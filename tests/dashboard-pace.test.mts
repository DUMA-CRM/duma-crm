import assert from 'node:assert/strict';
import test from 'node:test';

const { MIN_BASELINE_SAMPLES, baselineByMinute, computePace, computeTargetProgress } = await import('../lib/utils/pace.ts');
const { axisHours, axisNowMinutes, axisRange, isOvernight, minutesOf, resolveTradingDay, tradingDayLabel } = await import(
  '../lib/utils/trading-day.ts'
);
type DayBaseline = Parameters<typeof computePace>[0]['baseline'];

/** A baseline that takes £100 in each of the hours 09:00–16:59 — £800 a day. */
function evenBaseline(sampleCount = 8): DayBaseline {
  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const trading = hour >= 9 && hour <= 16;
    const completedHours = Math.min(Math.max(hour - 8, 0), 8);
    return {
      hour,
      cumulativeRevenue: completedHours * 100,
      cumulativeOrders: completedHours * 10,
      revenue: trading ? 100 : 0,
      orderCount: trading ? 10 : 0,
    };
  });
  return {
    weekday: 'thu',
    timezone: 'Europe/London',
    weeks: 8,
    sampleCount,
    sampleDates: [],
    dailyMedianRevenue: 800,
    dailyMedianOrders: 80,
    byHour,
  };
}

// ── Baseline interpolation ───────────────────────────────────────────────────

test('the baseline interpolates inside the current hour', () => {
  const baseline = evenBaseline();
  assert.equal(baselineByMinute(baseline, 9 * 60), 0); // 09:00 — the hour has not been earned yet
  assert.equal(baselineByMinute(baseline, 9 * 60 + 30), 50); // halfway through
  assert.equal(baselineByMinute(baseline, 10 * 60), 100); // the 09:00 hour complete
  assert.equal(baselineByMinute(baseline, 13 * 60), 400);
});

test('interpolating avoids the whole-hour jump that reads as a sudden collapse', () => {
  const baseline = evenBaseline();
  const before = baselineByMinute(baseline, 11 * 60 - 1);
  const after = baselineByMinute(baseline, 11 * 60 + 1);
  assert.ok(after - before < 5, `expected a smooth step, got ${before} → ${after}`);
});

test('a missing baseline reads as zero rather than throwing', () => {
  assert.equal(baselineByMinute(undefined, 600), 0);
  assert.equal(baselineByMinute(null, 600), 0);
});

// ── Pace ─────────────────────────────────────────────────────────────────────

test('ahead of typical is reported with the right sign and percentage', () => {
  const pace = computePace({ takenSoFar: 500, baseline: evenBaseline(), nowMinutes: 13 * 60 });
  assert.equal(pace.available, true);
  assert.equal(pace.expectedByNow, 400);
  assert.equal(pace.delta, 100);
  assert.equal(pace.deltaPct, 25);
});

test('behind typical is negative, not an absolute value', () => {
  const pace = computePace({ takenSoFar: 300, baseline: evenBaseline(), nowMinutes: 13 * 60 });
  assert.equal(pace.delta, -100);
  assert.equal(pace.deltaPct, -25);
});

test('the close is projected by scaling today onto the typical full day', () => {
  const pace = computePace({ takenSoFar: 500, baseline: evenBaseline(), nowMinutes: 13 * 60 });
  // Half the typical day has passed and £500 is in: 500 × (800/400).
  assert.equal(pace.projected, 1000);
});

test('too little history withholds pace entirely', () => {
  const pace = computePace({ takenSoFar: 500, baseline: evenBaseline(MIN_BASELINE_SAMPLES - 1), nowMinutes: 13 * 60 });
  assert.equal(pace.available, false);
  assert.equal(pace.projected, null);
});

test('a sliver of the morning does not get projected to a fantasy close', () => {
  // 09:06 — 10% of an hour into a £800 day, so ~1% of the day has passed.
  const pace = computePace({ takenSoFar: 20, baseline: evenBaseline(), nowMinutes: 9 * 60 + 6 });
  assert.equal(pace.projected, null, 'projecting from 1% of the day would imply £1,600');
});

test('before the first trading hour there is nothing to compare against', () => {
  const pace = computePace({ takenSoFar: 0, baseline: evenBaseline(), nowMinutes: 7 * 60 });
  assert.equal(pace.available, false);
  assert.equal(pace.projected, null);
});

