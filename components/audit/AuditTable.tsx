'use client';

import { ChevronDown } from '@/components/icons';
import { DataTable, type DataTableColumn, type DataTablePagination } from '@/components/ui/data-table';

import type { AuditLog } from '@/lib/api/audit.service';
import { type AuditGroup, summariseActors, summariseVerbs } from '@/lib/audit/groups';
import {
  type AuditStatus,
  auditActor,
  auditDomain,
  auditRole,
  auditSentence,
  auditSeverity,
  auditStatus,
  relativeTime,
  resourceLabel,
  severityClass,
  stampLabel,
} from '@/lib/audit/narrative';
import { cn } from '@/lib/utils/cn';

import { AuditGlyph, auditIcon } from './AuditGlyph';

/** Stable DOM id per entry so keyboard navigation can move real focus. */
export function auditRowId(logId: string) {
  return `audit-entry-${logId}`;
}

// ── Cells ─────────────────────────────────────────────────────────────────────

/** Same boxed-annotation construction as `Badge`: role hairline, role wash, role ink. */
const STATUS_TONE: Record<AuditStatus['tone'], string> = {
  success: 'border-momentum/30 bg-momentum/8 text-momentum',
  warning: 'border-measured/40 bg-measured/8 text-measured',
  exception: 'border-exception/30 bg-exception/8 text-exception',
};

function SeverityCell({ log }: { log: AuditLog }) {
  const status = auditStatus(auditSeverity(log), log.statusCode);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-1.5 py-px text-micro font-semibold tracking-micro uppercase',
        STATUS_TONE[status.tone],
      )}
      title={log.statusCode == null ? undefined : `HTTP ${log.statusCode}`}
    >
      {status.label}
    </span>
  );
}

