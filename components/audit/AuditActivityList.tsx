'use client';

import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { ChevronDown } from '@/components/icons';
import { LoadMore } from '@/components/shared/LoadMore';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone } from '@/components/shared/Skeleton';
import { TONE_TINT } from '@/components/shared/tone';

import {
  dayHeading,
  groupActor,
  groupPhrase,
  groupRecord,
  groupTimeSpan,
  groupVerbs,
  groupsByDay,
  localDayKey,
  sortNewestFirst,
} from '@/lib/audit/groups';
import { ROLE_LABEL, auditDomain, auditPhrase, auditSeverity, auditStatus, severityClass, timeOfDay } from '@/lib/audit/narrative';
import { type AuditGroup, type AuditLog, getAuditLogs } from '@/lib/modules/audit/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';

import { AuditGlyph, auditIcon } from './AuditGlyph';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Only what went differently — success is the default and says nothing. */
function AuditStatusPill({ severity, code }: { severity: AuditGroup['severity']; code?: number | null }) {
  if (severity === 'ok') return null;
  const status = auditStatus(severity, code);
  return <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', TONE_TINT[status.tone])}>{status.label}</span>;
}

/**
 * The audit log as the API groups it: under each day, one row per person per
 * record. A row of one entry opens it; a row of several unfolds to list them,
 * fetched on demand by id so the list itself stays light.
 */
export function AuditActivityList({
  groups,
  now,
  selectedId,
  expandedKey,
  onToggle,
  onSelect,
  hasMore,
  loadingMore,
  onLoadMore,
  total,
}: {
  groups: AuditGroup[];
  now: number;
  selectedId: string | null;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onSelect: (entry: AuditLog) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Null when the count isn't a count of groups (the fallback path). */
  total: number | null;
}) {
  return (
    <div className="space-y-6">
      {groupsByDay(groups).map((day) => (
        <section key={day.day} aria-labelledby={`audit-day-${day.day}`}>
          <h2 id={`audit-day-${day.day}`} className="mb-2 px-1 text-sm font-semibold text-foreground">
            {dayHeading(day.day, now)}
          </h2>
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {day.groups.map((group) => (
              <GroupRow
                key={group.key}
                group={group}
                selectedId={selectedId}
                expanded={expandedKey === group.key}
                today={day.day === localDayKey(new Date(now))}
                onToggle={() => onToggle(group.key)}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </section>
      ))}

      <LoadMore hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
      {total !== null && !hasMore && groups.length > 0 && (
        <p className="pb-2 text-center text-xs text-muted-foreground">That’s everything</p>
      )}
    </div>
  );
}

function GroupRow({
  group,
  selectedId,
  expanded,
  today,
  onToggle,
  onSelect,
}: {
  group: AuditGroup;
  selectedId: string | null;
  expanded: boolean;
  /** Today's rows read as a distance ("12m ago"); older days keep the clock. */
  today: boolean;
  onToggle: () => void;
  onSelect: (entry: AuditLog) => void;
}) {
  const latest = group.latest;
  const many = group.count > 1;
  const record = groupRecord(group);
  const role = group.actor.role ? (ROLE_LABEL[group.actor.role] ?? group.actor.role) : null;
  const glyphSeverity = group.severity === 'ok' && latest ? auditSeverity(latest) : group.severity;
  const detail = [role, many ? groupVerbs(group) : record && !record.named ? record.label : null].filter(Boolean).join(' · ');
  const selected = !many && latest?.id === selectedId;

  return (
    <li className="border-b border-rule/45 last:border-b-0">
      <button
        type="button"
        onClick={() => (many ? onToggle() : latest && onSelect(latest))}
        aria-expanded={many ? expanded : undefined}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          selected ? 'bg-band' : expanded ? 'bg-band/50' : 'hover:bg-band/40',
        )}
      >
        {latest ? (
          <AuditGlyph
            icon={auditIcon(latest, glyphSeverity)}
            size={16}
            className={cn('size-9 rounded-md', severityClass(glyphSeverity, auditDomain(group.resourceType)))}
          />
        ) : (
          <span className="size-9 shrink-0 rounded-md bg-band" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">
            <span className="font-semibold">{groupActor(group)}</span> {groupPhrase(group)}
          </span>
          {detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
        <AuditStatusPill severity={group.severity} code={latest?.statusCode} />
        {today ? (
          <RelativeTime iso={group.lastAt} className="shrink-0 text-xs tabular-nums text-muted-foreground" />
        ) : (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{groupTimeSpan(group)}</span>
        )}
        {many && (
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn('shrink-0 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {many && expanded && <GroupEntries group={group} selectedId={selectedId} onSelect={onSelect} />}
      </AnimatePresence>
    </li>
  );
}

/** The entries inside a group, loaded when it is opened. */
function GroupEntries({
  group,
  selectedId,
  onSelect,
}: {
  group: AuditGroup;
  selectedId: string | null;
  onSelect: (entry: AuditLog) => void;
}) {
  const reduceMotion = useReducedMotion();
  const entries = useQuery({
    queryKey: moduleQueryKeys.audit.key('audit-group-entries', group.key, group.entryIds.join(',')),
    queryFn: () => getAuditLogs({ ids: group.entryIds, limit: group.entryIds.length }),
    // Filtered again here: an API that predates `ids` would return everything.
    select: (response) => sortNewestFirst(response.data.filter((entry) => group.entryIds.includes(entry.id))),
    staleTime: 60_000,
  });

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
      className="overflow-hidden bg-band/25"
    >
      {entries.isPending ? (
        <div className="py-1" role="status" aria-busy="true" aria-label={`Loading ${group.count} entries`}>
          {Array.from({ length: Math.min(group.entryIds.length, 4) || 1 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 py-2 pl-15 pr-3.5" aria-hidden="true">
              <Bone className={cn('h-3.5', index % 2 === 0 ? 'w-56' : 'w-40', 'max-w-full')} />
              <Bone className="ml-auto h-3 w-10 shrink-0" />
            </div>
          ))}
        </div>
      ) : entries.isError ? (
        <p className="px-3.5 py-3 pl-15 text-xs text-exception">
          Couldn’t load these entries.{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void entries.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <ol className="py-1">
          {entries.data.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className={cn(
                  'flex w-full items-center gap-3 py-2 pl-15 pr-3.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  entry.id === selectedId ? 'bg-band' : 'hover:bg-band/60',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-foreground">{auditPhrase(entry)}</span>
                <AuditStatusPill severity={auditSeverity(entry)} code={entry.statusCode} />
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeOfDay(entry.createdAt)}</span>
              </button>
            </li>
          ))}
          {group.count > group.entryIds.length && (
            <li className="py-2 pl-15 pr-3.5 text-xs text-muted-foreground">
              Showing the latest {group.entryIds.length} of {group.count}. Open one and choose “This record” to see them all.
            </li>
          )}
        </ol>
      )}
    </motion.div>
  );
}
