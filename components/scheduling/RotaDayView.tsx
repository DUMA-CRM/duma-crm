'use client';

import { Avatar } from '@/components/people/shared';
import { fmtTime } from '@/components/scheduling/shared';

import type { PlannerStaff } from '@/lib/api/rota.service';
import type { ScheduledShift } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import type { CoverageDay } from '@/lib/utils/coverage-check';
import { type CellState, dayWindow, positionSwatch, shiftDate, timelineSpan } from '@/lib/utils/rota-planner';

const hourLabel = (hour: number) => String(hour % 24).padStart(2, '0');

/**
 * One day as a timeline: a row per person, hours across the location's
 * opening hours (or 06:00–24:00), each shift a bar. Under it, the headcount
 * each hour against what recent orders say the hour needs; short hours in red.
 * Read-mostly — a bar opens the shift.
 */
export function RotaDayView({
  date,
  timeZone,
  hours,
  people,
  shifts,
  cellOf,
  cover,
  onOpen,
}: {
  date: string;
  timeZone: string;
  hours: { open: string; close: string } | null | undefined;
  people: Pick<PlannerStaff, 'userId' | 'name' | 'email'>[];
  shifts: ScheduledShift[];
  cellOf: (userId: string) => CellState;
  cover: CoverageDay | null | undefined;
  onOpen: (shift: ScheduledShift) => void;
}) {
  const day = shifts.filter((shift) => shift.status !== 'cancelled' && shiftDate(shift, timeZone) === date);
  const window = dayWindow(hours, day, date, timeZone);
  const span = Array.from({ length: window.to - window.from }, (_, index) => window.from + index);
  const rows = [
    ...(day.some((shift) => !shift.userId) ? [{ userId: '', name: 'Open shifts', email: null }] : []),
    ...people.filter((person) => day.some((shift) => shift.userId === person.userId)),
    ...people.filter((person) => !day.some((shift) => shift.userId === person.userId)),
  ];
  const cols = { gridTemplateColumns: `12rem repeat(${span.length}, minmax(2.5rem, 1fr))` };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <div role="table" aria-label={`Day timeline, ${date}`} style={{ minWidth: `${12 + span.length * 2.5}rem` }}>
        <div role="row" className="grid border-b border-border" style={cols}>
          <div
            role="columnheader"
            className="sticky left-0 z-10 bg-card px-3 py-2 text-micro font-semibold text-muted-foreground uppercase"
          >
            Team
          </div>
          {span.map((hour) => (
            <div key={hour} role="columnheader" className="border-l border-border px-1 py-2 text-micro tabular-nums text-muted-foreground">
              {hourLabel(hour)}
            </div>
          ))}
        </div>

        {rows.map((person) => {
          const own = day.filter((shift) => (shift.userId ?? '') === person.userId);
          const cell = person.userId ? cellOf(person.userId) : null;
          return (
            <div key={person.userId || 'open'} role="row" className="grid" style={cols}>
              <div role="rowheader" className="sticky left-0 z-10 flex min-w-0 items-center gap-2 bg-card px-3 py-1.5">
                {person.userId && <Avatar name={person.name} email={person.email ?? undefined} size="sm" />}
                <span className="min-w-0 truncate text-sm font-semibold text-foreground">{person.name}</span>
              </div>
              <div
                role="cell"
                className={cn(
                  'relative min-h-11 border-l border-border',
                  cell?.leave && (cell.leave.status === 'approved' ? 'bg-reference/8' : 'bg-reference/4'),
                  cell?.unavailable && !cell.leave && 'bg-band/50',
                )}
                style={{ gridColumn: `2 / span ${span.length}` }}
              >
                {own.length === 0 && cell && (cell.leave || cell.unavailable) && (
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs text-muted-foreground">
                    {cell.leave ? (cell.leave.status === 'approved' ? 'Leave' : 'Leave?') : 'Unavailable'}
                  </span>
                )}
                {own.map((shift) => {
                  const at = timelineSpan(shift, date, timeZone, window);
                  if (!at) return null;
                  return (
                    <button
                      key={shift.id}
                      type="button"
                      onClick={() => onOpen(shift)}
                      style={{ left: `${at.left}%`, width: `${at.width}%` }}
                      aria-label={`${person.name}, ${fmtTime(shift.startsAt)} to ${fmtTime(shift.endsAt)}. Open shift`}
                      className={cn(
                        'absolute inset-y-1.5 min-w-0 overflow-hidden rounded-md border-l-[3px] px-1.5 text-left text-xs font-semibold whitespace-nowrap tabular-nums text-foreground',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        positionSwatch(shift.position?.color).edge,
                        shift.status === 'draft'
                          ? 'border-y border-r border-dashed border-y-primary/45 border-r-primary/45 hover:bg-primary/6'
                          : 'bg-primary/8 hover:bg-primary/12',
                        !shift.position && 'border-l-transparent',
                      )}
                    >
                      {fmtTime(shift.startsAt)}–{fmtTime(shift.endsAt)}
                      {shift.position && <span className="ml-1 font-normal text-muted-foreground">{shift.position.name}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Headcount each hour against the recommendation. */}
        <div role="row" className="grid border-t border-border" style={cols}>
          <div role="rowheader" className="sticky left-0 z-10 bg-card px-3 py-2 text-xs text-muted-foreground">
            On / needed
          </div>
          {span.map((hour) => {
            const row = cover?.hours.find((h) => h.hour === hour);
            const on =
              row?.rostered ??
              day.filter((shift) => {
                const at = timelineSpan(shift, date, timeZone, { from: hour, to: hour + 1 });
                return !!at;
              }).length;
            const short = row ? row.gap < 0 : false;
            return (
              <div
                key={hour}
                role="cell"
                className={cn(
                  'border-l border-border px-1 py-2 text-xs font-semibold tabular-nums',
                  short ? 'bg-exception/8 text-exception' : 'text-muted-foreground',
                )}
                title={row ? `${row.rostered} on, ${row.needed} needed` : undefined}
              >
                {on}
                {row && row.needed > 0 && <span className="font-normal">/{row.needed}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
