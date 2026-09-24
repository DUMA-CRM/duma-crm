'use client';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ChevronDown, ChevronLeft, ChevronRight, HeartPulse } from '@/components/icons';
import { MonthGrid, STATUS, dayLabel, hrs, monthBounds, shortDay, toHours } from '@/components/shared/AttendanceCalendar';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getMyAbsences, getMyAttendance } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { attendanceTotals, groupAttendanceByWeek, mergeAbsenceDays, mergeRosteredDays } from '@/lib/utils/my-hr';

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
    queryKey: moduleQueryKeys.people.key('attendance-me', range.from, range.to),
    queryFn: () => getMyAttendance(range.from, range.to),
  });
  // The rota carries the days still to come; attendance only describes what has
  // already happened, so on its own the calendar would end at today.
  const { data: roster = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-scheduled-shifts', range.from, range.to),
    queryFn: () => getMyScheduledShifts({ from: range.from, to: range.to }),
    retry: false,
  });

  // Shares the Absence card's cache entry, so this costs no extra request.
  const { data: absences = [] } = useQuery({ queryKey: moduleQueryKeys.people.key('absences-me'), queryFn: getMyAbsences, retry: false });

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

// ── Attendance ────────────────────────────────────────────────────────────────

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

function WeeklyLedger({ weeks, onQuery }: { weeks: ReturnType<typeof groupAttendanceByWeek>; onQuery: (date: string) => void }) {
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
  const {
    data: absences = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: moduleQueryKeys.people.key('absences-me'), queryFn: getMyAbsences, retry: false });

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
