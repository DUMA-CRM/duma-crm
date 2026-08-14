import type { AuditLog } from '../api/audit.service.ts';

import { auditSubject, shortId } from './change.ts';
import { type AuditDomain, actionPhrase, resourceMeta } from './vocabulary.ts';

export type { AuditDomain } from './vocabulary.ts';
export { actionFilterLabel, resourceMeta } from './vocabulary.ts';

/**
 * Turns an audit record into a sentence.
 *
 * Deliberately free of React and of the icon library: the AI agent's
 * `get_audit_activity` tool runs this on the server so the model reads the same
 * sentences an auditor does, rather than the raw `orders.status_update` keys.
 *
 * An audit row answers three questions in this order: who (and in what role),
 * what, and did it work. The stored row is a database fact — `orders.cancel`,
 * `orders`, a UUID — and an auditor reading fifty of them should never have to
 * translate. The vocabulary itself lives in `vocabulary.ts`, keyed on the
 * strings the API really writes.
 */

// ── Domains ───────────────────────────────────────────────────────────────────

/** Full class strings so Tailwind's scanner can see every variant it must build. */
const DOMAIN_CLASS: Record<AuditDomain, string> = {
  orders: 'bg-measured/8 text-measured',
  stock: 'bg-stock/8 text-stock',
  team: 'bg-momentum/8 text-momentum',
  reference: 'bg-reference/8 text-reference',
};

const EXCEPTION_CLASS = 'bg-exception/8 text-exception';

export function auditDomain(resourceType: string): AuditDomain {
  return resourceMeta(resourceType).domain;
}

// ── Severity ──────────────────────────────────────────────────────────────────

export type AuditSeverity = 'ok' | 'destructive' | 'refused' | 'failed';

/**
 * Deletions and cancellations are not failures, but an auditor scanning for
 * problems wants them to stand out just as much — so they get the exception
 * ink and their own glyph while keeping an honest label of their own.
 */
const DESTRUCTIVE = /delete|remove|cancel|void|revoke|purge|disable|deactivate|refund|eras|offboard/i;

export function auditSeverity(log: AuditLog): AuditSeverity {
  const code = log.statusCode;
  if (code != null && code >= 500) return 'failed';
  if (code != null && code >= 400) return 'refused';
  if (DESTRUCTIVE.test(log.action)) return 'destructive';
  return 'ok';
}

/**
 * The chip on a row — words, not a number. An auditor needs "Denied"; the code
 * behind it is a support fact and lives in the technical detail.
 */
export function severityLabel(severity: AuditSeverity, code?: number | null): string | null {
  if (severity === 'failed') return 'Failed';
  if (severity === 'refused') {
    if (code === 401 || code === 403) return 'Denied';
    if (code === 404) return 'Not found';
    if (code === 409) return 'Conflicted';
    return 'Rejected';
  }
  return null;
}

export function severityClass(severity: AuditSeverity, domain: AuditDomain): string {
  return severity === 'ok' ? DOMAIN_CLASS[domain] : EXCEPTION_CLASS;
}

/** Whether this entry counts toward the "needs a look" tally above the stream. */
export function isFlagged(severity: AuditSeverity): boolean {
  return severity === 'failed' || severity === 'refused';
}

// ── Sentences ─────────────────────────────────────────────────────────────────

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  franchise_owner: 'Franchise Owner',
  store_manager: 'Store Manager',
  barista: 'Barista',
  hr_manager: 'HR Manager',
  marketing_manager: 'Marketing',
  auditor: 'Auditor',
};

/** The subject. Unattributed calls say so rather than showing a dash. */
export function auditActor(log: AuditLog): string {
  return log.userName || log.userEmail || 'System';
}

export function auditRole(log: AuditLog): string | null {
  if (!log.userRole) return null;
  return ROLE_LABEL[log.userRole] ?? log.userRole;
}

/**
 * The predicate. Names the record where the payload gave up a readable label,
 * and stays indefinite where it didn't — a UUID in a sentence is worse than no
 * identifier at all.
 */
export function auditPhrase(log: AuditLog): string {
  return actionPhrase(log.action, log.resourceType, auditSubject(log));
}

/**
 * The row's sentence, plus the short ID to print after it when the payload gave
 * up no readable name.
 *
 * Without this a row reads "Sam Reed cancelled an order" and two different
 * orders are indistinguishable in the list. The ID is returned separately, and
 * never spliced into the sentence, so it is styled as an identifier rather than
 * read as the record's name.
 */
export function auditSentence(log: AuditLog): { phrase: string; recordId: string | null } {
  const subject = auditSubject(log);
  return {
    phrase: actionPhrase(log.action, log.resourceType, subject),
    recordId: subject || !log.resourceId ? null : shortId(log.resourceId),
  };
}

export function resourceLabel(resourceType: string): string {
  return resourceMeta(resourceType).plural;
}

// ── Time ──────────────────────────────────────────────────────────────────────

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const FULL_FORMAT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Seconds are load-bearing in an audit log — two entries a second apart are a sequence. */
export function timeOfDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : TIME_FORMAT.format(date);
}

export function fullTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : FULL_FORMAT.format(date);
}

/** Local calendar day, used to group the stream. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayLabel(iso: string, now: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Undated';
  if (dayKey(iso) === dayKey(new Date(now).toISOString())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday';
  return DAY_FORMAT.format(date);
}

/**
 * The stamp for a table row: the day only when it isn't obvious from context.
 * Replaces the day-separator headers the bespoke list used, so the ledger can
 * live in the shared DataTable like every other list in the product.
 */
export function stampLabel(iso: string, now: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = dayLabel(iso, now);
  const time = timeOfDay(iso).slice(0, 5);
  return day === 'Today' ? time : `${day} ${time}`;
}

export function relativeTime(iso: string, now: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function formatDuration(ms?: number | null): string | null {
  if (ms == null) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}
