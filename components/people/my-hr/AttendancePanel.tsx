'use client';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { CalendarCheck, ChevronDown, ChevronLeft, ChevronRight, HeartPulse } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type AttendanceDay, type AttendanceStatus, getMyAbsences, getMyAttendance } from '@/lib/api/people-ops.service';
import { getMyScheduledShifts } from '@/lib/api/scheduling.service';
import { cn } from '@/lib/utils/cn';
import {
  type AttendanceDayWithAbsence,
  attendanceTotals,
  groupAttendanceByWeek,
  mergeAbsenceDays,
  mergeRosteredDays,
} from '@/lib/utils/my-hr';

import { DayDetailDrawer } from './DayDetailDrawer';
import { PanelHeading } from './PanelHeading';
import { fmt } from './shared';

/**
 * Where your time actually went: the month on a calendar, then the two records
 * that explain it — the day-by-day figures and anything logged as absence.
 *
 * The month lives here rather than inside the calendar so the breakdown beside
 * it is always the same month, not a second one drifting out of step.
 */
export function AttendancePanel({ onCorrection }: { onCorrection: (date: string) => void }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const range = monthBounds(offset);
  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance-me', range.from, range.to],
    queryFn: () => getMyAttendance(range.from, range.to),
  });
  // The rota carries the days still to come; attendance only describes what has
  // already happened, so on its own the calendar would end at today.
  const { data: roster = [] } = useQuery({
    queryKey: ['my-scheduled-shifts', range.from, range.to],
    queryFn: () => getMyScheduledShifts({ from: range.from, to: range.to }),
    retry: false,
  });

  // Shares the Absence card's cache entry, so this costs no extra request.
  const { data: absences = [] } = useQuery({ queryKey: ['absences-me'], queryFn: getMyAbsences, retry: false });

  const data = useMemo(() => mergeAbsenceDays(mergeRosteredDays(attendance, roster), absences), [attendance, roster, absences]);
  const byDate = useMemo(() => new Map(data.map((day) => [day.date, day])), [data]);
  const weeks = groupAttendanceByWeek(data);
  const totals = attendanceTotals(data);
  const monthName = range.first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const selectedDay = selected ? byDate.get(selected) : undefined;

  const changeMonth = (direction: number) => {
    setOffset(offset + direction);
    // A selection from the old month would point at a day no longer on screen.
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <PanelHeading
          title="Attendance"
          description="The hours you worked against the hours you were rostered. Select a day to see it in full."
          action={
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <div className="w-36 text-center text-sm font-semibold">{monthName}</div>
              <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
          }
        />

        <MonthGrid
          range={range}
          monthName={monthName}
          byDate={byDate}
          isLoading={isLoading}
          selected={selected}
          totals={totals}
          onSelect={(date) => setSelected(date === selected ? null : date)}
        />
      </section>

      {/* The two records behind the calendar, side by side: one is the figures,
          the other is what was logged about you. Neither leads. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <BreakdownCard weeks={weeks} monthName={monthName} onQuery={onCorrection} />
        <AbsenceCard />
      </div>

      {selectedDay && (
        <DayDetailDrawer
          day={selectedDay}
          onClose={() => setSelected(null)}
          onQuery={() => {
            // Close first, so the correction dialog is not stacked on the drawer.
            setSelected(null);
            onCorrection(selectedDay.date);
          }}
        />
      )}
    </div>
  );
}

/** Card header shared by the two records, so they read as a matched pair. */
function CardHeading({ title, meta, children }: { title: string; meta?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {meta}
      {children}
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function monthBounds(offset: number) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { first, from: iso(first), to: iso(last), days: last.getDate(), blank: (first.getDay() + 6) % 7 };
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hrs = (hours: number) => `${Math.round(hours * 10) / 10}h`;
const toHours = (minutes: number) => (Number(minutes) || 0) / 60;
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
const STATUS: Record<
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
const ABSENCE = {
  label: 'Absent',
  cell: 'border-stock/45 bg-stock/8 text-stock',
  hover: 'hover:bg-stock/14',
  swatch: 'border-stock/45 bg-stock/8',
};

// ── Attendance ────────────────────────────────────────────────────────────────

function MonthGrid({
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
              Array.from({ length: 35 }, (_, i) => <div key={`skeleton-${i}`} className="h-20 animate-pulse rounded-sm bg-band/60 md:h-24" />)
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
function BreakdownCard({
  weeks,
  monthName,
  onQuery,
}: {
  weeks: ReturnType<typeof groupAttendanceByWeek>;
  monthName: string;
  onQuery: (date: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const days = weeks.reduce((sum, week) => sum + week.days.length, 0);

  return (
    <section className="overflow-hidden rounded-md border border-rule bg-card shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        disabled={days === 0}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 border-b border-rule px-4 py-3 text-left transition-colors hover:bg-band/50 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <h3 className="text-sm font-semibold text-foreground">Day by day</h3>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Nothing recorded'}
          {days > 0 && <ChevronDown size={15} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />}
        </span>
      </button>
      {days === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No working days recorded in {monthName}.</p>
      ) : (
        open && <WeeklyLedger weeks={weeks} onQuery={onQuery} />
      )}
    </section>
  );
}

function DayCell({
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
  const figure = !active || entry!.status === 'leave' || entry!.status === 'no_shift' ? null : entry!.status === 'scheduled' ? hrs(planned) : hrs(worked);
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


function WeeklyLedger({
  weeks,
  onQuery,
}: {
  weeks: ReturnType<typeof groupAttendanceByWeek>;
  onQuery: (date: string) => void;
}) {
  // No card of its own: it renders inside BreakdownCard's body.
  return (
    <div>
      {weeks.map((week) => (
        // Weeks are separated by a rule; the first sits under the card header,
        // which already has one.
        <div key={week.weekStart} className="border-t border-rule first:border-t-0">
          <div className="flex items-center justify-between gap-4 border-b border-rule bg-band/60 px-4 py-2">
            <h3 className="text-micro font-bold uppercase tracking-micro text-muted-foreground">
              {shortDay(week.weekStart)} – {shortDay(week.weekEnd)}
            </h3>
            {week.plannedHours > 0 && (
              <p className="font-mono text-label tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{hrs(week.workedHours)}</span> of {hrs(week.plannedHours)}
              </p>
            )}
          </div>
          <ul className="divide-y divide-rule">
            {week.days.map((day) => {
              const status = STATUS[day.status] ?? STATUS.no_shift;
              const worked = toHours(day.workedMinutes);
              const planned = toHours(day.plannedMinutes);
              const variance = Math.round((worked - planned) * 100) / 100;
              const comparable = day.status === 'full' || day.status === 'partial' || day.status === 'missed';
              return (
                // Sized for a half-width card: the date column is narrower and
                // the variance sits in a fixed slot so the figures align.
                <li key={day.date} className="group/day flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 hover:bg-band/40">
                  <p className="w-24 shrink-0 text-sm font-medium text-foreground">{dayLabel(day.date)}</p>
                  <Badge variant={status.badge}>{status.label}</Badge>
                  <div className="ml-auto flex items-center gap-2">
                    <p className="font-mono text-sm tabular-nums text-foreground">
                      {planned > 0 ? (
                        <>
                          {hrs(worked)} <span className="text-muted-foreground">of {hrs(planned)}</span>
                        </>
                      ) : worked > 0 ? (
                        hrs(worked)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                    <span
                      className={cn(
                        'w-14 shrink-0 text-right font-mono text-xs tabular-nums',
                        comparable && variance < 0 ? 'text-warning' : 'text-muted-foreground',
                      )}
                    >
                      {comparable && variance !== 0 ? `${variance > 0 ? '+' : '−'}${hrs(Math.abs(variance))}` : ''}
                    </span>
                    {/* Revealed on hover or keyboard focus: one per row is a lot
                        of buttons for something used rarely. */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onQuery(day.date)}
                      aria-label={`Query ${dayLabel(day.date)}`}
                      className="opacity-0 transition-opacity group-hover/day:opacity-100 focus-visible:opacity-100"
                    >
                      Query
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Sickness and unplanned absence logged about the employee — their record, so
 * they can see it. Sits beside the breakdown as a matching card.
 */
function AbsenceCard() {
  const { data: absences = [], isLoading, isError } = useQuery({ queryKey: ['absences-me'], queryFn: getMyAbsences, retry: false });

  // Nothing to say if the endpoint is unavailable to this account — but the card
  // still holds its place in the row rather than collapsing the grid.
  return (
    <section className="overflow-hidden rounded-md border border-rule bg-card shadow-sm">
      <CardHeading
        title="Absence"
        meta={
          <span className="text-xs text-muted-foreground">
            {isError ? 'Unavailable' : absences.length > 0 ? `${absences.length} logged` : 'None logged'}
          </span>
        }
      />
      {isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1].map((row) => (
            <div key={row} className="h-9 animate-pulse rounded-sm bg-band/60" />
          ))}
        </div>
      ) : isError ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Your absence record could not be loaded.</p>
      ) : absences.length === 0 ? (
        <EmptyState icon={HeartPulse} title="No absence recorded" description="Nothing has been logged against you." />
      ) : (
        <ul className="divide-y divide-rule">
          {absences.map((absence) => (
            <li key={absence.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {fmt(absence.date)}
                  {absence.isHalfDay && <span className="ml-2 text-xs font-normal text-muted-foreground">Half day</span>}
                </p>
                {absence.reason && <p className="mt-0.5 truncate text-sm text-muted-foreground">{absence.reason}</p>}
              </div>
              {absence.leaveType && <Badge variant="muted">{absence.leaveType.name}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
