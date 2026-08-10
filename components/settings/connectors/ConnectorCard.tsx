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
        'rounded-lg border border-rule/65 bg-card p-4 transition-colors',
        state === 'attention' && 'border-destructive/35 bg-destructive/5',
        state === 'unavailable' && 'opacity-70',
      )}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)_auto] md:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-md bg-band',
              state === 'attention' ? 'text-destructive' : state === 'connected' ? 'text-success' : 'text-primary',
            )}
          >
            <Icon size={17} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{definition.name}</h3>
              <Badge variant={badge.variant} className="shrink-0">
                {badge.label}
              </Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{definition.description}</p>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {definition.tags.slice(0, 4).map((tag) => (
                <li key={tag} className="text-xs text-muted-foreground before:mr-1.5 before:text-rule before:content-['•']">
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="min-w-0">
          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.label} className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{account.label}</p>
                    {account.meta && <p className="truncate text-xs text-muted-foreground">{account.meta}</p>}
                  </div>
                  {account.busy && <Loader2 size={15} className="shrink-0 animate-spin text-primary" aria-label="Checking" />}
                </div>
              ))}
              {extraAccountCount > 0 && <p className="text-xs text-muted-foreground">And {extraAccountCount} more at this location</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No account connected yet.</p>
          )}

          {alert && (
            <div className="mt-2 flex items-start gap-2 text-destructive">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                {alert.detail && <p className="text-xs text-destructive/80">{alert.detail}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="md:justify-self-end">
          {action ? (
            <Button
              variant={action.variant ?? 'default'}
              disabled={action.disabled}
              onClick={action.onClick}
              className="w-full gap-2 md:w-auto"
            >
              {ActionIcon && <ActionIcon size={15} aria-hidden="true" />}
              {action.label}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Not available yet</p>
          )}
        </div>
      </div>
    </article>
  );
}
