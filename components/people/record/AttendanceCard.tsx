'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ChevronLeft, ChevronRight } from '@/components/icons';
import { MonthGrid, monthBounds } from '@/components/shared/AttendanceCalendar';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';

import { getEmployeeAbsences, getEmployeeAttendance } from '@/lib/api/people-ops.service';
import { getScheduledShifts } from '@/lib/api/scheduling.service';
import { attendanceTotals, mergeAbsenceDays, mergeRosteredDays } from '@/lib/utils/my-hr';

/**
 * The attendance month, for the manager looking at someone else's record.
 *
 * The same calendar the employee sees of themselves, from
 * `GET /hr/attendance/:userId` — an endpoint whose service wrapper
 * (`getEmployeeAttendance`) had existed with **no caller at all**. The record
 * carried the timesheet (which shifts were clocked, the payroll input) and had
 * no answer to the different question of whether someone turned up.
 *
 * Read-only: the employee's own view offers "ask for a correction", which is a
 * request *to* a manager and makes no sense pointed at themselves.
 */
export function EmployeeAttendanceCard({ userId, canReadRota }: { userId: string; canReadRota: boolean }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const range = monthBounds(offset);

  const {
    data: attendance = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['employee-attendance', userId, range.from, range.to],
    queryFn: () => getEmployeeAttendance(userId, range.from, range.to),
  });

  // Attendance only describes what has already happened, so without the rota
  // the calendar stops at today. `hr_manager` could not read this until
  // 2026-09-11; without the capability the month simply ends early rather than
  // showing a failed request.
  const { data: roster = [] } = useQuery({
    queryKey: ['scheduled-shifts', userId, range.from, range.to],
    queryFn: () => getScheduledShifts({ userId, from: range.from, to: range.to }),
    enabled: canReadRota,
  });

  const { data: absences = [] } = useQuery({
    queryKey: ['employee-absences', userId],
    queryFn: () => getEmployeeAbsences(userId),
    retry: false,
  });

  const data = useMemo(() => mergeAbsenceDays(mergeRosteredDays(attendance, roster), absences), [attendance, roster, absences]);
  const byDate = useMemo(() => new Map(data.map((day) => [day.date, day])), [data]);
  const monthName = range.first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const changeMonth = (direction: number) => {
    setOffset(offset + direction);
    // A selection from the old month points at a day no longer on screen.
    setSelected(null);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Attendance</h3>
          <p className="text-sm text-muted-foreground">Hours worked against hours rostered.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <div className="w-36 text-center text-sm font-semibold">{monthName}</div>
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="rounded-md border border-rule bg-card">
          <ErrorState
            title="Attendance couldn’t be loaded"
            description="No day was read, so this is not a month with nothing in it."
            onRetry={() => void refetch()}
          />
        </div>
      ) : (
        <MonthGrid
          range={range}
          monthName={monthName}
          byDate={byDate}
          isLoading={isLoading}
          selected={selected}
          totals={attendanceTotals(data)}
          onSelect={(date) => setSelected(date === selected ? null : date)}
        />
      )}
    </section>
  );
}
