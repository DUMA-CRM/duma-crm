'use client';

import { Mascot } from '@/components/ai/Mascot';
import { ArrowRight, ReceiptText, RotateCcw, ShoppingBag, TrendingDown, TrendingUp, Users } from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { FactsSkeleton } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { askDuma } from '@/lib/ai/ask-duma';
import type { DayBaseline, LabourAnalytics } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { formatCompact, percentageChange } from '@/lib/utils/dashboard';
import { MIN_BASELINE_SAMPLES, baselineByMinute } from '@/lib/utils/pace';
import { todayInsight } from '@/lib/utils/today-insight';
import type { TradingDay } from '@/lib/utils/trading-day';

/* Today's figures as the Orders page's tiles — an icon rail, the number, one
   line of context — each carrying the comparison that makes it mean something.
   A bare "142 orders" is a number; "142 orders, 4% above a typical Thursday by
   now" is a reading a manager can act on. Anything that cannot be compared
   honestly says so rather than showing a confident zero.

   The row is always full: when a module leaves fewer than four figures, Ask
   DUMA takes the rest of it with the one thing worth knowing about today. */

/** Baseline order count by this minute, interpolated inside the current hour. */
function baselineOrdersByMinute(baseline: DayBaseline | undefined, minutes: number) {
  if (!baseline?.byHour?.length) return 0;
  const hour = Math.min(23, Math.max(0, Math.floor(minutes / 60)));
  const completed = hour > 0 ? (baseline.byHour[hour - 1]?.cumulativeOrders ?? 0) : 0;
  return completed + (baseline.byHour[hour]?.orderCount ?? 0) * ((minutes % 60) / 60);
}

/** "▲ 4% vs typical Thursday" — green up, amber down; the hint line's lead. */
function Change({ value, label }: { value: number | null | undefined; label: string }) {
  if (value === null || value === undefined) return null;
  const rounded = Math.round(value);
  if (rounded === 0) return <span>In line with {label.replace(/^vs /, 'a ')}</span>;
  const up = rounded > 0;
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', up ? 'text-momentum' : 'text-measured')}>
      {up ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
      {up ? '+' : '−'}
      {Math.abs(rounded)}% {label}
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
          labour.uncostedHours > 0 ? `${labour.uncostedHours.toFixed(1)}h unrostered` : null,
          labour.staffMissingPayData > 0 ? `${labour.staffMissingPayData} without pay data` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'No shifts recorded yet';

  const figures = showLabour ? 4 : 3;
  // What's left of a row of four (and of two, on a tablet) goes to Ask DUMA.
  const spare = 4 - figures;
  const insight = todayInsight(
    {
      weekday: day.weekday,
      comparable,
      open: day.state !== 'before-open',
      orders,
      typicalOrders,
      averageOrder: averageOrderValue,
      typicalAverageOrder: typicalAov,
      refunds: refundsIssuedToday,
      labourPercent: showLabour ? labourRatio : null,
    },
    (value) => formatMoney(value, 2),
  );

  if (loading) {
    return <FactsSkeleton count={4} label="Loading today’s figures" className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />;
  }

  return (
    <dl aria-label="Today's figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Fact
        surface="page"
        icon={ShoppingBag}
        label="Orders"
        value={formatCompact(orders)}
        hint={
          comparable ? (
            <>
              <Change value={percentageChange(orders, typicalOrders)} label={vsTypical} /> · {Math.round(typicalOrders)} expected
            </>
          ) : (
            'No comparison yet'
          )
        }
        href="/orders"
      />
      <Fact
        surface="page"
        icon={ReceiptText}
        label="Average order"
        value={formatMoney(averageOrderValue, 2)}
        hint={
          comparable && typicalAov > 0 ? (
            <>
              <Change value={percentageChange(averageOrderValue, typicalAov)} label={vsTypical} /> · {formatMoney(typicalAov, 2)} expected
            </>
          ) : (
            'No comparison yet'
          )
        }
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
                ? `${labourRatio.toFixed(0)}% of takings`
                : labour
                  ? formatMoney(labour.estimatedCost)
                  : '—'
          }
          hint={labourHint}
          tone={labourRatio !== null && labourRatio > 35 ? 'warning' : 'default'}
          href="/staff/shifts"
        />
      )}
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
      {spare > 0 && <AskTile line={insight.line} prompt={insight.prompt} span={spare} />}
    </dl>
  );
}

/**
 * The row's spare room, given to Ask DUMA: the mascot in the icon rail, the
 * one thing worth knowing about today, and a tap that opens the assistant with
 * the question already typed (not sent).
 */
function AskTile({ line, prompt, span }: { line: string; prompt: string; span: number }) {
  return (
    // One spare slot fills the row beside the last figure at every width; two take a row of their own.
    <div className={cn(span >= 2 && 'sm:col-span-2')}>
      <button
        type="button"
        onClick={() => askDuma(prompt)}
        className="group flex h-full w-full items-stretch overflow-hidden rounded-lg border border-primary/25 bg-primary/5 text-left transition-colors hover:border-primary/45 hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex w-14 shrink-0 items-center justify-center border-r border-primary/20 bg-primary/10" aria-hidden="true">
          <Mascot size={34} feeling="curious" fps={24} />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3">
          <span className="min-w-0 flex-1">
            <dt className="text-label uppercase text-primary">Ask DUMA</dt>
            <dd className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{line}</dd>
          </span>
          <ArrowRight size={14} className="shrink-0 text-primary/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
