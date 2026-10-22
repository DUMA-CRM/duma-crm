'use client';

import { RowTile } from '@/components/cms/rows';
import { ChevronRight } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

import { type ConnectorDefinition, type ConnectorState, STATE_BADGE } from './registry';

/** A connected account/device shown on the row. */
export interface ConnectorAccount {
  /** Primary line — the mailbox, reader name or device ID. */
  label: string;
  /** Secondary line — "Checked 2 min ago", the provider name, and so on. */
  meta?: string;
}

/** The one thing to do with a connector; the whole row does it. */
export interface ConnectorAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * One integration as a row, in the settings rows' rhythm: tile, name over the
 * account it uses (or what it does, before it's set up), its status, and the
 * single thing to do — the whole row is the button, the chevron says it goes
 * somewhere. A problem shows under the name, in red.
 */
export function ConnectorRow({
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
  extraAccountCount?: number;
  /** What broke and what it means — shown only when it needs attention. */
  alert?: { title: string; detail?: string };
  action?: ConnectorAction;
}) {
  const account = accounts[0];
  const subtitle = account
    ? [`${account.label}${extraAccountCount > 0 ? ` +${extraAccountCount}` : ''}`, account.meta].filter(Boolean).join(' · ')
    : definition.description;
  const badge = STATE_BADGE[state];

  return (
    <button
      type="button"
      onClick={action?.onClick}
      disabled={!action || action.disabled}
      className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-band/50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <RowTile icon={definition.icon} tone={state === 'attention' ? 'danger' : state === 'connected' ? 'success' : 'default'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{definition.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        {alert && (
          <span className="mt-0.5 block text-xs font-medium text-exception">
            {alert.title}
            {alert.detail ? ` — ${alert.detail}` : ''}
          </span>
        )}
      </span>
      {state !== 'disconnected' && <Badge variant={badge.variant}>{badge.label}</Badge>}
      {action && <span className="hidden shrink-0 text-xs font-medium text-primary sm:inline">{action.label}</span>}
      <ChevronRight size={14} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}
