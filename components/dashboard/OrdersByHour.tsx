'use client';

import { Widget, WidgetCaption, WidgetFigure, useFamily } from '@/components/dashboard/widget/Widget';
import { WidgetFacts } from '@/components/dashboard/widget/parts';
import { BarChart3 } from '@/components/icons';
import { Bone } from '@/components/shared/Skeleton';
import { DeltaBadge } from '@/components/shared/StatCard';
import { Tooltip } from '@/components/shared/Tooltip';

import type { DayBaseline, HourlyVolume } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { hourlyPace } from '@/lib/utils/hourly-pace';
import { MIN_BASELINE_SAMPLES } from '@/lib/utils/pace';
import { barPercent, weekdayName } from '@/lib/utils/today-figures';
import { type TradingDay, axisHours, axisNowMinutes } from '@/lib/utils/trading-day';

/* Orders per hour of the local trading day, so prep and staffing can be
   planned against the shape of the day rather than a total. The busiest hour
   leads in words; today's columns stand in the orders colour with a typical
   same weekday outlined behind them, on the location's real hours. */

/** A quiet hump of placeholder bars — the chart's own shape, not a grey slab. */
const HOUR_BARS = [
  'h-[12%]',
  'h-[22%]',
  'h-[38%]',
  'h-[55%]',
  'h-[70%]',
  'h-[48%]',
  'h-[34%]',
  'h-[42%]',
  'h-[60%]',
  'h-[46%]',
  'h-[28%]',
  'h-[16%]',
];

const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const ordersWord = (count: number) => (count === 1 ? '1 order' : `${count} orders`);

