/**
 * Bucketing a guest's timeline for display: one group per workspace calendar day,
 * newest first, each carrying what was spent that day, plus per-kind counts for
 * the filter chips. Pure, with `now` passed in, so "Today" is testable.
 */
import { formatInstant, workspaceDateKey, zonedParts } from './workspace-time.ts';

export type TimelineKindName = 'order' | 'points' | 'email' | 'consent' | 'privacy';

export interface TimelineItem {
  kind: TimelineKindName;
  at: string;
  status?: string;
  total?: string;
  refundStatus?: string;
}

export interface TimelineDay<T extends TimelineItem> {
  /** `YYYY-MM-DD`, in the workspace zone. */
  key: string;
  label: string;
  /** Sum of the day's orders that still stand — cancelled and fully refunded ones don't count. */
  spend: number;
  orders: number;
  entries: T[];
}

const VOID_STATUSES = new Set(['cancelled', 'canceled', 'void', 'voided']);

/** The calendar day before a `YYYY-MM-DD` key. */
const dayBefore = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

/** "Today", "Yesterday", "Mon 28 Sep" this year, "28 Sep 2025" before it. */
export function timelineDayLabel(at: Date, now: Date): string {
  const day = zonedParts(at);
  const today = zonedParts(now);
  if (day.date === today.date) return 'Today';
  if (day.date === dayBefore(today.date)) return 'Yesterday';
  return day.year === today.year
    ? formatInstant(at, { weekday: 'short', day: 'numeric', month: 'short' })
    : formatInstant(at, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** An order that counts towards what they spent. */
export function orderStands(entry: TimelineItem): boolean {
  return entry.kind === 'order' && !VOID_STATUSES.has(entry.status ?? '') && entry.refundStatus !== 'full';
}

/** Preserves arrival order (the API sends newest first) while bucketing by day. */
export function groupTimelineByDay<T extends TimelineItem>(entries: T[], now: Date): TimelineDay<T>[] {
  const days = new Map<string, TimelineDay<T>>();
  for (const entry of entries) {
    const at = new Date(entry.at);
    const key = workspaceDateKey(at);
    let day = days.get(key);
    if (!day) {
      day = { key, label: timelineDayLabel(at, now), spend: 0, orders: 0, entries: [] };
      days.set(key, day);
    }
    day.entries.push(entry);
    if (orderStands(entry)) {
      day.orders += 1;
      day.spend += Number(entry.total ?? 0) || 0;
    }
  }
  return [...days.values()];
}

export function countTimelineKinds(entries: TimelineItem[]): Record<TimelineKindName, number> {
  const counts: Record<TimelineKindName, number> = { order: 0, points: 0, email: 0, consent: 0, privacy: 0 };
  for (const entry of entries) counts[entry.kind] += 1;
  return counts;
}

// ── Row copy ────────────────────────────────────────────────────────────────

export interface TimelineRowSource extends TimelineItem {
  source?: string;
  delta?: number;
  balanceAfter?: number;
  reason?: string | null;
  subject?: string;
  toEmail?: string;
  trigger?: string;
  action?: string;
  type?: string;
  dueAt?: string;
  points?: { delta: number; balanceAfter: number } | null;
  loyalty?: { delta: number; unitSingular: string; unitPlural: string; programName: string; source: string }[];
}

export type RowPillTone = 'warning' | 'exception';

export interface TimelineRowText {
  /** Bold, first — the audit log's actor position: the amount, or the thing itself. */
  lead: string;
  /** The rest of the sentence. */
  phrase: string;
  /** The muted second line. */
  detail: string;
  /** Only when something went differently — success says nothing, as in the audit log. */
  pill?: { label: string; tone: RowPillTone };
}

const humanise = (value: string | undefined) => (value ?? '').replaceAll('_', ' ');
const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const CHANNEL: Record<string, string> = { pos: 'at the till', qr_code: 'by QR code' };

function signed(delta: number, singular: string, plural: string) {
  const amount = Math.abs(delta);
  return `${delta >= 0 ? '+' : '−'}${amount.toLocaleString('en-GB')} ${amount === 1 ? singular : plural}`;
}

/**
 * One timeline entry as an audit-log row: a bold lead, the phrase after it, a
 * detail line, and a pill only when it went wrong. `money` formats in the
 * workspace currency; it is passed in to keep this pure.
 */
export function timelineRowText(entry: TimelineRowSource, money: (amount: number) => string, now: number): TimelineRowText {
  switch (entry.kind) {
    case 'order': {
      const movements = [
        ...(entry.points ? [`${signed(entry.points.delta, 'point', 'points')}`] : []),
        ...(entry.loyalty ?? []).map(
          (movement) =>
            `${signed(movement.delta, movement.unitSingular, movement.unitPlural)}${movement.source === 'redemption' ? ' redeemed' : ''} · ${movement.programName}`,
        ),
      ];
      const voided = VOID_STATUSES.has(entry.status ?? '');
      return {
        lead: money(Number(entry.total ?? 0) || 0),
        phrase: `order ${CHANNEL[entry.source ?? ''] ?? 'on mobile'}`,
        detail: [capitalise(humanise(entry.status) || 'order'), ...movements].join(' · '),
        pill: voided
          ? { label: 'Cancelled', tone: 'exception' }
          : entry.refundStatus === 'full'
            ? { label: 'Refunded', tone: 'exception' }
            : entry.refundStatus && entry.refundStatus !== 'none'
              ? { label: 'Part refunded', tone: 'warning' }
              : undefined,
      };
    }
    case 'points': {
      const delta = entry.delta ?? 0;
      return {
        lead: signed(delta, 'point', 'points'),
        phrase: delta >= 0 ? 'added' : 'removed',
        detail: [entry.reason || 'No reason recorded', `balance ${(entry.balanceAfter ?? 0).toLocaleString('en-GB')}`].join(' · '),
      };
    }
    case 'email':
      return {
        lead: entry.subject || 'Email',
        phrase: entry.status === 'sent' ? 'sent' : entry.status === 'failed' ? 'not sent' : humanise(entry.status),
        detail: [entry.toEmail, entry.trigger ? capitalise(humanise(entry.trigger)) : null].filter(Boolean).join(' · '),
        pill: entry.status === 'failed' ? { label: 'Failed', tone: 'exception' } : undefined,
      };
    case 'consent':
      return {
        lead: entry.action === 'opted_in' ? 'Opted in' : entry.action === 'opted_out' ? 'Opted out' : 'Suppressed',
        phrase: entry.action === 'suppressed' ? '— nothing may be sent' : 'to marketing',
        detail: [capitalise(humanise(entry.source)), entry.reason].filter(Boolean).join(' · '),
      };
    case 'privacy': {
      const open = entry.status !== 'completed' && entry.status !== 'declined';
      const overdue = open && entry.dueAt !== undefined && Date.parse(entry.dueAt) < now;
      return {
        lead: `${capitalise(humanise(entry.type) || 'Privacy')} request`,
        phrase: 'received',
        detail: capitalise(humanise(entry.status)),
        pill: overdue ? { label: 'Overdue', tone: 'exception' } : undefined,
      };
    }
  }
}
