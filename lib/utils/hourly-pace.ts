/**
 * Today's orders against a typical day's, up to now. The hour in progress
 * counts only its elapsed share of the typical — at 12:15, a quarter of a
 * typical noon — or every day would look behind for most of each hour.
 */
export function hourlyPace(
  buckets: ReadonlyArray<{ startMinutes: number }>,
  counts: readonly number[],
  typical: readonly number[],
  nowMinutes: number,
): { soFar: number; typicalSoFar: number; change: number | null } {
  let soFar = 0;
  let typicalSoFar = 0;
  buckets.forEach((bucket, index) => {
    if (bucket.startMinutes > nowMinutes) return;
    soFar += counts[index] ?? 0;
    const elapsed = Math.min(1, Math.max(0, (nowMinutes - bucket.startMinutes) / 60));
    typicalSoFar += (typical[index] ?? 0) * elapsed;
  });
  // Too little to compare against: a percentage of almost nothing is noise.
  const change = typicalSoFar >= 3 ? (soFar - typicalSoFar) / typicalSoFar : null;
  return { soFar, typicalSoFar, change };
}
