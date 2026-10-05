/**
 * Rostered staff against the staffing demand implies, hour by hour, for one day.
 *
 * The API's coverage endpoint gives demand only — average orders per hour and
 * the headcount that implies. The rota gives who is planned. Neither says
 * "you're short at lunch", so the two are joined here, from real rows: nothing
 * in this file invents a figure the data doesn't hold.
 *
 * Demand hours are **UTC** — duma-api buckets with `EXTRACT(HOUR FROM
 * created_at)` on a UTC timestamp — so each is moved to the local hour of the
 * day being checked before it meets the rota. In British Summer Time an
 * uncorrected join puts every recommendation an hour early.
 */

export interface DemandHour {
  /** UTC hour, as the API reports it. */
  hour: number;
  avgOrders: number;
  recommendedStaff: number;
}

export interface RotaShiftLike {
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface CoverageHour {
  /** Local hour of day. */
  hour: number;
  avgOrders: number;
  needed: number;
  rostered: number;
  /** rostered − needed: negative is short. */
  gap: number;
}

export interface CoverageDay {
  hours: CoverageHour[];
  /** Runs of consecutive short hours, e.g. 12:00–14:00 short by 1. */
  short: { from: number; to: number; by: number }[];
  overHours: number;
  peak: CoverageHour | null;
}

const HOUR = 3_600_000;

/** Headcount on the rota during each local hour of `day` — any overlap counts. */
export function rosteredByHour(shifts: readonly RotaShiftLike[], day: Date): number[] {
  const counts = Array.from({ length: 24 }, () => 0);
  const midnight = new Date(day);
  midnight.setHours(0, 0, 0, 0);
  for (const shift of shifts) {
    if (shift.status === 'cancelled') continue;
    const start = new Date(shift.startsAt).getTime();
    const end = new Date(shift.endsAt).getTime();
    for (let hour = 0; hour < 24; hour += 1) {
      const slotStart = midnight.getTime() + hour * HOUR;
      if (start < slotStart + HOUR && end > slotStart) counts[hour] += 1;
    }
  }
  return counts;
}

/** The local hour that a UTC hour on `day` falls in. */
export function localHourOf(utcHour: number, day: Date): number {
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), utcHour)).getHours();
}

export function coverageForDay(demand: readonly DemandHour[], shifts: readonly RotaShiftLike[], day: Date): CoverageDay {
  const rostered = rosteredByHour(shifts, day);
  const needByHour = new Map<number, DemandHour>();
  for (const row of demand) needByHour.set(localHourOf(row.hour, day), row);

  const active = Array.from({ length: 24 }, (_, hour) => hour).filter(
    (hour) => (needByHour.get(hour)?.recommendedStaff ?? 0) > 0 || rostered[hour] > 0,
  );
  if (active.length === 0) return { hours: [], short: [], overHours: 0, peak: null };

  const first = Math.min(...active);
  const last = Math.max(...active);
  const hours: CoverageHour[] = [];
  for (let hour = first; hour <= last; hour += 1) {
    const need = needByHour.get(hour);
    const needed = need?.recommendedStaff ?? 0;
    hours.push({ hour, avgOrders: need?.avgOrders ?? 0, needed, rostered: rostered[hour], gap: rostered[hour] - needed });
  }

  const short: CoverageDay['short'] = [];
  for (const row of hours) {
    if (row.gap >= 0) continue;
    const current = short[short.length - 1];
    if (current && current.to === row.hour) {
      current.to = row.hour + 1;
      current.by = Math.max(current.by, -row.gap);
    } else short.push({ from: row.hour, to: row.hour + 1, by: -row.gap });
  }

  const peak = hours.reduce<CoverageHour | null>((best, row) => (!best || row.avgOrders > best.avgOrders ? row : best), null);
  return {
    hours,
    short,
    overHours: hours.filter((row) => row.needed > 0 && row.gap > 0).length,
    peak: peak && peak.avgOrders > 0 ? peak : null,
  };
}
