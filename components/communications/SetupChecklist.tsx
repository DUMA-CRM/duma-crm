'use client';

import { Check, CircleDashed, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';

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
      description: 'The email itself — start from a ready-made one and change the wording.',
      done: hasTemplate,
      action: { label: 'Create', onClick: onNewTemplate },
    },
    {
      title: 'Switch on an automation',
      description: 'Decides when the template is sent, like when an order is ready.',
      done: hasEnabledAutomation,
      action: { label: 'Choose', onClick: onNewAutomation },
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
    <section className="relative rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <button
        type="button"
        onClick={() => dismissTip(TIP_ID)}
        aria-label="Hide these setup steps"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X size={15} />
      </button>

      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Getting started · {doneCount} of {steps.length} done</p>
      <h2 className="mt-1 text-base font-semibold text-foreground">Four steps to your first automatic email</h2>

      <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              'rounded-xl border bg-card p-4',
              step.done ? 'border-success/30' : index === nextStep ? 'border-primary/40' : 'border-border',
            )}
          >
            <div className="flex items-start gap-2">
              {step.done ? (
                <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleDashed size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className={cn('text-sm font-semibold', step.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                  {index + 1}. {step.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                {!step.done && step.action && (
                  <Button variant="outline" size="sm" className="mt-2.5" onClick={step.action.onClick}>
                    {step.action.label}
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