// ── Targets ──────────────────────────────────────────────────────────────────

test('the target is spread by the trading shape, not evenly across the clock', () => {
  const progress = computeTargetProgress({
    target: 1600,
    takenSoFar: 800,
    baseline: evenBaseline(),
    nowMinutes: 13 * 60,
    openMinutes: 9 * 60,
    closeMinutes: 17 * 60,
  });
  // Half the typical day is done, so half the target is due.
  assert.equal(progress?.expectedByNow, 800);
  assert.equal(progress?.ahead, true);
  assert.equal(progress?.spreadEvenly, false);
});

test('an early-morning target is not judged against a full day', () => {
  const progress = computeTargetProgress({
    target: 1600,
    takenSoFar: 0,
    baseline: evenBaseline(),
    nowMinutes: 9 * 60,
    openMinutes: 9 * 60,
    closeMinutes: 17 * 60,
  });
  assert.equal(progress?.expectedByNow, 0, 'nothing is due at the moment the doors open');
  assert.equal(progress?.ahead, true);
});

test('with no usable baseline the target falls back to a straight line and says so', () => {
  const progress = computeTargetProgress({
    target: 800,
    takenSoFar: 300,
    baseline: evenBaseline(1),
    nowMinutes: 13 * 60,
    openMinutes: 9 * 60,
    closeMinutes: 17 * 60,
  });
  assert.equal(progress?.spreadEvenly, true);
  assert.equal(progress?.expectedByNow, 400); // half way through a 09:00–17:00 day
});

test('no target means no target panel', () => {
  const base = { takenSoFar: 100, baseline: evenBaseline(), nowMinutes: 600, openMinutes: 540, closeMinutes: 1020 };
  assert.equal(computeTargetProgress({ ...base, target: null }), null);
  assert.equal(computeTargetProgress({ ...base, target: 0 }), null);
});

// ── Trading day ──────────────────────────────────────────────────────────────

const hours = (open: string, close: string) => ({ open, close });
const week = (day: { open: string; close: string } | null) => ({
  mon: day,
  tue: day,
  wed: day,
  thu: day,
  fri: day,
  sat: day,
  sun: day,
});

test('minutesOf parses a wall clock and rejects nonsense', () => {
  assert.equal(minutesOf('09:30'), 570);
  assert.equal(minutesOf('00:00'), 0);
  assert.equal(minutesOf(undefined), null);
  assert.equal(minutesOf('nope'), null);
});

test('the day is read in the location timezone, not the viewer clock', () => {
  // 08:30 UTC is 09:30 in London (BST) and 04:30 in New York.
  const instant = new Date('2026-08-06T08:30:00Z');
  const london = resolveTradingDay({ timezone: 'Europe/London', openingHours: week(hours('09:00', '17:00')) }, instant);
  const newYork = resolveTradingDay({ timezone: 'America/New_York', openingHours: week(hours('09:00', '17:00')) }, instant);
  assert.equal(london.state, 'trading');
  assert.equal(newYork.state, 'before-open');
});

test('before open, trading and after close are all distinguished', () => {
  const config = { timezone: 'Europe/London', openingHours: week(hours('09:00', '17:00')) };
  assert.equal(resolveTradingDay(config, new Date('2026-08-06T06:00:00Z')).state, 'before-open');
  assert.equal(resolveTradingDay(config, new Date('2026-08-06T12:00:00Z')).state, 'trading');
  assert.equal(resolveTradingDay(config, new Date('2026-08-06T20:00:00Z')).state, 'after-close');
});

test('a closed day is not the same as having no hours configured', () => {
  const closed = resolveTradingDay({ timezone: 'Europe/London', openingHours: week(null) }, new Date('2026-08-06T12:00:00Z'));
  assert.equal(closed.state, 'closed-today');
  const unset = resolveTradingDay({ timezone: 'Europe/London', openingHours: null }, new Date('2026-08-06T12:00:00Z'));
  assert.equal(unset.state, 'no-hours');
});

