'use client';

import { ModuleCard } from '@/components/dashboard/ModuleCards';
import { Clock, Timer, TrendingDown, TrendingUp } from '@/components/icons';
import { MiniBar } from '@/components/shared/MiniBar';
import { Bone } from '@/components/shared/Skeleton';
import { TONE_TINT } from '@/components/shared/tone';

import type { DayBaseline, HourlyVolume } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { hourlyPace } from '@/lib/utils/hourly-pace';
import { MIN_BASELINE_SAMPLES } from '@/lib/utils/pace';
import { type TradingDay, axisHours, axisNowMinutes } from '@/lib/utils/trading-day';

/* Orders per hour of the local trading day, so prep and staffing can be planned
   against the shape of the day rather than a total — in the Stock health
   card's shape: the count as the headline, the day as one chart, then the two
   hours that matter.

   The axis is clipped to the location's real opening hours — the old version drew
   a fixed 00:00–23:00 range, most of which was structurally empty. */

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

export function OrdersByHour({
  day,
  hourly,
  baseline,
  loading,
}: {
  day: TradingDay;
  hourly: HourlyVolume[];
  baseline: DayBaseline | undefined;
  loading: boolean;
}) {
  // Shared axis with the day curve, so a site trading past midnight lists
  // 22, 23, 00, 01 in order rather than folding back to the start.
  const buckets = axisHours(day);
  const first = buckets[0]?.hour ?? day.axis.firstHour;
  const last = buckets.at(-1)?.hour ?? day.axis.lastHour;

  const byHour = new Map(hourly.map((row) => [row.hour, row.orderCount]));
  const hasTypical = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES;
  const nowMinutes = axisNowMinutes(day);

  const counts = buckets.map((bucket) => byHour.get(bucket.hour) ?? 0);
  const typical = buckets.map((bucket) => (hasTypical ? (baseline?.byHour[bucket.hour]?.orderCount ?? 0) : 0));
  const max = Math.max(...counts, ...typical, 1);
  const peak = Math.max(...counts);
  const busiest = buckets[counts.indexOf(peak)]?.hour ?? first;
  const totalSoFar = counts.reduce((sum, value) => sum + value, 0);
  const pace = hasTypical ? hourlyPace(buckets, counts, typical, nowMinutes) : null;
  // The hour in progress, while trading: what it has so far against a whole typical one.
  const currentIndex =
    day.state === 'trading'
      ? buckets.findIndex((bucket) => bucket.startMinutes <= nowMinutes && nowMinutes < bucket.startMinutes + 60)
      : -1;
  const current =
    currentIndex >= 0 ? { hour: buckets[currentIndex].hour, count: counts[currentIndex], typical: typical[currentIndex] } : null;
  const ahead = pace?.change !== null && pace?.change !== undefined && pace.change >= 0;

  return (
    <ModuleCard
      title="Orders by hour"
      subtitle={day.hours ? `${day.hours.open}–${day.hours.close}, local time` : 'Local time'}
      href="/reports/sales-by-hour"
      hrefLabel="Open sales by hour"
      loading={false}
      error={false}
      onRetry={() => undefined}
      empty={
        !loading && totalSoFar === 0
          ? day.state === 'before-open'
            ? { icon: Clock, title: 'Not open yet', description: `The day starts at ${day.hours?.open ?? '—'}.` }
            : { icon: Clock, title: 'No orders yet today', description: 'Each hour’s orders appear here as they come in.' }
          : undefined
      }
    >
      {loading ? (
        <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading orders by hour">
          <Bone className="h-7 w-40" />
          <div className="flex h-28 items-end gap-1 rounded-lg bg-band/50 p-2">
            {HOUR_BARS.map((height, index) => (
              <Bone key={index} className={cn('min-w-0 flex-1 rounded-b-none rounded-t-sm', height)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* The headline: orders so far, and how that compares with a typical day by now. */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span data-figure className="text-2xl font-semibold tracking-figure text-foreground">
              {totalSoFar}
            </span>
            <span className="text-xs text-muted-foreground">{totalSoFar === 1 ? 'order' : 'orders'} so far</span>
            {pace && pace.change !== null && (
              <span
                className={cn(
                  'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  TONE_TINT[ahead ? 'success' : 'warning'],
                )}
              >
                {ahead ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
                {ahead ? '+' : '−'}
                {Math.abs(Math.round(pace.change * 100))}% vs a typical {day.weekday}
              </span>
            )}
          </div>

          {/* The day as one chart, on the same tinted ground as Stock health's rows. */}
          <div className="rounded-lg bg-band/50 p-2.5">
            <div
              className="flex h-28 items-end gap-1"
              role="img"
              aria-label={`Orders by hour. ${totalSoFar} orders so far, busiest hour ${clock(busiest)} with ${peak} orders.`}
            >
              {buckets.map((bucket, index) => {
                const count = counts[index];
                const typicalCount = typical[index];
                // An hour that has not happened yet is drawn quiet, not empty.
                const future = bucket.startMinutes > nowMinutes && day.state === 'trading';
                return (
                  <div
                    key={bucket.startMinutes}
                    className="relative flex h-full min-w-0 flex-1 items-end"
                    title={`${clock(bucket.hour)} — ${count} orders${hasTypical ? `, typically ${typicalCount}` : ''}`}
                  >
                    {/* Typical sits behind as an outline, so today reads against it. */}
                    {hasTypical && typicalCount > 0 && (
                      <span
                        className="absolute inset-x-0 bottom-0 rounded-t-sm border border-dashed border-reference/60"
                        style={{ height: `${Math.max(3, (typicalCount / max) * 100)}%` }}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        'relative w-full rounded-t-sm',
                        future ? 'bg-card' : bucket.hour === busiest ? 'bg-measured' : 'bg-measured/45',
                        index === currentIndex && 'ring-2 ring-measured/30',
                      )}
                      style={{ height: `${count ? Math.max(4, (count / max) * 100) : 2}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between text-micro font-semibold text-muted-foreground" aria-hidden="true">
              <span>{clock(first)}</span>
              {/* The middle bucket, not the arithmetic midpoint of the two clock
                  hours — those disagree the moment the day crosses midnight. */}
              {buckets.length > 4 && <span>{clock(buckets[Math.floor(buckets.length / 2)].hour)}</span>}
              <span>{clock(last)}</span>
            </div>
          </div>

          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-measured" aria-hidden="true" />
              Today
            </span>
            {hasTypical && (
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] border border-dashed border-reference/70" aria-hidden="true" />
                Typical {day.weekday}
              </span>
            )}
          </p>

          {/* The two hours that matter: the busiest so far, and the one under way. */}
          <div className="space-y-2 rounded-lg bg-band/50 p-2">
            <HourRow icon={Clock} label="Busiest hour" hour={busiest} value={peak} max={max} tone="warning" />
            {current && (
              <HourRow
                icon={Timer}
                label="This hour so far"
                hour={current.hour}
                value={current.count}
                max={Math.max(current.typical, current.count, 1)}
                tone="info"
                detail={hasTypical && current.typical > 0 ? `typically ${current.typical}` : undefined}
              />
            )}
          </div>
        </div>
      )}
    </ModuleCard>
  );
}

/** One hour as a row: tinted tile, what it is, a bar, the count — Stock health's row, without a link. */
function HourRow({
  icon: Icon,
  label,
  hour,
  value,
  max,
  tone,
  detail,
}: {
  icon: typeof Clock;
  label: string;
  hour: number;
  value: number;
  max: number;
  tone: 'warning' | 'info';
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-card px-3 py-2.5 shadow-sm">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', TONE_TINT[tone])} aria-hidden="true">
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm text-foreground">{label}</span>
          <span data-figure className="shrink-0 text-xs text-muted-foreground">
            {clock(hour)}
            {detail ? ` · ${detail}` : ''}
          </span>
        </span>
        <MiniBar value={value} max={max} tone={tone} label={`${value} orders`} className="mt-1.5 h-1" />
      </span>
      <span data-figure className="shrink-0 text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}
