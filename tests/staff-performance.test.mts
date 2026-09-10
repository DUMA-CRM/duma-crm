import assert from 'node:assert/strict';
import test from 'node:test';

const { divide, fmtMins, fmtPct, hasSlowTail, otherOrders, otherSources, performanceMetrics, windowSpanDays } = await import(
  '../lib/utils/staff-performance.ts'
);

type Window = Parameters<typeof performanceMetrics>[0];

const window = (over: Partial<Window> = {}): Window =>
  ({
    window: 'last30Days',
    windowDays: 30,
    totalOrders: 100,
    completedOrders: 90,
    cancelledOrders: 10,
    cancellationRate: 0.1,
    totalRevenue: '2500.00',
    avgOrderValue: '25.00',
    activeDays: 20,
    avgOrdersPerActiveDay: 5,
    avgOrdersPerCalendarDay: null,
    bySource: { pos: 70, mobile: 20 },
    firstOrderAt: '2026-08-11T09:00:00Z',
    lastOrderAt: '2026-09-09T17:00:00Z',
    prepTime: { measuredOrders: 45, avgSeconds: 240, avgMinutes: 4, medianSeconds: 210, medianMinutes: 3.5, minMinutes: 1, maxMinutes: 20 },
    ...over,
  }) as Window;

// ── divide ───────────────────────────────────────────────────────────────────

test('divide never yields NaN or Infinity on an empty window', () => {
  assert.equal(divide(0, 0), 0);
  assert.equal(divide(5, 0), 0);
  assert.equal(divide(-5, 0), 0);
  assert.equal(divide(10, 4), 2.5);
});

// ── windowSpanDays ───────────────────────────────────────────────────────────

test('a fixed window uses its stated length', () => {
  assert.equal(windowSpanDays(window({ windowDays: 7 })), 7);
});

test('all-time spans first to last order, inclusive of both days', () => {
  const span = windowSpanDays(
    window({ windowDays: null, firstOrderAt: '2026-09-01T09:00:00Z', lastOrderAt: '2026-09-10T09:00:00Z' }),
  );
  assert.equal(span, 10);
});

test('a single-day all-time window is one day', () => {
  // It is a denominator — 0 would produce Infinity, and 2 halves every rate.
  const span = windowSpanDays(
    window({ windowDays: null, firstOrderAt: '2026-09-10T09:00:00Z', lastOrderAt: '2026-09-10T17:00:00Z' }),
  );
  assert.equal(span, 1);
});

test('the span counts dates, not elapsed time', () => {
  // Regression: `ceil(elapsedMs / day) + 1` returned 11 here, because the last
  // order sits later in the day than the first. Both of these are ten days.
  const evenHours = window({ windowDays: null, firstOrderAt: '2026-09-01T09:00:00Z', lastOrderAt: '2026-09-10T09:00:00Z' });
  const laterInDay = window({ windowDays: null, firstOrderAt: '2026-09-01T09:00:00Z', lastOrderAt: '2026-09-10T17:00:00Z' });
  assert.equal(windowSpanDays(evenHours), 10);
  assert.equal(windowSpanDays(laterInDay), 10);
});

test('with no orders at all the span falls back to active days, floored at 1', () => {
  assert.equal(windowSpanDays(window({ windowDays: null, firstOrderAt: null, lastOrderAt: null, activeDays: 4 })), 4);
  assert.equal(windowSpanDays(window({ windowDays: null, firstOrderAt: null, lastOrderAt: null, activeDays: 0 })), 1);
});

// ── performanceMetrics ───────────────────────────────────────────────────────

test('rates are percentages, not fractions', () => {
  const m = performanceMetrics(window());
  assert.equal(m.completionRate, 90);
  assert.equal(m.cancellationRate, 10);
  assert.equal(m.posShare, 70);
  assert.equal(m.mobileShare, 20);
});

