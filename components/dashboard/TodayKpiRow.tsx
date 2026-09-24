'use client';

import { ReceiptText, RotateCcw, ShoppingBag, Users } from '@/components/icons';
import { StatCard, StatCardGrid, changeDelta } from '@/components/shared/StatCard';

import type { DayBaseline, LabourAnalytics } from '@/lib/modules/analytics/client';
import { formatCompact, formatMoney, percentageChange } from '@/lib/utils/dashboard';
import { MIN_BASELINE_SAMPLES, baselineByMinute } from '@/lib/utils/pace';
import type { TradingDay } from '@/lib/utils/trading-day';

/* Four figures, each carrying the comparison that makes it mean something.
   A bare "142 orders" is a number; "142 orders, 4% above a typical Thursday by
   now" is a reading a manager can act on. Anything that cannot be compared
   honestly says so rather than showing a confident zero. */

/** Baseline order count by this minute, interpolated inside the current hour. */
function baselineOrdersByMinute(baseline: DayBaseline | undefined, minutes: number) {
  if (!baseline?.byHour?.length) return 0;
  const hour = Math.min(23, Math.max(0, Math.floor(minutes / 60)));
  const completed = hour > 0 ? (baseline.byHour[hour - 1]?.cumulativeOrders ?? 0) : 0;
  return completed + (baseline.byHour[hour]?.orderCount ?? 0) * ((minutes % 60) / 60);
}

export function TodayKpiRow({
  day,
  orders,
  averageOrderValue,
  revenue,
  refundsIssuedToday,
  refundsOnTodaysSales,
  labour,
  baseline,
  loading,
  labourLoading,
  labourError,
}: {
  day: TradingDay;
  orders: number;
  averageOrderValue: number;
  revenue: number;
  /** Refunds paid out today, whenever the original sale happened. */
  refundsIssuedToday: number;
  /** Refunds against sales made today — the number that dents today's takings. */
  refundsOnTodaysSales: number;
  labour: LabourAnalytics | undefined;
  baseline: DayBaseline | undefined;
  loading: boolean;
  labourLoading: boolean;
  labourError: boolean;
}) {
  const comparable = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES && day.state !== 'before-open' && day.state !== 'closed-today';

  const typicalOrders = baselineOrdersByMinute(baseline, day.nowMinutes);
  const typicalRevenue = baselineByMinute(baseline, day.nowMinutes);
  const typicalAov = typicalOrders > 0 ? typicalRevenue / typicalOrders : 0;

  const vsTypical = `vs typical ${day.weekday}`;

  // Labour as a share of what has actually been taken. Below a floor of revenue
  // the percentage is arithmetic noise — two coffees and one person on shift is
  // not a 400% labour problem.
  const labourRatio = labour && revenue >= 50 ? (labour.estimatedCost / revenue) * 100 : null;
  const labourHint = labourError
    ? 'Labour could not be loaded'
    : labour
      ? [
          `${labour.paidHours.toFixed(1)}h · ${labour.headcount} on shift`,
          labour.uncostedHours > 0 ? `${labour.uncostedHours.toFixed(1)}h unrostered, not costed` : null,
          labour.staffMissingPayData > 0 ? `${labour.staffMissingPayData} without pay data` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'No shifts recorded yet';

  return (
    <StatCardGrid aria-label="Today's figures">
      <StatCard
        label="Orders"
        value={formatCompact(orders)}
        hint={comparable ? `${Math.round(typicalOrders)} by now on a typical ${day.weekday}` : 'No comparison available'}
        delta={comparable ? changeDelta(percentageChange(orders, typicalOrders), { label: vsTypical }) : undefined}
        icon={ShoppingBag}
        accent="info"
        href="/orders"
        loading={loading}
      />
      <StatCard
        label="Average order"
        value={formatMoney(averageOrderValue, 2)}
        hint={comparable && typicalAov > 0 ? `${formatMoney(typicalAov, 2)} on a typical ${day.weekday}` : 'No comparison available'}
        delta={
          comparable && typicalAov > 0 ? changeDelta(percentageChange(averageOrderValue, typicalAov), { label: vsTypical }) : undefined
        }
        icon={ReceiptText}
        accent="purple"
        href="/reports"
        loading={loading}
      />
      <StatCard
        label="Labour"
        value={labourRatio !== null ? `${labourRatio.toFixed(0)}%` : labour ? formatMoney(labour.estimatedCost) : '—'}
        hint={labourHint}
        icon={Users}
        accent={labourRatio !== null && labourRatio > 35 ? 'warning' : 'success'}
        href="/staff/shifts"
        loading={labourLoading}
      />
      <StatCard
        label="Refunds paid"
        value={formatMoney(refundsIssuedToday, 2)}
        hint={
          refundsIssuedToday > 0 || refundsOnTodaysSales > 0
            ? `${formatMoney(refundsOnTodaysSales, 2)} of it against sales made today`
            : 'Nothing refunded today'
        }
        icon={RotateCcw}
        accent={refundsIssuedToday > 0 ? 'warning' : 'neutral'}
        href="/reports/refunds"
        loading={loading}
      />
    </StatCardGrid>
  );
}
