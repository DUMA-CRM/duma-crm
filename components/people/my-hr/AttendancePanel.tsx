'use client';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { CalendarCheck, ChevronLeft, ChevronRight, HeartPulse } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type AttendanceDay, type AttendanceStatus, getMyAbsences, getMyAttendance } from '@/lib/api/people-ops.service';
import { getMyScheduledShifts } from '@/lib/api/scheduling.service';
import { cn } from '@/lib/utils/cn';
import { attendanceTotals, groupAttendanceByWeek, mergeRosteredDays } from '@/lib/utils/my-hr';

import { DayDetailDrawer } from './DayDetailDrawer';
import { PanelHeading } from './PanelHeading';
import { fmt } from './shared';

/** Where your time actually went: hours worked against hours rostered, then absence. */
export function AttendancePanel({ onCorrection }: { onCorrection: (date: string) => void }) {
  return (
    <div className="space-y-8">
      <AttendanceSection onCorrection={onCorrection} />
      <section className="border-t border-rule pt-8">
        <AbsenceSection />
      </section>
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
 * How each state reads. The role colour rides on a small marker rather than
 * washing the whole cell, and every state carries a word too — so the calendar
 * stays porcelain and nothing depends on colour alone.
 */
const STATUS: Record<
  AttendanceStatus,
  { label: string; dot: string; badge: 'success' | 'warning' | 'destructive' | 'muted' | 'outline'; inLegend: boolean }
> = {
  full: { label: 'Worked', dot: 'bg-momentum', badge: 'success', inLegend: true },
  partial: { label: 'Short', dot: 'bg-measured', badge: 'warning', inLegend: true },
  missed: { label: 'Missed', dot: 'bg-exception', badge: 'destructive', inLegend: true },
  leave: { label: 'Leave', dot: 'bg-reference', badge: 'outline', inLegend: true },
  scheduled: { label: 'Rostered', dot: 'bg-muted-foreground', badge: 'muted', inLegend: true },
  no_shift: { label: 'No shift', dot: '', badge: 'muted', inLegend: false },
};

// ── Attendance ────────────────────────────────────────────────────────────────

function AttendanceSection({ onCorrection }: { onCorrection: (date: string) => void }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // The day-by-day figures are the detail behind the calendar, not the headline.
  const [showTable, setShowTable] = useState(false);

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

  const data = useMemo(() => mergeRosteredDays(attendance, roster), [attendance, roster]);
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

      {totals.plannedHours > 0 && (
        <p className="text-sm text-muted-foreground">
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

      <div className="rounded-md border border-rule bg-card p-3 shadow-sm md:p-4">
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Attendance for ${monthName}`}>
          {WEEKDAYS.map((day) => (
            <div key={day} role="columnheader" className="py-1 text-center text-micro uppercase text-muted-foreground">
              {day}
            </div>
          ))}

          {isLoading
            ? Array.from({ length: 35 }, (_, i) => <div key={`skeleton-${i}`} className="h-16 animate-pulse rounded-sm bg-band/60" />)
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
                      onSelect={() => setSelected(date === selected ? null : date)}
                    />
                  );
                }),
              ]}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {Object.values(STATUS)
          .filter((status) => status.inLegend)
          .map((status) => (
            <span key={status.label} className="flex items-center gap-1.5">
              <i className={cn('size-2 rounded-full', status.dot)} aria-hidden="true" />
              {status.label}
            </span>
          ))}
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

      {/* Collapsed by default: the calendar answers the usual question, and the
          week-by-week figures are there when somebody is checking their pay. */}
      {weeks.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" className="gap-1.5" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>
            <ChevronRight size={14} className={cn('transition-transform', showTable && 'rotate-90')} aria-hidden="true" />
            {showTable ? 'Hide' : 'Show'} day-by-day breakdown
          </Button>
          {showTable && <WeeklyLedger weeks={weeks} onQuery={onCorrection} />}
        </div>
      )}

      {!isLoading && weeks.length === 0 && (
        <div className="rounded-md border border-rule bg-card shadow-sm">
          <EmptyState
            icon={CalendarCheck}
            title={`Nothing recorded in ${monthName}`}
            description="Days you were rostered or worked will appear here."
          />
        </div>
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
  entry?: AttendanceDay;
  today: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = entry ? (STATUS[entry.status] ?? STATUS.no_shift) : STATUS.no_shift;
  const worked = toHours(entry?.workedMinutes ?? 0);
  const planned = toHours(entry?.plannedMinutes ?? 0);
  const active = !!entry && entry.status !== 'no_shift';

  // One figure per day: the hours if there are any, else the word for the state.
  const figure = !active
    ? null
    : entry!.status === 'leave'
      ? 'Leave'
      : entry!.status === 'scheduled'
        ? hrs(planned)
        : entry!.status === 'missed'
          ? '0h'
          : hrs(worked);

  return (
    <button
      type="button"
      role="gridcell"
      disabled={!active}
      aria-selected={selected}
      aria-label={`${dayLabel(date)} — ${active ? status.label : 'no shift'}${figure && figure !== status.label ? `, ${figure}` : ''}`}
      onClick={onSelect}
      className={cn(
        'flex h-16 flex-col rounded-sm border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active ? 'border-rule/70 hover:bg-muted' : 'cursor-default border-transparent',
        selected && 'border-primary bg-band ring-1 ring-primary',
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className={cn('text-xs tabular-nums', today ? 'font-bold text-primary' : active ? 'font-semibold' : 'text-muted-foreground')}>
          {day}
        </span>
        {active && <i className={cn('size-2 shrink-0 rounded-full', status.dot)} aria-hidden="true" />}
      </span>
      {figure && <span className="mt-auto font-mono text-micro tabular-nums text-muted-foreground">{figure}</span>}
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
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-rule bg-card shadow-sm">
      {weeks.map((week) => (
        <div key={week.weekStart}>
          <div className="flex items-center justify-between gap-4 border-b border-rule bg-band/60 px-4 py-2 md:px-5">
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
                <li key={day.date} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 md:px-5">
                  <p className="w-32 shrink-0 text-sm font-medium text-foreground">{dayLabel(day.date)}</p>
                  <Badge variant={status.badge}>{status.label}</Badge>
                  <div className="ml-auto flex items-center gap-3 md:gap-4">
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
                        'hidden w-16 shrink-0 text-right font-mono text-sm tabular-nums sm:block',
                        comparable && variance < 0 ? 'text-warning' : 'text-muted-foreground',
                      )}
                    >
                      {comparable && variance !== 0 ? `${variance > 0 ? '+' : '−'}${hrs(Math.abs(variance))}` : ''}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => onQuery(day.date)} aria-label={`Query ${dayLabel(day.date)}`}>
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

/** Sickness and unplanned absence logged about the employee — their record, so they can see it. */
function AbsenceSection() {
  const { data: absences = [], isLoading, isError } = useQuery({ queryKey: ['absences-me'], queryFn: getMyAbsences, retry: false });

  if (isLoading || isError) return null;

  return (
    <section className="space-y-4">
      <PanelHeading title="Absence" description="Sickness and unplanned absence recorded by your manager." />
      {absences.length === 0 ? (
        <div className="rounded-md border border-rule bg-card shadow-sm">
          <EmptyState icon={HeartPulse} title="No absence recorded" description="Nothing has been logged against you." />
        </div>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card shadow-sm">
          {absences.map((absence) => (
            <li key={absence.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 md:px-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {fmt(absence.date)}
                  {absence.isHalfDay && <span className="ml-2 text-xs font-normal text-muted-foreground">Half day</span>}
                </p>
                {absence.reason && <p className="mt-0.5 text-sm text-muted-foreground">{absence.reason}</p>}
              </div>
              {absence.leaveType && <Badge variant="muted">{absence.leaveType.name}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
