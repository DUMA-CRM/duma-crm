'use client';

import { CalendarClock, CheckCircle2, Clock, Coffee, FileText, MapPin, Moon, Sun } from '@/components/icons';
import type { ShiftDetail } from '@/components/scheduling/ShiftDetailDrawer';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';

import type { LeaveRequest } from '@/lib/modules/people/client';
import type { ScheduledShift, Shift } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import {
  type RotaChange,
  type WorkedShift,
  assignWorked,
  formatDuration,
  leaveOnDay,
  plannedMinutes,
  shiftProgress,
  shiftState,
  unpaidBreak,
  workedMinutes,
} from '@/lib/utils/my-rota';
import { formatInstant } from '@/lib/utils/workspace-time';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fmtTime = (value: Date | string) => formatInstant(value, { hour: '2-digit', minute: '2-digit' });
const fmtWindow = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export interface BreakRule {
  thresholdMins?: number | null;
  unpaidMins?: number | null;
}

/**
 * Your week as a calendar: a column per day on a desk, a row per day on a
 * phone, and a card per shift that says everything about it — when, where, as
 * what, when the break falls, any note from your manager, and how it went.
 *
 * It replaced an hour-axis timeline (2026-10-03). That chart answered "where in
 * the day is my shift", which the times already say; it couldn't fit the
 * location, role, notes or outcome a person actually checks, and it scrolled
 * sideways below 760px. Deputy's employee week view made the same move.
 */
