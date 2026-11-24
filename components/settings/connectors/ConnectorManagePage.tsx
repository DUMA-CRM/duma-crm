'use client';

import { useState } from 'react';

import { BrandTile, RowMenu, type RowMenuItem, RowWarning } from '@/components/shared/rows';
import { Activity, type IconComponent, Loader2, Trash2 } from '@/components/icons';
import { ChangeRow } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

import type { ConnectorDefinition } from './registry';

export interface ConnectorStatus {
  tone: 'success' | 'warning' | 'danger' | 'muted';
  /** "Working", "The last message failed", "Paused — messages are skipped". */
  text: string;
}

export interface HealthFact {
  icon: IconComponent;
  title: string;
  value: React.ReactNode;
  tone?: 'warning' | 'danger';
}

export interface UsedByItem {
  icon: IconComponent;
  label: string;
  /** Shown only where the count is already known; otherwise the row is a plain link. */
  count?: number | string;
  href: string;
}

export interface ConnectorDisconnect {
  /** What stops working, one line each — the confirm lists them. */
  consequences: string[];
  /** Money or files are involved: the connector's name must be typed to confirm. */
  typeToConfirm?: boolean;
  label?: string;
  pending: boolean;
  onConfirm: () => void;
}

const DOT: Record<ConnectorStatus['tone'], string> = {
  success: 'bg-success',
  warning: 'bg-stock',
  danger: 'bg-exception',
  muted: 'bg-muted-foreground/60',
};

const FACT_TONE = { warning: 'text-measured', danger: 'text-exception' } as const;

/**
 * The manage page's body as a bento of two stacked columns, no rail: the
 * connector's own settings | its health, what uses it and anything else it
 * adds. With no settings of its own, Health sits beside the rest.
 */
function ManageBody({
  health,
  status,
  usedBy,
  aside,
  children,
}: {
  health?: React.ComponentProps<typeof ConnectorManagePage>['health'];
  status?: ConnectorStatus;
  usedBy: UsedByItem[];
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const healthSection = health && (
    <RecordGroup
      card
      id="connector-health"
      title="Health"
      actions={
        health.test && (
          <Button variant="outline" size="sm" disabled={health.test.pending || health.test.disabled} onClick={health.test.onTest}>
            {health.test.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <health.test.icon aria-hidden="true" />}
            {health.test.label}
          </Button>
        )
      }
      footnote={health.test?.note}
    >
      <div>
        {status && <ChangeRow icon={Activity} label="Status" value={<StatusValue status={status} />} />}
        {health.facts.map((fact) => (
          <ChangeRow
            key={fact.title}
            icon={fact.icon}
            label={fact.title}
            value={<span className={cn('truncate', fact.tone && FACT_TONE[fact.tone])}>{fact.value}</span>}
          />
        ))}
      </div>
      {health.problem && <RowWarning className="mt-4">{health.problem}</RowWarning>}
      {health.extra && <div className="mt-4">{health.extra}</div>}
    </RecordGroup>
  );
  const usedBySection = usedBy.length > 0 && (
    <RecordGroup id="connector-used-by" title="Used by">
      <ListRowGroup>
        {usedBy.map((item) => (
          <ListRow
            key={item.label}
            href={item.href}
            icon={item.icon}
            title={item.label}
            trailing={item.count !== undefined && <span className="text-sm tabular-nums text-muted-foreground">{item.count}</span>}
          />
        ))}
      </ListRowGroup>
    </RecordGroup>
  );
  const hasOwn = Boolean(children) && children !== false;
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5">{hasOwn ? children : healthSection}</div>
      <div className="flex min-w-0 flex-col gap-5">
        {hasOwn && healthSection}
        {usedBySection}
        {aside}
      </div>
    </div>
  );
}