test('active-day and calendar-day rates are distinct denominators', () => {
  // 20 active days inside a 30-day window: the same person looks busier per
  // day worked than per day elapsed, and the two must not be interchangeable.
  const m = performanceMetrics(window());
  assert.equal(m.revenuePerActiveDay, 125);
  assert.equal(m.revenuePerCalendarDay, 2500 / 30);
  assert.notEqual(m.revenuePerActiveDay, m.revenuePerCalendarDay);
  assert.equal(Math.round(m.activityCoverage), 67);
});

test("the API's own per-calendar-day figure wins when it supplies one", () => {
  const m = performanceMetrics(window({ avgOrdersPerCalendarDay: 9.9 }));
  assert.equal(m.ordersPerCalendarDay, 9.9);
});

test('a window with no orders produces zeros throughout, never NaN', () => {
  const m = performanceMetrics(
    window({
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      cancellationRate: 0,
      totalRevenue: '0.00',
      avgOrderValue: '0.00',
      activeDays: 0,
      avgOrdersPerActiveDay: 0,
      bySource: { pos: 0, mobile: 0 },
      prepTime: { measuredOrders: 0, avgSeconds: 0, avgMinutes: 0, medianSeconds: 0, medianMinutes: 0, minMinutes: 0, maxMinutes: 0 },
    }),
  );
  for (const [key, value] of Object.entries(m)) {
    assert.ok(Number.isFinite(value), `${key} is ${value}`);
  }
  assert.equal(m.completionRate, 0);
  assert.equal(m.prepCoverage, 0);
});

test('money arrives as a string and is parsed only for arithmetic', () => {
  const m = performanceMetrics(window({ totalRevenue: '1234.56', avgOrderValue: '12.34' }));
  assert.equal(m.revenue, 1234.56);
  assert.equal(m.revenuePerOrder, 12.34);
});

// ── Residual buckets ─────────────────────────────────────────────────────────

test('other orders and other sources are the unnamed remainder, never negative', () => {
  assert.equal(otherOrders(window({ totalOrders: 100, completedOrders: 90, cancelledOrders: 5 })), 5);
  assert.equal(otherSources(window({ totalOrders: 100, bySource: { pos: 70, mobile: 20 } })), 10);
  // Inconsistent counts from the API must not render as a negative bar.
  assert.equal(otherOrders(window({ totalOrders: 10, completedOrders: 9, cancelledOrders: 9 })), 0);
  assert.equal(otherSources(window({ totalOrders: 10, bySource: { pos: 9, mobile: 9 } })), 0);
});

// ── Prep time ────────────────────────────────────────────────────────────────

test('a slow tail is a mean well above the median, not simply a high mean', () => {
  assert.equal(hasSlowTail(window({ prepTime: { measuredOrders: 10, avgSeconds: 300, avgMinutes: 5, medianSeconds: 180, medianMinutes: 3, minMinutes: 1, maxMinutes: 40 } })), true);
  // Uniformly slow: high, but evenly so — a different problem.
  assert.equal(hasSlowTail(window({ prepTime: { measuredOrders: 10, avgSeconds: 540, avgMinutes: 9, medianSeconds: 540, medianMinutes: 9, minMinutes: 8, maxMinutes: 10 } })), false);
  // Nothing measured means nothing can be claimed.
  assert.equal(hasSlowTail(window({ prepTime: { measuredOrders: 0, avgSeconds: 5940, avgMinutes: 99, medianSeconds: 60, medianMinutes: 1, minMinutes: 0, maxMinutes: 0 } })), false);
});

test('an unmeasured prep time renders as a dash rather than 0 minutes', () => {
  assert.equal(fmtMins(0, 12), '—');
  assert.equal(fmtMins(5, 0.5), '30s');
  assert.equal(fmtMins(5, 4.26), '4.3 min');
});

test('fmtPct keeps one decimal', () => {
  assert.equal(fmtPct(66.666), '66.7%');
  assert.equal(fmtPct(100), '100%');
});