export function WeekSchedule({
  title,
  days,
  today,
  now,
  byDay,
  workedByDay,
  openWindowsByDay,
  breakRule,
  leave,
  leaveError,
  changes,
  onOpen,
  loading,
  error,
  onRetry,
}: {
  title: string;
  days: Date[];
  today: Date;
  now: number;
  byDay: ScheduledShift[][];
  workedByDay: Shift[][];
  /** Each day's opening hours across the locations involved, as minutes of the day. */
  openWindowsByDay: { open: number; close: number }[][];
  breakRule?: BreakRule;
  /** Your leave requests; only approved and pending ones show. */
  leave: LeaveRequest[];
  /** Leave didn't load — said under the week, so an "Off" day isn't mistaken for "no leave". */
  leaveError: boolean;
  /** New or changed since you last looked. */
  changes: Map<string, RotaChange>;
  onOpen: (detail: ShiftDetail) => void;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const empty = byDay.every((shifts) => shifts.length === 0) && workedByDay.every((worked) => worked.length === 0);

  return (
    <SettingsSection
      title={title}
      footnote={leaveError ? 'Your leave couldn’t be loaded, so days off you’ve booked may not show here.' : undefined}
    >
      {error ? (
        <ErrorState
          className="py-10"
          title="Your rota couldn’t be loaded"
          description={error instanceof Error ? error.message : 'Check your connection and try again.'}
          onRetry={onRetry}
        />
      ) : loading ? (
        <div role="status" className="grid gap-2 lg:grid-cols-7" aria-busy="true" aria-label="Loading your rota">
          {/* Each day's own card — the date, then a shift-sized block — so the week doesn't jump. */}
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex gap-3 rounded-lg border border-rule/50 bg-background/60 p-2.5 lg:min-h-52 lg:flex-col lg:gap-2"
              aria-hidden="true"
            >
              <span className="flex w-14 shrink-0 flex-col gap-1 lg:w-auto lg:flex-row lg:items-center lg:gap-2 lg:px-0.5">
                <Bone className="h-2.5 w-8" />
                <Bone className="h-4 w-6" />
              </span>
              <Bone className="h-14 min-w-0 flex-1 lg:flex-none" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {empty && (
            <div className="mb-3 flex items-center gap-3 rounded-lg border border-dashed border-rule/60 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground">
                <CalendarClock size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">No published shifts this week</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  They appear here as soon as your manager publishes the rota.
                </span>
              </span>
            </div>
          )}
          <ol className="grid gap-2 lg:grid-cols-7">
            {days.map((day, index) => {
              const planned = [...byDay[index]].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
              // Each clock-in lands once: on the shift whose hours it shares, or
              // in a run of unplanned work with the clock-ins next to it.
              const { byShift, unplanned } = assignWorked(planned, workedByDay[index], now);
              const dayMins = planned.reduce((sum, shift) => sum + plannedMinutes(shift), 0);
              const isToday = sameDay(day, today);
              const past = day < today && !isToday;
              const windows = openWindowsByDay[index];
              const dayLeave = leaveOnDay(leave, day);
              const off = planned.length === 0 && unplanned.length === 0 && dayLeave.length === 0;

              return (
                <li
                  key={day.toISOString()}
                  aria-current={isToday ? 'date' : undefined}
                  className={cn(
                    'flex gap-3 rounded-lg border p-2.5 lg:min-h-52 lg:flex-col lg:gap-2',
                    isToday ? 'border-primary/45 bg-primary/4' : 'border-rule/50 bg-background/60',
                  )}
                >
                  {/* ── The day ──────────────────────────────────────────── */}
                  <header className="flex w-14 shrink-0 flex-col items-start lg:w-auto lg:flex-row lg:items-center lg:justify-between lg:px-0.5">
                    <div className="flex flex-col items-start lg:flex-row lg:items-center lg:gap-2">
                      <span className={cn('text-micro font-semibold uppercase', isToday ? 'text-primary' : 'text-muted-foreground')}>
                        {DAY_LABELS[index]}
                      </span>
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-full text-base font-semibold tabular-nums',
                          isToday ? 'bg-primary text-primary-foreground' : past ? 'text-muted-foreground' : 'text-foreground',
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    {dayMins > 0 && <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(dayMins)}</span>}
                  </header>

                  {/* ── Its shifts ───────────────────────────────────────── */}
                  {off ? (
                    // A day off fills the column it would have held shifts in,
                    // so the week reads as a row of equal days, not a gap.
                    <p className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-dashed border-rule/50 px-3 text-xs font-medium text-muted-foreground lg:flex-col lg:justify-center lg:gap-1.5 lg:px-2">
                      <Moon size={14} className="shrink-0 text-muted-foreground/60" aria-hidden="true" />
                      {isToday ? 'Day off' : 'Off'}
                    </p>
                  ) : (
                    <div className="grid min-w-0 flex-1 content-start gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      {dayLeave.map((request) => (
                        <LeaveCard key={request.id} request={request} />
                      ))}
                      {planned.map((shift) => {
                        const worked = byShift.get(shift.id) ?? [];
                        return (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            worked={worked}
                            now={now}
                            breakRule={breakRule}
                            change={changes.get(shift.id)}
                            onOpen={() => onOpen({ kind: 'shift', shift, worked })}
                          />
                        );
                      })}
                      {unplanned.map((run) => (
                        <UnplannedCard key={run[0].id} run={run} now={now} onOpen={() => onOpen({ kind: 'unplanned', run })} />
                      ))}
                    </div>
                  )}

                  {windows.length > 0 && (
                    <p className="hidden truncate px-0.5 text-micro text-muted-foreground lg:block" title="Location opening hours">
                      Open {windows.map((window) => `${fmtWindow(window.open)}–${fmtWindow(window.close)}`).join(', ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </SettingsSection>
  );
}

/** One planned shift, with its outcome once there is one. */
function ShiftCard({
  shift,
  worked,
  now,
  breakRule,
  change,
  onOpen,
}: {
  shift: ScheduledShift;
  worked: WorkedShift[];
  now: number;
  breakRule?: BreakRule;
  change?: RotaChange;
  onOpen: () => void;
}) {
  const state = shiftState(shift, now);
  const planned = plannedMinutes(shift);
  const progress = shiftProgress(shift, now);
  const gap = unpaidBreak(planned, breakRule);
  const breakAt = gap ? new Date(new Date(shift.startsAt).getTime() + gap.from * 60_000) : null;
  const clocked = workedMinutes(worked, now);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${fmtTime(shift.startsAt)} to ${fmtTime(shift.endsAt)}, ${shift.location?.name ?? 'location not listed'} — open details`}
      className={cn(
        'relative block w-full min-w-0 overflow-hidden rounded-md border bg-card px-3 py-2.5 text-left shadow-sm transition-[border-color,box-shadow]',
        'hover:border-primary/60 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        state === 'now' ? 'border-primary/70 ring-2 ring-primary/15' : state === 'done' ? 'border-rule/50' : 'border-primary/35',
      )}
    >
      {change && (
        <span className="mb-1.5 inline-block rounded-sm bg-reference/10 px-1.5 py-0.5 text-micro font-semibold text-reference">
          {change === 'new' ? 'New' : 'Changed'}
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn('font-mono text-sm font-semibold tabular-nums', state === 'done' ? 'text-muted-foreground' : 'text-foreground')}>
          {fmtTime(shift.startsAt)}–{fmtTime(shift.endsAt)}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDuration(planned)}</span>
      </div>

      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={shift.location?.name}>
        <MapPin size={12} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{shift.location?.name ?? 'Location not listed'}</span>
      </p>
      {shift.role && <p className="mt-0.5 truncate pl-[18px] text-xs font-medium text-foreground">{shift.role}</p>}

      {breakAt && gap && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-stock">
          <Coffee size={12} className="shrink-0" aria-hidden="true" />
          {formatDuration(gap.to - gap.from)} break · {fmtTime(breakAt)}
        </p>
      )}
      {shift.notes && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground" title={shift.notes}>
          <FileText size={12} className="mt-px shrink-0" aria-hidden="true" />
          <span className="line-clamp-2">{shift.notes}</span>
        </p>
      )}

      {/* ── How it went ─────────────────────────────────────────────────── */}
      {state === 'now' && progress !== null ? (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-micro font-semibold">
            <span className="text-primary">On now</span>
            <span className="tabular-nums text-muted-foreground">{formatDuration((1 - progress) * planned)} left</span>
          </div>
          <div
            className="mt-1 h-1 overflow-hidden rounded-full bg-band"
            role="progressbar"
            aria-label="Shift elapsed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      ) : state === 'done' ? (
        worked.length > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-momentum">
            <CheckCircle2 size={12} className="shrink-0" aria-hidden="true" />
            Worked {formatDuration(clocked)}
          </p>
        ) : (
          <span className="mt-2 inline-block rounded-sm bg-exception/8 px-1.5 py-0.5 text-micro font-semibold text-exception">
            Not clocked
          </span>
        )
      ) : null}
    </button>
  );
}

/** Time on the clock that no planned shift accounts for — one card per stretch, however many clock-ins it took. */
function UnplannedCard({ run, now, onOpen }: { run: Shift[]; now: number; onOpen: () => void }) {
  const first = run[0];
  const last = run.at(-1)!;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full min-w-0 rounded-md border border-dashed border-momentum/45 bg-momentum/5 px-3 py-2.5 text-left transition-colors hover:bg-momentum/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-momentum">
        <Clock size={12} className="shrink-0" aria-hidden="true" />
        Unplanned · {formatDuration(workedMinutes(run, now))}
      </p>
      <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
        {fmtTime(first.clockedIn)}–{last.clockedOut ? fmtTime(last.clockedOut) : 'now'}
        {run.length > 1 && <span className="font-sans"> · {run.length} clock-ins</span>}
      </p>
    </button>
  );
}

/** A day off you've booked — approved solid, pending dashed. Not a button: My HR owns leave. */
function LeaveCard({ request }: { request: LeaveRequest }) {
  const approved = request.status === 'approved';
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border px-3 py-2.5',
        approved ? 'border-reference/35 bg-reference/8' : 'border-dashed border-reference/45 bg-transparent',
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-reference">
        <Sun size={12} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{request.leaveType?.name ?? 'Leave'}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{approved ? 'Approved' : 'Awaiting approval'}</p>
    </div>
  );
}
