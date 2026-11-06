'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { ArrowLeft, type IconComponent, Loader2, Lock } from '@/components/icons';
import { ChalkCurve } from '@/components/marketing/Strokes';
import { type Choice, ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/label';

import type { ConnectorRequirement } from './registry';

const EASE = [0.16, 1, 0.3, 1] as const;
/** Long enough to see the card tick, short enough not to feel like waiting. */
const AUTO_ADVANCE_MS = 280;

export interface WizardStep {
  key: string;
  /** Short name for the step list and the Back / Continue buttons ("Bot token"). Defaults to the title. */
  label?: string;
  title: string;
  description?: string;
  content: React.ReactNode;
  /** Continue stays disabled until this is true. Defaults to true. */
  ready?: boolean;
  continueLabel?: string;
  /** Runs before advancing — return false to stay put (e.g. a save failed). */
  onContinue?: () => boolean | Promise<boolean>;
  /** Adds "Skip for now", which advances without running `onContinue`. */
  skippable?: boolean;
}

/** Lets a step's content move the wizard on — a single-choice answer does, like onboarding. */
const WizardContext = createContext<{ next: () => void } | null>(null);

/**
 * What to have to hand before starting, as tiles under the first question —
 * so nobody gets three steps in and has to go hunting for a password.
 */
export function WizardRail({
  requirements,
  footnote,
  note,
  children,
}: {
  icon?: IconComponent;
  name?: string;
  tagline?: string;
  requirements: ConnectorRequirement[];
  footnote?: React.ReactNode;
  /** Where what's entered is kept, when that matters to know. */
  note?: React.ReactNode;
  /** The step's instruction, full width under the tiles, in the same group. */
  children?: React.ReactNode;
}) {
  if (!requirements.length && !note && !footnote && !children) return null;
  return (
    <div>
      {requirements.length > 0 && (
        <>
          <FieldLabel as="span">You need</FieldLabel>
          <ol className="mt-1.5 space-y-2">
            {requirements.map((requirement, index) => {
              const { label, hint } = typeof requirement === 'string' ? { label: requirement, hint: undefined } : requirement;
              return (
                <li key={label} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-foreground">{label}</span>
                    {hint && <span className="text-muted-foreground"> · {hint}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          {children && <div className="mt-3">{children}</div>}
        </>
      )}
      {note && (
        <p className="mt-3 flex gap-1.5 text-xs text-muted-foreground">
          <Lock size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {note}
        </p>
      )}
      {footnote && <p className="mt-1.5 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}

/** The one thing to do in a step — an icon and a line, with any command set as code (`Command`). */
export function WizardInstruction({ icon: Icon, children }: { icon: IconComponent; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon size={16} aria-hidden="true" />
      </span>
      <p className="text-sm text-foreground">{children}</p>
    </div>
  );
}

/** A command to type, such as /newbot, set apart from the sentence around it. */
export function Command({ children }: { children: React.ReactNode }) {
  return <code className="mx-0.5 rounded bg-band/70 p-0.5 font-mono text-[0.8125rem] text-foreground ring-1 ring-rule/50">{children}</code>;
}

/**
 * A connector's setup in the onboarding shape: one question per screen, a
 * progress bar, the step sliding in from the side you are heading, Back and
 * Continue at the foot, Enter to go on. Each step owns whether Continue is
 * allowed, and a step can save on the way out so the next screen has something
 * real to test against.
 */
export function ConnectWizard({
  eyebrow,
  title,
  icon,
  rail,
  steps,
  onClose,
  onFinish,
  finishLabel = 'Done',
  dirty = false,
  lockedFrom,
  initialIndex = 0,
  resumeKey,
  onStartOver,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  /** "You need", at the foot of the first step only. */
  rail?: React.ReactNode;
  steps: WizardStep[];
  onClose: () => void;
  /** Called after the last step's `onContinue` succeeds. */
  onFinish: () => void;
  finishLabel?: string;
  dirty?: boolean;
  /**
   * Index from which going back is no longer offered. Use it when an earlier
   * step did something that cannot be repeated — creating a record rather than
   * updating one — so re-running it would leave a duplicate behind.
   */
  lockedFrom?: number;
  /** The step to open on — after a reload that kept what was entered. */
  initialIndex?: number;
  /**
   * Remember the step on this browser, so leaving and coming back picks up
   * where you were. The connector keeps its own fields (never its secrets).
   */
  resumeKey?: string | null;
  /** "Start over" on a resumed setup: clear the connector's kept fields. */
  onStartOver?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [position, setPosition] = useState({ index: initialIndex, direction: 1 });
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const stepKey = resumeKey ? `duma-connect-step:${resumeKey}` : null;
  const [resumed, setResumed] = useState(false);
  // Restored after mount, so the server and first client render agree.
  useEffect(() => {
    if (!stepKey) return;
    try {
      const stored = Number(localStorage.getItem(stepKey));
      if (stored > 0) {
        setPosition({ index: stored, direction: 1 });
        setResumed(true);
      }
    } catch {
      // No storage: start at the beginning.
    }
  }, [stepKey]);

  const clamped = Math.min(position.index, steps.length - 1);
  const step = steps[clamped];
  const isLast = clamped === steps.length - 1;
  const locked = lockedFrom !== undefined && clamped >= lockedFrom;
  const canContinue = !busy && step.ready !== false;

  useEffect(() => {
    if (!stepKey) return;
    try {
      localStorage.setItem(stepKey, String(clamped));
    } catch {
      // Not remembered; nothing else depends on it.
    }
  }, [stepKey, clamped]);
  const labelOf = (item: WizardStep) => item.label ?? item.title;
  const go = (index: number) => setPosition({ index, direction: index > clamped ? 1 : -1 });

  // The heading takes focus on each step, unless the step focused its own field.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus({ preventScroll: true });
  }, [clamped]);

  async function advance(runStep: boolean) {
    if (runStep && step.onContinue) {
      setBusy(true);
      let ok = false;
      try {
        ok = await step.onContinue();
      } finally {
        setBusy(false);
      }
      if (!ok) return;
    }
    if (isLast) {
      if (stepKey)
        try {
          localStorage.removeItem(stepKey);
        } catch {
          // Nothing kept to clear.
        }
      onFinish();
      return;
    }
    setPosition({ index: clamped + 1, direction: 1 });
  }

  const context = {
    // Deferred a beat so the chosen card visibly ticks before the step moves.
    next: () => window.setTimeout(() => void advance(true), reduceMotion ? 0 : AUTO_ADVANCE_MS),
  };

  return (
    <EditorShell eyebrow={eyebrow} title={title} icon={icon} onClose={onClose} dirty={dirty} flush>
      {/* The website's chalk curves behind the setup. ChalkCurve draws in --mkt-chalk,
          which only the marketing site defines, so the colour is set here for both themes. */}
      <div className="relative flex flex-1 overflow-auto [--mkt-chalk:#e6e0d6] dark:[--mkt-chalk:#2a2724]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <ChalkCurve side="left" id="connect-left" className="absolute top-0 -left-8 hidden w-[34rem] md:block" />
          <ChalkCurve side="right" id="connect-right" className="absolute top-40 -right-40 hidden w-[44rem] md:block" />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl flex-col px-5 py-10 sm:py-14">
          {/* Progress: one segment per step, filled up to where you are. */}
          <div className="flex items-center gap-4">
            <div
              className="grid flex-1 gap-1.5"
              style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-valuenow={clamped + 1}
              aria-label="Setup progress"
            >
              {steps.map((item, itemIndex) => (
                <div key={item.key} className="h-1 overflow-hidden rounded-full bg-band">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{ width: itemIndex <= clamped ? '100%' : '0%' }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: EASE }}
                  />
                </div>
              ))}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {clamped + 1} of {steps.length} · {labelOf(step)}
            </span>
          </div>
          {resumed && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" role="status">
              Picked up where you left off.
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  onStartOver?.();
                  setResumed(false);
                  go(0);
                }}
              >
                Start over
              </button>
            </p>
          )}

          <form
            className="relative mt-8 flex flex-1 flex-col"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (canContinue) void advance(true);
            }}
          >
            <WizardContext.Provider value={context}>
              <AnimatePresence mode="popLayout" custom={position.direction} initial={false}>
                <motion.div
                  key={step.key}
                  custom={position.direction}
                  variants={{
                    enter: (dir: number) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * 28, filter: 'blur(3px)' }),
                    center: { opacity: 1, x: 0, filter: 'blur(0px)' },
                    exit: (dir: number) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * -28, filter: 'blur(3px)' }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: EASE }}
                >
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-2xl font-semibold leading-tight tracking-headline text-foreground outline-none sm:text-3xl"
                  >
                    {step.title}
                  </h2>
                  {step.description && <p className="mt-2 max-w-[56ch] text-sm leading-6 text-muted-foreground">{step.description}</p>}
                  {/* The step's content, then — on the first step — what you need, apart from it. */}
                  <div className="mt-6 flex flex-col gap-6">
                    {step.content}
                    {clamped === 0 && rail}
                  </div>
                </motion.div>
              </AnimatePresence>
            </WizardContext.Provider>

            <div className="mt-10 flex items-center justify-between gap-4">
              {clamped > 0 && !locked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-11 gap-1.5 px-4 text-muted-foreground"
                  disabled={busy}
                  onClick={() => go(clamped - 1)}
                >
                  <ArrowLeft aria-hidden="true" /> Back to {labelOf(steps[clamped - 1])}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {step.skippable && (
                  <Button type="button" variant="ghost" size="lg" className="h-11 px-4" disabled={busy} onClick={() => void advance(false)}>
                    Skip for now
                  </Button>
                )}
                <Button type="submit" size="lg" className="h-11 min-w-36 gap-2 px-5" disabled={!canContinue}>
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {step.continueLabel ?? (isLast ? finishLabel : `Continue to ${labelOf(steps[clamped + 1])}`)}
                  {!busy && (
                    <kbd
                      aria-hidden="true"
                      className="hidden rounded border border-primary-foreground/30 px-1 font-mono text-micro sm:inline"
                    >
                      ↵
                    </kbd>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </EditorShell>
  );
}

/**
 * The provider question on the first step: the onboarding answer cards, and a
 * pick moves you on — the same feel as setting up the workspace.
 */
export function ProviderGrid<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; icon: IconComponent; hint?: string; brand?: Choice<T>['brand'] }[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const wizard = useContext(WizardContext);
  const choices: Choice<T>[] = options.map((option) => ({
    value: option.value,
    label: option.label,
    detail: option.hint,
    icon: option.icon,
    brand: option.brand,
  }));
  return (
    <ChoiceGrid<T>
      label={ariaLabel}
      choices={choices}
      selected={value ? [value] : []}
      onChange={(next) => {
        onChange(next);
        wizard?.next();
      }}
    />
  );
}
