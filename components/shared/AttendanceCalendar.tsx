'use client';

import { CalendarCheck } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';

import type { AttendanceDay, AttendanceStatus } from '@/lib/modules/people/client';
import { cn } from '@/lib/utils/cn';
import { type AttendanceDayWithAbsence, attendanceTotals } from '@/lib/utils/my-hr';

/* The attendance month, shared by the employee's own view and the manager's
   view of them.

   It lived inside My HR's `AttendancePanel` until 2026-09-11, when the
   employee record gained the same calendar. Copying 200 lines so a manager
   could see what an employee already sees would have guaranteed the two
   drifted — the colour of a "partial" day is a statement about someone's pay,
   and it should not depend on who is looking. */

export function monthBounds(offset: number) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { first, from: iso(first), to: iso(last), days: last.getDate(), blank: (first.getDay() + 6) % 7 };
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const hrs = (hours: number) => `${Math.round(hours * 10) / 10}h`;
export const toHours = (minutes: number) => (Number(minutes) || 0) / 60;
export const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * How each state reads. The whole cell takes the role wash so a month can be
 * scanned at a glance, built the way `Badge` builds an annotation — a light
 * role tint under role-coloured text with a matching hairline, which is the one
 * construction in this system verified for contrast in both themes.
 *
 * Every cell still prints its status as a word next to the hours, so the colour
 * is a second channel rather than the only one. Labels are kept short because a
 * cell is roughly 44px wide on a phone.
 */

export const STATUS: Record<
  AttendanceStatus,
  {
    label: string;
    /** Cell wash: tint, hairline and ink. */
    cell: string;
    hover: string;
    /** Legend swatch. */
    swatch: string;
    badge: 'success' | 'warning' | 'destructive' | 'muted' | 'reference';
    inLegend: boolean;
  }
> = {
  full: {
    label: 'Worked',
    cell: 'border-momentum/45 bg-momentum/6 text-momentum',
    hover: 'hover:bg-momentum/12',
    swatch: 'border-momentum/45 bg-momentum/6',
    badge: 'success',
    inLegend: true,
  },
  partial: {
    label: 'Short',
    cell: 'border-measured/45 bg-measured/6 text-measured',
    hover: 'hover:bg-measured/12',
    swatch: 'border-measured/45 bg-measured/6',
    badge: 'warning',
    inLegend: true,
  },
  missed: {
    label: 'Missed',
    cell: 'border-exception/45 bg-exception/6 text-exception',
    hover: 'hover:bg-exception/12',
    swatch: 'border-exception/45 bg-exception/6',
    badge: 'destructive',
    inLegend: true,
  },
  leave: {
    label: 'Leave',
    cell: 'border-reference/45 bg-reference/8 text-reference',
    hover: 'hover:bg-reference/14',
    swatch: 'border-reference/45 bg-reference/8',
    badge: 'reference',
    inLegend: true,
  },
  scheduled: {
    label: 'Rota',
    cell: 'border-rule bg-band text-muted-foreground',
    hover: 'hover:bg-band/70',
    swatch: 'border-rule bg-band',
    badge: 'muted',
    inLegend: true,
  },
  // A day you were not working is still a day of the month: it keeps a quiet
  // grey edge so the grid reads as a calendar, with no fill and no label to say
  // nothing happened. The leading blanks before the 1st stay truly empty —
  // those are not dates at all.
  no_shift: { label: 'No shift', cell: 'border-rule/60 text-muted-foreground', hover: '', swatch: '', badge: 'muted', inLegend: false },
};

/**
 * Absence sits outside the attendance statuses — it is logged separately by a
 * manager — so it gets its own wash rather than a sixth status. Saffron because
 * it is the system's yellow and apricot is already spoken for by "Short" in
 * this same grid.
 */
export const ABSENCE = {
  label: 'Absent',
  cell: 'border-stock/45 bg-stock/8 text-stock',
  hover: 'hover:bg-stock/14',
  swatch: 'border-stock/45 bg-stock/8',
};

