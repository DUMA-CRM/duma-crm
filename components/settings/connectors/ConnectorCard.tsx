'use client';

import { AlertCircle, type IconComponent, Loader2 } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

import { type ConnectorDefinition, type ConnectorState, STATE_BADGE } from './registry';

/** A connected account/device shown in the card's detail box. */
export interface ConnectorAccount {
  /** Primary line — the mailbox, reader name or device ID. */
  label: string;
  /** Secondary line — "Checked 2 min ago", the provider name, and so on. */
  meta?: string;
  /** Spins a loader in place of the tick while a check is running. */
  busy?: boolean;
}

export interface ConnectorAction {
  label: string;
  icon?: IconComponent;
  onClick: () => void;
  variant?: 'default' | 'outline';
  disabled?: boolean;
}

/**
 * One integration, told top to bottom: what it is and whether it works, what it
 * can do, which account it is using, then the single thing to do about it. The
 * action always sits on the bottom edge so a row of cards lines its buttons up
 * however much copy each one carries.
 */
export function ConnectorCard({
  definition,
  state,
  accounts = [],
  extraAccountCount = 0,
  alert,
  action,
}: {
  definition: ConnectorDefinition;
  state: ConnectorState;
  accounts?: ConnectorAccount[];
  /** Rendered as a "+3" chip beside the first account, like the reference design. */
  extraAccountCount?: number;
  /** Red status line above the action — what broke and what it means. */
  alert?: { title: string; detail?: string };
  action?: ConnectorAction;
}) {
  const Icon = definition.icon;
  const badge = STATE_BADGE[state];
  const ActionIcon = action?.icon;

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl border border-border bg-muted/40 p-1.5 transition-colors',
        state === 'attention' && 'border-destructive/30 bg-destructive/5',
        state === 'unavailable' && 'opacity-70',
      )}
    >
      <header className="flex items-center gap-2.5 px-3.5 py-3">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg bg-card',
            state === 'attention' ? 'text-destructive' : 'text-primary',
          )}
        >
          <Icon size={17} aria-hidden="true" />
        </div>
        <h3 className="truncate text-base font-semibold text-foreground">{definition.name}</h3>
        <Badge variant={badge.variant} className="shrink-0 uppercase tracking-wide">
          {badge.label}
        </Badge>
      </header>

      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card shadow-sm p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{definition.description}</p>

        <ul className="mt-3.5 flex flex-wrap gap-1.5">
          {definition.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              {tag}
            </li>
          ))}
        </ul>

        {/* Everything below is pinned to the bottom so the buttons align across a row. */}
        <div className="mt-auto space-y-3 pt-5">
          {accounts.length > 0 && (
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                {accounts.map((account) => (
                  <div key={account.label} className="flex items-center gap-2 rounded-xl bg-surface-offset/60 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{account.label}</p>
                      {account.meta && <p className="truncate text-xs text-muted-foreground">{account.meta}</p>}
                    </div>
                    {account.busy && <Loader2 size={15} className="shrink-0 animate-spin text-primary" aria-label="Checking" />}
                  </div>
                ))}
              </div>
              {extraAccountCount > 0 && (
                <div
                  className="flex w-12 shrink-0 items-center justify-center rounded-xl bg-surface-offset/60 text-sm font-semibold text-muted-foreground tabular-nums"
                  title={`${extraAccountCount} more`}
                >
                  +{extraAccountCount}
                </div>
              )}
            </div>
          )}

          {alert && (
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                {alert.detail && <p className="text-xs text-destructive/80">{alert.detail}</p>}
              </div>
            </div>
          )}

          {action ? (
            <Button variant={action.variant ?? 'default'} disabled={action.disabled} onClick={action.onClick} className="h-10 w-full gap-2">
              {ActionIcon && <ActionIcon size={15} aria-hidden="true" />}
              {action.label}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Nothing to set up yet — we’ll switch this on when it’s ready.</p>
          )}
        </div>
      </div>
    </article>
  );
}
