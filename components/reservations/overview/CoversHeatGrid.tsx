'use client';

import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';
import { WEEKDAY_LABELS, busyHourSpan } from '@/lib/utils/reservations-stats';
import { heatLevel, heatmapPeak, hourLabel } from '@/lib/utils/web-analytics';

/* Covers by weekday and the hour bookings start, drawn as Website analytics
   draws its heatmap: one hue in five steps by share of the busiest hour,
   empty hours the band colour. Only the hours with covers are drawn, so the
   grid stays readable in half a page. The busiest hour is named in text and
   every cell is in the screen-reader table. */

const HEAT = ['bg-band/70', 'bg-primary/15', 'bg-primary/30', 'bg-primary/50', 'bg-primary/72', 'bg-primary'] as const;

const covers = (count: number) => (count === 1 ? '1 cover' : `${count} covers`);

export function CoversHeatGrid({ grid }: { grid: number[][] }) {
  const span = busyHourSpan(grid);
  if (!span) return null;
  const hours = Array.from({ length: span.to - span.from + 1 }, (_, index) => span.from + index);
  const max = Math.max(0, ...grid.flat());
  const peak = heatmapPeak(grid);

  return (
    <div className="relative space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {peak && (
          <p>
            Busiest:{' '}
            <span className="font-semibold text-foreground">
              {WEEKDAY_LABELS[peak.day]} {hourLabel(peak.hour)}
            </span>{' '}
            · {covers(peak.value)}
          </p>
        )}
        <span className="flex items-center gap-1.5" aria-hidden="true">
          Fewer
          {HEAT.slice(1).map((tone) => (
            <span key={tone} className={cn('size-3 rounded-xs', tone)} />
          ))}
          More
        </span>
      </div>

      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {grid.map((row, day) => (
          <div key={WEEKDAY_LABELS[day]} className="contents">
            <span className="flex items-center text-[11px] text-muted-foreground">{WEEKDAY_LABELS[day]}</span>
            {hours.map((hour) => {
              const value = row[hour] ?? 0;
              return (
                <Tooltip
                  key={hour}
                  side="top"
                  label={`${WEEKDAY_LABELS[day]} ${hourLabel(hour)}–${hourLabel((hour + 1) % 24)} · ${covers(value)}`}
                  className="block h-6"
                >
                  <span className={cn('block size-full rounded-[3px]', HEAT[heatLevel(value, max)])} />
                </Tooltip>
              );
            })}
          </div>
        ))}
        <span />
        {hours.map((hour) => (
          <span key={hour} className="pt-1 text-center text-[10px] tabular-nums text-muted-foreground">
            {hours.length <= 12 || hour % 2 === 0 ? String(hour).padStart(2, '0') : ''}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Covers by weekday and the hour bookings start</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {hours.map((hour) => (
              <th key={hour} scope="col">
                {hourLabel(hour)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, day) => (
            <tr key={WEEKDAY_LABELS[day]}>
              <th scope="row">{WEEKDAY_LABELS[day]}</th>
              {hours.map((hour) => (
                <td key={hour}>{row[hour] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
