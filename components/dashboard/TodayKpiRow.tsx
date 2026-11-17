'use client';

import { Banknote, ReceiptText, RotateCcw, ShoppingBag, TrendingDown, TrendingUp, Users } from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { FactsSkeleton } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import type { DayBaseline, LabourAnalytics } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { formatCompact } from '@/lib/utils/dashboard';
import { MIN_BASELINE_SAMPLES, baselineByMinute } from '@/lib/utils/pace';
import {
  type FigureChange,
  LABOUR_SHARE_WARNING,
  baselineOrdersByMinute,
  figureChange,
  labourShare,
  weekdayName,
} from '@/lib/utils/today-figures';
import type { TradingDay } from '@/lib/utils/trading-day';

/* Today's headline figures, led as Square, Shopify and Stripe lead theirs:
   net sales, orders, average order, then labour and refunds. Each carries the
   comparison that makes it mean something, named in words — "+4% vs a typical
   Thursday by now". Anything that can't be compared honestly says so. */

/** "▲ 4% vs a typical Thursday" — green up, amber down, a plain word when level. */
function Change({ change, basis }: { change: FigureChange; basis: string }) {
  if (change.percent === null) return <span>No comparison yet</span>;
  if (change.direction === 'flat') return <span>Level with {basis}</span>;
  const up = change.direction === 'up';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', up ? 'text-momentum' : 'text-measured')}>
        {up ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
        {up ? '+' : '−'}
        {Math.abs(change.percent)}%
      </span>
      vs {basis}
    </span>
  );
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
  showLabour = true,
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
  /** Labour comes from Workforce's shifts; without that module there is nothing to cost. */
  showLabour?: boolean;
}) {
  const formatMoney = useFormatMoney();
  const comparable = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES && day.state !== 'before-open' && day.state !== 'closed-today';

  const typicalOrders = comparable ? baselineOrdersByMinute(baseline, day.nowMinutes) : null;
  const typicalRevenue = comparable ? baselineByMinute(baseline, day.nowMinutes) : null;
  const typicalAov = typicalOrders && typicalRevenue !== null ? typicalRevenue / typicalOrders : null;
  const basis = `a typical ${weekdayName(day.weekday)}`;

  const labourRatio = labour ? labourShare(labour.estimatedCost, revenue) : null;
  const labourHint = labourError
    ? 'Labour couldn’t be loaded'
    : labour
      ? [
          `${labour.paidHours.toFixed(1)}h · ${labour.headcount} on shift`,
          labour.uncostedHours > 0 ? `${labour.uncostedHours.toFixed(1)}h unrostered` : null,
          labour.staffMissingPayData > 0 ? `${labour.staffMissingPayData} without pay data` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'No shifts recorded yet';

  const count = showLabour ? 5 : 4;

  if (loading) {
    return (
      <FactsSkeleton
        count={count}
        label="Loading today’s figures"
        className={cn('grid-cols-1 sm:grid-cols-2', showLabour ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}
      />
    );
  }

  return (
    // Five tiles take one row of five on a wide screen; on a tablet the last spans the pair, so no row has a hole.
    <dl aria-label="Today’s figures" className={cn('grid gap-3 sm:grid-cols-2', showLabour ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
      <Fact
        surface="page"
        icon={Banknote}
        label="Net sales"
        value={formatMoney(revenue)}
        hint={<Change change={figureChange(revenue, typicalRevenue)} basis={basis} />}
        href="/reports/sales-summary"
      />
      <Fact
        surface="page"
        icon={ShoppingBag}
        label="Orders"
        value={formatCompact(orders)}
        hint={<Change change={figureChange(orders, typicalOrders)} basis={basis} />}
        href="/orders"
      />
      <Fact
        surface="page"
        icon={ReceiptText}
        label="Average order"
        value={formatMoney(averageOrderValue, 2)}
        hint={<Change change={figureChange(averageOrderValue, typicalAov)} basis={basis} />}
        href="/reports/sales-summary"
      />
      {showLabour && (
        <Fact
          surface="page"
          icon={Users}
          label="Labour"
          value={
            labourLoading
              ? '…'
              : labourRatio !== null
                ? `${labourRatio.toFixed(0)}% of sales`
                : labour
                  ? formatMoney(labour.estimatedCost)
                  : '—'
          }
          hint={labourHint}
          tone={labourError || (labourRatio !== null && labourRatio > LABOUR_SHARE_WARNING) ? 'warning' : 'default'}
          href="/staff/shifts"
        />
      )}
      <div className={cn('grid', showLabour && 'sm:col-span-2 xl:col-span-1')}>
        <Fact
          surface="page"
          icon={RotateCcw}
          label="Refunds paid"
          value={formatMoney(refundsIssuedToday, 2)}
          hint={
            refundsIssuedToday > 0 || refundsOnTodaysSales > 0
              ? `${formatMoney(refundsOnTodaysSales, 2)} against today’s sales`
              : 'Nothing refunded today'
          }
          tone={refundsIssuedToday > 0 ? 'warning' : 'default'}
          href="/reports/refunds"
        />
      </div>
    </dl>
  );
}
