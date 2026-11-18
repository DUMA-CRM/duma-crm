/**
 * Today on the location's trading hours, as the dashboard widgets draw it:
 * what came in each hour, the running total up to the hour under way (ending
 * on the live figure, not the last full hour), and a typical same weekday's
 * running total across the whole day. A typical day is only ever drawn from
 * history the caller has judged sufficient.
 */

import { zonedParts } from './workspace-time.ts';

export interface DayBucket {
  hour: number;
  startMinutes: number;
}

export interface DaySeries {
  /** Today's figure within each hour of the day; 0 for hours not reached yet. */
  perHour: number[];
  /** Today's running total at each hour up to the one under way. Empty before the day starts. */
  today: number[];
  /** A typical day's running total at every hour; empty without history. */
  typical: number[];
  /** The hour under way, or -1 when the day isn't trading. */
  nowIndex: number;
  /** The hour with the most so far, or -1 when nothing has come in. */
  busiestIndex: number;
}

export function daySeries(input: {
  buckets: readonly DayBucket[];
  /** Today's figure by clock hour. */
  byHour: ReadonlyMap<number, number>;
  /** A typical day's running total by clock hour; empty without enough history. */
  typicalByHour: ReadonlyMap<number, number>;
  /** Minutes on the axis's clock, past midnight for an overnight day. */
  nowMinutes: number;
  /** False before open and on a closed day: today has no line. */
  showToday: boolean;
  /** The live total, so the line ends on the figure the widget shows. */
  soFar: number;
  trading: boolean;
}): DaySeries {
  const { buckets } = input;
  const perHour = buckets.map((bucket) =>
    input.showToday && bucket.startMinutes <= input.nowMinutes ? (input.byHour.get(bucket.hour) ?? 0) : 0,
  );
  const elapsed = input.showToday ? buckets.filter((bucket) => bucket.startMinutes <= input.nowMinutes).length : 0;
  let running = 0;
  const today = perHour.slice(0, elapsed).map((value, index) => {
    running += value;
    return index === elapsed - 1 ? input.soFar : running;
  });
  const typical = input.typicalByHour.size > 0 ? buckets.map((bucket) => input.typicalByHour.get(bucket.hour) ?? 0) : [];
  const nowIndex = input.trading
    ? buckets.findIndex((bucket) => bucket.startMinutes <= input.nowMinutes && input.nowMinutes < bucket.startMinutes + 60)
    : -1;
  const peak = Math.max(0, ...perHour);
  return { perHour, today, typical, nowIndex, busiestIndex: peak > 0 ? perHour.indexOf(peak) : -1 };
}

/** "09:00" for an hour of the clock. */
export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** First, middle and last hour of the axis — the middle bucket, not the midpoint, so an overnight day reads in order. */
export function axisTicks(buckets: readonly DayBucket[]): string[] {
  if (buckets.length === 0) return [];
  const ticks = [hourLabel(buckets[0]!.hour)];
  if (buckets.length > 4) ticks.push(hourLabel(buckets[Math.floor(buckets.length / 2)]!.hour));
  if (buckets.length > 1) ticks.push(hourLabel(buckets.at(-1)!.hour));
  return ticks;
}

/**
 * Amounts (decimal strings) summed by the clock hour they happened in at the
 * shop — refunds, for the Refunds paid widget's hours. Every row counts, as in
 * the API's refunds-by-refund-date total, so the hours add up to the figure.
 */
export function amountsByHour(rows: ReadonlyArray<{ createdAt: string; amount: string }>, timeZone: string): Map<number, number> {
  const byHour = new Map<number, number>();
  for (const row of rows) {
    const hour = zonedParts(row.createdAt, timeZone).hour;
    byHour.set(hour, Math.round(((byHour.get(hour) ?? 0) + (Number(row.amount) || 0)) * 100) / 100);
  }
  return byHour;
}
