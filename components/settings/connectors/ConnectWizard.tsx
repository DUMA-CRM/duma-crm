'use client';

import { useState } from 'react';

import { ArrowRight, Check, type IconComponent, Loader2, Lock } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

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

/**
 * Left rail of the connect wizard: what this connector is for and what you need
 * to hand before you start, so nobody gets three steps in and has to go hunting
 * for a password.
 */
export function WizardRail({
  icon: Icon,
  name,
  tagline,
  requirements,
  footnote,
}: {
  icon: IconComponent;
  name: string;
  tagline: string;
  requirements: string[];
  footnote?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-offset/40 p-6">
      {/* Faint graph paper, purely decorative — echoes the rest of the app's cards. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">Connector setup</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{tagline}</p>

        {requirements.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Before you start</p>
            <ul className="mt-3 space-y-2.5">
              {requirements.map((requirement) => (
                <li key={requirement} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                  <Check size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  {requirement}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex gap-2.5 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>Credentials are encrypted before they are stored and are never shown again — only replaced.</p>
        </div>

        {footnote && <div className="mt-5 border-t border-border pt-5 text-xs text-muted-foreground">{footnote}</div>}
      </div>
    </div>
  );
}

/**
 * A connector's setup, one decision per screen: pick the provider, then fill in
 * only the fields that provider actually needs, then prove it works. Each step
 * owns whether Continue is allowed, and a step can save on the way out so the
 * next screen has something real to test against.
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
  rail: React.ReactNode;
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
  const [index, setIndex] = useState(0);
  // How far you have legitimately reached — the dots above that stay locked, so
  // you cannot jump ahead of a step that still has to save something.
  const [furthest, setFurthest] = useState(0);
  const [busy, setBusy] = useState(false);

  const clamped = Math.min(index, steps.length - 1);
  const step = steps[clamped];
  const isLast = clamped === steps.length - 1;
  const locked = lockedFrom !== undefined && clamped >= lockedFrom;

  const goTo = (next: number) => {
    setIndex(next);
    setFurthest((current) => Math.max(current, next));
  };

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
    goTo(clamped + 1);
  }

  return (
    <EditorShell eyebrow={eyebrow} title={title} icon={icon} onClose={onClose} dirty={dirty} flush>
      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-4 md:p-8 lg:flex-row lg:gap-14">
          <aside className="shrink-0 lg:w-80">{rail}</aside>

          <div className="min-w-0 flex-1 lg:max-w-xl lg:py-6">
            {/* Progress: a wide pill for where you are, ticks for what is done. */}
            <ol className="flex items-center gap-2" aria-label={`Step ${clamped + 1} of ${steps.length}`}>
              {steps.map((item, itemIndex) => {
                const done = itemIndex < clamped;
                const active = itemIndex === clamped;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      disabled={itemIndex > furthest || busy || locked}
                      aria-current={active ? 'step' : undefined}
                      aria-label={`Step ${itemIndex + 1}: ${item.title}`}
                      onClick={() => setIndex(itemIndex)}
                      className={cn(
                        'h-2 rounded-full transition-all',
                        active ? 'w-8 bg-primary' : done ? 'w-2 bg-primary/40' : 'w-2 bg-muted',
                        !locked && done && 'hover:bg-primary/70',
                        (itemIndex > furthest || locked) && 'cursor-default',
                      )}
                    />
                  </li>
                );
              })}
            </ol>

            <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-primary">
              Step {clamped + 1} of {steps.length}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{step.title}</h2>
            {step.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>}

            <div className="mt-7">{step.content}</div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {clamped > 0 && !locked && (
                <Button variant="ghost" disabled={busy} onClick={() => setIndex(clamped - 1)}>
                  Back
                </Button>
              )}
              {step.skippable && (
                <Button variant="ghost" disabled={busy} onClick={() => void advance(false)}>
                  Skip for now
                </Button>
              )}
              <Button
                className="h-10 gap-2"
                disabled={busy || step.ready === false}
                onClick={() => void advance(true)}
                title={step.ready === false ? 'Fill in the fields above to continue' : undefined}
              >
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                {step.continueLabel ?? (isLast ? finishLabel : 'Continue')}
                {!busy && !isLast && <ArrowRight size={15} aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </EditorShell>
  );
}

/**
 * The provider grid used by the first step of every wizard — the same tile grid
 * as the reference design, one tap to pick who you are with.
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
  const selected = options.find((option) => option.value === value);
  return (
    <div>
      <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-colors',
                active ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-surface-offset/60',
              )}
            >
              <Icon size={22} aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{option.label}</span>
            </button>
          );
        })}
      </div>
      {selected?.hint && <p className="mt-3 text-sm text-primary">{selected.hint}</p>}
    </div>
  );
}
