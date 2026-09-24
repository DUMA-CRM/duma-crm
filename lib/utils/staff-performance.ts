// ---------------------------------------------------------------------------
// The arithmetic behind a staff member's operational performance.
//
// Lifted out of `EmployeeRecordPage` when the performance view moved to
// Reports. It is all rate-and-ratio work over one window of attributed orders,
// and none of it needs React — which is the only reason any of it can now be
// tested.
//
// A caution that belongs with the numbers rather than only in the UI copy:
// these are *attributed* operational metrics, not an employee score. Orders are
// matched by `orders.createdBy`, so they measure the till a person stood at as
// much as the person.
// ---------------------------------------------------------------------------
import type { StaffPerfWindow } from '@/lib/modules/identity/client';

/** Guarded division — an empty window must yield 0, never `NaN` or `Infinity`. */
export const divide = (value: number, denominator: number): number => (denominator > 0 ? value / denominator : 0);

const DAY_MS = 86_400_000;

/** Midnight UTC on the day an instant falls, so spans count dates not durations. */
function utcMidnight(iso: string): number {
  const at = new Date(iso);
  return Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
}

/**
 * How many calendar days the window covers, counting both end days.
 *
 * The API states `windowDays` for the fixed windows and leaves it null for
 * all-time, where the span has to come from the first and last order. With
 * neither, fall back to the days actually worked — never 0, because it is a
 * denominator.
 *
 * This counts *dates*, not elapsed time. The version this replaced was
 * `Math.ceil(elapsedMs / DAY_MS) + 1`, which gains a phantom day whenever the
 * last order is later in the day than the first — the ordinary case. A ten-day
 * career read as eleven days and a single trading day read as two, deflating
 * every per-calendar-day rate and the activity coverage on the all-time window
 * — which is the baseline the other two windows are compared against.
 * Fixed windows were unaffected, since they never reach this branch.
 */
export function windowSpanDays(window: StaffPerfWindow): number {
  if (window.windowDays) return window.windowDays;
  if (!window.firstOrderAt || !window.lastOrderAt) return Math.max(window.activeDays, 1);
  // Both operands are UTC midnights, so the quotient is a whole number of days.
  return Math.max(1, Math.round((utcMidnight(window.lastOrderAt) - utcMidnight(window.firstOrderAt)) / DAY_MS) + 1);
}

export interface PerformanceMetrics {
  spanDays: number;
  revenue: number;
  completionRate: number;
  cancellationRate: number;
  revenuePerOrder: number;
  ordersPerActiveDay: number;
  ordersPerCalendarDay: number;
  revenuePerActiveDay: number;
  revenuePerCalendarDay: number;
  /** Share of the span on which this person took any order at all. */
  activityCoverage: number;
  /** Share of completed orders that carry a usable prep time. */
  prepCoverage: number;
  posShare: number;
  mobileShare: number;
}

/**
 * Per-day and per-order rates for one window.
 *
 * Two denominators are deliberately kept apart. *Active day* rates describe how
 * someone works on a day they work; *calendar day* rates describe their
 * contribution over the period. A part-timer looks fast on the first and
 * modest on the second, and conflating them is how a rota decision gets made on
 * the wrong figure.
 */
export function performanceMetrics(window: StaffPerfWindow): PerformanceMetrics {
  const spanDays = windowSpanDays(window);
  const revenue = Number(window.totalRevenue);
  return {
    spanDays,
    revenue,
    completionRate: divide(window.completedOrders, window.totalOrders) * 100,
    cancellationRate: window.cancellationRate * 100,
    revenuePerOrder: Number(window.avgOrderValue),
    ordersPerActiveDay: window.avgOrdersPerActiveDay,
    ordersPerCalendarDay: window.avgOrdersPerCalendarDay ?? divide(window.totalOrders, spanDays),
    revenuePerActiveDay: divide(revenue, window.activeDays),
    revenuePerCalendarDay: divide(revenue, spanDays),
    activityCoverage: divide(window.activeDays, spanDays) * 100,
    prepCoverage: divide(window.prepTime.measuredOrders, window.completedOrders) * 100,
    posShare: divide(window.bySource.pos, window.totalOrders) * 100,
    mobileShare: divide(window.bySource.mobile, window.totalOrders) * 100,
  };
}

/** Orders that are neither completed nor cancelled — open, or in some other state. */
export const otherOrders = (window: StaffPerfWindow): number =>
  Math.max(0, window.totalOrders - window.completedOrders - window.cancelledOrders);

/** Orders from neither the till nor the mobile app (QR, and anything added later). */
export const otherSources = (window: StaffPerfWindow): number =>
  Math.max(0, window.totalOrders - window.bySource.pos - window.bySource.mobile);

/**
 * A mean well above the median means a few very slow orders, not a uniformly
 * slow server — a different conversation, so it is worth naming separately.
 */
export const hasSlowTail = (window: StaffPerfWindow): boolean =>
  window.prepTime.measuredOrders > 0 && window.prepTime.avgMinutes > window.prepTime.medianMinutes * 1.2;

export const fmtMins = (measuredOrders: number, mins: number): string =>
  measuredOrders === 0 ? '—' : mins < 1 ? `${Math.round(mins * 60)}s` : `${Math.round(mins * 10) / 10} min`;

export const fmtPct = (value: number): string => `${Math.round(value * 10) / 10}%`;