test('a late shift closing after midnight still counts as trading', () => {
  const config = { timezone: 'Europe/London', openingHours: week(hours('18:00', '02:00')) };
  const nearMidnight = resolveTradingDay(config, new Date('2026-08-06T22:30:00Z')); // 23:30 local
  assert.equal(nearMidnight.state, 'trading');
  assert.equal(nearMidnight.closeMinutes, 26 * 60, 'the close belongs to the next day clock');
  assert.ok((nearMidnight.progress ?? 0) > 0 && (nearMidnight.progress ?? 0) < 1);
});

test('the chart axis covers the closing hour rather than cutting it off', () => {
  const day = resolveTradingDay(
    { timezone: 'Europe/London', openingHours: week(hours('07:00', '17:30')) },
    new Date('2026-08-06T10:00:00Z'),
  );
  assert.equal(day.axis.firstHour, 7);
  assert.equal(day.axis.lastHour, 17, 'a 17:30 close still needs the 17:00 hour on the axis');
});

test('progress through the day stays within bounds', () => {
  const config = { timezone: 'Europe/London', openingHours: week(hours('09:00', '17:00')) };
  const midday = resolveTradingDay(config, new Date('2026-08-06T12:00:00Z')); // 13:00 local
  assert.equal(midday.progress, 0.5);
  assert.equal(resolveTradingDay(config, new Date('2026-08-06T20:00:00Z')).progress, null);
});

test('the state label speaks plainly', () => {
  const config = { timezone: 'Europe/London', openingHours: week(hours('09:00', '17:00')) };
  assert.equal(tradingDayLabel(resolveTradingDay(config, new Date('2026-08-06T12:00:00Z'))), 'Open until 17:00');
  assert.equal(tradingDayLabel(resolveTradingDay(config, new Date('2026-08-06T06:00:00Z'))), 'Opens at 09:00');
});

// ── Chart axis ───────────────────────────────────────────────────────────────

test('the axis covers open to close in minute space', () => {
  const day = resolveTradingDay(
    { timezone: 'Europe/London', openingHours: week(hours('07:00', '20:00')) },
    new Date('2026-08-06T12:00:00Z'),
  );
  const range = axisRange(day);
  assert.equal(range.start, 7 * 60);
  assert.equal(range.end, 20 * 60);
  assert.equal(isOvernight(day), false);
});

test('an overnight day runs left to right instead of folding back on itself', () => {
  const day = resolveTradingDay(
    { timezone: 'Europe/London', openingHours: week(hours('18:00', '02:00')) },
    new Date('2026-08-07T00:30:00Z'), // 01:30 local — after midnight, still trading
  );
  assert.equal(isOvernight(day), true);
  const range = axisRange(day);
  assert.equal(range.start, 18 * 60);
  assert.equal(range.end, 26 * 60, 'the close belongs to the next day');

  // 01:30 must land near the right-hand end, not pinned to the left edge.
  const nowMinutes = axisNowMinutes(day);
  assert.equal(nowMinutes, 25 * 60 + 30);
  const position = (nowMinutes - range.start) / (range.end - range.start);
  assert.ok(position > 0.9 && position <= 1, `expected the far right, got ${position}`);
});

test('axis buckets wrap past midnight while keeping real clock hours', () => {
  const day = resolveTradingDay(
    { timezone: 'Europe/London', openingHours: week(hours('22:00', '02:00')) },
    new Date('2026-08-06T22:30:00Z'),
  );
  const buckets = axisHours(day);
  assert.deepEqual(
    buckets.map((bucket) => bucket.hour),
    [22, 23, 0, 1],
  );
  // Positions keep increasing even though the clock hours wrap.
  assert.deepEqual(
    buckets.map((bucket) => bucket.startMinutes),
    [22 * 60, 23 * 60, 24 * 60, 25 * 60],
  );
});

test('after close, now sits beyond the axis so the rule can be dropped', () => {
  // Axis ends at 20:00; it is 22:00.
  const day = resolveTradingDay(
    { timezone: 'Europe/London', openingHours: week(hours('08:00', '20:00')) },
    new Date('2026-08-06T21:00:00Z'), // 22:00 local
  );
  assert.equal(day.state, 'after-close');
  const range = axisRange(day);
  const position = (axisNowMinutes(day) - range.start) / (range.end - range.start);
  assert.ok(position > 1, `now must fall outside the axis so it is not pinned to the end, got ${position}`);
});
