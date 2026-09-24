import type { DayBaseline } from '@/lib/modules/analytics/client';

// Is today ahead or behind? Everything here answers that one question, and every
// path can refuse to answer it — a pace line drawn off two Thursdays or off the
// first twenty minutes of trading is worse than no pace line at all.

/**
 * Below this many sampled days the baseline is noise, so pace is withheld and
 * the dashboard says how much history it actually has.
 */
export const MIN_BASELINE_SAMPLES = 3;

/**
 * Projecting the close from a sliver of the morning multiplies that sliver by a
 * huge factor: £20 taken against 1% of a typical day implies £2,000. Until a
 * tenth of the typical day has passed there is no projection.
 */
const MIN_PROGRESS_TO_PROJECT = 0.1;

export interface Pace {
  /** True when there is enough history and enough of the day to compare. */
  available: boolean;
  sampleCount: number;
  /** What a typical same-weekday would have taken by this exact time. */
  expectedByNow: number;
  /** What a typical same-weekday takes in full. */
  typicalFullDay: number;
  /** Today minus typical, at this point in the day. */
  delta: number;
  /** Same as a percentage of typical, or null when typical is zero. */
  deltaPct: number | null;
  /** Where today lands by close if the rest of the day behaves typically. */
  projected: number | null;
}

/**
 * Baseline revenue accrued by `minutes` past local midnight.
 *
 * `cumulativeRevenue` is the total by the *end* of each hour, so the current
 * hour is interpolated by how far into it we are — otherwise the comparison
 * jumps a whole hour's takings at each o'clock and reads as a sudden collapse
 * at :00 followed by a recovery.
 */
export function baselineByMinute(baseline: DayBaseline | undefined | null, minutes: number): number {
  if (!baseline?.byHour?.length) return 0;
  const hour = Math.floor(minutes / 60);
  if (hour < 0) return 0;
  if (hour > 23) return baseline.byHour[23]?.cumulativeRevenue ?? 0;

  const completed = hour > 0 ? (baseline.byHour[hour - 1]?.cumulativeRevenue ?? 0) : 0;
  const thisHour = baseline.byHour[hour]?.revenue ?? 0;
  return completed + thisHour * ((minutes % 60) / 60);
}

export function computePace({
  takenSoFar,
  baseline,
  nowMinutes,
}: {
  takenSoFar: number;
  baseline: DayBaseline | undefined | null;
  nowMinutes: number;
}): Pace {
  const sampleCount = baseline?.sampleCount ?? 0;
  const typicalFullDay = baseline?.dailyMedianRevenue ?? 0;
  const expectedByNow = baselineByMinute(baseline, nowMinutes);
  const enoughHistory = sampleCount >= MIN_BASELINE_SAMPLES && typicalFullDay > 0;

  const delta = takenSoFar - expectedByNow;
  const progress = typicalFullDay > 0 ? expectedByNow / typicalFullDay : 0;

  return {
    available: enoughHistory && expectedByNow > 0,
    sampleCount,
    expectedByNow,
    typicalFullDay,
    delta,
    deltaPct: expectedByNow > 0 ? (delta / expectedByNow) * 100 : null,
    projected:
      enoughHistory && progress >= MIN_PROGRESS_TO_PROJECT && expectedByNow > 0 ? takenSoFar * (typicalFullDay / expectedByNow) : null,
  };
}

export interface TargetProgress {
  target: number;
  /** The share of the target a typical day would have reached by now. */
  expectedByNow: number;
  /** Taken as a share of the whole target, 0–1 (uncapped above 1). */
  progress: number;
  ahead: boolean;
  delta: number;
  /** True when the target was spread evenly because no baseline shape was available. */
  spreadEvenly: boolean;
}

/**
 * Progress against a daily target.
 *
 * The target is spread across the day using the baseline's own shape, not
 * evenly: an even split says a café is 60% behind at 09:00 every single morning,
 * which trains people to ignore it. With no usable baseline it falls back to a
 * straight line through the trading window and says so.
 */
export function computeTargetProgress({
  target,
  takenSoFar,
  baseline,
  nowMinutes,
  openMinutes,
  closeMinutes,
}: {
  target: number | null | undefined;
  takenSoFar: number;
  baseline: DayBaseline | undefined | null;
  nowMinutes: number;
  openMinutes: number | null;
  closeMinutes: number | null;
}): TargetProgress | null {
  if (!target || target <= 0) return null;

  const typicalFullDay = baseline?.dailyMedianRevenue ?? 0;
  const usableBaseline = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES && typicalFullDay > 0;

  let share: number;
  if (usableBaseline) {
    share = baselineByMinute(baseline, nowMinutes) / typicalFullDay;
  } else if (openMinutes !== null && closeMinutes !== null && closeMinutes > openMinutes) {
    share = (nowMinutes - openMinutes) / (closeMinutes - openMinutes);
  } else {
    share = nowMinutes / (24 * 60);
  }
  share = Math.min(1, Math.max(0, share));

  const expectedByNow = target * share;
  return {
    target,
    expectedByNow,
    progress: takenSoFar / target,
    ahead: takenSoFar >= expectedByNow,
    delta: takenSoFar - expectedByNow,
    spreadEvenly: !usableBaseline,
  };
}
