'use client';

import Link from 'next/link';
import { useState } from 'react';

import { BrandTile, InfoRow, InfoRows, RowMenu, type RowMenuItem, RowTile, RowWarning } from '@/components/cms/rows';
import { ChevronRight, type IconComponent, Loader2, Trash2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
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

/** Health at a glance: the status colour, pulsing while there's something live to report. */
function PulseDot({ status }: { status: ConnectorStatus }) {
  const live = status.tone !== 'muted';
  return (
    <span className="relative flex size-2.5" title={status.text}>
      {live && (
        <span
          className={cn('absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping', DOT[status.tone])}
          aria-hidden="true"
        />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', DOT[status.tone])} aria-hidden="true" />
      <span className="sr-only">{status.text}</span>
    </span>
  );
}

/**
 * Every connection's manage page has the same shape, so they read as one
 * product: who or what it's connected to and whether it works, then its health
 * and what depends on it beside that connector's own settings. Rare actions —
 * set up again, disconnect — sit behind ⋯, and disconnecting says what stops.
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
  /** More for the sidebar, after Health and Used by — what the connection may do, say. */
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
            <SettingsTabBody
              narrowAside
              aside={
                <>
                  {health && (
                    <SettingsSection title="Health" alignActionsToTitle actions={status ? <PulseDot status={status} /> : undefined}>
                      <InfoRows>
                        {health.facts.map((fact) => (
                          <InfoRow key={fact.title} icon={fact.icon} title={fact.title} tone={fact.tone}>
                            <span className="truncate text-sm text-muted-foreground">{fact.value}</span>
                          </InfoRow>
                        ))}
                      </InfoRows>
                      {health.problem && <RowWarning className="mt-4">{health.problem}</RowWarning>}
                      {health.extra && <div className="mt-4">{health.extra}</div>}
                      {health.test && (
                        <div className="mt-4 space-y-2">
                          <Button
                            variant="outline"
                            className="h-9 w-full gap-1.5"
                            disabled={health.test.pending || health.test.disabled}
                            onClick={health.test.onTest}
                          >
                            {health.test.pending ? (
                              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            ) : (
                              <health.test.icon size={15} aria-hidden="true" />
                            )}
                            {health.test.label}
                          </Button>
                          {health.test.note && <p className="text-xs text-muted-foreground">{health.test.note}</p>}
                        </div>
                      )}
                    </SettingsSection>
                  )}
                  {usedBy.length > 0 && (
                    <SettingsSection title="Used by">
                      <div className="-mx-2 flex flex-col gap-0.5">
                        {usedBy.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <RowTile icon={item.icon} />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{item.label}</span>
                            {item.count !== undefined && (
                              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{item.count}</span>
                            )}
                            <ChevronRight
                              size={14}
                              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </Link>
                        ))}
                      </div>
                    </SettingsSection>
                  )}
                  {aside}
                </>
              }
            >
              {children}
            </SettingsTabBody>
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
