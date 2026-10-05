'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { monthBounds } from '@/components/shared/AttendanceCalendar';

import { getMyAbsences, getMyAttendance } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { attendanceTotals, mergeAbsenceDays, mergeRosteredDays } from '@/lib/utils/my-hr';

/**
 * One month of your attendance: what the clock recorded, the rota's days still
 * to come, and absence logged about you — merged, with totals.
 *
 * Shared by the Attendance tab and the Overview's "This month" fact so both
 * read one cache entry per month; written twice, they would have been two
 * requests and, sooner or later, two different numbers.
 */
export function useMonthAttendance(offset: number) {
  const range = monthBounds(offset);
  const attendance = useQuery({
    queryKey: moduleQueryKeys.people.key('attendance-me', range.from, range.to),
    queryFn: () => getMyAttendance(range.from, range.to),
  });
  // Attendance only describes what has happened; the rota carries the rest.
  const roster = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-scheduled-shifts', range.from, range.to),
    queryFn: () => getMyScheduledShifts({ from: range.from, to: range.to }),
    retry: false,
  });
  const absences = useQuery({ queryKey: moduleQueryKeys.people.key('absences-me'), queryFn: getMyAbsences, retry: false });

  const days = useMemo(
    () => mergeAbsenceDays(mergeRosteredDays(attendance.data ?? [], roster.data ?? []), absences.data ?? []),
    [attendance.data, roster.data, absences.data],
  );
  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);

  return {
    range,
    days,
    byDate,
    totals: attendanceTotals(days),
    absences,
    isLoading: attendance.isPending,
    isError: attendance.isError,
    refetch: () => void attendance.refetch(),
  };
}
