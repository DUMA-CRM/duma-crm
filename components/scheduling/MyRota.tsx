'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  type IconComponent,
  LogOut,
  MapPin,
  Timer,
} from '@/components/icons';
import { type ShiftDetail, ShiftDetailDrawer } from '@/components/scheduling/ShiftDetailDrawer';
import { WeekSchedule } from '@/components/scheduling/WeekSchedule';
import { useRotaChanges } from '@/components/scheduling/useRotaChanges';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { ClockOutDialog } from '@/components/shifts/ClockOutDialog';
import { SlideToClockIn } from '@/components/shifts/SlideToClockIn';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { useAuth } from '@/lib/hooks/useAuth';
import { type OpeningHours, type Weekday, getLocations } from '@/lib/modules/organization/client';
import { type HrEmployee, getMyEmployee, getMyLeaveRequests } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type ScheduledShift, getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { type Shift, clockIn, getActiveShifts, getMyShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { formatDuration, localDateKey, paidMinutes, unpaidBreak, weekOffsetFor } from '@/lib/utils/my-rota';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Date helpers ──────────────────────────────────────────────────────────────

const WEEKDAY_KEY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function startOfWeek(offsetWeeks: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const mondayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayIndex + offsetWeeks * 7);
  return d;
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const durationMin = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 60000);
const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtHrs = formatDuration;
/** How far ahead "Next shift" looks. */
const UPCOMING_DAYS = 35;

/** "Today", "Tomorrow", or "Mon 6 Oct". */
const relativeDay = (date: Date, today: Date) => {
  const key = localDateKey(date);
  if (key === localDateKey(today)) return 'Today';
  if (key === localDateKey(addDays(today, 1))) return 'Tomorrow';
  return fmtShortDay(date);
};
const fmtShortDay = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
/** Countdown to a shift that has not started yet, or null once it has. */
const fmtUntil = (startsAt: string, now: number) => {
  const mins = Math.round((new Date(startsAt).getTime() - now) / 60000);
  return mins > 0 ? fmtHrs(mins) : null;
};
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
/** The employee's contract break rule, in the shape `unpaidBreak` reads. */
const breakRuleOf = (employee?: HrEmployee) =>
  employee ? { thresholdMins: employee.breakThresholdMins, unpaidMins: employee.unpaidBreakMins } : undefined;

// ── Shift dial ────────────────────────────────────────────────────────────────
// A 288° gauge with the gap at the bottom, read like the instrument dials
// elsewhere in the app: a band trough, hour ticks on the outside, one measured
// trace that turns to exception once the shift runs long, and a stock-coloured
// inner rail marking the unpaid break.

const DIAL_SWEEP = 288; // degrees of drawn track
const DIAL_START = 126; // clockwise from 3 o'clock, so the gap centres on 6 o'clock
const DIAL_ARC = (DIAL_SWEEP / 360) * 100; // as a share of pathLength="100"

function dialPoint(fraction: number, radius: number) {
  const radians = ((DIAL_START + fraction * DIAL_SWEEP) * Math.PI) / 180;
  return { x: 60 + radius * Math.cos(radians), y: 60 + radius * Math.sin(radians) };
}

