'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { TINT_FILL, type WidgetTint, useFamily } from '@/components/dashboard/widget/Widget';
import { WidgetCompare, WidgetCurve, WidgetFacts, WidgetRing } from '@/components/dashboard/widget/parts';
import { Banknote, ReceiptText, RotateCcw, ShoppingBag, TrendingDown, TrendingUp, Users } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { FactsSkeleton } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { hasCapability } from '@/lib/auth/capabilities';
import type { TodayDashboard } from '@/lib/hooks/useTodayDashboard';
import { getRefundReport } from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatCompact, getDateWindow } from '@/lib/utils/dashboard';
import { amountsByHour, axisTicks, daySeries, hourLabel } from '@/lib/utils/day-series';
import { comparisonWait } from '@/lib/utils/day-story';
import { MIN_BASELINE_SAMPLES, baselineByMinute } from '@/lib/utils/pace';
import {
  type FigureChange,
  LABOUR_SHARE_WARNING,
  baselineOrdersByMinute,
  figureChange,
  labourShare,
  weekdayName,
} from '@/lib/utils/today-figures';
import { axisHours, axisNowMinutes } from '@/lib/utils/trading-day';
import { workspaceDateKey } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

/* Today's headline figures, each its own widget so a board carries only the
   ones it needs — and each one the product's stat tile, the `Fact` the
   figures row has always used: an icon tile, the label, the figure, and what
   it is measured against in words ("+4% vs a typical Thursday"). One grid row
   is one tile. A wider or taller tile keeps that row and adds the day's
   picture: beside the figure on a bar, under it from small up, with the
   figures behind it on a medium. */

export type TodayFigureKey =
  | 'analytics.net-sales'
  | 'analytics.orders'
  | 'analytics.average-order'
  | 'analytics.labour'
  | 'analytics.refunds';

const FIGURES: Record<TodayFigureKey, { icon: IconComponent; label: string; href: string; tint: WidgetTint }> = {
  'analytics.net-sales': { icon: Banknote, label: 'Net sales', href: '/reports/sales-summary', tint: 'money' },
  'analytics.orders': { icon: ShoppingBag, label: 'Orders', href: '/orders', tint: 'orders' },
  'analytics.average-order': { icon: ReceiptText, label: 'Average order', href: '/reports/sales-summary', tint: 'kitchen' },
  'analytics.labour': { icon: Users, label: 'Labour', href: '/staff/rota', tint: 'team' },
  'analytics.refunds': { icon: RotateCcw, label: 'Refunds paid', href: '/reports/refunds', tint: 'orders' },
};

export const isTodayFigure = (key: string): key is TodayFigureKey => key in FIGURES;

