/**
 * The Taken today chart's series, hour by hour along the trading day — the
 * running total, so the Reports trend chart can draw today against a typical
 * same weekday and the target as it builds through the day.
 *
 * Today's line stops at the hour under way: an hour that hasn't happened has
 * no takings, not zero takings. Before open and on a closed day there is no
 * today, and the typical day is drawn in full instead.
 */
export interface TakenTodaySeries {
  points: Array<{ hour: number; label: string; value: number }>;
  /** A typical day's running total at each point, or null without enough history. */
  typical: number[] | null;
  /** The target's running share at each point, shaped like a typical day where one exists. */
  target: number[] | null;
}

export function takenTodaySeries(input: {
  buckets: ReadonlyArray<{ hour: number; startMinutes: number }>;
  revenueByHour: ReadonlyMap<number, number>;
  /** Cumulative typical revenue by clock hour; empty without enough history. */
  typicalByHour: ReadonlyMap<number, number>;
  typicalDay: number;
  nowMinutes: number;
  /** Today's live total — the last point lands on it exactly. */
  takenSoFar: number;
  target: number | null;
  showToday: boolean;
}): TakenTodaySeries {
  const { buckets } = input;
  const label = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
  // The hours drawn: all of them for a typical day, up to the one under way for today.
  const shown = input.showToday ? buckets.filter((bucket) => bucket.startMinutes <= input.nowMinutes) : [...buckets];

  let running = 0;
  const points = shown.map((bucket, index) => {
    running += input.showToday ? (input.revenueByHour.get(bucket.hour) ?? 0) : 0;
    const last = index === shown.length - 1;
    const value = input.showToday ? (last ? input.takenSoFar : running) : (input.typicalByHour.get(bucket.hour) ?? 0);
    return { hour: bucket.hour, label: label(bucket.hour), value };
  });

  const hasTypical = input.typicalByHour.size > 0 && input.typicalDay > 0;
  const typical = hasTypical ? shown.map((bucket) => input.typicalByHour.get(bucket.hour) ?? 0) : null;
  const target =
    input.target && input.target > 0
      ? shown.map((bucket) =>
          hasTypical
            ? input.target! * Math.min(1, (input.typicalByHour.get(bucket.hour) ?? 0) / input.typicalDay)
            : input.target! * ((buckets.indexOf(bucket) + 1) / Math.max(1, buckets.length)),
        )
      : null;

  return { points, typical: input.showToday ? typical : null, target };
}
