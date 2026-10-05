/**
 * How close a privacy request is to its statutory deadline, in words.
 *
 * The API sets `dueAt` one calendar month after receipt (UK GDPR Art. 12(3)).
 * The queue used to print only the date, which left the reader to do the
 * subtraction — and a date three days away looks exactly like one three weeks
 * away. Pure, so the day arithmetic is tested.
 */

export type DeadlineTone = 'done' | 'calm' | 'soon' | 'today' | 'overdue';

export interface Deadline {
  /** Whole days until the due day; negative once it has passed. */
  daysLeft: number;
  label: string;
  tone: DeadlineTone;
  /** Share of the allowed time already used, 0–1, for a progress bar. */
  used: number;
}

const DAY = 86_400_000;
/** Inside this many days a request is "due soon". */
export const DUE_SOON_DAYS = 7;

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

interface Datable {
  receivedAt: string;
  dueAt: string;
  status: string;
}

export const isClosedRequest = (request: { status: string }) => request.status === 'completed' || request.status === 'declined';

export function requestDeadline(request: Datable, now: number): Deadline {
  const due = Date.parse(request.dueAt);
  const received = Date.parse(request.receivedAt);
  const daysLeft = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  const span = Math.max(1, due - received);
  const used = Math.min(1, Math.max(0, (now - received) / span));

  if (isClosedRequest(request)) return { daysLeft, label: 'Closed', tone: 'done', used: 1 };
  if (daysLeft < 0) {
    const late = -daysLeft;
    return { daysLeft, label: `${late} ${late === 1 ? 'day' : 'days'} overdue`, tone: 'overdue', used: 1 };
  }
  if (daysLeft === 0) return { daysLeft, label: 'Due today', tone: 'today', used };
  if (daysLeft === 1) return { daysLeft, label: 'Due tomorrow', tone: 'soon', used };
  return { daysLeft, label: `Due in ${daysLeft} days`, tone: daysLeft <= DUE_SOON_DAYS ? 'soon' : 'calm', used };
}

export interface QueueSummary {
  open: number;
  dueSoon: number;
  overdue: number;
  closedRecently: number;
}

/** The four numbers at the top of the queue. "Recently" is the last 30 days. */
export function summariseQueue(
  requests: readonly (Datable & { completedAt?: string | null; updatedAt?: string | null })[],
  now: number,
): QueueSummary {
  const summary: QueueSummary = { open: 0, dueSoon: 0, overdue: 0, closedRecently: 0 };
  for (const request of requests) {
    if (isClosedRequest(request)) {
      const closedAt = Date.parse(request.completedAt ?? request.updatedAt ?? request.dueAt);
      if (now - closedAt <= 30 * DAY) summary.closedRecently += 1;
      continue;
    }
    summary.open += 1;
    const { tone } = requestDeadline(request, now);
    if (tone === 'overdue') summary.overdue += 1;
    else if (tone === 'today' || tone === 'soon') summary.dueSoon += 1;
  }
  return summary;
}

/** Open work by urgency, soonest deadline first; closed work newest first. */
export function sortQueue<T extends Datable & { completedAt?: string | null }>(requests: readonly T[]): T[] {
  return [...requests].sort((a, b) => {
    const closedA = isClosedRequest(a);
    const closedB = isClosedRequest(b);
    if (closedA !== closedB) return closedA ? 1 : -1;
    if (closedA) return Date.parse(b.completedAt ?? b.dueAt) - Date.parse(a.completedAt ?? a.dueAt);
    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  });
}
