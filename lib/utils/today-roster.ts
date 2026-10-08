/**
 * Today's rota as a timeline: one row per shift, placed on a window that fits
 * the day, with where each person is up to right now. Pure, so the placement
 * and the "late" rule are tested without a browser.
 */

import { workspaceDateKey, zonedParts, zonedToInstant } from './workspace-time.ts';

export type RosterStatus = 'on' | 'late' | 'later' | 'done' | 'unplanned';

export interface RosterShiftInput {
  id: string;
  userId?: string | null;
  name: string;
  role?: string | null;
  startsAt: string;
  endsAt: string;
}

export interface RosterClockInput {
  id: string;
  userId: string;
  name: string;
  clockedIn: string;
}

export interface RosterRow {
  key: string;
  name: string;
  role: string | null;
  /** Where the bar sits on the window, 0–100. */
  left: number;
  width: number;
  status: RosterStatus;
  /** "Since 13:23", "Starts 17:00", "12 min late", "Finished 14:00". */
  label: string;
  /** The planned hours, "09:00–17:00". */
  span: string;
}

export interface RosterWindow {
  startHour: number;
  endHour: number;
  /** Where "now" falls on the window, or null when it's outside it. */
  now: number | null;
  /** Hour marks for the axis. */
  ticks: number[];
}

/** Someone this far past their start without clocking in is late, not just busy. */
export const LATE_AFTER_MINUTES = 5;

const MINUTE = 60_000;
const clock = (date: Date) => zonedParts(date).time;

export function buildRoster(input: { shifts: RosterShiftInput[]; clockedIn: RosterClockInput[]; now: Date }): {
  rows: RosterRow[];
  window: RosterWindow;
  counts: Record<RosterStatus, number>;
} {
  const { shifts, clockedIn, now } = input;
  // Hours since today's midnight at the business, clamped to the day: a shift
  // that runs past midnight ends at 24 rather than wrapping round to "01:38".
  const midnight = zonedToInstant(workspaceDateKey(now), '00:00') ?? now;
  const hourOf = (date: Date) => Math.min(24, Math.max(0, (date.getTime() - midnight.getTime()) / 3_600_000));
  const clockByUser = new Map(clockedIn.map((entry) => [entry.userId, entry]));
  const rostered = new Set(shifts.map((shift) => shift.userId).filter(Boolean));
  const unplanned = clockedIn.filter((entry) => !rostered.has(entry.userId));

  // The window: the day's shifts plus anyone clocked in, widened to whole
  // hours, never narrower than a working day so short rotas don't stretch.
  const hours = [
    ...shifts.flatMap((shift) => [hourOf(new Date(shift.startsAt)), hourOf(new Date(shift.endsAt))]),
    ...unplanned.map((entry) => hourOf(new Date(entry.clockedIn))),
    ...(unplanned.length ? [hourOf(now)] : []),
  ];
  let startHour = hours.length ? Math.floor(Math.min(...hours)) : 8;
  let endHour = hours.length ? Math.ceil(Math.max(...hours)) : 18;
  if (endHour <= startHour) endHour = startHour + 1;
  while (endHour - startHour < 8) {
    if (startHour > 6) startHour -= 1;
    else endHour += 1;
  }
  endHour = Math.min(24, endHour);
  const span = endHour - startHour;
  const place = (date: Date) => Math.min(100, Math.max(0, ((hourOf(date) - startHour) / span) * 100));
  const nowHour = hourOf(now);

  const rows: RosterRow[] = shifts.map((shift) => {
    const start = new Date(shift.startsAt);
    const end = new Date(shift.endsAt);
    const clock_ = shift.userId ? clockByUser.get(shift.userId) : undefined;
    let status: RosterStatus;
    let label: string;
    if (clock_) {
      status = 'on';
      label = `Since ${clock(new Date(clock_.clockedIn))}`;
    } else if (now >= end) {
      status = 'done';
      label = `Finished ${clock(end)}`;
    } else if (now.getTime() - start.getTime() > LATE_AFTER_MINUTES * MINUTE) {
      status = 'late';
      label = `${Math.round((now.getTime() - start.getTime()) / MINUTE)} min late`;
    } else {
      status = 'later';
      label = `Starts ${clock(start)}`;
    }
    const left = place(start);
    return {
      key: shift.id,
      name: shift.name,
      role: shift.role ?? null,
      left,
      width: Math.max(1.5, place(end) - left),
      status,
      label,
      span: `${clock(start)}–${clock(end)}`,
    };
  });

  for (const entry of unplanned) {
    const start = new Date(entry.clockedIn);
    const left = place(start);
    rows.push({
      key: `unplanned-${entry.id}`,
      name: entry.name,
      role: null,
      left,
      width: Math.max(1.5, place(now) - left),
      status: 'unplanned',
      label: `Since ${clock(start)} · not on the rota`,
      span: `${clock(start)}–now`,
    });
  }

  // Working now first, then late, then who's next, then who's gone home.
  const order: Record<RosterStatus, number> = { on: 0, unplanned: 1, late: 2, later: 3, done: 4 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.left - b.left);

  const counts: Record<RosterStatus, number> = { on: 0, late: 0, later: 0, done: 0, unplanned: 0 };
  for (const row of rows) counts[row.status] += 1;

  const ticks: number[] = [];
  const step = span > 12 ? 3 : 2;
  for (let hour = Math.ceil(startHour / step) * step; hour <= endHour; hour += step) ticks.push(hour);

  return {
    rows,
    window: { startHour, endHour, now: nowHour >= startHour && nowHour <= endHour ? ((nowHour - startHour) / span) * 100 : null, ticks },
    counts,
  };
}
