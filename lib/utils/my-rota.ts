/**
 * The arithmetic behind "My rota": where a planned shift stands against the
 * clock, which clock-ins belong to it, and where the contract break falls.
 * Pure, with `now` passed in, so every state is testable.
 */

export interface PlannedShift {
  id: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
}

export interface WorkedShift {
  id: string;
  locationId: string;
  clockedIn: string;
  clockedOut?: string | null;
  scheduledShiftId?: string | null;
  durationMinutes?: number;
}

export type ShiftState = 'done' | 'now' | 'upcoming';

/** A clock-in this long before the start still counts as the shift's own. */
const EARLY_GRACE_MS = 60 * 60 * 1000;

const ms = (iso: string) => new Date(iso).getTime();

export function shiftState(shift: PlannedShift, now: number): ShiftState {
  if (now >= ms(shift.endsAt)) return 'done';
  if (now >= ms(shift.startsAt)) return 'now';
  return 'upcoming';
}

/** Planned length in minutes; never negative. */
export function plannedMinutes(shift: PlannedShift): number {
  return Math.max(0, (ms(shift.endsAt) - ms(shift.startsAt)) / 60_000);
}

/** 0–1 through a running shift; null when it is not running. */
export function shiftProgress(shift: PlannedShift, now: number): number | null {
  const starts = ms(shift.startsAt);
  const ends = ms(shift.endsAt);
  if (now < starts || now >= ends || ends <= starts) return null;
  return (now - starts) / (ends - starts);
}

export interface WorkedAssignment<W extends WorkedShift> {
  /** Clock-ins per planned shift id. */
  byShift: Map<string, W[]>;
  /** Clock-ins no planned shift accounts for, merged into runs (see `assignWorked`). */
  unplanned: W[][];
}

/** Clock-ins within this gap of each other read as one stretch of work. */
const RUN_GAP_MS = 60 * 60 * 1000;

/**
 * Gives every clock-in of a day to at most one planned shift, then groups what
 * is left.
 *
 * A clock-in linked to a shift on this day goes to it. Otherwise it goes to the
 * planned shift its time overlaps (from an hour before the start to the end) —
 * at any location, because a clock-in taken on the wrong till is still the same
 * hours worked. Where two shifts overlap it, the same location wins, then the
 * larger overlap. Whatever is left is merged into runs: clock-ins less than an
 * hour apart (out for lunch, back in) are one stretch of unplanned work.
 */
export function assignWorked<W extends WorkedShift>(planned: PlannedShift[], worked: W[], now: number): WorkedAssignment<W> {
  const byShift = new Map<string, W[]>(planned.map((shift) => [shift.id, []]));
  const ids = new Set(planned.map((shift) => shift.id));
  const loose: W[] = [];
  const end = (entry: W) => (entry.clockedOut ? ms(entry.clockedOut) : now);

  for (const entry of worked) {
    if (entry.scheduledShiftId && ids.has(entry.scheduledShiftId)) {
      byShift.get(entry.scheduledShiftId)!.push(entry);
      continue;
    }
    const from = ms(entry.clockedIn);
    const to = Math.max(from, end(entry));
    const candidates = planned
      .map((shift) => {
        const windowFrom = ms(shift.startsAt) - EARLY_GRACE_MS;
        const windowTo = ms(shift.endsAt);
        // A clock-in (even a zero-length one) counts when it starts inside the window or spans part of it.
        const touches = (from >= windowFrom && from < windowTo) || (from < windowTo && to > windowFrom);
        const overlap = Math.max(0, Math.min(to, ms(shift.endsAt)) - Math.max(from, ms(shift.startsAt)));
        return { shift, touches, overlap, sameLocation: shift.locationId === entry.locationId };
      })
      .filter((candidate) => candidate.touches)
      .sort((a, b) => Number(b.sameLocation) - Number(a.sameLocation) || b.overlap - a.overlap);
    if (candidates[0]) byShift.get(candidates[0].shift.id)!.push(entry);
    else loose.push(entry);
  }

  const unplanned: W[][] = [];
  for (const entry of [...loose].sort((a, b) => ms(a.clockedIn) - ms(b.clockedIn))) {
    const run = unplanned.at(-1);
    const runEnd = run ? Math.max(...run.map(end)) : -Infinity;
    if (run && ms(entry.clockedIn) - runEnd <= RUN_GAP_MS) run.push(entry);
    else unplanned.push([entry]);
  }

  return { byShift, unplanned };
}

