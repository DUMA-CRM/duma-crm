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
