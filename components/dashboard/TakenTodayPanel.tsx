'use client';

import Link from 'next/link';

import { DailyTargetControl } from '@/components/dashboard/DailyTargetControl';
import { ArrowUpRight, Target, TrendingDown, TrendingUp } from '@/components/icons';
import { TrendChart, TrendLegend } from '@/components/reports/kit/parts';
import { Bone, LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { useFormatMoney, useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import type { DayBaseline, HourlyVolume } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { MIN_BASELINE_SAMPLES, type Pace, type TargetProgress } from '@/lib/utils/pace';
import { compactMoney } from '@/lib/utils/report-chart';
import { takenTodaySeries } from '@/lib/utils/taken-today';
import { type TradingDay, axisHours, axisNowMinutes } from '@/lib/utils/trading-day';

/* What the site has taken today, against what a typical same weekday had taken
   by this exact time — laid out as Reports' Net sales panel, and drawn with
   its trend chart: the running total, a typical day dashed, the target
   stepped, a tooltip on every hour. One look across the two pages. */

/** Static classes — Tailwind can't see a computed `sm:grid-cols-${n}`. */
const STAT_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

export function TakenTodayPanel({
  day,
  takenSoFar,
  hourly,
  baseline,
  pace,
  target,
  loading,
  yesterdayRevenue,
  locationId,
  dailyTarget,
}: {
  day: TradingDay;
  takenSoFar: number;
  hourly: HourlyVolume[];
  baseline: DayBaseline | undefined;
  pace: Pace;
  target: TargetProgress | null;
  loading: boolean;
  yesterdayRevenue: number | null;
  /** Null when every location is in scope — a target belongs to one site. */
  locationId: string | null;
  dailyTarget: number | null;
}) {
  const money = useFormatMoney();
  const currency = useWorkspaceCurrency();
  const showToday = day.state !== 'before-open' && day.state !== 'closed-today';
  const hasTypical = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES;
  const typicalLabel = `Typical ${day.weekday}`;
  const ahead = pace.delta >= 0;

  const series = takenTodaySeries({
    buckets: axisHours(day),
    revenueByHour: new Map(hourly.map((row) => [row.hour, Number(row.totalRevenue ?? 0)])),
    typicalByHour: hasTypical ? new Map((baseline?.byHour ?? []).map((row) => [row.hour, row.cumulativeRevenue])) : new Map(),
    typicalDay: hasTypical ? (baseline?.dailyMedianRevenue ?? 0) : 0,
    nowMinutes: axisNowMinutes(day),
    takenSoFar,
    target: target?.target ?? null,
    showToday,
  });

  // The headline: what's in, or before it starts, what the day is aiming at.
  const headline = showToday ? takenSoFar : (target?.target ?? baseline?.dailyMedianRevenue ?? 0);
  const caption = showToday
    ? 'Net of refunds'
    : day.state === 'before-open'
      ? `${target ? 'Today’s target' : typicalLabel} · opens ${day.hours?.open ?? '—'}`
      : `${typicalLabel} — closed today`;

  // The day's counts in one row, as Net sales has; only the ones that can be said honestly.
  const stats = [
    showToday && pace.available ? { label: 'Typical by now', value: money(pace.expectedByNow) } : null,
    showToday && day.state === 'trading' && pace.projected !== null ? { label: 'On pace for', value: money(pace.projected) } : null,
    hasTypical ? { label: typicalLabel, value: money(baseline?.dailyMedianRevenue ?? 0) } : null,
    yesterdayRevenue !== null ? { label: 'Yesterday', value: money(yesterdayRevenue) } : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  return (
    <section aria-labelledby="taken-today-title" className="rounded-lg border border-rule/60 bg-field">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 pt-5">
        <div className="min-w-0">
          <h2 id="taken-today-title" className="text-sm font-semibold text-foreground">
            {day.state === 'before-open' ? 'Before open' : day.state === 'closed-today' ? 'Closed today' : 'Taken today'}
          </h2>
          {loading ? (
            <div role="status" aria-busy="true" aria-label="Loading today’s takings" className="mt-1 space-y-2">
              <Bone className="h-9 w-40" />
              <Bone className="h-3 w-56" />
            </div>
          ) : (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-2.5">
                <span data-figure className="text-3xl font-semibold tracking-title tabular-nums text-foreground">
                  {money(headline)}
                </span>
                {showToday && pace.available && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-micro font-semibold tabular-nums',
                      ahead ? 'bg-momentum/10 text-momentum' : 'bg-exception/8 text-exception',
                    )}
                    title={`${ahead ? 'Ahead of' : 'Behind'} a typical ${day.weekday} by this time`}
                  >
                    {ahead ? <TrendingUp size={11} aria-hidden="true" /> : <TrendingDown size={11} aria-hidden="true" />}
                    {money(Math.abs(pace.delta))} {ahead ? 'ahead' : 'behind'}
                    {pace.deltaPct !== null && ` · ${pace.deltaPct > 0 ? '+' : ''}${pace.deltaPct.toFixed(0)}%`}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {caption}
                {showToday && !pace.available && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {pace.sampleCount < MIN_BASELINE_SAMPLES
                      ? `pace needs ${MIN_BASELINE_SAMPLES} past ${day.weekday}s (there are ${pace.sampleCount})`
                      : 'too early to compare'}
                  </>
                )}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {locationId && <DailyTargetControl locationId={locationId} target={target?.target ?? dailyTarget} />}
          {/* The same corner as the module cards: an arrow into the report behind it. */}
          <Tooltip label="Open sales by hour" side="top" className="shrink-0">
            <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
              <Link href="/reports/sales-by-hour" aria-label="Open sales by hour">
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </Button>
          </Tooltip>
        </div>
      </header>

      {/* Progress on the target, as Net sales shows it. */}
      {target && !loading && (
        <div className="mx-5 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-band/50 px-3.5 py-2.5">
          <Target size={15} className={cn('shrink-0', target.ahead ? 'text-momentum' : 'text-warning')} aria-hidden="true" />
          <div className="min-w-40 flex-1">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-rule/40">
              <span
                className={cn('rounded-full', target.ahead ? 'bg-momentum' : 'bg-warning')}
                style={{ width: `${Math.min(100, target.progress * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            <span className={cn('font-semibold', target.progress >= 1 ? 'text-momentum' : 'text-foreground')}>
              {Math.round(target.progress * 100)}%
            </span>{' '}
            of {money(target.target)} target
            {showToday && ` · ${Math.round(target.expectedByNow * 100)}% expected by now`}
          </p>
        </div>
      )}

      <div className="px-3 pb-2 pt-4 sm:px-4">
        {loading ? (
          <LoadingState label="Drawing today’s takings" className="h-56 py-0" />
        ) : series.points.length === 0 ? (
          <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">The day’s first hour hasn’t started yet.</p>
        ) : (
          <TrendChart
            points={series.points.map((point) => ({ label: `By ${point.label}`, axis: point.label, value: point.value }))}
            previous={series.typical}
            target={series.target}
            format={(value) => money(value)}
            axisFormat={(value) => compactMoney(value, currency)}
            height={220}
            ariaLabel={
              showToday ? `Taken through the day so far, against a typical ${day.weekday}` : `A typical ${day.weekday}, hour by hour`
            }
            seriesLabel={showToday ? 'Today' : typicalLabel}
            previousLabel={typicalLabel}
          />
        )}
      </div>

      {stats.length > 0 && (
        <dl className={cn('grid border-t border-rule/50', STAT_COLUMNS[stats.length])}>
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                'min-w-0 px-5 py-3.5',
                index % 2 === 1 && 'border-l border-rule/50',
                index >= 2 && 'border-t border-rule/50 sm:border-t-0 sm:border-l',
              )}
            >
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                {loading ? <Bone className="my-0.5 h-5 w-16" /> : stat.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-rule/50 px-5 py-3">
        <TrendLegend
          comparison={!!series.typical}
          seriesLabel={showToday ? 'Today' : typicalLabel}
          previousLabel={typicalLabel}
          target={!!series.target}
        />
        {!hasTypical && (
          <span className="text-xs text-muted-foreground">
            {baseline?.sampleCount ?? 0} of {MIN_BASELINE_SAMPLES} past {day.weekday}s for a typical day
          </span>
        )}
      </footer>
    </section>
  );
}