/** Minutes on the clock across entries; a running one counts up to `now`. */
export function workedMinutes(entries: WorkedShift[], now: number): number {
  return entries.reduce((sum, entry) => {
    if (typeof entry.durationMinutes === 'number') return sum + entry.durationMinutes;
    const end = entry.clockedOut ? ms(entry.clockedOut) : now;
    return sum + Math.max(0, (end - ms(entry.clockedIn)) / 60_000);
  }, 0);
}

/**
 * The unpaid break the contract places inside a shift, as minutes from its
 * start: `unpaidMins` beginning once the shift reaches `thresholdMins`. A
 * shorter shift carries none. Nobody clocks a break — the rule is set per
 * employee, so the window is known in advance.
 */
export function unpaidBreak(
  planned: number,
  rule: { thresholdMins?: number | null; unpaidMins?: number | null } | undefined,
): { from: number; to: number } | null {
  const threshold = rule?.thresholdMins ?? 0;
  const unpaid = rule?.unpaidMins ?? 0;
  if (!unpaid || !threshold || planned < threshold) return null;
  const to = Math.min(planned, threshold + unpaid);
  return to > threshold ? { from: threshold, to } : null;
}

/** "45m", "8h", "7h 55m". */
export function formatDuration(mins: number): string {
  const rounded = Math.max(0, Math.round(mins));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// ── Leave on the calendar ─────────────────────────────────────────────────

export interface LeaveSpan {
  id: string;
  /** `YYYY-MM-DD`, inclusive. */
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
}

/** `YYYY-MM-DD` of a date by the local calendar. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Leave that covers this day and still stands — approved first, then pending. Declined and cancelled say nothing. */
export function leaveOnDay<L extends LeaveSpan>(requests: L[], day: Date): L[] {
  const key = localDateKey(day);
  return requests
    .filter(
      (request) =>
        (request.status === 'approved' || request.status === 'pending') &&
        request.startDate.slice(0, 10) <= key &&
        key <= request.endDate.slice(0, 10),
    )
    .sort((a, b) => Number(b.status === 'approved') - Number(a.status === 'approved'));
}

// ── Pay ───────────────────────────────────────────────────────────────────

/** Paid minutes of a planned shift: its length less the contract's unpaid break. */
export function paidMinutes(shift: PlannedShift, rule: Parameters<typeof unpaidBreak>[1]): number {
  const planned = plannedMinutes(shift);
  const gap = unpaidBreak(planned, rule);
  return planned - (gap ? gap.to - gap.from : 0);
}

// ── Changes since you last looked ─────────────────────────────────────────

export interface RotaShiftFields extends PlannedShift {
  role?: string | null;
  notes?: string | null;
}

export type RotaChange = 'new' | 'changed';

/** What a person would notice: when, where, as what, and the note. */
export function shiftSignature(shift: RotaShiftFields): string {
  return [shift.startsAt, shift.endsAt, shift.locationId, shift.role ?? '', shift.notes ?? ''].join('|');
}

export function rotaSnapshot(shifts: RotaShiftFields[]): Record<string, string> {
  return Object.fromEntries(shifts.map((shift) => [shift.id, shiftSignature(shift)]));
}

/**
 * Shifts that are new or different since the snapshot taken on the last visit.
 * No snapshot — a first visit — marks nothing: everything would be "new", which
 * says nothing at all.
 */
export function diffRota(previous: Record<string, string> | null, shifts: RotaShiftFields[]): Map<string, RotaChange> {
  const changes = new Map<string, RotaChange>();
  if (!previous) return changes;
  for (const shift of shifts) {
    const before = previous[shift.id];
    if (before === undefined) changes.set(shift.id, 'new');
    else if (before !== shiftSignature(shift)) changes.set(shift.id, 'changed');
  }
  return changes;
}

// ── Weeks ─────────────────────────────────────────────────────────────────

/** Monday 00:00 of the week holding `date`, local time. */
export function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** How many weeks `target` is from `today`'s week — 0 for this week, negative for the past. */
export function weekOffsetFor(target: Date, today: Date): number {
  return Math.round((mondayOf(target).getTime() - mondayOf(today).getTime()) / (7 * 86_400_000));
}
