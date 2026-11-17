'use client';

import { ModuleCard } from '@/components/dashboard/ModuleCards';
import { Clock, TrendingDown, TrendingUp } from '@/components/icons';
import { Bone } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';

import type { DayBaseline, HourlyVolume } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { hourlyPace } from '@/lib/utils/hourly-pace';
import { MIN_BASELINE_SAMPLES } from '@/lib/utils/pace';
import { barPercent, weekdayName } from '@/lib/utils/today-figures';
import { type TradingDay, axisHours, axisNowMinutes } from '@/lib/utils/trading-day';

/* Orders per hour of the local trading day, so prep and staffing can be
   planned against the shape of the day rather than a total. Today's columns
   in the orders colour, a typical same weekday outlined behind them, the
   busiest hour marked in words. The axis is the location's real hours. */

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
  const ahead = pace?.change !== null && pace?.change !== undefined && pace.change >= 0;
  const describe = (index: number) =>
    `${clock(buckets[index]!.hour)}: ${ordersWord(counts[index]!)}${hasTypical ? `, typically ${typical[index]}` : ''}`;

  return (
    <ModuleCard
      id="dashboard-orders-hourly"
      title="Orders by hour"
      loading={loading}
      skeleton={
        <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading orders by hour">
          <Bone className="h-5 w-48" />
          <div className="flex h-32 items-end gap-1">
            {HOUR_BARS.map((height, index) => (
              <Bone key={index} className={cn('min-w-0 flex-1 rounded-b-none rounded-t-sm', height)} />
            ))}
          </div>
        </div>
      }
      error={error}
      onRetry={onRetry}
      empty={
        totalSoFar === 0
          ? day.state === 'before-open'
            ? { icon: Clock, title: 'Not open yet', description: `The day starts at ${day.hours?.open ?? '—'}.` }
            : { icon: Clock, title: 'No orders yet today', description: 'Each hour’s orders appear here as they come in.' }
          : undefined
      }
    >
      <div className="space-y-4">
        {/* The reading: the busiest hour, the one under way, and the pace against a typical day. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span>
            Busiest <span className="font-semibold text-foreground tabular-nums">{clock(busiest)}</span> · {ordersWord(peak)}
          </span>
          {current && (
            <span>
              This hour <span className="font-semibold text-foreground tabular-nums">{current.count}</span>
              {hasTypical && current.typical > 0 ? ` of a typical ${current.typical}` : ''}
            </span>
          )}
          {pace && pace.change !== null && (
            <span className={cn('ml-auto inline-flex items-center gap-1 font-semibold', ahead ? 'text-momentum' : 'text-measured')}>
              {ahead ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
              {ahead ? '+' : '−'}
              {Math.abs(Math.round(pace.change * 100))}%<span className="font-normal text-muted-foreground">vs a typical {weekday}</span>
            </span>
          )}
        </div>

        <div>
          <div className="flex h-32 items-end gap-1" aria-hidden="true">
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
                        className="absolute inset-x-0 bottom-0 rounded-t-[4px] border border-dashed border-reference/60"
                        style={{ height: `${barPercent(typicalCount, max, 3)}%` }}
                      />
                    )}
                    <span
                      className={cn(
                        'relative w-full rounded-t-[4px]',
                        count === 0 || future ? 'bg-band' : bucket.hour === busiest ? 'bg-measured' : 'bg-measured/50',
                        index === currentIndex && 'ring-2 ring-measured/30',
                      )}
                      style={{ height: count ? `${barPercent(count, max)}%` : '2px' }}
                    />
                  </span>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-micro font-semibold text-muted-foreground" aria-hidden="true">
            <span>{clock(first)}</span>
            {/* The middle bucket, not the arithmetic midpoint — those disagree once the day crosses midnight. */}
            {buckets.length > 4 && <span>{clock(buckets[Math.floor(buckets.length / 2)]!.hour)}</span>}
            <span>{clock(last)}</span>
          </div>
        </div>

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
      </div>
    </ModuleCard>
  );
}
