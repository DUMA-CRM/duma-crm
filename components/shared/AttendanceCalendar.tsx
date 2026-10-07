'use client';

import { useEffect, useRef } from 'react';

import { CalendarCheck } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Bone } from '@/components/shared/Skeleton';
import { Calendar } from '@/components/ui/calendar';

import type { AttendanceDay, AttendanceStatus } from '@/lib/modules/people/client';
import { cn } from '@/lib/utils/cn';
import { dateToIso, isoToDate } from '@/lib/utils/date';
import { type AttendanceDayWithAbsence, type AttendanceKey, attendanceCounts, attendanceTotals } from '@/lib/utils/my-hr';

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
 * How each state reads. The whole cell takes a soft role wash with a matching
 * hairline, the way HR calendars colour a month so it scans at a glance — the
 * same light-tint-under-role-ink construction as `Badge`, verified for contrast
 * in both themes. (A pill-only version was tried on 2026-09-26 and reverted:
 * the month lost its at-a-glance read.)
 *
 * Every cell still prints its status as a word, so colour is a second channel
 * rather than the only one. Labels stay short: a cell is ~44px wide on a phone.
 */

export const STATUS: Record<
  AttendanceStatus,
  {
    label: string;
    /** Cell wash: tint, hairline and ink. */
    cell: string;
    hover: string;
    /** Legend dot. */
    swatch: string;
    badge: 'success' | 'warning' | 'destructive' | 'muted' | 'reference';
    inLegend: boolean;
  }
> = {
  full: {
    label: 'Worked',
    cell: 'border-momentum/35 bg-momentum/6 text-momentum',
    hover: 'hover:bg-momentum/12',
    swatch: 'bg-momentum',
    badge: 'success',
    inLegend: true,
  },
  partial: {
    label: 'Short',
    cell: 'border-measured/40 bg-measured/7 text-measured',
    hover: 'hover:bg-measured/13',
    swatch: 'bg-measured',
    badge: 'warning',
    inLegend: true,
  },
  missed: {
    label: 'Missed',
    cell: 'border-exception/40 bg-exception/6 text-exception',
    hover: 'hover:bg-exception/12',
    swatch: 'bg-exception',
    badge: 'destructive',
    inLegend: true,
  },
  leave: {
    label: 'Leave',
    cell: 'border-reference/40 bg-reference/7 text-reference',
    hover: 'hover:bg-reference/13',
    swatch: 'bg-reference',
    badge: 'reference',
    inLegend: true,
  },
  scheduled: {
    label: 'Rota',
    cell: 'border-dashed border-rule bg-band/50 text-muted-foreground',
    hover: 'hover:bg-band',
    swatch: 'bg-muted-foreground/45',
    badge: 'muted',
    inLegend: true,
  },
  // A day not worked is still a day of the month: a plain cell with its number,
  // nothing printed to say nothing happened. The blanks before the 1st stay
  // truly empty — those are not dates at all.
  no_shift: { label: 'No shift', cell: 'border-rule/50 text-muted-foreground', hover: '', swatch: '', badge: 'muted', inLegend: false },
};

/**
 * Absence sits outside the attendance statuses — it is logged separately by a
 * manager — so it gets its own wash rather than a sixth status. Saffron because
 * it is the system's yellow and apricot is already "Short" in this grid.
 */
export const ABSENCE = {
  label: 'Absent',
  cell: 'border-stock/40 bg-stock/8 text-stock',
  hover: 'hover:bg-stock/14',
  swatch: 'bg-stock',
};