function WhenCell({ iso, now }: { iso: string; now: number }) {
  return (
    <div className="text-right">
      <p className="font-mono text-xs tabular-nums tracking-figure whitespace-nowrap text-foreground">{stampLabel(iso, now)}</p>
      <p className="mt-0.5 text-label whitespace-nowrap text-muted-foreground">{relativeTime(iso, now)}</p>
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

/**
 * The audit ledger, on the same `DataTable` every other list in the product
 * uses — same columns, same density, same sticky header, same footer paging.
 *
 * A row is a *record*, not an event: the five entries an order collects collapse
 * into one line that opens to show them. Entries with no record ID, and every
 * entry when grouping is off, are groups of one and render identically.
 */
export function AuditTable({
  groups,
  now,
  selectedId,
  expandedKeys,
  onToggleGroup,
  onSelect,
  isLoading,
  emptyState,
  pagination,
}: {
  groups: AuditGroup[];
  now: number;
  selectedId: string | null;
  expandedKeys: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  onSelect: (log: AuditLog) => void;
  isLoading: boolean;
  emptyState: React.ReactNode;
  pagination?: DataTablePagination;
}) {
  const columns: DataTableColumn<AuditGroup>[] = [
    {
      id: 'activity',
      header: 'Activity',
      minWidth: 260,
      cell: ({ row: group }) => {
        const many = group.entries.length > 1;
        const expanded = expandedKeys.has(group.key);
        const { phrase } = auditSentence(group.latest);
        const severity = auditSeverity(group.latest);

        return (
          <div className="flex items-center gap-2.5">
            <AuditGlyph
              icon={auditIcon(group.latest, severity)}
              size={16}
              className={cn(
                'size-9',
                severityClass(group.severity === 'ok' ? severity : group.severity, auditDomain(group.latest.resourceType)),
              )}
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">
                {many ? (
                  <>
                    <span className="font-semibold">{group.entries.length} changes</span>{' '}
                    <span className="text-muted-foreground">— {summariseVerbs(group.verbs)}</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{auditActor(group.latest)}</span> {phrase}
                  </>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground lg:hidden">
                {many ? summariseActors(group.actors) : (auditRole(group.latest) ?? 'Role not recorded')}
              </p>
            </div>
            {many && (
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={cn('ml-auto shrink-0 text-muted-foreground transition-transform duration-150', expanded && 'rotate-180')}
              />
            )}
          </div>
        );
      },
    },
    {
      id: 'actor',
      header: 'Actor',
      visibility: 'lg',
      minWidth: 150,
      wrap: 'truncate',
      cell: ({ row: group }) =>
        group.entries.length > 1 ? (
          <span className="text-sm text-foreground">{summariseActors(group.actors)}</span>
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{auditActor(group.latest)}</p>
            {/* Role is an audit fact — "Barista deleted a supplier" is the line
                an auditor is scanning for — so it never leaves the list. */}
            <p className="truncate text-xs text-muted-foreground">{auditRole(group.latest) ?? 'Role not recorded'}</p>
          </div>
        ),
    },
    {
      id: 'record',
      header: 'Record',
      visibility: 'md',
      minWidth: 150,
      wrap: 'truncate',
      cell: ({ row: group }) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{resourceLabel(group.latest.resourceType)}</p>
          {group.record && (
            <p
              className={cn('truncate text-xs text-muted-foreground', !group.named && 'font-mono tracking-figure')}
              title={group.latest.resourceId ?? undefined}
            >
              {group.record}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 'fit',
      cell: ({ row: group }) => <SeverityCell log={group.latest} />,
    },
    {
      id: 'when',
      header: 'When',
      align: 'right',
      width: 'fit',
      cell: ({ row: group }) => <WhenCell iso={group.latest.createdAt} now={now} />,
    },
  ];

  return (
    <DataTable
      aria-label="Audit entries"
      data={groups}
      columns={columns}
      getRowKey={(group) => group.key}
      isLoading={isLoading}
      loadingRows={12}
      density="compact"
      stickyHeader
      minWidth={720}
      emptyState={emptyState}
      onRowClick={({ row: group }) => (group.entries.length > 1 ? onToggleGroup(group.key) : onSelect(group.latest))}
      rowAriaLabel={({ row: group }) =>
        group.entries.length > 1
          ? `${group.entries.length} changes to ${group.record ?? resourceLabel(group.latest.resourceType)}`
          : `${auditActor(group.latest)} ${auditSentence(group.latest).phrase}`
      }
      rowClassName={({ row: group }) =>
        cn(
          'scroll-mt-12',
          group.entries.length === 1 && group.latest.id === selectedId && 'bg-band',
          expandedKeys.has(group.key) && 'bg-band/50',
        )
      }
      renderAfterRow={({ row: group }) => {
        if (group.entries.length < 2 || !expandedKeys.has(group.key)) return null;
        return group.entries.map((entry) => {
          const { phrase } = auditSentence(entry);
          return (
            <tr
              key={entry.id}
              id={auditRowId(entry.id)}
              tabIndex={-1}
              onClick={() => onSelect(entry)}
              aria-label={`${auditActor(entry)} ${phrase}`}
              className={cn(
                'cursor-pointer border-b border-rule/45 transition-colors duration-150',
                entry.id === selectedId ? 'bg-band' : 'bg-band/25 hover:bg-band/60',
              )}
            >
              {/* The nested entries of one record — indented under the row they belong to. */}
              <td className="px-3 py-2">
                <p className="truncate pl-6 text-sm text-foreground">
                  <span className="font-semibold">{auditActor(entry)}</span> {phrase}
                </p>
              </td>
              <td className="hidden px-3 py-2 lg:table-cell">
                <p className="truncate text-xs text-muted-foreground">{auditRole(entry) ?? 'Role not recorded'}</p>
              </td>
              <td className="hidden px-3 py-2 md:table-cell" />
              <td className="px-3 py-2">
                <SeverityCell log={entry} />
              </td>
              <td className="px-3 py-2">
                <WhenCell iso={entry.createdAt} now={now} />
              </td>
            </tr>
          );
        });
      }}
      pagination={pagination}
    />
  );
}
