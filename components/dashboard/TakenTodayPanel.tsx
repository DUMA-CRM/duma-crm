'use client';

import { DailyTargetControl } from '@/components/dashboard/DailyTargetControl';
import { ModuleCard } from '@/components/dashboard/ModuleCards';
import { Target, TrendingDown, TrendingUp } from '@/components/icons';
import { TrendChart, TrendLegend } from '@/components/reports/kit/parts';
import { MiniBar } from '@/components/shared/MiniBar';
import { Bone } from '@/components/shared/Skeleton';
import { useFormatMoney, useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';

import type { DayBaseline, HourlyVolume } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { MIN_BASELINE_SAMPLES, type Pace, type TargetProgress } from '@/lib/utils/pace';
import { compactMoney } from '@/lib/utils/report-chart';
import { takenTodaySeries } from '@/lib/utils/taken-today';
import { weekdayName } from '@/lib/utils/today-figures';
import { type TradingDay, axisHours, axisNowMinutes } from '@/lib/utils/trading-day';

/* What the site has taken through the day, against what a typical same
   weekday had taken by each hour — drawn with Reports' trend chart: the
   running total, a typical day dashed, the target stepped, a tooltip on every
   hour. The day's comparisons sit under it as a row of figures. */

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
  lastWeekRevenue,
  locationId,
  dailyTarget,
  showHeadline = true,
}: {
  day: TradingDay;
  takenSoFar: number;
  hourly: HourlyVolume[];
  baseline: DayBaseline | undefined;
  pace: Pace;
  target: TargetProgress | null;
  loading: boolean;
  yesterdayRevenue: number | null;
  /** Taken by this time on the same weekday last week; null when unknown. */
  lastWeekRevenue: number | null;
  /** Null when every location is in scope — a target belongs to one site. */
  locationId: string | null;
  dailyTarget: number | null;
  /** Off when the figures row already leads with net sales — the panel then says only how the day compares. */
  showHeadline?: boolean;
}) {
  const money = useFormatMoney();
  const currency = useWorkspaceCurrency();
  const weekday = weekdayName(day.weekday);
  const showToday = day.state !== 'before-open' && day.state !== 'closed-today';
  const hasTypical = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES;
  const typicalLabel = `Typical ${weekday}`;
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

  // Before the day starts the headline is what it's aiming at; once it's under way, what's in.
  const headline = showToday ? takenSoFar : (target?.target ?? (hasTypical ? (baseline?.dailyMedianRevenue ?? 0) : null));
  const caption = showToday
    ? null
    : day.state === 'before-open'
      ? `${target ? 'Today’s target' : typicalLabel} · opens ${day.hours?.open ?? '—'}`
      : `${typicalLabel} · closed today`;

  // The day's comparisons, only the ones that can be said honestly.
  const stats = [
    showToday && pace.available ? { label: 'Typical by now', value: money(pace.expectedByNow) } : null,
    showToday && lastWeekRevenue !== null ? { label: `Last ${weekday} by now`, value: money(lastWeekRevenue) } : null,
    showToday && day.state === 'trading' && pace.projected !== null ? { label: 'On pace for', value: money(pace.projected) } : null,
    hasTypical ? { label: `${typicalLabel} in full`, value: money(baseline?.dailyMedianRevenue ?? 0) } : null,
    yesterdayRevenue !== null ? { label: 'Yesterday', value: money(yesterdayRevenue) } : null,
  ]
    .filter((stat): stat is { label: string; value: string } => stat !== null)
    .slice(0, 4);

  const title = day.state === 'before-open' ? 'Before open' : day.state === 'closed-today' ? 'Closed today' : 'Taken today';

  return (
    <ModuleCard
      id="dashboard-taken-today"
      title={title}
      href="/reports/sales-by-hour"
      linkLabel="Sales by hour"
      hrefLabel="Open sales by hour"
      actions={locationId && <DailyTargetControl locationId={locationId} target={target?.target ?? dailyTarget} />}
      loading={loading}
      skeleton={
        <div role="status" aria-busy="true" aria-label="Loading today’s takings" className="space-y-4">
          <Bone className="h-7 w-44" />
          <Bone className="h-52 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Bone key={index} className="h-9" />
            ))}
          </div>
        </div>
      }
      error={false}
      onRetry={() => undefined}
    >
      <div className="space-y-4">
        {/* The reading: the figure (unless the row above already shows it) and how it compares. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {(showHeadline || !showToday) && headline !== null && (
            <span data-figure className="text-2xl font-semibold tracking-figure text-foreground">
              {money(headline)}
            </span>
          )}
          {showToday && pace.available ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                ahead ? 'bg-momentum/10 text-momentum' : 'bg-measured/10 text-measured',
              )}
            >
              {ahead ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
              {money(Math.abs(pace.delta))} {ahead ? 'ahead of' : 'behind'} a typical {weekday}
              {pace.deltaPct !== null && ` · ${pace.deltaPct > 0 ? '+' : ''}${pace.deltaPct.toFixed(0)}%`}
            </span>
          ) : showToday ? (
            <span className="text-xs text-muted-foreground">
              {pace.sampleCount < MIN_BASELINE_SAMPLES ? 'No typical day to compare with yet' : 'Too early to compare'}
            </span>
          ) : (
            caption && <span className="text-xs text-muted-foreground">{caption}</span>
          )}
        </div>

        {/* Progress on the target: the bar, then how far along the day should be. */}
        {target && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Target size={15} className={cn('shrink-0', target.ahead ? 'text-momentum' : 'text-measured')} aria-hidden="true" />
            <MiniBar
              value={target.progress * 100}
              max={100}
              tone={target.ahead ? 'success' : 'warning'}
              label={`${Math.round(target.progress * 100)}% of the ${money(target.target)} target`}
              className="min-w-32 flex-1"
            />
            <p className="text-xs tabular-nums text-muted-foreground">
              <span className={cn('font-semibold', target.progress >= 1 ? 'text-momentum' : 'text-foreground')}>
                {Math.round(target.progress * 100)}%
              </span>{' '}
              of {money(target.target)}
              {showToday && ` · ${Math.round(target.expectedByNow * 100)}% expected by now`}
            </p>
          </div>
        )}

        {series.points.length === 0 ? (
          <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">The day’s first hour hasn’t started yet.</p>
        ) : (
          <div className="-mx-1">
            <TrendChart
              points={series.points.map((point) => ({ label: `By ${point.label}`, axis: point.label, value: point.value }))}
              previous={series.typical}
              target={series.target}
              format={(value) => money(value)}
              axisFormat={(value) => compactMoney(value, currency)}
              height={220}
              ariaLabel={showToday ? `Taken through the day so far, against a typical ${weekday}` : `A typical ${weekday}, hour by hour`}
              seriesLabel={showToday ? 'Today' : typicalLabel}
              previousLabel={typicalLabel}
            />
          </div>
        )}

        <TrendLegend
          comparison={!!series.typical}
          seriesLabel={showToday ? 'Today' : typicalLabel}
          previousLabel={typicalLabel}
          target={!!series.target}
        />

        {stats.length > 0 && (
          <dl className={cn('grid gap-x-6 gap-y-3 pt-1', STAT_COLUMNS[stats.length])}>
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-0">
                <dt className="truncate text-xs text-muted-foreground">{stat.label}</dt>
                <dd data-figure className="mt-0.5 text-base font-semibold text-foreground">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </ModuleCard>
  );
}
