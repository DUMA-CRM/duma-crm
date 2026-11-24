'use client';

import { BrandTile } from '@/components/shared/rows';
import { ListRow } from '@/components/shared/ListRow';
import { Bone } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { Badge } from '@/components/ui/badge';

import { CONNECTOR_BRANDS } from './brands';
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

const TILE_TONE: Partial<Record<ConnectorState, Tone>> = { attention: 'exception', connected: 'success' };

/**
 * One integration as a `ListRow`: its brand mark (or icon), the name over the
 * account it uses (or what it does, before it's set up), its status and the
 * single thing to do — the whole row is the target. A problem shows under the
 * account line, in red, and wraps rather than being cut off.
 */
export function ConnectorRow({
  definition,
  state,
  accounts = [],
  extraAccountCount = 0,
  alert,
  action,
  loading = false,
}: {
  definition: ConnectorDefinition;
  state: ConnectorState;
  accounts?: ConnectorAccount[];
  extraAccountCount?: number;
  /** What broke and what it means — shown only when it needs attention. */
  alert?: { title: string; detail?: string };
  action?: ConnectorAction;
  /** Its status is still being checked: a placeholder line, no badge yet. */
  loading?: boolean;
}) {
  const account = accounts[0];
  const subtitle = account
    ? [`${account.label}${extraAccountCount > 0 ? ` +${extraAccountCount}` : ''}`, account.meta].filter(Boolean).join(' · ')
    : definition.description;
  const badge = STATE_BADGE[state];
  const brand = CONNECTOR_BRANDS[definition.id];
  const enabled = action && !action.disabled;

  return (
    <ListRow
      leading={brand ? <BrandTile brand={brand} className="size-9" /> : undefined}
      icon={definition.icon}
      tone={TILE_TONE[state] ?? 'muted'}
      title={definition.name}
      muted={!definition.available}
      meta={
        loading ? (
          <Bone className="mt-1 block h-3 w-40 max-w-full" />
        ) : (
          <>
            <span className="block truncate">{subtitle}</span>
            {alert && (
              <span className="mt-0.5 block whitespace-normal font-medium text-exception">
                {alert.title}
                {alert.detail ? ` — ${alert.detail}` : ''}
              </span>
            )}
          </>
        )
      }
      trailing={
        <>
          {!loading && state !== 'disconnected' && <Badge variant={badge.variant}>{badge.label}</Badge>}
          {action && (
            <span className={`hidden text-xs font-medium sm:inline ${enabled ? 'text-primary' : 'text-muted-foreground'}`}>
              {action.label}
            </span>
          )}
        </>
      }
      onClick={enabled ? action.onClick : undefined}
      targetLabel={action ? `${action.label} — ${definition.name}` : undefined}
    />
  );
}
