'use client';

import { DailyTargetControl } from '@/components/dashboard/DailyTargetControl';
import { Widget, WidgetBar, WidgetCaption, WidgetFigure, useFamily } from '@/components/dashboard/widget/Widget';
import { WidgetCurve, WidgetFacts } from '@/components/dashboard/widget/parts';
import { LineChart } from '@/components/icons';
import { Bone } from '@/components/shared/Skeleton';
import { DeltaBadge } from '@/components/shared/StatCard';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import type { DayBaseline, HourlyVolume } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { axisTicks, daySeries } from '@/lib/utils/day-series';
import { MIN_BASELINE_SAMPLES, type Pace, type TargetProgress } from '@/lib/utils/pace';
import { weekdayName } from '@/lib/utils/today-figures';
import { type TradingDay, axisHours, axisNowMinutes } from '@/lib/utils/trading-day';

/* What the site has taken through the day — the dashboard's signature curve,
   drawn on the location's real trading hours: today's running total in the
   orders colour up to now, a typical same weekday dashed across the whole day,
   the target as a green rule. A mark only goes where real data puts it.
   Medium is the figure and the curve side by side; large stacks them over the
   day's comparisons; extra large gives the curve the width it deserves. */

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
  /** Off when the net sales widget is on the board — the figure then gives way to how the day compares. */
  showHeadline?: boolean;
}) {
  const money = useFormatMoney();
  const family = useFamily();
  const weekday = weekdayName(day.weekday);
  const showToday = day.state !== 'before-open' && day.state !== 'closed-today';
  const hasTypical = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES;
  const ahead = pace.delta >= 0;

  // The whole trading day on the axis; today's running total only up to the hour under way.
  const buckets = axisHours(day);
  const series = daySeries({
    buckets,
    byHour: new Map(hourly.map((row) => [row.hour, Number(row.totalRevenue ?? 0)])),
    typicalByHour: hasTypical ? new Map((baseline?.byHour ?? []).map((row) => [row.hour, row.cumulativeRevenue])) : new Map(),
    nowMinutes: axisNowMinutes(day),
    showToday,
    soFar: takenSoFar,
    trading: day.state === 'trading',
  });
  // How much of a typical whole day is already in — the day's progress, as a share.
  const dayShare = showToday && hasTypical && (baseline?.dailyMedianRevenue ?? 0) > 0 ? takenSoFar / baseline!.dailyMedianRevenue : null;

  // Before the day starts the figure is what it's aiming at; once it's under way, what's in.
  const headline = showToday ? takenSoFar : (target?.target ?? (hasTypical ? (baseline?.dailyMedianRevenue ?? 0) : null));
  const title = day.state === 'before-open' ? 'Before open' : day.state === 'closed-today' ? 'Closed today' : 'Taken today';
  const figure = (showHeadline || !showToday) && headline !== null ? money(headline) : null;

  const paceLine =
    showToday && pace.available ? (
      <DeltaBadge
        size="sm"
        className="min-w-0"
        delta={{
          value: `${ahead ? '+' : '−'}${money(Math.abs(pace.delta))}`,
          trend: ahead ? 'up' : 'down',
          tone: ahead ? 'positive' : 'negative',
          label: `vs a typical ${weekday}`,
        }}
      />
    ) : showToday ? (
      pace.sampleCount < MIN_BASELINE_SAMPLES ? (
        'No typical day to compare with yet'
      ) : (
        'Too early to compare'
      )
    ) : day.state === 'before-open' ? (
      `${target ? 'Today’s target' : `Typical ${weekday}`} · opens ${day.hours?.open ?? '—'}`
    ) : (
      `Typical ${weekday} · closed today`
    );

  // The day's comparisons, only the ones that can be said honestly.
  const stats = [
    showToday && pace.available ? { label: 'Typical by now', value: money(pace.expectedByNow) } : null,
    showToday && day.state === 'trading' && pace.projected !== null ? { label: 'On pace for', value: money(pace.projected) } : null,
    showToday && lastWeekRevenue !== null ? { label: `Last ${weekday}`, value: money(lastWeekRevenue) } : null,
    yesterdayRevenue !== null ? { label: 'Yesterday', value: money(yesterdayRevenue) } : null,
    hasTypical ? { label: `Typical ${weekday}`, value: money(baseline?.dailyMedianRevenue ?? 0) } : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  const curve = (showAxis: boolean) =>
    buckets.length === 0 ? (
      <p className="flex h-full items-center text-[13px] text-muted-foreground">No trading hours to draw the day on.</p>
    ) : (
      <WidgetCurve
        today={series.today}
        typical={series.typical}
        target={target?.target ?? null}
        slots={buckets.length}
        tint="orders"
        label={showToday ? `Taken through the day so far, against a typical ${weekday}` : `A typical ${weekday}, hour by hour`}
        axis={showAxis ? axisTicks(buckets) : undefined}
      />
    );

  const progressLine = !target && dayShare !== null && (
    <div className="mt-2 min-w-0">
      <WidgetBar
        value={dayShare * 100}
        max={100}
        className="bg-measured"
        label={`${Math.round(dayShare * 100)}% of a typical ${weekday}`}
      />
      <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
        <span className="font-semibold text-heading">{Math.round(dayShare * 100)}%</span> of a typical {weekday}
      </p>
    </div>
  );

  const targetLine = target && (
    <div className="mt-2 min-w-0">
      <WidgetBar
        value={target.progress * 100}
        max={100}
        className={target.ahead ? 'bg-success' : 'bg-stock'}
        label={`${Math.round(target.progress * 100)}% of the ${money(target.target)} target`}
      />
      <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
        <span className="font-semibold text-heading">{Math.round(target.progress * 100)}%</span> of {money(target.target)} target
      </p>
    </div>
  );

  const reading = (
    <div className="min-w-0">
      {figure && <WidgetFigure value={figure} size={family === 'medium' ? 'medium' : 'large'} />}
      <WidgetCaption className={cn('flex items-center', figure && 'mt-1.5')}>{paceLine}</WidgetCaption>
    </div>
  );

  // The comparisons flat on the card, not in a tray: across the foot at large, a column of label and figure at extra large.
  const statRow = <WidgetFacts facts={stats.slice(0, 4)} columns={4} tray={false} className="border-t border-border/60 pt-3" />;
  const statColumn = (
    <dl className="divide-y divide-border/60">
      {stats.slice(0, 4).map((stat) => (
        <div key={stat.label} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px] leading-[18px]">
          <dt className="min-w-0 truncate text-muted-foreground">{stat.label}</dt>
          <dd className="shrink-0 font-semibold text-heading tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <Widget
      title={title}
      icon={LineChart}
      tint="orders"
      surface="plain"
      href="/reports/sales-by-hour"
      hrefLabel="Open sales by hour"
      // At every size: the target is set where it is read.
      accessory={locationId ? <DailyTargetControl locationId={locationId} target={target?.target ?? dailyTarget} /> : undefined}
      loading={loading}
      skeleton={
        <div role="status" aria-busy="true" aria-label="Loading today’s takings" className="flex flex-1 flex-col gap-3">
          <Bone className="h-9 w-32 rounded-md" />
          <Bone className="min-h-0 w-full flex-1 rounded-md" />
        </div>
      }
    >
      {family === 'banner' ? (
        // Half a square: the figure and its pace on one line — stacked, the two outgrow the cell and meet the header.
        <div className="mt-auto flex min-h-0 min-w-0 flex-1 items-end gap-4">
          <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
            <WidgetFigure value={figure ?? money(takenSoFar)} size="banner" className="shrink-0" />
            <span className="flex min-w-0 items-center truncate text-[13px] text-muted-foreground">{paceLine}</span>
          </div>
          <div className="h-full min-h-0 w-[58%] shrink-0">{curve(false)}</div>
        </div>
      ) : family === 'medium' ? (
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="mt-auto flex min-w-0 flex-1 flex-col">
            {reading}
            {targetLine}
            {progressLine}
          </div>
          <div className="w-[50%] shrink-0 pt-2">{curve(false)}</div>
        </div>
      ) : family === 'extraLarge' ? (
        <div className="flex min-h-0 flex-1 gap-6">
          <div className="flex w-[34%] shrink-0 flex-col">
            {reading}
            {targetLine}
            {progressLine}
            <div className="mt-auto pt-3">{statColumn}</div>
          </div>
          <div className="min-w-0 flex-1 pt-1">{curve(true)}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {reading}
          {targetLine}
          {progressLine}
          <div className="min-h-0 flex-1 py-3">{curve(true)}</div>
          {statRow}
        </div>
      )}
    </Widget>
  );
}
