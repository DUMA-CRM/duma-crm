// ---------------------------------------------------------------------------
// What the employee record should put in front of a manager first.
//
// The record used to open on all six compliance checks at once, each with a
// badge — so a complete record spent its most valuable space showing six green
// "Ready" pills. This decides what actually needs someone, in the same shape
// My HR and the staff overview use.
//
// Pure, so the rules about somebody's employment can be tested without a
// browser. → UI-ADR-007
// ---------------------------------------------------------------------------
import type { HelpdeskTicket } from '@/lib/modules/people/client';
import type { ComplianceCheck } from '@/lib/utils/employee-compliance';

export type RecordAttentionSeverity = 'blocking' | 'attention' | 'info';

export interface RecordAttentionItem {
  id: string;
  severity: RecordAttentionSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  /** Which part of the record resolves it. */
  target: 'edit' | 'documents' | 'access' | 'requests' | 'pay';
}

/**
 * A completed check says nothing, so it contributes no row.
 *
 * `destructive` is reserved in `employeeSetupChecks` for the two things that
 * carry legal exposure — expired right-to-work evidence, and a rate below the
 * age-based National Minimum Wage — so it maps to `blocking` rather than
 * merely urgent.
 */
const TONE_SEVERITY: Record<ComplianceCheck['tone'], RecordAttentionSeverity | null> = {
  destructive: 'blocking',
  warning: 'attention',
  muted: 'info',
  success: null,
};

/** Where each check is fixed. A check with nowhere to go is not actionable. */
const CHECK_TARGET: Record<string, RecordAttentionItem['target']> = {
  profile: 'edit',
  'right-to-work': 'documents',
  contract: 'documents',
  pay: 'edit',
  statutory: 'edit',
  access: 'access',
};

const ACTION_LABEL: Record<RecordAttentionItem['target'], string> = {
  edit: 'Edit details',
  documents: 'Open documents',
  access: 'Review access',
  requests: 'Open requests',
  pay: 'Open pay',
};

/** A ticket left this long without a reply has been forgotten. */
export const TICKET_STALE_DAYS = 7;

const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);

