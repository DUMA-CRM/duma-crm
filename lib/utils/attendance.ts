import type { ScheduledShift } from '@/lib/api/scheduling.service';
import type { Shift } from '@/lib/api/shifts.service';
import type { TradingDay } from '@/lib/utils/trading-day';

/* Who is on the clock when they should not be.
 *
 * Two different problems, deliberately distinguished because the manager does
 * different things about them:
 *
 *  · `after-close` — somebody is still clocked in after the site shut. Almost
 *    always a forgotten clock-out, and it quietly inflates labour cost and
 *    payroll until someone corrects it.
 *  · `off-rota`    — somebody is on the clock with no published shift covering
 *    now. Their hours are real but unrostered, which is exactly the time the
 *    labour endpoint reports as uncosted.
 *
 * Arriving before opening is NOT flagged: prep, deliveries and setup before the
 * doors open are normal, and a dashboard that cries about them every morning is
 * one nobody reads.
 */

/** Clocking in a few minutes either side of a rota slot is normal, not an exception. */
export const ROTA_GRACE_MINS = 15;

/**
 * How late somebody can be before "hasn't clocked in" is worth raising.
 *
 * Without this the warning fires the instant a shift starts, so a person
 * rostered at 09:00 who clocks in at 09:01 sets off an alarm at 09:00:00. A
 * strip that cries wolf every morning is one nobody reads by Wednesday.
 */
export const NO_SHOW_GRACE_MINS = 10;

export type AttendanceReason = 'after-close' | 'off-rota';

export interface AttendanceIssue {
  shift: Shift;
  reason: AttendanceReason;
  name: string;
  /** Minutes clocked in so far. */
  minutes: number;
}

function staffName(shift: Shift) {
  return shift.staff?.user?.name ?? shift.staff?.name ?? 'Someone';
}

export type CoverGapReason =
  /** Rostered to somebody who has not clocked in. */
  | 'not-clocked-in'
  /** A published slot nobody was ever assigned to. */
  | 'unassigned';

export interface CoverGap {
  slot: ScheduledShift;
  reason: CoverGapReason;
  name: string;
  /** Minutes since this shift should have been covered. */
  minutesLate: number;
}

/**
 * Published shifts that should be covered right now but are not.
 *
 * The mirror of `findAttendanceIssues`: that one finds people on the clock who
 * should not be, this one finds shifts with nobody on them. Only slots already
 * past their grace window count, so this reads as "somebody has not turned up"
 * rather than "a shift just started".
 */
export function findCoverGaps({
  rota,
  activeShifts,
  now,
  graceMins = NO_SHOW_GRACE_MINS,
}: {
  rota: ScheduledShift[];
  /** Shifts clocked in and not yet out, already scoped to the location. */
  activeShifts: Shift[];
  now: Date;
  graceMins?: number;
}): CoverGap[] {
  const at = now.getTime();

  return rota
    .map((slot) => {
      if (slot.status !== 'published') return null;

      const startsAt = new Date(slot.startsAt).getTime();
      const endsAt = new Date(slot.endsAt).getTime();
      // Not yet due (or its grace has not elapsed), or already over.
      if (at < startsAt + graceMins * 60_000 || at > endsAt) return null;

      const minutesLate = (at - startsAt) / 60_000;

      if (!slot.userId) {
        return { slot, reason: 'unassigned' as const, name: 'Nobody assigned', minutesLate };
      }

      const covered = activeShifts.some((shift) => shift.userId === slot.userId);
      if (covered) return null;

      // They are by definition not clocked in here, so the name can only come
      // from the rota slot.
      return { slot, reason: 'not-clocked-in' as const, name: slot.staff?.user?.name ?? 'Someone', minutesLate };
    })
    .filter((gap): gap is CoverGap => gap !== null)
    .sort((a, b) => b.minutesLate - a.minutesLate);
}

export function findAttendanceIssues({
  activeShifts,
  rota,
  day,
  now,
  graceMins = ROTA_GRACE_MINS,
}: {
  /** Shifts that are clocked in and not yet clocked out, already scoped to the location. */
  activeShifts: Shift[];
  rota: ScheduledShift[];
  day: TradingDay;
  now: Date;
  graceMins?: number;
}): AttendanceIssue[] {
  // With no hours configured we cannot say the site is shut, so only the rota
  // check applies — better silent than wrong.
  const siteClosed = day.state === 'after-close' || day.state === 'closed-today';
  const grace = graceMins * 60_000;
  const at = now.getTime();

  return activeShifts
    .map((shift) => {
      const minutes = Math.max(0, (at - new Date(shift.clockedIn).getTime()) / 60_000);

      if (siteClosed) return { shift, reason: 'after-close' as const, name: staffName(shift), minutes };

      const covered = rota.some(
        (slot) =>
          slot.status === 'published' &&
          slot.userId === shift.userId &&
          at >= new Date(slot.startsAt).getTime() - grace &&
          at <= new Date(slot.endsAt).getTime() + grace,
      );
      if (covered) return null;

      return { shift, reason: 'off-rota' as const, name: staffName(shift), minutes };
    })
    .filter((issue): issue is AttendanceIssue => issue !== null)
    .sort((a, b) => b.minutes - a.minutes);
}
