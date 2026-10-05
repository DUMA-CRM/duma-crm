'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { ChevronLeft, ChevronRight, HeartPulse } from '@/components/icons';
import { RecordBlock, RecordList, RecordListRow } from '@/components/people/record/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { MonthGrid } from '@/components/shared/AttendanceCalendar';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';

import { getMyAbsences } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

import { DayDetailDrawer } from './DayDetailDrawer';
import { fmt } from './shared';
import { useMonthAttendance } from './useMonthAttendance';

/**
 * Where your time went: the month as a calendar, then the absence logged about
 * you. Select a day to see it in full, and query it from there.
 *
 * A "day by day" ledger sat under the calendar until 2026-10-04. It listed the
 * same status and hours each calendar cell already shows, with a second set of
 * Query buttons beside the drawer's — the same facts said twice, so it went.
 * The month's totals are the calendar's own legend line.
 */
export function AttendancePanel({ onCorrection }: { onCorrection: (date: string) => void }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const month = useMonthAttendance(offset);
  const monthName = month.range.first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const selectedDay = selected ? month.byDate.get(selected) : undefined;

  const changeMonth = (next: number) => {
    setOffset(next);
    // A selection from the old month would point at a day no longer on screen.
    setSelected(null);
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      <motion.section variants={SECTION_RISE} aria-label={`Attendance for ${monthName}`} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-base font-semibold tracking-title text-foreground" aria-live="polite">
            {monthName}
          </h2>
          <div className="flex items-center gap-1.5">
            {offset !== 0 && (
              <Button variant="outline" size="sm" onClick={() => changeMonth(0)}>
                This month
              </Button>
            )}
            <Button variant="outline" size="icon" className="size-8" onClick={() => changeMonth(offset - 1)} aria-label="Previous month">
              <ChevronLeft size={15} />
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => changeMonth(offset + 1)} aria-label="Next month">
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>

        {month.isError ? (
          <div className="rounded-lg border border-rule/60 bg-card">
            <ErrorState title="Your attendance couldn’t be loaded" onRetry={month.refetch} />
          </div>
        ) : (
          <MonthGrid
            range={month.range}
            monthName={monthName}
            byDate={month.byDate}
            isLoading={month.isLoading}
            selected={selected}
            totals={month.totals}
            onSelect={(date) => setSelected(date === selected ? null : date)}
          />
        )}
        <p className="px-1 text-xs text-muted-foreground">
          Select a day to see the shift, your clock-ins and any leave — and query it if something’s wrong.
        </p>
      </motion.section>

      <Absence />

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
    </motion.div>
  );
}

/**
 * Sickness and unplanned absence logged about you — your record, so you can see
 * it, with the reason the calendar has no room for.
 */
function Absence() {
  // The same key the month hook reads, so this is the calendar's request, not a second one.
  const absences = useQuery({ queryKey: moduleQueryKeys.people.key('absences-me'), queryFn: getMyAbsences, retry: false });
  const list = absences.data ?? [];

  return (
    <RecordBlock
      id="my-absence"
      title="Absence"
      note="Logged by your manager. Ask HR if a day here isn’t right."
      action={
        !absences.isPending && !absences.isError && list.length > 0 ? (
          <span className="text-xs text-muted-foreground">{list.length} logged</span>
        ) : undefined
      }
    >
      {absences.isPending ? (
        <div className="h-24 animate-pulse rounded-lg bg-band/60" aria-hidden="true" />
      ) : absences.isError ? (
        <div className="rounded-lg border border-rule/60 bg-card">
          <ErrorState title="Your absence record couldn’t be loaded" onRetry={() => void absences.refetch()} />
        </div>
      ) : (
        <RecordList>
          {list.length === 0 ? (
            <RecordListRow icon={HeartPulse} tone="muted" label="Nothing has been logged against you" placeholder="No absence recorded" />
          ) : (
            list.map((absence) => (
              <RecordListRow
                key={absence.id}
                icon={HeartPulse}
                tone="money"
                value={fmt(absence.date)}
                label={absence.reason || 'No reason recorded'}
                detail={absence.isHalfDay ? 'Half day' : undefined}
                trailing={absence.leaveType?.name}
              />
            ))
          )}
        </RecordList>
      )}
    </RecordBlock>
  );
}
