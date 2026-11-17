'use client';

import { Flame } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';
import type { DayCovers } from '@/lib/utils/reservations-stats';
import { formatCalendarDate } from '@/lib/utils/workspace-time';

/* Covers for each of the next seven days as a column, lunch below dinner with
   a 2px surface gap, as the Forms "Per day" chart draws its columns. The
   day's total is printed over its column and the busy days carry a word and
   an icon, so nothing is read by colour alone. Lunch and dinner are the app's
   first two validated series colours (light and dark both checked). */

const covers = (count: number) => (count === 1 ? '1 cover' : `${count} covers`);

function dayName(date: string, today: string) {
  return date === today ? 'Today' : formatCalendarDate(date, { weekday: 'short' });
}

const longName = (value: string, today: string) =>
  value === today ? 'Today' : formatCalendarDate(value, { weekday: 'long', day: 'numeric', month: 'short' });

function describe(day: DayCovers, today: string) {
  const name = longName(day.date, today);
  return [
    `${name}: ${covers(day.total)}`,
    `lunch ${day.lunch}, dinner ${day.dinner}`,
    day.busy ? 'busy' : null,
    day.peak ? 'busiest day' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function WeekCovers({ days, today, onOpenDay }: { days: DayCovers[]; today: string; onOpenDay?: (date: string) => void }) {
  const peak = Math.max(1, ...days.map((day) => day.total));
  const total = days.reduce((sum, day) => sum + day.total, 0);

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground tabular-nums">{total}</span> {total === 1 ? 'cover' : 'covers'} booked
        </p>
        <span className="flex items-center gap-3" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-series-1" />
            Lunch
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-series-2" />
            Dinner
          </span>
        </span>
      </div>

      <ol className="grid grid-cols-7 gap-1.5 sm:gap-3" aria-hidden={onOpenDay ? undefined : true}>
        {days.map((day) => {
          const column = (
            <>
              <span className={cn('text-xs tabular-nums', day.peak ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {day.total}
              </span>
              <span className="mt-1 flex h-32 w-full max-w-12 flex-col justify-end gap-0.5">
                {day.total === 0 ? (
                  <span className="block h-0.5 w-full rounded-full bg-band" />
                ) : (
                  <>
                    {day.dinner > 0 && (
                      <span
                        className="block w-full rounded-t-[4px] bg-series-2"
                        style={{ height: `${Math.max(3, (day.dinner / peak) * 100)}%` }}
                      />
                    )}
                    {day.lunch > 0 && (
                      <span
                        className={cn('block w-full bg-series-1', day.dinner === 0 && 'rounded-t-[4px]')}
                        style={{ height: `${Math.max(3, (day.lunch / peak) * 100)}%` }}
                      />
                    )}
                  </>
                )}
              </span>
              <span className={cn('mt-2 text-xs', day.date === today ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {dayName(day.date, today)}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{formatCalendarDate(day.date, { day: 'numeric' })}</span>
              <span className={cn('mt-1 flex h-4 items-center gap-0.5 text-[11px] font-medium text-measured', !day.busy && 'invisible')}>
                <Flame size={11} aria-hidden="true" />
                Busy
              </span>
            </>
          );
          return (
            <li key={day.date} className="min-w-0">
              <Tooltip label={describe(day, today)} side="top" className="block">
                {onOpenDay ? (
                  <button
                    type="button"
                    aria-label={`${describe(day, today)}. Open in Host`}
                    onClick={() => onOpenDay(day.date)}
                    className="flex w-full flex-col items-center rounded-md px-0.5 pt-1 pb-0.5 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="contents" aria-hidden="true">
                      {column}
                    </span>
                  </button>
                ) : (
                  <span className="flex w-full flex-col items-center px-0.5 pt-1 pb-0.5">{column}</span>
                )}
              </Tooltip>
            </li>
          );
        })}
      </ol>

      {/* The same days as a table, for screen readers. */}
      <table className="sr-only">
        <caption>Covers booked for the next seven days, lunch and dinner</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Lunch</th>
            <th scope="col">Dinner</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{longName(day.date, today)}</th>
              <td>{day.lunch}</td>
              <td>{day.dinner}</td>
              <td>
                {day.total}
                {day.busy ? ', busy' : ''}
                {day.peak ? ', busiest day' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