/** The status in words, after a dot in its colour — pulsing while there's something live to report. */
function StatusValue({ status }: { status: ConnectorStatus }) {
  const live = status.tone !== 'muted';
  return (
    <>
      <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
        {live && (
          <span className={cn('absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping', DOT[status.tone])} />
        )}
        <span className={cn('relative inline-flex size-2.5 rounded-full', DOT[status.tone])} />
      </span>
      <span className="truncate">{status.text}</span>
    </>
  );
}

/**
 * Every connection's manage page has the same shape, so they read as one
 * product, in the Settings → Account layout: that connector's own settings |
 * its health (status and facts as read-only `ChangeRow`s) and what depends on
 * it (a `RecordGroup`). Rare actions — set up again, disconnect — sit behind ⋯,
 * and disconnecting says what stops.
 */
export function ConnectorManagePage({
  definition,
  brand,
  status,
  loading = false,
  error,
  notSetUp,
  health,
  usedBy = [],
  aside,
  actions = [],
  disconnect,
  dirty = false,
  onClose,
  children,
  footer,
}: {
  definition: ConnectorDefinition;
  /** The brand's mark in the page header, in place of the connector's icon. */
  brand?: { background: string; path: string };
  status?: ConnectorStatus;
  loading?: boolean;
  error?: { title: string; onRetry: () => void };
  /** Shown instead of the body before anything is connected. */
  notSetUp?: React.ReactNode;
  health?: {
    facts: HealthFact[];
    test?: { label: string; icon: IconComponent; pending: boolean; disabled?: boolean; note?: string; onTest: () => void };
    /** The last error, in words — shown at the foot of Health. */
    problem?: string | null;
    /** A connector's own test controls, in place of the one button (email takes a recipient). */
    extra?: React.ReactNode;
  };
  usedBy?: UsedByItem[];
  /** More after Health and Used by — what the connection may do, say. */
  aside?: React.ReactNode;
  actions?: RowMenuItem[];
  disconnect?: ConnectorDisconnect;
  dirty?: boolean;
  onClose: () => void;
  /** That connector's own settings sections. */
  children?: React.ReactNode;
  /** The SaveBar, when the page edits a draft. */
  footer?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const Icon = definition.icon;
  const menu: RowMenuItem[] = [
    ...actions,
    ...(disconnect
      ? [{ icon: Trash2, label: disconnect.label ?? 'Disconnect', danger: true, onClick: () => setConfirming(true) } satisfies RowMenuItem]
      : []),
  ];

  return (
    <EditorShell
      eyebrow="Connection"
      title={definition.name}
      icon={<Icon size={20} aria-hidden="true" />}
      leading={brand ? <BrandTile brand={brand} className="size-9" /> : undefined}
      onClose={onClose}
      dirty={dirty}
      actions={menu.length && !notSetUp ? <RowMenu label={`${definition.name} actions`} items={menu} /> : null}
    >
      {error ? (
        <ErrorState title={error.title} onRetry={error.onRetry} />
      ) : (
        <div className="flex flex-col gap-6">
          {loading ? (
            <Bone className="h-72 w-full rounded-lg" />
          ) : notSetUp ? (
            notSetUp
          ) : (
            <ManageBody health={health} status={status} usedBy={usedBy} aside={aside}>
              {children}
            </ManageBody>
          )}
        </div>
      )}

      {footer}

      {confirming && disconnect && (
        <ConfirmModal
          title={`Disconnect ${definition.name}?`}
          message={
            <div className="space-y-2">
              <p>This will happen straight away:</p>
              <ul className="list-disc space-y-1 pl-5">
                {disconnect.consequences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          }
          confirmText={disconnect.typeToConfirm ? definition.name : undefined}
          confirmLabel={disconnect.label ?? 'Disconnect'}
          pendingLabel="Disconnecting…"
          isPending={disconnect.pending}
          onClose={() => setConfirming(false)}
          onConfirm={disconnect.onConfirm}
        />
      )}
    </EditorShell>
  );
}
