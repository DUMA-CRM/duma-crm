'use client';

import { Clock } from '@/components/icons';

import type { DayBaseline, HourlyVolume } from '@/lib/modules/analytics/client';
import { cn } from '@/lib/utils/cn';
import { MIN_BASELINE_SAMPLES } from '@/lib/utils/pace';
import { type TradingDay, axisHours, axisNowMinutes } from '@/lib/utils/trading-day';

/* Orders per hour of the local trading day, so prep and staffing can be planned
   against the shape of the day rather than a total.

   The axis is clipped to the location's real opening hours — the old version drew
   a fixed 00:00–23:00 range, most of which was structurally empty. */

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
  const busiest = buckets[counts.indexOf(Math.max(...counts))]?.hour ?? first;
  const totalSoFar = counts.reduce((sum, value) => sum + value, 0);

  return (
    <div className="rounded-lg border border-rule/65 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-title text-foreground">Orders by hour</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {day.hours ? `${day.hours.open}–${day.hours.close} in local time` : 'Local time'}
            {hasTypical && ' · outline is a typical ' + day.weekday}
          </p>
        </div>
        {totalSoFar > 0 && (
          <span className="shrink-0 rounded-sm bg-band/70 px-2.5 py-1 text-xs font-semibold text-foreground">
            Busiest {String(busiest).padStart(2, '0')}:00
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-5 h-32 animate-pulse rounded-sm bg-band" aria-hidden="true" />
      ) : totalSoFar === 0 ? (
        <div className="mt-5 flex h-32 flex-col items-center justify-center gap-2 text-center">
          <Clock size={20} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {day.state === 'before-open' ? 'Nothing yet — the day starts at ' + (day.hours?.open ?? '—') : 'No orders yet today.'}
          </p>
        </div>
      ) : (
        <>
          <div
            className="mt-5 flex h-32 items-end gap-1"
            role="img"
            aria-label={`Orders by hour. ${totalSoFar} orders so far, busiest hour ${String(busiest).padStart(2, '0')}:00 with ${Math.max(...counts)} orders.`}
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
                  title={`${String(bucket.hour).padStart(2, '0')}:00 — ${count} orders`}
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
                      future ? 'bg-band' : bucket.hour === busiest ? 'bg-measured' : 'bg-measured/45',
                    )}
                    style={{ height: `${count ? Math.max(4, (count / max) * 100) : 2}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-micro font-semibold text-muted-foreground" aria-hidden="true">
            <span>{String(first).padStart(2, '0')}:00</span>
            {/* The middle bucket, not the arithmetic midpoint of the two clock
                hours — those disagree the moment the day crosses midnight. */}
            {buckets.length > 4 && <span>{String(buckets[Math.floor(buckets.length / 2)].hour).padStart(2, '0')}:00</span>}
            <span>{String(last).padStart(2, '0')}:00</span>
          </div>
        </>
      )}
    </div>
  );
}
