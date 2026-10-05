import type { AuditGroup, AuditLog } from '../api/audit.service.ts';

import { auditSubject, shortId } from './change.ts';
import { auditPhrase } from './narrative.ts';
import { actionVerb, resourceMeta } from './vocabulary.ts';

/**
 * Reading the API's audit groups (`GET /audit-logs/groups`).
 *
 * The grouping itself moved to the server: one row per person, per record, per
 * local day, computed over the whole filtered range. Grouping in the browser
 * could only see the page it had loaded, so a record's history was cut at every
 * page boundary and the same order could appear on three pages. What stays
 * here is wording — pure, so it is tested without React.
 */

export function groupActor(group: AuditGroup): string {
  return group.actor.name || group.actor.email || 'System';
}

/** The record's readable name, or a short ID, or null when it has neither. */
export function groupRecord(group: AuditGroup): { label: string; named: boolean } | null {
  const subject = group.latest ? auditSubject(group.latest) : null;
  if (subject) return { label: subject, named: true };
  return group.resourceId ? { label: shortId(group.resourceId), named: false } : null;
}

/**
 * The row's sentence after the actor's name. One entry reads as itself
 * ("refunded order #1042"); several read as what they add up to
 * ("made 4 changes to order #1042"), with the verbs underneath.
 */
export function groupPhrase(group: AuditGroup): string {
  if (group.count === 1 && group.latest) return auditPhrase(group.latest);
  const meta = resourceMeta(group.resourceType);
  const record = groupRecord(group);
  const changes = `${group.count} ${group.count === 1 ? 'change' : 'changes'}`;
  if (!record) return `made ${changes} to ${meta.plural.toLowerCase()}`;
  return record.named
    ? `made ${changes} to ${meta.noun} ${record.label}`
    : `made ${changes} to ${/^[aeiou]/i.test(meta.noun) ? 'an' : 'a'} ${meta.noun}`;
}

/** "refunded, updated and 1 more" — what the changes were, newest first. */
export function groupVerbs(group: AuditGroup): string {
  const verbs = group.actions.map((action) => actionVerb(action, group.resourceType));
  return summariseVerbs(verbs.filter((verb, index) => verbs.indexOf(verb) === index));
}

/** "cancelled, refunded and 2 more" — the shape of a record's day in one line. */
export function summariseVerbs(verbs: readonly string[]): string {
  if (verbs.length <= 2) return verbs.join(' and ');
  return `${verbs.slice(0, 2).join(', ')} and ${verbs.length - 2} more`;
}

const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

/** "09:12" for a moment, "09:12–11:40" for a span. */
export function groupTimeSpan(group: Pick<AuditGroup, 'firstAt' | 'lastAt'>): string {
  const [start, end] = [group.firstAt, group.lastAt].sort();
  const first = CLOCK.format(new Date(start));
  const last = CLOCK.format(new Date(end));
  return first === last ? last : `${first}–${last}`;
}

const DAY_HEADING = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export const localDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** "Today", "Yesterday", "Monday 22 September" — the year only when it isn't this one. */
export function dayHeading(day: string, now: number): string {
  const today = new Date(now);
  if (day === localDayKey(today)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDayKey(yesterday)) return 'Yesterday';
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(year, month - 1, date);
  if (Number.isNaN(value.getTime())) return day;
  // Appended by hand: en-GB puts a comma after the weekday once a year is in the format.
  return year === today.getFullYear() ? DAY_HEADING.format(value) : `${DAY_HEADING.format(value)} ${year}`;
}

/**
 * Pages from "Load more", flattened. The log is live, so new activity shifts
 * everything down between fetches and a group can arrive twice — the first
 * (newest) copy wins.
 */
export function mergeGroupPages(pages: readonly { data: readonly AuditGroup[] }[]): AuditGroup[] {
  const seen = new Set<string>();
  const merged: AuditGroup[] = [];
  for (const page of pages) {
    for (const group of page.data) {
      if (seen.has(group.key)) continue;
      seen.add(group.key);
      merged.push(group);
    }
  }
  return merged;
}

/** Consecutive groups under their day, order kept — the API already sorts newest first. */
export function groupsByDay(groups: readonly AuditGroup[]): { day: string; groups: AuditGroup[] }[] {
  const days: { day: string; groups: AuditGroup[] }[] = [];
  for (const group of groups) {
    const last = days[days.length - 1];
    if (last && last.day === group.day) last.groups.push(group);
    else days.push({ day: group.day, groups: [group] });
  }
  return days;
}

/** Entries of an opened group, newest first, whatever order they arrive in. */
export function sortNewestFirst(entries: readonly AuditLog[]): AuditLog[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Fallback while the API lacks /audit-logs/groups ───────────────────────────

const SEVERITY_ORDER: AuditGroup['severity'][] = ['ok', 'destructive', 'refused', 'failed'];

/** The calendar day an instant falls on in `timeZone`, as `YYYY-MM-DD`. */
export function dayIn(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    new Date(iso),
  );
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * The server's grouping (one row per person, per record, per local day),
 * rebuilt in the browser over the entries of one page. Only used when the API
 * predates `GET /audit-logs/groups`: it can't see past the page it was given,
 * which is exactly the limitation the endpoint exists to remove.
 *
 * @param severityOf injected so this module stays free of the narrative rules' callers.
 */
export function groupEntriesLocally(
  entries: readonly AuditLog[],
  timeZone: string,
  severityOf: (entry: AuditLog) => AuditGroup['severity'],
): AuditGroup[] {
  const groups = new Map<string, AuditGroup>();
  for (const entry of sortNewestFirst(entries)) {
    const day = dayIn(entry.createdAt, timeZone);
    const key = [day, entry.userId || entry.userEmail || 'system', entry.resourceType, entry.resourceId || `entry:${entry.id}`].join('|');
    const severity = severityOf(entry);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.firstAt = entry.createdAt;
      existing.entryIds.push(entry.id);
      if (!existing.actions.includes(entry.action)) existing.actions.push(entry.action);
      if (severity === 'failed') existing.failedCount += 1;
      if (severity === 'refused') existing.refusedCount += 1;
      if (SEVERITY_ORDER.indexOf(severity) > SEVERITY_ORDER.indexOf(existing.severity)) existing.severity = severity;
      continue;
    }
    groups.set(key, {
      key,
      day,
      actor: { userId: entry.userId, name: entry.userName ?? null, email: entry.userEmail ?? null, role: entry.userRole ?? null },
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      count: 1,
      firstAt: entry.createdAt,
      lastAt: entry.createdAt,
      actions: [entry.action],
      severity,
      failedCount: severity === 'failed' ? 1 : 0,
      refusedCount: severity === 'refused' ? 1 : 0,
      entryIds: [entry.id],
      latest: entry,
    });
  }
  return [...groups.values()];
}

/** The fallback's search: the entry's own words, since the old API has no `q`. */
export function entryMatches(entry: AuditLog, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.userName, entry.userEmail, entry.action, entry.resourceType, entry.resourceId, entry.metadata].some((value) =>
    value?.toLowerCase().includes(needle),
  );
}