/** "▲ 4% vs a typical Thursday" — green up, amber down, a plain word when level. */
function Change({ change, basis, waiting }: { change: FigureChange; basis: string; waiting: string }) {
  if (change.percent === null) return <span>{waiting}</span>;
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

/** The day's hours as bars: elapsed in the figure's colour, those to come a quiet trough. */
function HourBars({ values, nowIndex, tint, label }: { values: number[]; nowIndex: number; tint: WidgetTint; label: string }) {
  const max = Math.max(1, ...values);
  const elapsed = nowIndex < 0 ? values.length : nowIndex;
  return (
    <div className="flex h-full min-h-0 items-end gap-[3px]" role="img" aria-label={label}>
      {values.map((value, index) => (
        <span
          key={index}
          className={cn(
            'min-w-0 flex-1 rounded-t-[4px]',
            index > elapsed ? 'bg-band' : TINT_FILL[tint],
            index === nowIndex && 'opacity-60',
          )}
          style={{ height: `${Math.max(index > elapsed ? 8 : 6, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function TodayFigure({ figure, dashboard }: { figure: TodayFigureKey; dashboard: TodayDashboard }) {
  const money = useFormatMoney();
  const family = useFamily();
  const { icon, label, tint } = FIGURES[figure];
  const { tradingDay: day, metrics, baseline, labour, hourly, pace, loading, errors, refresh } = dashboard;
  // Refunds paid draws its hours from today's refunds, which need the refunds report's own capability;
  // without it the widget keeps its share-of-sales ring.
  const canSeeRefunds = useAuthStore((state) => hasCapability(state.capabilities, 'orders:refund'));
  const locationId = dashboard.selectedLocation?.id;
  const refunds = useQuery({
    queryKey: moduleQueryKeys.payments.key('dashboard-refunds', workspaceDateKey(new Date(), day.timeZone), locationId ?? 'all'),
    queryFn: () => {
      const window = getDateWindow('today', day.timeZone);
      return getRefundReport({ from: window.from, to: window.to, basis: 'refund', ...(locationId ? { locationId } : {}) });
    },
    enabled: figure === 'analytics.refunds' && canSeeRefunds,
    refetchInterval: 60_000,
  });
  const refundsPaid = Number(dashboard.refundsIssuedToday);
  const refundsOnSales = Number(dashboard.refundsOnTodaysSales);

  const showToday = day.state !== 'before-open' && day.state !== 'closed-today';
  const hasHistory = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES;
  const comparable = hasHistory && showToday;
  const typicalOrders = comparable ? baselineOrdersByMinute(baseline, day.nowMinutes) : null;
  const typicalRevenue = comparable ? baselineByMinute(baseline, day.nowMinutes) : null;
  const typicalAov = typicalOrders && typicalRevenue !== null ? typicalRevenue / typicalOrders : null;
  const weekday = weekdayName(day.weekday);
  const basis = `a typical ${weekday}`;
  // Why there's nothing to compare with, in words: the day isn't under way, or there aren't enough of its weekday yet.
  const waiting = !showToday
    ? day.state === 'before-open'
      ? 'Not open yet'
      : 'Closed today'
    : hasHistory
      ? 'Too early to compare'
      : comparisonWait(baseline?.sampleCount ?? 0, MIN_BASELINE_SAMPLES, weekday);

  const buckets = axisHours(day);
  const orders = figure === 'analytics.orders';
  const series = daySeries({
    buckets,
    byHour: new Map(hourly.map((row) => [row.hour, orders ? row.orderCount : Number(row.totalRevenue ?? 0)])),
    typicalByHour: hasHistory
      ? new Map((baseline?.byHour ?? []).map((row) => [row.hour, orders ? row.cumulativeOrders : row.cumulativeRevenue]))
      : new Map(),
    nowMinutes: axisNowMinutes(day),
    showToday,
    soFar: orders ? metrics.orders : metrics.revenue,
    trading: day.state === 'trading',
  });
  const busiest = series.busiestIndex >= 0 ? buckets[series.busiestIndex]! : null;
  const ratio = labour ? labourShare(labour.estimatedCost, metrics.revenue) : null;
  const refundShare = metrics.revenue > 0 ? (refundsOnSales / metrics.revenue) * 100 : null;
  const refundHours = refunds.data
    ? daySeries({
        buckets,
        byHour: amountsByHour(refunds.data.data, day.timeZone),
        typicalByHour: new Map(),
        nowMinutes: axisNowMinutes(day),
        showToday,
        soFar: refundsPaid,
        trading: day.state === 'trading',
      })
    : null;

  if (loading.core)
    return <FactsSkeleton count={1} label={`Loading ${label.toLowerCase()}`} className="h-full grid-cols-1 lg:grid-cols-1" />;

  // A tile keeps its shape when the figure can't be read: it says so, and the whole tile retries.
  if (errors.core || (figure === 'analytics.labour' && errors.labour)) {
    return (
      <dl className="grid h-full">
        <Fact
          surface="page"
          icon={icon}
          label={label}
          value="—"
          hint="Couldn’t be loaded"
          tone="warning"
          onSelect={() => void refresh()}
          action="Retry"
        />
      </dl>
    );
  }

  let value: ReactNode = '—';
  let hint: ReactNode = null;
  let warning = false;
  let facts: Parameters<typeof WidgetFacts>[0]['facts'] = [];
  switch (figure) {
    case 'analytics.net-sales':
      value = money(metrics.revenue);
      hint = <Change change={figureChange(metrics.revenue, typicalRevenue)} basis={basis} waiting={waiting} />;
      facts = [
        pace.available && { label: 'Typical by now', value: money(pace.expectedByNow) },
        day.state === 'trading' && pace.projected !== null && { label: 'On pace for', value: money(pace.projected) },
        dashboard.lastWeekMetrics && { label: `Last ${weekday}`, value: money(dashboard.lastWeekMetrics.revenue) },
      ];
      break;
    case 'analytics.orders':
      value = formatCompact(metrics.orders);
      hint = <Change change={figureChange(metrics.orders, typicalOrders)} basis={basis} waiting={waiting} />;
      facts = [
        typicalOrders !== null && { label: 'Typical by now', value: Math.round(typicalOrders) },
        busiest && { label: 'Busiest hour', value: hourLabel(busiest.hour) },
        series.nowIndex >= 0 && { label: 'This hour', value: series.perHour[series.nowIndex] ?? 0 },
      ];
      break;
    case 'analytics.average-order':
      value = money(metrics.averageOrderValue, 2);
      hint = <Change change={figureChange(metrics.averageOrderValue, typicalAov)} basis={basis} waiting={waiting} />;
      facts = [
        { label: 'Orders', value: formatCompact(metrics.orders) },
        { label: 'Net sales', value: money(metrics.revenue) },
      ];
      break;
    case 'analytics.labour':
      value = loading.labour ? '…' : ratio !== null ? `${ratio.toFixed(0)}% of sales` : labour ? money(labour.estimatedCost) : '—';
      hint = labour
        ? [
            labour.headcount === 1 ? '1 person on shift' : `${labour.headcount} people on shift`,
            labour.paidHours >= 0.1 ? `${labour.paidHours.toFixed(1)}h paid` : null,
            labour.uncostedHours >= 0.1 ? `${labour.uncostedHours.toFixed(1)}h off the rota` : null,
            labour.staffMissingPayData > 0 ? `${labour.staffMissingPayData} missing a pay rate` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : 'No shifts recorded yet';
      warning = ratio !== null && ratio > LABOUR_SHARE_WARNING;
      facts = labour
        ? [
            { label: 'Cost so far', value: money(labour.estimatedCost) },
            { label: 'Open shifts', value: labour.openShifts },
          ]
        : [];
      break;
    case 'analytics.refunds':
      value = money(refundsPaid, 2);
      hint = refundsPaid > 0 || refundsOnSales > 0 ? `${money(refundsOnSales, 2)} against today’s sales` : 'Nothing refunded today';
      warning = refundsPaid > 0;
      facts = [
        refundShare !== null && {
          label: 'Share of sales',
          value: `${refundShare.toFixed(1)}%`,
          tone: refundShare > 5 ? 'warning' : undefined,
        },
        refunds.data ? { label: 'Refunds', value: refunds.data.data.length } : { label: 'Net sales', value: money(metrics.revenue) },
      ];
      break;
  }

  // The day's picture for this figure, sized by where it goes.
  const picture = (axis: boolean, ringSize: number): ReactNode => {
    switch (figure) {
      case 'analytics.net-sales':
        return buckets.length > 0 ? (
          <WidgetCurve
            today={series.today}
            typical={series.typical}
            target={dashboard.target?.target ?? null}
            slots={buckets.length}
            tint={tint}
            label={`Net sales through the day, against ${basis}`}
            axis={axis ? axisTicks(buckets) : undefined}
          />
        ) : null;
      case 'analytics.orders':
        return buckets.length > 0 ? (
          <HourBars values={series.perHour} nowIndex={series.nowIndex} tint={tint} label="Orders by hour today" />
        ) : null;
      case 'analytics.average-order':
        return (
          <WidgetCompare
            today={metrics.averageOrderValue}
            typical={typicalAov}
            tint={tint}
            todayLabel={money(metrics.averageOrderValue, 2)}
            typicalLabel={typicalAov !== null ? money(typicalAov, 2) : '—'}
          />
        );
      case 'analytics.labour':
        return ratio !== null ? (
          <WidgetRing
            value={ratio / 100}
            tint={warning ? 'stock' : 'team'}
            size={ringSize}
            thickness={Math.max(5, Math.round(ringSize / 8))}
            label={`Labour is ${ratio.toFixed(0)}% of net sales`}
          >
            <span className="text-[11px] font-semibold text-heading tabular-nums">{ratio.toFixed(0)}%</span>
          </WidgetRing>
        ) : null;
      case 'analytics.refunds':
        if (refundHours && buckets.length > 0)
          return <HourBars values={refundHours.perHour} nowIndex={refundHours.nowIndex} tint={tint} label="Refunds paid by hour today" />;
        return refundShare !== null ? (
          <WidgetRing
            value={refundShare / 100}
            tint="orders"
            size={ringSize}
            thickness={Math.max(5, Math.round(ringSize / 8))}
            label={`${refundShare.toFixed(1)}% of today’s sales refunded`}
          >
            <span className="text-[11px] font-semibold text-heading tabular-nums">
              {refundShare < 10 ? refundShare.toFixed(1) : refundShare.toFixed(0)}%
            </span>
          </WidgetRing>
        ) : null;
    }
  };
  const ring = figure === 'analytics.labour' || (figure === 'analytics.refunds' && !refundHours);
  const tone = warning ? 'warning' : 'default';

  if (family === 'compact') {
    return (
      <dl className="grid h-full">
        <Fact surface="page" icon={icon} label={label} value={value} hint={hint} tone={tone} />
      </dl>
    );
  }

  if (family === 'bar') {
    const aside = picture(false, 48);
    return (
      <dl className="grid h-full">
        <Fact
          surface="page"
          icon={icon}
          label={label}
          value={value}
          hint={hint}
          tone={tone}
          aside={aside && <div className={cn('h-12 shrink-0 self-center', ring ? 'w-auto' : 'w-[42%]')}>{aside}</div>}
        />
      </dl>
    );
  }

  const below = picture(true, family === 'small' ? 72 : 88);
  return (
    <dl className="grid h-full">
      <Fact surface="page" icon={icon} label={label} value={value} hint={hint} tone={tone} className="h-full">
        {family === 'small' ? (
          <div className={cn('min-h-0 flex-1', ring ? 'grid place-items-center' : 'flex flex-col justify-end')}>{below}</div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4">
            <div className={cn('min-w-0 flex-1', ring ? 'grid place-items-center' : 'flex flex-col justify-end')}>{below}</div>
            <WidgetFacts facts={facts} columns={2} className="w-[44%] shrink-0 self-end" />
          </div>
        )}
      </Fact>
    </dl>
  );
}
