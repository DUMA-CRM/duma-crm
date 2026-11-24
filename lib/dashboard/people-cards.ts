import { ticketAge } from '../utils/helpdesk-board.ts';
import { type EntitlementLike, type LeaveFlag, type LeaveLike, type ShiftLike, leaveContext, leaveFlag } from '../utils/leave-review.ts';
import { type Deadline, isClosedRequest, requestDeadline, sortQueue } from '../utils/privacy-deadline.ts';

/**
 * The arithmetic behind the dashboard's people cards — Time off to decide,
 * Helpdesk and Privacy requests. Each reuses the rule its own screen already
 * applies (the HR inbox's leave flag, the helpdesk's stale age, the privacy
 * queue's statutory deadline) so a card never disagrees with the page it
 * opens; this only orders and counts.
 */

const DAY = 86_400_000;
const URGENCY_RANK = { exception: 0, warning: 1, calm: 2 } as const;

/**
 * Pending leave as the card reads it: each request with the HR inbox's flag
 * (over allowance, shifts to cover, colleagues off, or its wait), the worst
 * first and then the soonest to start, and how many fall in each urgency.
 * `others` is null while the approved leave, rota and allowances are still
 * loading, so a clash is never reported as clear before it was checked.
 */
export function leaveQueue<T extends LeaveLike & { createdAt: string }>(
  pending: readonly T[],
  others: { approved: readonly LeaveLike[]; shifts: readonly ShiftLike[]; entitlements: readonly EntitlementLike[] | null },
  now: Date,
  checking: boolean,
) {
  const rows = pending
    .filter((request) => request.status === 'pending')
    .map((request) => {
      const waited = Math.max(0, Math.floor((now.getTime() - Date.parse(request.createdAt)) / DAY));
      const flag: LeaveFlag = leaveFlag(leaveContext(request, others), waited, checking);
      return { request, flag };
    })
    .sort(
      (a, b) =>
        URGENCY_RANK[a.flag.urgency] - URGENCY_RANK[b.flag.urgency] ||
        a.request.startDate.slice(0, 10).localeCompare(b.request.startDate.slice(0, 10)),
    );
  const counts = { exception: 0, warning: 0, calm: 0 };
  for (const row of rows) counts[row.flag.urgency] += 1;
  return { rows, counts, days: Math.round(rows.reduce((sum, row) => sum + Number(row.request.totalDays), 0) * 100) / 100 };
}

interface TicketLike {
  id: string;
  status: 'open' | 'in_progress' | 'waiting_employee' | 'resolved' | 'closed';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  createdAt: string;
  updatedAt: string;
}

export type TicketUrgency = 'exception' | 'warning' | 'calm';

/**
 * Open tickets, the one that has waited longest first. Urgent is red; high, or
 * untouched long enough for the board to call it stale, is amber.
 */
export function openTickets<T extends TicketLike>(tickets: readonly T[], now: number) {
  const rows = tickets
    .filter((ticket) => ticket.status === 'open')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((ticket) => {
      const { stale } = ticketAge(ticket, now);
      const urgency: TicketUrgency = ticket.priority === 'urgent' ? 'exception' : ticket.priority === 'high' || stale ? 'warning' : 'calm';
      return { ticket, urgency, waitedDays: Math.max(0, Math.floor((now - Date.parse(ticket.createdAt)) / DAY)), stale };
    });
  const counts = { exception: 0, warning: 0, calm: 0 };
  for (const row of rows) counts[row.urgency] += 1;
  return { rows, counts, oldestDays: rows[0]?.waitedDays ?? 0 };
}

interface PrivacyLike {
  receivedAt: string;
  dueAt: string;
  status: string;
  completedAt?: string | null;
}

/**
 * Open privacy requests against their statutory deadline (the API sets `dueAt`
 * a calendar month after receipt): soonest due first, so overdue work leads,
 * each with the queue's own deadline words, and the split — overdue, due
 * today or within a week, and the rest.
 */
export function privacyQueue<T extends PrivacyLike>(requests: readonly T[], now: number) {
  const rows: { request: T; deadline: Deadline }[] = sortQueue(requests.filter((request) => !isClosedRequest(request))).map((request) => ({
    request,
    deadline: requestDeadline(request, now),
  }));
  const counts = { overdue: 0, soon: 0, calm: 0 };
  for (const { deadline } of rows) {
    if (deadline.tone === 'overdue') counts.overdue += 1;
    else if (deadline.tone === 'today' || deadline.tone === 'soon') counts.soon += 1;
    else counts.calm += 1;
  }
  return { rows, counts };
}
