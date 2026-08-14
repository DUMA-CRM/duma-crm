import type { AuditLog } from '../api/audit.service.ts';

import { auditSubject, shortId } from './change.ts';
import { actionVerb } from './vocabulary.ts';

/**
 * Collapses the many entries one record collects into a single row.
 *
 * An order is created, moved twice, refunded and cancelled: five audit rows for
 * one thing that happened to one order. Read flat, the list is mostly repetition
 * and the shape of the record's life is invisible. Grouped, each record gets one
 * row carrying its own history, and the page stops being a firehose.
 *
 * The grouping is **within the loaded page only** — the API pages by time, so
 * entries for the same record can straddle a page boundary and no client-side
 * grouping can see them. Callers must say so rather than implying the group is
 * a complete history; the inspector's "everything on this record" pivot is the
 * thing that actually answers that, because it re-queries the server.
 */

export type AuditSeverityRank = 'ok' | 'destructive' | 'refused' | 'failed';

const SEVERITY_ORDER: AuditSeverityRank[] = ['ok', 'destructive', 'refused', 'failed'];

export interface AuditGroup {
  /** Stable key for React and for expansion state. */
  key: string;
  /** Newest first, matching the API's own ordering. */
  entries: AuditLog[];
  /** The entry that decides the row's sentence, glyph and time. */
  latest: AuditLog;
  /** Distinct actor names in the group, newest first. */
  actors: string[];
  /** Distinct verbs, newest first — "cancelled, refunded, moved". */
  verbs: string[];
  /** Worst severity anywhere in the group, so a failure can't hide inside one. */
  severity: AuditSeverityRank;
  /** Human name for the record, or a short ID, or null when it has neither. */
  record: string | null;
  /** True when the record's name was resolved rather than falling back to an ID. */
  named: boolean;
  /** Oldest entry's timestamp, for the "over N minutes" reading. */
  earliestAt: string;
}

function worst(a: AuditSeverityRank, b: AuditSeverityRank): AuditSeverityRank {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/**
 * @param severityOf injected so this module stays free of React and of the icon
 *   layer, and can be unit-tested on its own.
 */
export function groupAuditLogs(logs: readonly AuditLog[], severityOf: (log: AuditLog) => AuditSeverityRank, enabled = true): AuditGroup[] {
  const groups: AuditGroup[] = [];
  const byKey = new Map<string, AuditGroup>();

  for (const log of logs) {
    // No record ID means nothing to group by — and grouping off means every
    // entry keeps its own row, which is what a strict chronological read wants.
    const groupable = enabled && !!log.resourceId;
    const key = groupable ? `${log.resourceType}::${log.resourceId}` : `entry::${log.id}`;
    const existing = groupable ? byKey.get(key) : undefined;

    if (existing) {
      existing.entries.push(log);
      existing.severity = worst(existing.severity, severityOf(log));
      existing.earliestAt = log.createdAt;
      const actor = log.userName || log.userEmail || 'System';
      if (!existing.actors.includes(actor)) existing.actors.push(actor);
      const verb = actionVerb(log.action, log.resourceType);
      if (!existing.verbs.includes(verb)) existing.verbs.push(verb);
      continue;
    }

    const subject = auditSubject(log);
    const group: AuditGroup = {
      key,
      entries: [log],
      latest: log,
      actors: [log.userName || log.userEmail || 'System'],
      verbs: [actionVerb(log.action, log.resourceType)],
      severity: severityOf(log),
      record: subject ?? (log.resourceId ? shortId(log.resourceId) : null),
      named: !!subject,
      earliestAt: log.createdAt,
    };
    groups.push(group);
    if (groupable) byKey.set(key, group);
  }

  return groups;
}

/** "cancelled, refunded and 2 more" — the shape of a record's day in one line. */
export function summariseVerbs(verbs: readonly string[]): string {
  if (verbs.length <= 2) return verbs.join(' and ');
  return `${verbs.slice(0, 2).join(', ')} and ${verbs.length - 2} more`;
}

/** "Sam Reed and 2 others" — who touched this record. */
export function summariseActors(actors: readonly string[]): string {
  if (actors.length === 1) return actors[0];
  if (actors.length === 2) return `${actors[0]} and 1 other`;
  return `${actors[0]} and ${actors.length - 1} others`;
}
