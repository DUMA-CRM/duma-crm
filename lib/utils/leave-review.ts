/**
 * What a reviewer needs beside a leave request before saying yes: does it fit
 * the person's allowance, who else is already off those days, and which rota
 * shifts it would leave uncovered. All three come from rows the API already
 * returns; this joins them. Pure, so the overlap rules are tested.
 */

export interface LeaveLike {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  status: string;
  leaveType: { id: string };
  employee?: { name?: string | null; email?: string | null } | null;
}

export interface EntitlementLike {
  userId: string;
  year: number;
  totalDays: string;
  usedDays: string;
  leaveType: { id: string };
}

export interface ShiftLike {
  userId?: string | null;
  startsAt: string;
  status: string;
}

export interface LeaveContext {
  /** Others with approved leave overlapping these dates. */
  alsoOff: string[];
  /** The person's own rota shifts inside the leave, which will need cover. */
  shiftsDuring: number;
  /** Allowance for this leave type, or null when no entitlement is on file. */
  balance: { total: number; remaining: number; after: number } | null;
}

const day = (value: string) => value.slice(0, 10);
const overlaps = (a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }) =>
  day(a.startDate) <= day(b.endDate) && day(b.startDate) <= day(a.endDate);

export function leaveContext(
  request: LeaveLike,
  others: { approved: readonly LeaveLike[]; shifts: readonly ShiftLike[]; entitlements: readonly EntitlementLike[] | null },
): LeaveContext {
  const alsoOff = others.approved
    .filter((other) => other.id !== request.id && other.userId !== request.userId && overlaps(request, other))
    .map((other) => other.employee?.name || other.employee?.email || 'Someone')
    .filter((name, index, all) => all.indexOf(name) === index);

  const shiftsDuring = others.shifts.filter((shift) => {
    if (shift.userId !== request.userId || shift.status === 'cancelled') return false;
    const date = day(new Date(shift.startsAt).toISOString());
    return date >= day(request.startDate) && date <= day(request.endDate);
  }).length;

  const year = Number(day(request.startDate).slice(0, 4));
  const entitlement = others.entitlements?.find(
    (row) => row.userId === request.userId && row.leaveType.id === request.leaveType.id && row.year === year,
  );
  let balance: LeaveContext['balance'] = null;
  if (entitlement) {
    const total = Number(entitlement.totalDays);
    const remaining = total - Number(entitlement.usedDays);
    // A pending request hasn't been taken yet; an approved one is already in usedDays.
    const after = request.status === 'pending' ? remaining - Number(request.totalDays) : remaining;
    balance = { total, remaining, after };
  }

  return { alsoOff, shiftsDuring, balance };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const DAY_MS = 86_400_000;

export type LeaveUrgency = 'calm' | 'warning' | 'exception';

export interface LeaveFlag {
  /** The row's value: the one thing to know before deciding, in words. */
  label: string;
  /** How that value is inked; null for nothing to worry about. */
  tone: Exclude<LeaveUrgency, 'calm'> | null;
  /** The row's tile: the worse of the problem and the wait. */
  urgency: LeaveUrgency;
}

/**
 * The single word a pending request's row leads with. A problem with the
 * request outranks how long it has waited: over the allowance first, then
 * shifts that would need cover, then colleagues already off. With none, the
 * wait — five days or more is overdue. Clashes are skipped while the approved
 * leave and rota are still loading, so "checking" never reads as "clear".
 */
export function leaveFlag(context: LeaveContext | null, waitedDays: number, checking: boolean): LeaveFlag {
  const wait: LeaveUrgency = waitedDays >= 5 ? 'exception' : waitedDays >= 1 ? 'warning' : 'calm';
  const worse = (a: LeaveUrgency, b: LeaveUrgency): LeaveUrgency =>
    a === 'exception' || b === 'exception' ? 'exception' : a === 'warning' || b === 'warning' ? 'warning' : 'calm';

  if (context?.balance && context.balance.after < 0) {
    return { label: `${plural(-context.balance.after, 'day')} over allowance`, tone: 'exception', urgency: 'exception' };
  }
  if (!checking && context && context.shiftsDuring > 0) {
    return { label: `${plural(context.shiftsDuring, 'shift')} to cover`, tone: 'warning', urgency: worse('warning', wait) };
  }
  if (!checking && context && context.alsoOff.length > 0) {
    return { label: `${context.alsoOff.length} also off`, tone: 'warning', urgency: worse('warning', wait) };
  }
  if (waitedDays >= 1) {
    return { label: `Waiting ${plural(waitedDays, 'day')}`, tone: wait === 'calm' ? null : wait, urgency: wait };
  }
  return { label: 'New today', tone: null, urgency: 'calm' };
}

export interface LeaveQueueSummary {
  waiting: number;
  /** Whole days the oldest request has waited. */
  longestWait: number;
  /** Requests whose leave starts within the next seven days (today included). */
  startingSoon: number;
  /** Working days asked for across the queue. */
  days: number;
}

/** The four figures over the leave queue. `today` is the workspace's date, `YYYY-MM-DD`. */
export function summariseLeaveQueue(
  pending: readonly { status: string; startDate: string; totalDays: string; createdAt: string }[],
  now: Date,
  today: string,
): LeaveQueueSummary {
  const waiting = pending.filter((request) => request.status === 'pending');
  const weekOut = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * DAY_MS).toISOString().slice(0, 10);
  return {
    waiting: waiting.length,
    longestWait: waiting.reduce(
      (oldest, request) => Math.max(oldest, Math.floor((now.getTime() - Date.parse(request.createdAt)) / DAY_MS)),
      0,
    ),
    startingSoon: waiting.filter((request) => day(request.startDate) >= today && day(request.startDate) < weekOut).length,
    days: Math.round(waiting.reduce((sum, request) => sum + Number(request.totalDays), 0) * 100) / 100,
  };
}