export function MonthGrid({
  range,
  monthName,
  byDate,
  isLoading,
  selected,
  totals,
  onSelect,
}: {
  range: ReturnType<typeof monthBounds>;
  monthName: string;
  byDate: Map<string, AttendanceDay>;
  isLoading: boolean;
  selected: string | null;
  totals: ReturnType<typeof attendanceTotals>;
  onSelect: (date: string) => void;
}) {
  return (
    <>
      <div className="rounded-md border border-rule bg-card p-3 shadow-sm md:p-4">
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Attendance for ${monthName}`}>
          {WEEKDAYS.map((day) => (
            <div key={day} role="columnheader" className="py-1 text-center text-micro uppercase text-muted-foreground">
              {day}
            </div>
          ))}

          {isLoading
            ? // Same height as a real cell, so the grid does not jump when data lands.
              Array.from({ length: 35 }, (_, i) => (
                <div key={`skeleton-${i}`} className="h-20 animate-pulse rounded-sm bg-band/60 md:h-24" />
              ))
            : [
                ...Array.from({ length: range.blank }, (_, i) => <div key={`blank-${i}`} />),
                ...Array.from({ length: range.days }, (_, i) => {
                  const date = `${range.from.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
                  return (
                    <DayCell
                      key={date}
                      date={date}
                      day={i + 1}
                      entry={byDate.get(date)}
                      today={date === todayIso()}
                      selected={date === selected}
                      onSelect={() => onSelect(date)}
                    />
                  );
                }),
              ]}
        </div>
      </div>

      {/* Key on the left, the month's total on the right: both are chrome for
          the grid above, so they share one row rather than taking two. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {[...Object.values(STATUS).filter((status) => status.inLegend), ABSENCE].map((status) => (
            <span key={status.label} className="flex items-center gap-1.5">
              {/* A miniature of the cell, not a dot, so the key matches the grid. */}
              <i className={cn('size-3 rounded-sm border', status.swatch)} aria-hidden="true" />
              {status.label}
            </span>
          ))}
        </div>

        {totals.plannedHours > 0 && (
          <p className="text-sm">
            <span className="font-mono font-semibold text-foreground">{hrs(totals.workedHours)}</span> worked of{' '}
            <span className="font-mono">{hrs(totals.plannedHours)}</span> rostered
            {totals.varianceHours !== 0 && (
              <>
                {' · '}
                <span className={cn('font-medium', totals.varianceHours < 0 ? 'text-warning' : 'text-foreground')}>
                  {hrs(Math.abs(totals.varianceHours))} {totals.varianceHours < 0 ? 'short' : 'over'}
                </span>
              </>
            )}
          </p>
        )}
      </div>

      {!isLoading && byDate.size === 0 && (
        <div className="rounded-md border border-rule bg-card shadow-sm">
          <EmptyState
            icon={CalendarCheck}
            title={`Nothing recorded in ${monthName}`}
            description="Days you were rostered or worked will appear here."
          />
        </div>
      )}
    </>
  );
}

/**
 * The figures behind the calendar. Open by default — it sits beside the calendar
 * rather than below it, so showing it costs no vertical room, and the week
 * subtotals are what somebody checking their pay came for. The whole header is
 * the toggle, so the hit area matches the card.
 */

export function DayCell({
  date,
  day,
  entry,
  today,
  selected,
  onSelect,
}: {
  date: string;
  day: number;
  entry?: AttendanceDayWithAbsence;
  today: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = entry ? (STATUS[entry.status] ?? STATUS.no_shift) : STATUS.no_shift;
  const worked = toHours(entry?.workedMinutes ?? 0);
  const planned = toHours(entry?.plannedMinutes ?? 0);
  // Absence was logged about this day, whatever the clock recorded.
  const absent = !!entry?.absence;
  const active = !!entry && (entry.status !== 'no_shift' || absent);

  // The hours are the figure; leave and an absence with no shift have none.
  const figure =
    !active || entry!.status === 'leave' || entry!.status === 'no_shift'
      ? null
      : entry!.status === 'scheduled'
        ? hrs(planned)
        : hrs(worked);
  // Absence takes the wash and the word — it explains the day better than
  // "missed" does, and the hours beside it still say what was worked.
  const label = absent ? (entry!.absence!.isHalfDay ? 'Absent ½' : ABSENCE.label) : status.label;

  return (
    <button
      type="button"
      role="gridcell"
      disabled={!active}
      aria-selected={selected}
      aria-label={`${dayLabel(date)} — ${active ? label : 'no shift'}${figure ? `, ${figure}` : ''}${
        entry?.absence?.reason ? `, ${entry.absence.reason}` : ''
      }`}
      onClick={onSelect}
      className={cn(
        'flex h-20 flex-col gap-0.5 rounded-sm border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:h-24 md:p-2',
        absent ? ABSENCE.cell : status.cell,
        active ? (absent ? ABSENCE.hover : status.hover) : 'cursor-default',
        // Ring rather than a competing fill, so the day's own colour survives selection.
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
      )}
    >
      <span className="flex items-center justify-between gap-1">
        {/* Today is a filled chip: it has to read over any of the washes. */}
        <span
          className={cn(
            'text-xs tabular-nums',
            today
              ? 'inline-flex size-5 items-center justify-center rounded-sm bg-primary font-bold text-primary-foreground'
              : active
                ? 'font-semibold'
                : 'text-muted-foreground',
          )}
        >
          {day}
        </span>
        {figure && <span className="font-mono text-xs font-semibold tabular-nums">{figure}</span>}
      </span>
      {active && <span className="mt-auto truncate text-micro font-semibold uppercase tracking-micro">{label}</span>}
      {active && planned > 0 && entry!.status !== 'scheduled' && (
        <span className="truncate font-mono text-micro tabular-nums opacity-70">of {hrs(planned)}</span>
      )}
    </button>
  );
}
