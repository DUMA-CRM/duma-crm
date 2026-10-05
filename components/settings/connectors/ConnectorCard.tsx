'use client';

import { motion, useReducedMotion } from 'motion/react';

import { AlertCircle, type IconComponent, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

import { type ConnectorDefinition, type ConnectorState, STATE_BADGE } from './registry';

/** A connected account/device shown on the card. */
export interface ConnectorAccount {
  /** Primary line — the mailbox, reader name or device ID. */
  label: string;
  /** Secondary line — "Checked 2 min ago", the provider name, and so on. */
  meta?: string;
  /** Spins a loader while a check is running. */
  busy?: boolean;
}

export interface ConnectorAction {
  label: string;
  icon?: IconComponent;
  onClick: () => void;
  variant?: 'default' | 'outline';
  disabled?: boolean;
}

const DOT: Record<ConnectorState, string> = {
  connected: 'bg-success',
  attention: 'bg-exception',
  paused: 'bg-stock',
  disconnected: 'bg-muted-foreground/50',
  unavailable: 'bg-muted-foreground/40',
};

/**
 * One integration as a tile: what it is and whether it works at the top, one
 * line on what it does, then the account it uses and the single thing to do.
 * The action sits on the bottom edge so a row of tiles lines its buttons up.
 */
export function ConnectorCard({
  definition,
  state,
  accounts = [],
  extraAccountCount = 0,
  alert,
  action,
  index = 0,
}: {
  definition: ConnectorDefinition;
  state: ConnectorState;
  accounts?: ConnectorAccount[];
  extraAccountCount?: number;
  /** What broke and what it means — shown only when it needs attention. */
  alert?: { title: string; detail?: string };
  action?: ConnectorAction;
  index?: number;
}) {
  const reduceMotion = useReducedMotion();
  const Icon = definition.icon;
  const ActionIcon = action?.icon;
  const live = state === 'connected' || state === 'paused';
  const account = accounts[0];

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex h-full flex-col rounded-lg border bg-field p-4',
        state === 'attention' ? 'border-exception/40' : 'border-rule/60',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-lg',
            state === 'attention' ? 'bg-exception/8 text-exception' : live ? 'bg-primary/8 text-primary' : 'bg-band text-muted-foreground',
          )}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{definition.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', DOT[state])} aria-hidden="true" />
            {STATE_BADGE[state].label}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{definition.description}</p>

      {alert && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-exception/6 px-3 py-2 text-sm text-exception" role="status">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium">{alert.title}</span>
            {alert.detail && <span className="block text-xs text-exception/80">{alert.detail}</span>}
          </span>
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 pt-4">
        <div className="min-w-0 flex-1">
          {account ? (
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {account.busy && <Loader2 size={12} className="shrink-0 animate-spin" aria-label="Checking" />}
              <span className="truncate font-medium text-foreground">{account.label}</span>
              {extraAccountCount > 0 && <span className="shrink-0">+{extraAccountCount}</span>}
            </p>
          ) : null}
          {account?.meta && <p className="truncate text-xs text-muted-foreground">{account.meta}</p>}
        </div>
        {action && (
          <Button variant={action.variant ?? 'default'} size="sm" disabled={action.disabled} onClick={action.onClick} className="shrink-0">
            {ActionIcon && <ActionIcon aria-hidden="true" />}
            {action.label}
          </Button>
        )}
      </div>
    </motion.article>
  );
}
