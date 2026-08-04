'use client';

import { useSyncExternalStore } from 'react';

import { Check, X } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

const TIP_ID = 'communications-setup';

interface Step {
  title: string;
  description: string;
  done: boolean;
  action?: { label: string; onClick: () => void };
}

/**
 * First-run orientation: the four things that have to be true before a customer
 * receives an email, in order, with a live tick on each. It disappears on its own
 * once every step is done, and can be dismissed early.
 */
export function SetupChecklist({
  emailConnected,
  hasTemplate,
  hasEnabledAutomation,
  hasDeliveries,
  canConfigure,
  onOpenConnection,
  onNewTemplate,
  onNewAutomation,
  onOpenHistory,
}: {
  emailConnected: boolean;
  hasTemplate: boolean;
  hasEnabledAutomation: boolean;
  hasDeliveries: boolean;
  canConfigure: boolean;
  onOpenConnection: () => void;
  onNewTemplate: () => void;
  onNewAutomation: () => void;
  onOpenHistory: () => void;
}) {
  const dismissedTips = useUiSettingsStore((state) => state.dismissedTips);
  const dismissTip = useUiSettingsStore((state) => state.dismissTip);
  // The store is persisted, so wait for the client before deciding to hide it.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const steps: Step[] = [
    {
      title: 'Connect your email account',
      description: canConfigure
        ? 'Emails are sent through your own mail provider.'
        : 'An owner or admin needs to do this once for the business.',
      done: emailConnected,
      ...(canConfigure ? { action: { label: 'Set up', onClick: onOpenConnection } } : {}),
    },
    {
      title: 'Write your first template',
      description: 'Design the reusable email content in your own brand style.',
      done: hasTemplate,
      action: { label: 'Create', onClick: onNewTemplate },
    },
    {
      title: 'Switch on an automation',
      description: 'Decides when the template is sent, like when an order is ready.',
      done: hasEnabledAutomation,
      action: { label: 'Create', onClick: onNewAutomation },
    },
    {
      title: 'Check what went out',
      description: 'History shows every email, who got it, and whether it worked.',
      done: hasDeliveries,
      action: { label: 'Open', onClick: onOpenHistory },
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  if (!mounted || doneCount === steps.length || dismissedTips.includes(TIP_ID)) return null;

  const nextStep = steps.findIndex((step) => !step.done);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-linear-to-br from-primary/8 via-card to-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Getting started</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">Four steps to your first automatic email</h2>
        </div>
        {/* Progress, then the dismiss — the count earns its place next to the bar. */}
        <div className="flex items-center gap-3 pr-8">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-offset" role="presentation">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {doneCount} of {steps.length}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => dismissTip(TIP_ID)}
        aria-label="Hide these setup steps"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X size={15} />
      </button>

      <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => {
          const isNext = index === nextStep;
          return (
            <li
              key={step.title}
              className={cn(
                'rounded-xl border bg-card p-4 transition-colors',
                step.done ? 'border-success/30' : isNext ? 'border-primary/45 shadow-sm' : 'border-border',
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    step.done
                      ? 'bg-success text-white'
                      : isNext
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-surface-offset text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {step.done ? <Check size={12} strokeWidth={3} /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className={cn('text-sm font-semibold', step.done ? 'text-muted-foreground' : 'text-foreground')}>{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                  {!step.done && step.action && (
                    <Button variant={isNext ? 'default' : 'outline'} size="sm" className="mt-2.5" onClick={step.action.onClick}>
                      {step.action.label}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