const LEGEND: { key: AttendanceKey; label: string; swatch: string }[] = [
  { key: 'full', label: STATUS.full.label, swatch: STATUS.full.swatch },
  { key: 'partial', label: STATUS.partial.label, swatch: STATUS.partial.swatch },
  { key: 'missed', label: STATUS.missed.label, swatch: STATUS.missed.swatch },
  { key: 'absent', label: ABSENCE.label, swatch: ABSENCE.swatch },
  { key: 'leave', label: STATUS.leave.label, swatch: STATUS.leave.swatch },
  { key: 'scheduled', label: STATUS.scheduled.label, swatch: STATUS.scheduled.swatch },
];

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
  const today = todayIso();
  // Only this month's days: the absence log is not month-scoped, so an absence
  // from August would otherwise be counted under September.
  const counts = attendanceCounts([...byDate.values()].filter((day) => day.date >= range.from && day.date <= range.to));

  return (
    <>
      <div className="rounded-lg border border-rule/60 bg-card p-2.5 md:p-3">
        {/* The legend is the month's summary: each state with how many days
            fell in it, and the hours against the rota — so the key and the
            totals are one line, not two. */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule/45 px-1 pb-2.5">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {LEGEND.map((item) => (
              <li key={item.key} className={cn('flex items-center gap-1.5', counts[item.key] === 0 && 'opacity-55')}>
                <i className={cn('size-2 rounded-full', item.swatch)} aria-hidden="true" />
                {!isLoading && <span className="font-semibold text-foreground">{counts[item.key]}</span>}
                {item.label}
              </li>
            ))}
          </ul>
          {totals.plannedHours > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{hrs(totals.workedHours)}</span> worked of {hrs(totals.plannedHours)} rostered
              {totals.varianceHours !== 0 && (
                <>
                  {' · '}
                  <span className={cn('font-semibold', totals.varianceHours < 0 ? 'text-measured' : 'text-foreground')}>
                    {hrs(Math.abs(totals.varianceHours))} {totals.varianceHours < 0 ? 'short' : 'over'}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {isLoading ? (
          // Same height as a real cell, so the grid does not jump when data lands.
          <div
            className="grid grid-cols-7 gap-1 md:gap-1.5"
            role="status"
            aria-busy="true"
            aria-label={`Loading attendance for ${monthName}`}
          >
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-1 pb-1 text-label uppercase text-muted-foreground">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }, (_, i) => (
              <Bone key={`skeleton-${i}`} className="h-20 md:h-24" />
            ))}
          </div>
        ) : (
          // The shared calendar, held on this month (the arrows above the
          // grid own navigation), with each day drawn as its attendance. It
          // brings what the hand-built grid lacked: arrow, Home/End and
          // PageUp/PageDown movement between days, and real grid semantics.
          <Calendar
            mode="single"
            month={range.first}
            hideNavigation
            showOutsideDays={false}
            aria-label={`Attendance for ${monthName}`}
            selected={selected ? (isoToDate(selected) ?? undefined) : undefined}
            // A second click on the chosen day passes undefined; hand the day back so the caller's toggle clears it.
            onSelect={(date) => onSelect(date ? dateToIso(date) : (selected ?? ''))}
            disabled={(date) => !isActiveDay(byDate.get(dateToIso(date)))}
            className="w-full"
            classNames={{
              root: 'w-full',
              months: 'w-full',
              month: 'flex w-full flex-col',
              month_caption: 'hidden',
              month_grid: 'w-full table-fixed border-collapse',
              weekdays: '',
              weekday:
                'px-1.5 pb-1 text-left text-label font-normal uppercase text-muted-foreground [&:nth-child(n+6)]:text-muted-foreground/65',
              week: '',
              // Cell padding, not border-spacing: the same 4px/6px gutters as before, flush to the panel edge.
              day: 'p-0.5 align-top md:p-[3px]',
              today: '',
              outside: '',
              disabled: '',
              hidden: 'invisible',
            }}
            components={{
              DayButton: ({ day, modifiers, ...props }) => {
                const date = dateToIso(day.date);
                return (
                  <DayCell
                    {...props}
                    date={date}
                    day={day.date.getDate()}
                    weekend={day.date.getDay() === 0 || day.date.getDay() === 6}
                    entry={byDate.get(date)}
                    today={date === today}
                    selected={date === selected}
                    focused={modifiers.focused}
                  />
                );
              },
            }}
          />
        )}
      </div>

      {!isLoading && byDate.size === 0 && (
        <EmptyState
          icon={CalendarCheck}
          title={`Nothing recorded in ${monthName}`}
          description="Days rostered or worked will appear here."
          compact
        />
      )}
    </>
  );
}

/** Whether a day has anything to open — a shift, leave or a logged absence. */
function isActiveDay(entry?: AttendanceDayWithAbsence) {
  return !!entry && (entry.status !== 'no_shift' || !!entry.absence);
}

/**
 * One day of the attendance month, as the calendar's `DayButton`: the day's
 * wash, its number, the hours and the word. It takes react-day-picker's button
 * props (click, keyboard, tabindex) so the grid's own navigation drives it.
 */
export function DayCell({
  date,
  day,
  weekend = false,
  entry,
  today,
  selected,
  focused,
  className,
  ...buttonProps
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  date: string;
  day: number;
  weekend?: boolean;
  entry?: AttendanceDayWithAbsence;
  today: boolean;
  selected: boolean;
  /** The calendar's roving focus — it moves the real focus here. */
  focused?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focused) ref.current?.focus();
  }, [focused]);

  const status = entry ? (STATUS[entry.status] ?? STATUS.no_shift) : STATUS.no_shift;
  const worked = toHours(entry?.workedMinutes ?? 0);
  const planned = toHours(entry?.plannedMinutes ?? 0);
  // Absence was logged about this day, whatever the clock recorded.
  const absent = !!entry?.absence;
  const active = isActiveDay(entry);

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
  // "of 6h" only when it adds something — a full day's 6h of 6h says nothing.
  const showPlanned = active && planned > 0 && entry!.status !== 'scheduled' && entry!.status !== 'leave' && worked !== planned;

  return (
    <button
      {...buttonProps}
      ref={ref}
      type="button"
      disabled={!active}
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      aria-label={`${dayLabel(date)} — ${active ? label : 'no shift'}${figure ? `, ${figure}` : ''}${
        entry?.absence?.reason ? `, ${entry.absence.reason}` : ''
      }`}
      className={cn(
        'flex h-20 w-full flex-col rounded-md border p-1.5 text-left transition-colors md:h-24 md:p-2',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        absent ? ABSENCE.cell : status.cell,
        !active && weekend && 'bg-band/30',
        active ? (absent ? ABSENCE.hover : status.hover) : 'cursor-default',
        // Ring rather than a competing fill, so the day's own colour survives selection.
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
        className,
      )}
    >
      <span className="flex items-start justify-between gap-1">
        {/* Today is a filled chip: it has to read over any of the washes. */}
        <span
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-md text-xs',
            today ? 'bg-primary font-semibold text-primary-foreground' : active ? 'font-semibold' : 'text-muted-foreground',
          )}
        >
          {day}
        </span>
        {figure && <span className="pt-1 text-xs font-semibold">{figure}</span>}
      </span>
      {active && (
        <span className="mt-auto min-w-0">
          <span className="block truncate text-xs font-semibold">{label}</span>
          {showPlanned && <span className="hidden truncate text-xs opacity-75 md:block">of {hrs(planned)} planned</span>}
        </span>
      )}
    </button>
  );
}