export function OrdersByHour({
  day,
  hourly,
  baseline,
  loading,
  error = false,
  onRetry = () => undefined,
}: {
  day: TradingDay;
  hourly: HourlyVolume[];
  baseline: DayBaseline | undefined;
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const family = useFamily();
  // Shared axis with the day curve, so a site trading past midnight lists
  // 22, 23, 00, 01 in order rather than folding back to the start.
  const buckets = axisHours(day);
  const first = buckets[0]?.hour ?? day.axis.firstHour;
  const last = buckets.at(-1)?.hour ?? day.axis.lastHour;
  const weekday = weekdayName(day.weekday);

  const byHour = new Map(hourly.map((row) => [row.hour, row.orderCount]));
  const hasTypical = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES;
  const nowMinutes = axisNowMinutes(day);

  const counts = buckets.map((bucket) => byHour.get(bucket.hour) ?? 0);
  const typical = buckets.map((bucket) => (hasTypical ? (baseline?.byHour[bucket.hour]?.orderCount ?? 0) : 0));
  const max = Math.max(...counts, ...typical, 1);
  const peak = Math.max(0, ...counts);
  const busiest = buckets[counts.indexOf(peak)]?.hour ?? first;
  const totalSoFar = counts.reduce((sum, value) => sum + value, 0);
  const pace = hasTypical ? hourlyPace(buckets, counts, typical, nowMinutes) : null;
  // The hour in progress, while trading.
  const currentIndex =
    day.state === 'trading'
      ? buckets.findIndex((bucket) => bucket.startMinutes <= nowMinutes && nowMinutes < bucket.startMinutes + 60)
      : -1;
  const current =
    currentIndex >= 0 ? { hour: buckets[currentIndex]!.hour, count: counts[currentIndex]!, typical: typical[currentIndex]! } : null;
  const describe = (index: number) =>
    `${clock(buckets[index]!.hour)}: ${ordersWord(counts[index]!)}${hasTypical ? `, typically ${typical[index]}` : ''}`;

  // Nothing in yet: the chart still stands, each hour a thin cap, and the words say why rather than naming a busiest hour.
  const none = totalSoFar === 0;
  const quietLine = day.state === 'before-open' ? `Not open yet · opens ${day.hours?.open ?? '—'}` : 'No orders yet today';
  const reading = (
    <div className="min-w-0">
      <WidgetFigure value={none ? 0 : clock(busiest)} size={family === 'medium' ? 'medium' : 'large'} />
      <WidgetCaption className="mt-1.5">{none ? quietLine : `Busiest · ${ordersWord(peak)}`}</WidgetCaption>
      {pace && pace.change !== null && (
        <WidgetCaption className="mt-0.5 flex items-center">
          <DeltaBadge size="sm" className="min-w-0" delta={{ value: Math.round(pace.change * 100), label: `vs a typical ${weekday}` }} />
        </WidgetCaption>
      )}
    </div>
  );

  const stats = [
    { label: 'So far', value: totalSoFar },
    current && { label: 'This hour', value: current.count },
    hasTypical && { label: `Typical ${weekday}`, value: Math.round(baseline?.dailyMedianOrders ?? 0) },
  ].filter((stat): stat is { label: string; value: number } => !!stat);
  // The figures flat on the card, not in a tray: across the foot at large, a column of label and figure at extra large.
  const statRow = <WidgetFacts columns={3} tray={false} facts={stats} className="border-t border-border/60 pt-3" />;
  const statColumn = (
    <dl className="divide-y divide-border/60">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px] leading-[18px]">
          <dt className="min-w-0 truncate text-muted-foreground">{stat.label}</dt>
          <dd className="shrink-0 font-semibold text-heading tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );

  const bars = (showAxis: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-end gap-[3px]" aria-hidden="true">
        {buckets.map((bucket, index) => {
          const count = counts[index]!;
          const typicalCount = typical[index]!;
          // An hour that has not happened yet is drawn quiet, not empty.
          const future = bucket.startMinutes > nowMinutes && day.state === 'trading';
          return (
            <Tooltip key={bucket.startMinutes} label={describe(index)} side="top" className="flex h-full min-w-0 flex-1">
              <span className="relative flex h-full w-full items-end">
                {hasTypical && typicalCount > 0 && (
                  <span
                    className="absolute inset-x-0 bottom-0 rounded-t-[4px] border border-dashed border-reference/70"
                    style={{ height: `${barPercent(typicalCount, max, 3)}%` }}
                  />
                )}
                <span
                  className={cn(
                    'relative w-full rounded-t-[4px]',
                    count === 0 || future ? 'bg-band' : bucket.hour === busiest ? 'bg-measured' : 'bg-measured/55',
                  )}
                  style={{ height: count ? `${barPercent(count, max)}%` : '4px' }}
                />
              </span>
            </Tooltip>
          );
        })}
      </div>
      {showAxis && (
        <div
          className="mt-1.5 flex justify-between text-[11px] leading-none font-medium text-muted-foreground tabular-nums"
          aria-hidden="true"
        >
          <span>{clock(first)}</span>
          {/* The middle bucket, not the arithmetic midpoint — those disagree once the day crosses midnight. */}
          {buckets.length > 4 && <span>{clock(buckets[Math.floor(buckets.length / 2)]!.hour)}</span>}
          <span>{clock(last)}</span>
        </div>
      )}
    </div>
  );

  return (
    <Widget
      title="Orders by hour"
      icon={BarChart3}
      tint="orders"
      surface="plain"
      href="/reports/sales-by-hour"
      hrefLabel="Open sales by hour"
      loading={loading}
      skeleton={
        <div className="flex flex-1 items-end gap-[3px]" role="status" aria-busy="true" aria-label="Loading orders by hour">
          {HOUR_BARS.map((height, index) => (
            <Bone key={index} className={cn('min-w-0 flex-1 rounded-t-[4px] rounded-b-none', height)} />
          ))}
        </div>
      }
      error={error}
      onRetry={onRetry}
    >
      {family === 'banner' ? (
        // Half a square: the busiest hour and its caption on one line — stacked, the two outgrow the cell and meet the header.
        <div className="mt-auto flex min-h-0 min-w-0 flex-1 items-end gap-4">
          <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
            <WidgetFigure value={none ? 0 : clock(busiest)} size="banner" className="shrink-0" />
            <span className="truncate text-[13px] text-muted-foreground">
              {none ? quietLine : `Busiest · ${ordersWord(peak)} · ${ordersWord(totalSoFar)} so far`}
            </span>
          </div>
          <div className="h-full min-h-0 w-[58%] shrink-0">{bars(false)}</div>
        </div>
      ) : family === 'medium' ? (
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="mt-auto min-w-0 flex-1">{reading}</div>
          <div className="w-[52%] shrink-0 pt-2">{bars(false)}</div>
        </div>
      ) : family === 'extraLarge' ? (
        <div className="flex min-h-0 flex-1 gap-6">
          <div className="flex w-[30%] shrink-0 flex-col justify-between">
            {reading}
            {statColumn}
          </div>
          <div className="min-w-0 flex-1 pt-1">{bars(true)}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {reading}
          <div className="min-h-0 flex-1 py-3">{bars(true)}</div>
          {statRow}
        </div>
      )}

      {/* The same hours as a table, for screen readers. */}
      <table className="sr-only">
        <caption>
          Orders by hour today, {ordersWord(totalSoFar)} so far, busiest {clock(busiest)}
        </caption>
        <thead>
          <tr>
            <th scope="col">Hour</th>
            <th scope="col">Orders</th>
            {hasTypical && <th scope="col">Typical {weekday}</th>}
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket, index) => (
            <tr key={bucket.startMinutes}>
              <th scope="row">{clock(bucket.hour)}</th>
              <td>{counts[index]}</td>
              {hasTypical && <td>{typical[index]}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </Widget>
  );
}
