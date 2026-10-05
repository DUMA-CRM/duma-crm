'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { ArrowLeft, Check, type IconComponent, Loader2, Lock } from '@/components/icons';
import { type Choice, ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';

const EASE = [0.16, 1, 0.3, 1] as const;
/** Long enough to see the card tick, short enough not to feel like waiting. */
const AUTO_ADVANCE_MS = 280;

export interface WizardStep {
  key: string;
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
 * What to have to hand before starting — shown under the first question, so
 * nobody gets three steps in and has to go hunting for a password.
 */
export function WizardRail({
  requirements,
  footnote,
}: {
  icon?: IconComponent;
  name?: string;
  tagline?: string;
  requirements: string[];
  footnote?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-rule/50 bg-background/60 px-4 py-3.5">
      {requirements.length > 0 && (
        <>
          <p className="text-label uppercase text-muted-foreground">Before you start</p>
          <ul className="mt-2 space-y-1.5">
            {requirements.map((requirement) => (
              <li key={requirement} className="flex gap-2 text-sm text-foreground">
                <Check size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                {requirement}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        Keys are encrypted when saved and never shown again.
      </p>
      {footnote && <p className="mt-1.5 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
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
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  /** Shown under the first question only. */
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
}) {
  const reduceMotion = useReducedMotion();
  const [position, setPosition] = useState({ index: 0, direction: 1 });
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const clamped = Math.min(position.index, steps.length - 1);
  const step = steps[clamped];
  const isLast = clamped === steps.length - 1;
  const locked = lockedFrom !== undefined && clamped >= lockedFrom;
  const canContinue = !busy && step.ready !== false;

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
      <div className="flex flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col px-5 py-10 sm:py-14">
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
              {clamped + 1} of {steps.length}
            </span>
          </div>

          <form
            className="relative mt-10 flex flex-1 flex-col"
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
                  <div className="mt-8">{step.content}</div>
                  {clamped === 0 && rail && <div className="mt-6">{rail}</div>}
                </motion.div>
              </AnimatePresence>
            </WizardContext.Provider>

            <div className="mt-12 flex items-center justify-between gap-4">
              {clamped > 0 && !locked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-11 gap-1.5 px-4 text-muted-foreground"
                  disabled={busy}
                  onClick={() => setPosition({ index: clamped - 1, direction: -1 })}
                >
                  <ArrowLeft aria-hidden="true" /> Back
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
                  {step.continueLabel ?? (isLast ? finishLabel : 'Continue')}
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
  options: { value: T; label: string; icon: IconComponent; hint?: string }[];
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