/** This employee's tickets, newest first — the managed queue has no user filter. */
export const ticketsForEmployee = (tickets: HelpdeskTicket[], userId: string): HelpdeskTicket[] =>
  tickets.filter((ticket) => ticket.createdBy === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const openTicketsFor = (tickets: HelpdeskTicket[]): HelpdeskTicket[] =>
  tickets.filter((ticket) => ticket.status !== 'resolved' && ticket.status !== 'closed');

export interface RecordAttentionInput {
  now: Date;
  checks?: ComplianceCheck[];
  /** Already narrowed to this employee. */
  tickets?: HelpdeskTicket[];
}

/**
 * Build the record's attention list, worst first.
 *
 * Every input is optional because the panel is assembled per capability: a
 * reader without `hr.documents:read` never fetches documents, and a row about
 * them must be absent rather than reassuring.
 */
export function buildRecordAttention({ now, checks, tickets }: RecordAttentionInput): RecordAttentionItem[] {
  const items: RecordAttentionItem[] = [];

  for (const check of checks ?? []) {
    if (check.complete) continue;
    const severity = TONE_SEVERITY[check.tone];
    if (!severity) continue;
    const target = CHECK_TARGET[check.id] ?? 'edit';
    items.push({
      id: `check-${check.id}`,
      severity,
      title: check.label,
      detail: check.detail,
      actionLabel: ACTION_LABEL[target],
      target,
    });
  }

  const open = tickets ? openTicketsFor(tickets) : [];

  // A request the employee has to answer is blocking *them*, and a manager
  // looking at the record is the person who can unblock it.
  const waiting = open.filter((ticket) => ticket.status === 'waiting_employee');
  if (waiting.length) {
    items.push({
      id: 'tickets-waiting-employee',
      severity: 'attention',
      title: `${waiting.length === 1 ? 'A request is' : `${waiting.length} requests are`} waiting on this employee`,
      detail: waiting[0].subject,
      actionLabel: ACTION_LABEL.requests,
      target: 'requests',
    });
  }

  const stale = open.filter((ticket) => ticket.status !== 'waiting_employee' && daysSince(ticket.createdAt, now) >= TICKET_STALE_DAYS);
  if (stale.length) {
    items.push({
      id: 'tickets-stale',
      severity: 'attention',
      title: `${stale.length} ${stale.length === 1 ? 'request has' : 'requests have'} been open over a week`,
      detail: stale[0].subject,
      actionLabel: ACTION_LABEL.requests,
      target: 'requests',
    });
  }

  const ORDER: Record<RecordAttentionSeverity, number> = { blocking: 0, attention: 1, info: 2 };
  return items.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

/**
 * How long someone has worked here, in the words a manager would say it:
 * "3 weeks", "7 months", "2 yrs 4 mos". Whole calendar months, so a start on
 * the 31st does not skip February. `null` for a start date that has not
 * happened yet — an employee who starts next week has no service to show.
 */
export function lengthOfService(startDate: string, now: Date): string | null {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (start > today) return null;

  let months = (today.getUTCFullYear() - start.getUTCFullYear()) * 12 + (today.getUTCMonth() - start.getUTCMonth());
  if (today.getUTCDate() < start.getUTCDate()) months -= 1;

  if (months < 1) {
    const days = Math.round((today.getTime() - start.getTime()) / 86_400_000);
    if (days < 7) return days === 0 ? 'Started today' : `${days} ${days === 1 ? 'day' : 'days'}`;
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} ${rest === 1 ? 'month' : 'months'}`;
  const y = `${years} ${years === 1 ? 'yr' : 'yrs'}`;
  return rest === 0 ? y : `${y} ${rest} ${rest === 1 ? 'mo' : 'mos'}`;
}

// Lives with the checks that also name it; re-exported for the record's screens.
export { statutoryIdLabel } from './employee-compliance.ts';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Working days (1 = Monday … 7 = Sunday) the way a rota says them: a run of
 * three or more collapses to a range ("Mon–Fri"), anything else is listed
 * ("Mon, Tue, Thu, Fri"). Every day is "Every day"; none is `null`.
 */
export function workingDaysLabel(days: readonly number[]): string | null {
  const sorted = [...new Set(days)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 7) return 'Every day';
  const runs: number[][] = [];
  for (const day of sorted) {
    const last = runs.at(-1);
    if (last && day === last[last.length - 1] + 1) last.push(day);
    else runs.push([day]);
  }
  return runs
    .flatMap((run) =>
      run.length >= 3 ? [`${DAY_SHORT[run[0] - 1]}–${DAY_SHORT[run[run.length - 1] - 1]}`] : run.map((day) => DAY_SHORT[day - 1]),
    )
    .join(', ');
}

/**
 * What the record's Requests panel lists: open ones first (a reply the
 * employee is waiting on before one they are not), then the most recent
 * closed ones, capped. The panel is a summary; the helpdesk is the history.
 */
export function recordRequestList(tickets: HelpdeskTicket[], limit = 5): HelpdeskTicket[] {
  const RANK: Record<string, number> = { waiting_employee: 1, open: 0, in_progress: 0 };
  const open = openTicketsFor(tickets).sort(
    (a, b) => (RANK[a.status] ?? 0) - (RANK[b.status] ?? 0) || b.createdAt.localeCompare(a.createdAt),
  );
  const closed = tickets.filter((ticket) => !open.includes(ticket)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...open, ...closed].slice(0, limit);
}

const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The calendar month `offset` months before `now`, as local dates. Built with
 * `toISOString()` until 2026-09-26, which is UTC: east of Greenwich — the UK
 * all summer — midnight on the 1st is still the previous day, so September
 * began on 31 August and every timesheet took the last day of the month before.
 */
export function monthRangeOf(now: Date, offset: number): { from: string; to: string; label: string } {
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  return {
    from: localIso(start),
    to: localIso(end),
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  };
}