function ShiftDial({
  elapsedMinutes,
  plannedMinutes,
  breakSpan,
  label,
}: {
  elapsedMinutes: number;
  plannedMinutes: number;
  /** The contract break as a 0–1 share of the shift, drawn on the inner rail. */
  breakSpan: { from: number; to: number } | null;
  label?: string;
}) {
  const ratio = plannedMinutes > 0 ? elapsedMinutes / plannedMinutes : 0;
  const percentage = Math.round(ratio * 100);
  const arc = Math.min(1, ratio) * DIAL_ARC;
  const over = elapsedMinutes > plannedMinutes;

  // One tick per scheduled hour, thinned out on a long shift so they stay legible.
  const hours = plannedMinutes / 60;
  const tickStep = hours > 12 ? 3 : hours > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let hour = tickStep; hour < hours; hour += tickStep) ticks.push(hour / hours);

  return (
    <div
      className="relative size-28 shrink-0 sm:size-32"
      // The stock rail carries no visible label, so hovering names it.
      title={label}
    >
      <svg
        viewBox="0 0 120 120"
        className="size-full"
        role="img"
        aria-label={label ?? `${percentage}% of your ${fmtHrs(plannedMinutes)} shift elapsed`}
      >
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          pathLength="100"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${DIAL_ARC} ${100 - DIAL_ARC}`}
          transform={`rotate(${DIAL_START} 60 60)`}
          className="text-band"
        />
        {ticks.map((fraction) => {
          const inner = dialPoint(fraction, 55.5);
          const outer = dialPoint(fraction, 59);
          return (
            <line
              key={fraction}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="text-grid-major"
            />
          );
        })}
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          pathLength="100"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${100 - arc}`}
          transform={`rotate(${DIAL_START} 60 60)`}
          className={cn(
            'transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none',
            over ? 'text-exception' : 'text-primary',
          )}
        />
        {breakSpan && (
          <circle
            cx="60"
            cy="60"
            r="39"
            fill="none"
            pathLength="100"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${(breakSpan.to - breakSpan.from) * DIAL_ARC} ${100 - (breakSpan.to - breakSpan.from) * DIAL_ARC}`}
            strokeDashoffset={-(breakSpan.from * DIAL_ARC)}
            transform={`rotate(${DIAL_START} 60 60)`}
            className="text-stock"
          />
        )}
      </svg>
      {/* The gap sits at the bottom, so the readout rides slightly above centre. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-2 text-center">
        <span className={cn('font-mono text-2xl font-semibold tabular-nums', over ? 'text-exception' : 'text-foreground')}>
          {percentage}%
        </span>
        <span className="mt-0.5 text-micro uppercase text-muted-foreground">elapsed</span>
      </div>
    </div>
  );
}

export function MyRota() {
  const { locationId } = useWorkspaceStore();
  const { user } = useAuth();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [offset, setOffset] = useState(0);
  const today = useMemo(() => new Date(), []);

  // Tick every 30s so the "clocked in for" label stays fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const weekStart = useMemo(() => startOfWeek(offset), [offset]);
  const weekEndExclusive = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const {
    data: shifts = [],
    isLoading,
    isError: rotaError,
    error: rotaErrorDetail,
    refetch: refetchRota,
  } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-rota', weekStart.toISOString()),
    queryFn: () => getMyScheduledShifts({ from: weekStart.toISOString(), to: weekEndExclusive.toISOString() }),
  });

  const { data: locations = [] } = useQuery({ queryKey: moduleQueryKeys.organization.key('locations-all'), queryFn: getLocations });
  const hoursByLocation = useMemo(() => {
    const m = new Map<string, OpeningHours | null | undefined>();
    for (const l of locations) m.set(l.id, l.openingHours);
    return m;
  }, [locations]);

  // ── Time clock ──────────────────────────────────────────────────────────────
  const {
    data: active = [],
    isError: activeShiftError,
    refetch: refetchActiveShift,
  } = useQuery({ queryKey: moduleQueryKeys.workforce.key('shifts-active'), queryFn: getActiveShifts });
  const myActive = user ? active.find((s) => s.userId === user.id) : undefined;
  const clockLocationId = myActive?.locationId ?? locationId;
  const activeDayRange = useMemo(() => {
    if (!myActive) return null;
    const from = new Date(myActive.clockedIn);
    from.setHours(0, 0, 0, 0);
    const to = addDays(from, 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [myActive]);
  // Shares a key shape with today's query below, so a shift started today costs
  // one request rather than two.
  const { data: activeDayShifts = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-rota-day', activeDayRange?.from),
    queryFn: () => getMyScheduledShifts(activeDayRange!),
    enabled: !!activeDayRange,
  });

  // Today's rota, independent of the week being browsed — clocking in and the
  // late warning must stay right while you are looking at next week.
  const todayRange = useMemo(() => {
    const from = new Date(today);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: addDays(from, 1).toISOString() };
  }, [today]);
  const { data: todayShifts = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-rota-day', todayRange.from),
    queryFn: () => getMyScheduledShifts(todayRange),
  });
  const currentScheduledToday =
    todayShifts.find((shift) => new Date(shift.startsAt).getTime() <= now && now < new Date(shift.endsAt).getTime()) ?? null;
  const upcomingToday = useMemo(
    () =>
      [...todayShifts]
        .filter((shift) => new Date(shift.startsAt).getTime() > now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null,
    [now, todayShifts],
  );
  // Link the timesheet to the shift you are actually starting: the one running
  // now, or the next one if it is within the hour.
  const upcomingOrCurrentShiftId =
    currentScheduledToday?.id ??
    (upcomingToday && new Date(upcomingToday.startsAt).getTime() - now <= 60 * 60 * 1000 ? upcomingToday.id : null);
  // Scheduled to be here, and not clocked in.
  const lateByMins =
    !myActive && currentScheduledToday ? Math.floor((now - new Date(currentScheduledToday.startsAt).getTime()) / 60000) : 0;

  // ── Worked time, to read the rota against ───────────────────────────────────
  const { data: myWorkedShifts = [] } = useQuery({ queryKey: moduleQueryKeys.workforce.key('shifts-my'), queryFn: getMyShifts });
  const workedThisWeek = useMemo(() => {
    const from = weekStart.getTime();
    const to = weekEndExclusive.getTime();
    return myWorkedShifts.filter((shift) => {
      const clockedIn = new Date(shift.clockedIn).getTime();
      return clockedIn >= from && clockedIn < to;
    });
  }, [myWorkedShifts, weekEndExclusive, weekStart]);
  const workedEnd = (shift: Shift) => (shift.clockedOut ? new Date(shift.clockedOut).getTime() : now);
  const workedByDay = useMemo(() => {
    const buckets: Shift[][] = Array.from({ length: 7 }, () => []);
    for (const shift of workedThisWeek) {
      const idx = days.findIndex((day) => sameDay(day, new Date(shift.clockedIn)));
      if (idx >= 0) buckets[idx].push(shift);
    }
    return buckets;
  }, [days, workedThisWeek]);
  const workedMins = useMemo(
    () =>
      workedThisWeek.reduce(
        (sum, shift) => sum + (shift.durationMinutes ?? Math.max(0, (workedEnd(shift) - new Date(shift.clockedIn).getTime()) / 60000)),
        0,
      ),
    // `now` keeps a running shift's contribution current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, workedThisWeek],
  );
  // Always on: the contract break rule places a break inside every long shift on
  // the timeline, not only the one being worked right now.
  const { data: employee } = useQuery({
    queryKey: moduleQueryKeys.people.key('hr-employee-me'),
    queryFn: getMyEmployee,
    retry: false,
    meta: { silentError: true },
  });
  const activeScheduledShift = useMemo(() => {
    if (!myActive) return null;
    if (myActive.scheduledShiftId) {
      const linked = activeDayShifts.find((shift) => shift.id === myActive.scheduledShiftId);
      if (linked) return linked;
    }
    const clockedIn = new Date(myActive.clockedIn).getTime();
    return (
      activeDayShifts.find(
        (shift) =>
          shift.locationId === myActive.locationId &&
          clockedIn >= new Date(shift.startsAt).getTime() - 60 * 60 * 1000 &&
          clockedIn <= new Date(shift.endsAt).getTime(),
      ) ?? null
    );
  }, [activeDayShifts, myActive]);
  const activePlannedMinutes = activeScheduledShift
    ? durationMin(new Date(activeScheduledShift.startsAt), new Date(activeScheduledShift.endsAt))
    : 0;
  const invalidateClock = () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-active') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-my') });
  };
  // The API can link the timesheet to the rota itself, but only if we tell it
  // which shift this is — otherwise planned-vs-worked has to guess.
  const clockInM = useMutation({
    mutationFn: () => clockIn({ locationId: locationId!, scheduledShiftId: upcomingOrCurrentShiftId ?? undefined }),
    onSuccess: invalidateClock,
  });
  // Order completion already consumed recipe inventory; clock-out only ends the shift.
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const clockError = clockInM.error as Error | undefined;
  const clockedMins = myActive ? Math.max(0, Math.floor((now - new Date(myActive.clockedIn).getTime()) / 60000)) : 0;
  // The dial needs a scheduled length to measure against; an unplanned clock-in has none.
  const onShiftWithPlan = !!myActive && activePlannedMinutes > 0;
  const overrunMins = onShiftWithPlan ? Math.max(0, clockedMins - activePlannedMinutes) : 0;

  // ── Break ───────────────────────────────────────────────────────────────────
  // Set per employee by an admin, so it has a known length and a known place in
  // the shift. Nothing to start or stop.
  const activeBreak = unpaidBreak(activePlannedMinutes, breakRuleOf(employee));
  const activeBreakMins = activeBreak ? activeBreak.to - activeBreak.from : 0;
  const dialBreakSpan = activeBreak ? { from: activeBreak.from / activePlannedMinutes, to: activeBreak.to / activePlannedMinutes } : null;
  const breakStartsAt = myActive && activeBreak ? new Date(new Date(myActive.clockedIn).getTime() + activeBreak.from * 60000) : null;

  const dialLabel = onShiftWithPlan
    ? `${Math.round((clockedMins / activePlannedMinutes) * 100)}% of your ${fmtHrs(activePlannedMinutes)} shift elapsed${
        breakStartsAt ? `, with a ${fmtHrs(activeBreakMins)} unpaid break from ${fmtTime(breakStartsAt)}` : ''
      }`
    : undefined;

  const byDay = useMemo(() => {
    const buckets: ScheduledShift[][] = Array.from({ length: 7 }, () => []);
    for (const s of shifts) {
      const idx = days.findIndex((d) => sameDay(d, new Date(s.startsAt)));
      if (idx >= 0) buckets[idx].push(s);
    }
    return buckets;
  }, [shifts, days]);

  const openWindowsByDay = useMemo(
    () =>
      days.map((date, i) => {
        const key = WEEKDAY_KEY[date.getDay()];
        const locIds = new Set<string>();
        if (locationId) locIds.add(locationId);
        for (const s of byDay[i]) locIds.add(s.locationId);
        const wins: { open: number; close: number }[] = [];
        for (const locId of locIds) {
          const win = hoursByLocation.get(locId)?.[key];
          if (win) wins.push({ open: toMin(win.open), close: toMin(win.close) });
        }
        return wins;
      }),
    [days, byDay, hoursByLocation, locationId],
  );

  const totalMins = useMemo(() => shifts.reduce((sum, s) => sum + durationMin(new Date(s.startsAt), new Date(s.endsAt)), 0), [shifts]);
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`;

  // ── Next shift ──────────────────────────────────────────────────────────────
  // Read across the coming five weeks, not the week on screen: on a Sunday the
  // week's last shift has passed, and "None this week" hid Monday's.
  const upcomingRange = useMemo(() => {
    const from = new Date(today);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: addDays(from, UPCOMING_DAYS).toISOString() };
  }, [today]);
  const upcoming = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-rota-upcoming', upcomingRange.from),
    queryFn: () => getMyScheduledShifts(upcomingRange),
  });
  const nextShift = useMemo(
    () =>
      [...(upcoming.data ?? [])]
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .find((shift) => new Date(shift.endsAt).getTime() > now) ?? null,
    [now, upcoming.data],
  );

  // ── Leave, drawn on the days it covers ──────────────────────────────────────
  // My HR's own key, so the two screens share one request.
  const leave = useQuery({ queryKey: moduleQueryKeys.people.key('leave-requests-me'), queryFn: getMyLeaveRequests });

  // ── Pay, for hourly staff only ──────────────────────────────────────────────
  // Paid time is the plan less the unpaid break — the API pays up to the
  // scheduled hours, so the estimate follows the rota, not the clock.
  const money = useWorkspaceMoney();
  const hourlyRate = employee?.payType === 'hourly' && employee.hourlyRate ? Number(employee.hourlyRate) || null : null;
  const paidWeekMins = useMemo(() => shifts.reduce((sum, shift) => sum + paidMinutes(shift, breakRuleOf(employee)), 0), [employee, shifts]);

  // ── New or changed since you last looked ────────────────────────────────────
  const changes = useRotaChanges(user?.id, localDateKey(weekStart), shifts, !isLoading && !rotaError);

  // ── The drawer, and the keyboard ────────────────────────────────────────────
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      // Never steal an arrow from a field, a slider (slide to clock in) or an open dialog.
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="dialog"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      setOffset((value) => value + (event.key === 'ArrowRight' ? 1 : -1));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const breakRule =
    employee?.unpaidBreakMins && employee.breakThresholdMins
      ? { value: `${fmtHrs(employee.unpaidBreakMins)} unpaid`, hint: `On shifts of ${fmtHrs(employee.breakThresholdMins)} or more` }
      : null;
  const nextLabel = nextShift && new Date(nextShift.startsAt).getTime() <= now ? 'On now' : 'Next shift';

  return (
    <EditorShell
      eyebrow="Scheduling"
      title="My rota"
      icon={<CalendarDays size={20} aria-hidden="true" />}
      // Which week you are looking at is the page's one control, so it rides in the bar.
      actions={
        <>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => setOffset((value) => value - 1)}
            aria-label="Previous week"
            title="Previous week (←)"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <Button variant="outline" className="h-9" onClick={() => setOffset(0)} disabled={offset === 0}>
            This week
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => setOffset((value) => value + 1)}
            aria-label="Next week"
            title="Next week (→)"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
          {/* The shared calendar: any day jumps to the week holding it, and the
              week on screen is washed so you can see where you are. */}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="size-9" aria-label="Go to a date" title="Go to a date">
                <CalendarDays size={16} aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto">
              <Calendar
                mode="single"
                defaultMonth={weekStart}
                startMonth={addDays(today, -366)}
                endMonth={addDays(today, 366)}
                onSelect={(date) => {
                  if (!date) return;
                  setOffset(weekOffsetFor(date, today));
                  setPickerOpen(false);
                }}
                modifiers={{ shownWeek: { from: weekStart, to: addDays(weekStart, 6) } }}
                modifiersClassNames={{ shownWeek: 'bg-primary/8 first:rounded-l-md last:rounded-r-md' }}
              />
            </PopoverContent>
          </Popover>
        </>
      }
    >
      <motion.div
        className="flex flex-col gap-5"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      >
        {/* ── Time clock: the one thing this page is opened for mid-shift ──────
            One panel whether or not you are on: the dial takes the tile's
            place while a scheduled shift runs, so progress is not a second card. */}
        <motion.section
          variants={SECTION_RISE}
          aria-label="Time clock"
          className={cn('overflow-hidden rounded-lg border bg-field', myActive ? 'border-momentum/35' : 'border-rule/60')}
        >
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {onShiftWithPlan ? (
              <ShiftDial elapsedMinutes={clockedMins} plannedMinutes={activePlannedMinutes} breakSpan={dialBreakSpan} label={dialLabel} />
            ) : (
              <span
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-lg',
                  myActive ? 'bg-momentum/10 text-momentum' : 'bg-primary/8 text-primary',
                )}
                aria-hidden="true"
              >
                <Timer size={22} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              {myActive ? (
                <>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="rounded-sm bg-momentum/10 px-1.5 py-0.5 text-micro font-semibold text-momentum">On shift</span>
                    <span className="text-sm text-muted-foreground">
                      since <span className="font-mono font-semibold tabular-nums text-foreground">{fmtClock(myActive.clockedIn)}</span>
                    </span>
                  </p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold tracking-headline tabular-nums text-foreground">
                    {fmtHrs(clockedMins)}
                    {onShiftWithPlan && (
                      <span className="ml-2 font-sans text-sm font-normal tracking-normal text-muted-foreground">
                        of {fmtHrs(activePlannedMinutes)} scheduled
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} aria-hidden="true" />
                      {activeScheduledShift?.location?.name ?? (onShiftWithPlan ? 'Location not listed' : 'No scheduled shift matched')}
                    </span>
                    {breakStartsAt && (
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-sm bg-stock" aria-hidden="true" />
                        {fmtHrs(activeBreakMins)} break from {fmtTime(breakStartsAt)}
                      </span>
                    )}
                    {overrunMins > 0 && <span className="font-semibold text-exception">{fmtHrs(overrunMins)} past your finish</span>}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-foreground">Not clocked in</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {!locationId
                      ? 'Choose a location in the header before clocking in.'
                      : upcomingToday
                        ? `Today’s shift starts at ${fmtTime(new Date(upcomingToday.startsAt))}${
                            // Null within the last rounding minute — better silent than "in 0m".
                            fmtUntil(upcomingToday.startsAt, now) ? ` · in ${fmtUntil(upcomingToday.startsAt, now)}` : ''
                          }`
                        : 'Clocking in starts your record for today.'}
                  </p>
                </>
              )}
            </div>

            <div className="sm:shrink-0">
              {myActive ? (
                <Button
                  size="touch"
                  className="w-full sm:w-auto sm:min-w-36"
                  onClick={() => setClockOutOpen(true)}
                  disabled={!clockLocationId}
                >
                  <LogOut size={17} aria-hidden="true" /> Clock out
                </Button>
              ) : (
                <SlideToClockIn
                  onClockIn={() => clockInM.mutateAsync()}
                  pending={clockInM.isPending}
                  disabled={!locationId || activeShiftError}
                  className="sm:w-64"
                />
              )}
            </div>
          </div>

          {/* Scheduled to be here and not on the clock — the one thing worth
              interrupting for. Failures sit against the control that caused them. */}
          {lateByMins > 0 && (
            <ClockNotice tone="warning" icon={AlertTriangle}>
              Your shift started {fmtHrs(lateByMins)} ago at {fmtTime(new Date(currentScheduledToday!.startsAt))} and you’re not clocked in.
            </ClockNotice>
          )}
          {activeShiftError && (
            <ClockNotice
              tone="exception"
              icon={AlertCircle}
              action={
                <Button variant="outline" size="xs" onClick={() => void refetchActiveShift()}>
                  Retry
                </Button>
              }
            >
              Clock status unavailable, so clocking in is held back.
            </ClockNotice>
          )}
          {clockError && (
            <ClockNotice tone="exception" icon={AlertCircle}>
              You weren’t clocked in. {clockError.message}
            </ClockNotice>
          )}
        </motion.section>

        {/* ── The week at a glance ──────────────────────────────────────────
            Four facts, said once: they replace the next-shift strip and the
            summary line the schedule used to carry in its header. */}
        <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact
            surface="page"
            icon={CalendarClock}
            label={nextLabel}
            value={
              upcoming.isPending
                ? '…'
                : upcoming.isError
                  ? '—'
                  : nextShift
                    ? relativeDay(new Date(nextShift.startsAt), today)
                    : `None in ${UPCOMING_DAYS / 7} weeks`
            }
            hint={
              upcoming.isError
                ? 'Couldn’t be loaded'
                : nextShift
                  ? `${fmtTime(new Date(nextShift.startsAt))}–${fmtTime(new Date(nextShift.endsAt))} · ${nextShift.location?.name ?? 'Location not listed'}`
                  : undefined
            }
            tone={upcoming.isError ? 'warning' : 'default'}
            // Takes you to its week — usually this one, sometimes the next.
            onSelect={nextShift ? () => setOffset(weekOffsetFor(new Date(nextShift.startsAt), today)) : undefined}
          />
          <Fact
            surface="page"
            icon={CalendarRange}
            label="Scheduled"
            value={isLoading ? '…' : fmtHrs(totalMins)}
            hint={`${shifts.length} ${shifts.length === 1 ? 'shift' : 'shifts'} · ${weekLabel}`}
          />
          <Fact
            surface="page"
            icon={Clock}
            label="Worked"
            value={fmtHrs(workedMins)}
            hint={
              workedThisWeek.length === 0 ? 'Nothing clocked this week' : totalMins > 0 ? `of ${fmtHrs(totalMins)} scheduled` : undefined
            }
          />
          {hourlyRate !== null ? (
            <Fact
              surface="page"
              icon={Banknote}
              label="Est. pay"
              value={isLoading ? '…' : money((paidWeekMins / 60) * hourlyRate)}
              hint={`${fmtHrs(paidWeekMins)} paid · before deductions`}
            />
          ) : (
            <Fact
              surface="page"
              icon={Coffee}
              label="Breaks"
              value={breakRule?.value ?? 'None set'}
              hint={breakRule?.hint ?? 'Your manager sets the break rule'}
            />
          )}
        </motion.dl>

        {/* ── Week schedule ─────────────────────────────────────────────────── */}
        <WeekSchedule
          title={`Week of ${weekLabel}`}
          days={days}
          today={today}
          now={now}
          byDay={byDay}
          workedByDay={workedByDay}
          openWindowsByDay={openWindowsByDay}
          breakRule={breakRuleOf(employee)}
          leave={leave.data ?? []}
          leaveError={leave.isError}
          changes={changes}
          onOpen={setDetail}
          loading={isLoading}
          error={rotaError ? (rotaErrorDetail ?? true) : null}
          onRetry={() => void refetchRota()}
        />

        {detail && (
          <ShiftDetailDrawer
            detail={detail}
            now={now}
            breakRule={breakRuleOf(employee)}
            change={detail.kind === 'shift' ? changes.get(detail.shift.id) : undefined}
            hourlyRate={hourlyRate}
            money={money}
            onClose={() => setDetail(null)}
          />
        )}

        {clockOutOpen && clockLocationId && (
          <ClockOutDialog
            locationId={clockLocationId}
            shiftId={myActive?.id}
            onClose={() => setClockOutOpen(false)}
            onClockedOut={invalidateClock}
          />
        )}
      </motion.div>
    </EditorShell>
  );
}

/** A line under the clock: lateness, or a failure — against the control it concerns. */
function ClockNotice({
  tone,
  icon: Icon,
  action,
  children,
}: {
  tone: 'warning' | 'exception';
  icon: IconComponent;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === 'exception' ? 'alert' : undefined}
      className={cn(
        'flex items-center gap-3 border-t px-5 py-3 text-sm',
        tone === 'warning' ? 'border-measured/30 bg-measured/6' : 'border-exception/30 bg-exception/5',
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          tone === 'warning' ? 'bg-measured/12 text-measured' : 'bg-exception/10 text-exception',
        )}
      >
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-foreground">{children}</span>
      {action}
    </div>
  );
}
