'use client';

import Link from 'next/link';

import { DailyTargetControl } from '@/components/dashboard/DailyTargetControl';
import { ArrowRight, Target, TrendingDown, TrendingUp } from '@/components/icons';

import type { DayBaseline, HourlyVolume } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/dashboard';
import { MIN_BASELINE_SAMPLES, type Pace, type TargetProgress } from '@/lib/utils/pace';
import { type TradingDay, axisHours, axisNowMinutes, axisRange } from '@/lib/utils/trading-day';

/* The board: what the site has taken today, measured against what a typical
   same-weekday had taken by this exact minute.

   This replaced the old service-board gantt, whose lane blocks were positioned
   by hardcoded percentages and whose Now/shift/week tabs only changed a heading.
   The time axis and the "Now" rule survive because those were the honest parts
   of that idea — they now sit on the location's real trading hours and real
   takings. */

interface CurvePoint {
  x: number;
  y: number;
}

function toPath(points: CurvePoint[]) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function TodayCurve({
  day,
  hourly,
  baseline,
  takenSoFar,
  pace,
  target,
  showToday,
}: {
  day: TradingDay;
  hourly: HourlyVolume[];
  baseline: DayBaseline | undefined;
  takenSoFar: number;
  pace: Pace;
  target: TargetProgress | null;
  showToday: boolean;
}) {
  const hasTypical = (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES;
  const revenueByHour = new Map(hourly.map((row) => [row.hour, Number(row.totalRevenue ?? 0)]));

  // Everything is positioned in axis-minute space, so a site trading past
  // midnight lays out left-to-right instead of folding back on itself.
  const { start, end } = axisRange(day);
  const buckets = axisHours(day);
  const xAt = (minutes: number) => ((minutes - start) / Math.max(1, end - start)) * 100;

  const nowMinutes = axisNowMinutes(day);
  const rawNowX = xAt(nowMinutes);
  const nowX = Math.min(100, Math.max(0, rawNowX));
  // The rule marks the present moment. Once the day is over it would be marking
  // nothing — clamped to the right-hand edge it reads as "we are at closing
  // time" for the rest of the evening, which is a lie the axis tells for hours.
  const showNowRule = day.state === 'trading' && rawNowX >= 0 && rawNowX <= 100;

  const typicalPoints: CurvePoint[] = [];
  const todayPoints: CurvePoint[] = [];
  let typicalRunning = 0;
  let todayRunning = 0;

  for (const bucket of buckets) {
    const endX = xAt(bucket.startMinutes + 60);

    if (hasTypical) {
      typicalRunning = baseline?.byHour[bucket.hour]?.cumulativeRevenue ?? typicalRunning;
      typicalPoints.push({ x: Math.min(100, endX), y: typicalRunning });
    }
    // Only hours that have actually happened carry a point.
    if (showToday && bucket.startMinutes <= nowMinutes) {
      todayRunning += revenueByHour.get(bucket.hour) ?? 0;
      todayPoints.push({ x: Math.min(endX, nowX), y: todayRunning });
    }
  }

  // Pin the last point to the live total so the line's end and the headline
  // figure can never disagree by a rounding of the hour buckets.
  if (showToday) todayPoints.push({ x: nowX, y: takenSoFar });

  const ceiling = Math.max(takenSoFar, hasTypical ? (baseline?.dailyMedianRevenue ?? 0) : 0, target?.target ?? 0, 1);
  const yAt = (value: number) => 100 - (value / ceiling) * 100;

  // At most six ticks, always including the first and last hour of the day.
  const tickStep = Math.max(1, Math.ceil(buckets.length / 6));
  const ticks = buckets.filter((_, index) => index % tickStep === 0 || index === buckets.length - 1);

  const scale = (points: CurvePoint[]) => points.map((point) => ({ x: point.x, y: yAt(point.y) }));
  const todayPath = toPath([{ x: 0, y: yAt(0) }, ...scale(todayPoints)]);
  const typicalPath = toPath([{ x: 0, y: yAt(0) }, ...scale(typicalPoints)]);
  const todayArea = todayPath ? `${todayPath} L${nowX.toFixed(2)},100 L0,100 Z` : '';

  const summary = showToday
    ? `Taken ${formatMoney(takenSoFar)} by ${day.time}.` +
      (pace.available
        ? ` ${formatMoney(Math.abs(pace.delta))} ${pace.delta >= 0 ? 'ahead of' : 'behind'} a typical ${day.weekday}.`
        : ' Not enough history to compare.')
    : `A typical ${day.weekday} takes ${formatMoney(baseline?.dailyMedianRevenue ?? 0)}.`;

  return (
    <div className="mt-5">
      <div className="relative h-40 sm:h-48">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          {/* Quiet horizontal guides — quarter, half, three-quarter of the ceiling. */}
          {[25, 50, 75].map((position) => (
            <line
              key={position}
              x1="0"
              x2="100"
              y1={position}
              y2={position}
              className="stroke-rule/50"
              strokeWidth="1"
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {target && yAt(target.target) >= 0 && (
            <line
              x1="0"
              x2="100"
              y1={yAt(target.target)}
              y2={yAt(target.target)}
              className="stroke-primary/70"
              strokeWidth="1.5"
              strokeDasharray="5 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {typicalPath && (
            <path
              d={typicalPath}
              fill="none"
              className="stroke-reference"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {todayArea && <path d={todayArea} className="fill-measured/12" />}
          {todayPath && (
            <path
              d={todayPath}
              fill="none"
              className="stroke-measured"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {showNowRule && (
            <line
              x1={nowX}
              x2={nowX}
              y1="0"
              y2="100"
              className="stroke-foreground/35"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* The head of today's line, as HTML rather than an SVG circle: the
            viewBox is stretched to fit, so a circle would render as an ellipse. */}
        {showToday && todayPoints.length > 0 && (
          <span
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-measured ring-2 ring-card"
            style={{ left: `${nowX}%`, top: `${Math.min(100, Math.max(0, yAt(takenSoFar)))}%` }}
            aria-hidden="true"
          />
        )}
        {showNowRule && (
          <span
            className="pointer-events-none absolute -top-2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-rule bg-card px-1.5 py-0.5 text-micro font-bold text-foreground shadow-sm"
            style={{ left: `${nowX}%` }}
            aria-hidden="true"
          >
            {day.time}
          </span>
        )}
        {target && yAt(target.target) >= 0 && (
          <span
            className="pointer-events-none absolute right-0 -translate-y-1/2 rounded-sm bg-card px-1.5 text-micro font-bold text-primary"
            style={{ top: `${yAt(target.target)}%` }}
          >
            Target {formatMoney(target.target)}
          </span>
        )}
      </div>

      {/* Axis ticks sit at their true position rather than being spread evenly —
          on a page about honest marks, the labels have to be honest too. */}
      <div className="relative mt-2 h-4 text-micro font-semibold text-muted-foreground" aria-hidden="true">
        {ticks.map((tick) => (
          <span
            key={tick.startMinutes}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${Math.min(98, Math.max(2, xAt(tick.startMinutes)))}%` }}
          >
            {String(tick.hour).padStart(2, '0')}:00
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {showToday && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-measured" aria-hidden="true" />
            Today
          </span>
        )}
        {hasTypical ? (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-reference" aria-hidden="true" />
            Typical {day.weekday} · {baseline?.sampleCount} weeks
          </span>
        ) : (
          <span>
            Not enough history for a typical {day.weekday} yet ({baseline?.sampleCount ?? 0} of {MIN_BASELINE_SAMPLES} needed)
          </span>
        )}
      </div>
    </div>
  );
}

export function TakenTodayPanel({
  day,
  takenSoFar,
  orderCount,
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
  orderCount: number;
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
  const trading = day.state === 'trading' || day.state === 'after-close' || day.state === 'no-hours';
  const ahead = pace.delta >= 0;

  return (
    <div className="rounded-lg border border-rule/65 bg-card p-4 sm:p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-title text-foreground">
            {day.state === 'before-open' ? 'Before open' : day.state === 'closed-today' ? 'Closed today' : 'Taken today'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {day.state === 'closed-today'
              ? 'No trade to measure — here is what a typical day looks like.'
              : day.state === 'before-open'
                ? 'What a typical day looks like, and what you are aiming at.'
                : `Net of refunds, against a typical ${day.weekday} by this time.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {locationId && <DailyTargetControl locationId={locationId} target={target?.target ?? dailyTarget} />}
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
          >
            Reports
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 h-10 w-48 animate-pulse rounded-sm bg-band" aria-hidden="true" />
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
          {day.state === 'closed-today' ? (
            <>
              <p data-figure className="text-2xl font-semibold text-foreground sm:text-metric">
                {formatMoney(baseline?.dailyMedianRevenue ?? 0)}
              </p>
              <p className="pb-1 text-sm text-muted-foreground">
                typical {day.weekday}
                {yesterdayRevenue !== null && <> · yesterday {formatMoney(yesterdayRevenue)}</>}
              </p>
            </>
          ) : day.state === 'before-open' ? (
            <>
              <p data-figure className="text-2xl font-semibold text-foreground sm:text-metric">
                {formatMoney(target?.target ?? baseline?.dailyMedianRevenue ?? 0)}
              </p>
              <p className="pb-1 text-sm text-muted-foreground">
                {target ? "today's target" : `typical ${day.weekday}`} · opens {day.hours?.open ?? '—'}
              </p>
            </>
          ) : (
            <>
              <p data-figure className="text-2xl font-semibold text-foreground sm:text-metric">
                {formatMoney(takenSoFar)}
              </p>
              <p className="pb-1 text-sm text-muted-foreground">{orderCount} orders</p>
            </>
          )}
        </div>
      )}

      {trading && !loading && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {pace.available ? (
            <>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-semibold',
                  ahead ? 'border-momentum/60 bg-momentum/6 text-momentum' : 'border-exception/60 bg-exception/6 text-exception',
                )}
              >
                {ahead ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
                {formatMoney(Math.abs(pace.delta))} {ahead ? 'ahead of' : 'behind'} typical
                {pace.deltaPct !== null && (
                  <span className="font-normal">
                    ({pace.deltaPct > 0 ? '+' : ''}
                    {pace.deltaPct.toFixed(0)}%)
                  </span>
                )}
              </span>
              {pace.projected !== null && day.state === 'trading' && (
                <span className="text-xs text-muted-foreground">
                  On pace for <span className="font-semibold text-foreground">{formatMoney(pace.projected)}</span> by close
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {pace.sampleCount < MIN_BASELINE_SAMPLES
                ? `Pace needs ${MIN_BASELINE_SAMPLES} past ${day.weekday}s to be worth showing — there are ${pace.sampleCount}.`
                : 'Too early in the day to project a close.'}
            </span>
          )}

          {target && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-semibold',
                target.ahead ? 'border-momentum/60 text-momentum' : 'border-measured/60 text-measured',
              )}
              title={target.spreadEvenly ? 'Target spread evenly across the day — no baseline shape available yet.' : undefined}
            >
              <Target size={13} aria-hidden="true" />
              {Math.round(target.progress * 100)}% of {formatMoney(target.target)}
            </span>
          )}
        </div>
      )}

      <TodayCurve
        day={day}
        hourly={hourly}
        baseline={baseline}
        takenSoFar={takenSoFar}
        pace={pace}
        target={target}
        showToday={day.state !== 'before-open' && day.state !== 'closed-today'}
      />
    </div>
  );
}
