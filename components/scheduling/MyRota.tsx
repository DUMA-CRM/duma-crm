'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Timer,
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { ClockOutDialog } from '@/components/shifts/ClockOutDialog';
import { Button } from '@/components/ui/button';

import { useAuth } from '@/lib/hooks/useAuth';
import { type OpeningHours, type Weekday, getLocations } from '@/lib/modules/organization/client';
import { type HrEmployee, getMyEmployee } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type ScheduledShift, getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { type Shift, clockIn, getActiveShifts, getMyShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Date helpers ──────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const durationMin = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 60000);
const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtHrs = (mins: number) => {
  const rounded = Math.round(mins);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};
const fmtDay = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtLongDay = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
/** Countdown to a shift that has not started yet, or null once it has. */
const fmtUntil = (startsAt: string, now: number) => {
  const mins = Math.round((new Date(startsAt).getTime() - now) / 60000);
  return mins > 0 ? fmtHrs(mins) : null;
};
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
/** A worked shift as a minutes-of-day span. Still running ends at `now`; one crossing midnight is clipped to the day. */
const workedSpan = (shift: Shift, now: number) => {
  const start = new Date(shift.clockedIn);
  const endMs = shift.clockedOut ? new Date(shift.clockedOut).getTime() : now;
  const from = minutesOfDay(start);
  const to = Math.min(24 * 60, from + Math.max(0, (endMs - start.getTime()) / 60000));
  return { from, to };
};

/**
 * The unpaid break the contract places inside a shift, as minutes from the shift
 * start: `unpaidBreakMins` beginning once the shift reaches `breakThresholdMins`.
 * A shift shorter than the threshold carries no break. Nobody clocks a break in
 * or out — the rule is set per employee, so the window is known in advance.
 */
const breakWindow = (plannedMinutes: number, employee?: HrEmployee) => {
  const threshold = employee?.breakThresholdMins ?? 0;
  const unpaid = employee?.unpaidBreakMins ?? 0;
  if (!unpaid || !threshold || plannedMinutes < threshold) return null;
  const to = Math.min(plannedMinutes, threshold + unpaid);
  return to > threshold ? { from: threshold, to } : null;
};

/**
 * How far through a shift the clock is, 0–1, or null when it is not running now.
 * Finished and future shifts stay unfilled so a filled bar always means "in progress".
 */
const elapsedShareOf = (shift: ScheduledShift, now: number) => {
  const starts = new Date(shift.startsAt).getTime();
  const ends = new Date(shift.endsAt).getTime();
  if (now < starts || now >= ends || ends <= starts) return null;
  return Math.min(1, Math.max(0, (now - starts) / (ends - starts)));
};

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
  const activeBreak = breakWindow(activePlannedMinutes, employee);
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

  const [startHour, endHour] = useMemo(() => {
    let openMin = Infinity;
    let closeMax = -Infinity;
    for (const wins of openWindowsByDay)
      for (const w of wins) {
        openMin = Math.min(openMin, w.open);
        closeMax = Math.max(closeMax, w.close);
      }
    let lo = openMin <= closeMax ? openMin - 60 : 8 * 60;
    let hi = openMin <= closeMax ? closeMax + 60 : 18 * 60;
    for (const s of shifts) {
      const a = new Date(s.startsAt);
      const b = new Date(s.endsAt);
      lo = Math.min(lo, minutesOfDay(a));
      const end = minutesOfDay(b);
      hi = Math.max(hi, end <= minutesOfDay(a) ? 24 * 60 : end);
    }
    lo = Math.max(0, lo);
    hi = Math.min(24 * 60, hi);
    if (lo >= hi) return [8, 18];
    return [Math.floor(lo / 60), Math.ceil(hi / 60)];
  }, [shifts, openWindowsByDay]);

  const totalMinutes = (endHour - startHour) * 60;
  const pct = (min: number) => ((Math.min(Math.max(min, startHour * 60), endHour * 60) - startHour * 60) / totalMinutes) * 100;
  const hourTicks = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  // Gridlines stay hourly; labels thin out on a long day so they never collide.
  const labelStep = endHour - startHour > 14 ? 3 : endHour - startHour > 9 ? 2 : 1;

  // Current time, for the "now" indicator line spanning the timeline.
  const nowMin = useMemo(() => minutesOfDay(new Date(now)), [now]);
  const nowInRange = nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const todayInWeek = useMemo(() => days.some((d) => sameDay(d, today)), [days, today]);

  const totalMins = useMemo(() => shifts.reduce((sum, s) => sum + durationMin(new Date(s.startsAt), new Date(s.endsAt)), 0), [shifts]);
  const sortedShifts = useMemo(() => [...shifts].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [shifts]);
  const featuredShift = useMemo(() => {
    if (offset === 0) return sortedShifts.find((shift) => new Date(shift.endsAt).getTime() > now) ?? null;
    return sortedShifts[0] ?? null;
  }, [now, offset, sortedShifts]);
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`;

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
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <Button variant="outline" className="h-9" onClick={() => setOffset(0)} disabled={offset === 0}>
            This week
          </Button>
          <Button variant="outline" size="icon" className="size-9" onClick={() => setOffset((value) => value + 1)} aria-label="Next week">
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className={cn('grid items-start gap-4', onShiftWithPlan && 'xl:grid-cols-[minmax(0,1fr)_22rem]')}>
          {/* ── Time clock: the one thing this page is opened for mid-shift ──── */}
          <section className="overflow-hidden rounded-lg border border-rule/65 bg-card">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-4">
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-md',
                  myActive ? 'bg-momentum/6 text-momentum' : 'bg-band text-muted-foreground',
                )}
                aria-hidden="true"
              >
                <Timer size={21} />
              </span>

              <div className="min-w-0 flex-1">
                {myActive ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      Clocked in at <span className="font-mono tabular-nums">{fmtClock(myActive.clockedIn)}</span>
                      {/* Without a scheduled shift there is no progress card, so the running total lives here. */}
                      {!onShiftWithPlan && <span className="font-normal text-muted-foreground"> · {fmtHrs(clockedMins)} so far</span>}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activeScheduledShift?.location?.name ??
                        (onShiftWithPlan ? 'Location not listed' : 'No scheduled shift matched this clock-in.')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">Not clocked in</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {!locationId
                        ? 'Choose a location in the header before clocking in.'
                        : upcomingToday
                          ? `Today's shift starts at ${fmtTime(new Date(upcomingToday.startsAt))}${
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
                  <Button
                    size="touch"
                    className="w-full sm:w-auto sm:min-w-36"
                    onClick={() => clockInM.mutate()}
                    disabled={!locationId || clockInM.isPending || activeShiftError}
                  >
                    {clockInM.isPending ? (
                      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <LogIn size={17} aria-hidden="true" />
                    )}
                    {clockInM.isPending ? 'Clocking in…' : 'Clock in'}
                  </Button>
                )}
              </div>
            </div>

            {/* Scheduled to be here and not on the clock — the one thing worth
                interrupting for, so it sits above the shift detail. */}
            {lateByMins > 0 && (
              <div className="flex items-start gap-2 border-t border-measured/40 bg-measured/6 px-4 py-2.5 text-xs text-measured">
                <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  Your shift started {fmtHrs(lateByMins)} ago at {fmtTime(new Date(currentScheduledToday!.startsAt))} and you are not
                  clocked in.
                </span>
              </div>
            )}
            {/* Failures sit against the control that caused them, not adrift on the page. */}
            {activeShiftError && (
              <div
                role="alert"
                className="flex items-center gap-2 border-t border-exception/35 bg-exception/6 px-4 py-2.5 text-xs text-exception"
              >
                <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                <span className="flex-1">Clock status unavailable, so clocking in is held back.</span>
                <button
                  type="button"
                  onClick={() => void refetchActiveShift()}
                  className="shrink-0 font-semibold underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            )}
            {clockError && (
              <div
                role="alert"
                className="flex items-start gap-2 border-t border-exception/35 bg-exception/6 px-4 py-2.5 text-xs text-exception"
              >
                <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>You were not clocked in. {clockError.message}</span>
              </div>
            )}

            {!isLoading && featuredShift && (
              <div className="grid gap-2 border-t border-rule/45 bg-band/50 px-4 py-2.5 sm:grid-cols-[minmax(9rem,1fr)_auto_auto] sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CalendarClock size={16} className="shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-micro uppercase text-muted-foreground">
                      {offset === 0
                        ? new Date(featuredShift.startsAt).getTime() <= now
                          ? 'Current scheduled shift'
                          : 'Next shift'
                        : 'First shift this week'}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{fmtLongDay(new Date(featuredShift.startsAt))}</p>
                  </div>
                </div>
                <p className="flex items-center gap-2 font-mono text-sm font-semibold text-foreground tabular-nums">
                  <Clock size={15} className="text-muted-foreground" aria-hidden="true" />
                  {fmtTime(new Date(featuredShift.startsAt))}–{fmtTime(new Date(featuredShift.endsAt))}
                </p>
                <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <MapPin size={15} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{featuredShift.location?.name ?? 'Location not listed'}</span>
                  {featuredShift.role && <span className="shrink-0">· {featuredShift.role}</span>}
                </p>
              </div>
            )}
          </section>

          {/* ── Shift progress: only meaningful against a scheduled length ───── */}
          {onShiftWithPlan && (
            <section className="overflow-hidden rounded-lg border border-rule/65 bg-card">
              <div className="flex items-center gap-4 p-4">
                <ShiftDial elapsedMinutes={clockedMins} plannedMinutes={activePlannedMinutes} breakSpan={dialBreakSpan} label={dialLabel} />
                <div className="min-w-0">
                  <p className="font-mono text-lg font-semibold text-foreground tabular-nums">{fmtHrs(clockedMins)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">of {fmtHrs(activePlannedMinutes)} scheduled</p>
                  {breakStartsAt && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 rounded-sm bg-stock" aria-hidden="true" />
                      {fmtHrs(activeBreakMins)} break from {fmtTime(breakStartsAt)}
                    </p>
                  )}
                  {overrunMins > 0 && (
                    <p className="mt-2 text-xs font-semibold text-exception">{fmtHrs(overrunMins)} past your scheduled finish</p>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ── Week schedule ─────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-lg border border-rule/65 bg-card">
          <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 border-b border-rule/45 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarRange size={16} className="text-reference" aria-hidden="true" /> Week schedule
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums" aria-live="polite">
                {weekLabel} · {shifts.length} {shifts.length === 1 ? 'shift' : 'shifts'} · {fmtHrs(totalMins)} scheduled
                {workedThisWeek.length > 0 && ` · ${fmtHrs(workedMins)} worked`}
              </p>
            </div>
            <div className="hidden items-center gap-4 md:flex" aria-label="Schedule legend">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-sm border border-reference/40 bg-reference/6" aria-hidden="true" /> Opening hours
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-sm border border-primary/45 bg-card" aria-hidden="true" /> Your shift
              </span>
              {employee?.unpaidBreakMins ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-sm border border-stock/55 bg-stock/15" aria-hidden="true" /> Unpaid break
                </span>
              ) : null}
              {workedThisWeek.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-1 w-3 rounded-full bg-momentum" aria-hidden="true" /> Worked
                </span>
              )}
              {todayInWeek && nowInRange && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-3 w-px bg-foreground" aria-hidden="true" /> Now
                </span>
              )}
            </div>
          </header>

          {rotaError ? (
            <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
              <AlertCircle size={24} className="text-destructive" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-foreground">Your rota could not be loaded</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {rotaErrorDetail instanceof Error ? rotaErrorDetail.message : 'Check your connection and try again.'}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => void refetchRota()}>
                <RefreshCw size={15} aria-hidden="true" /> Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading your rota">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="flex items-stretch gap-4">
                  <div className="h-14 w-24 shrink-0 animate-pulse rounded-sm bg-band md:w-28" />
                  <div className="h-14 flex-1 animate-pulse rounded-md bg-band/60" />
                </div>
              ))}
            </div>
          ) : shifts.length === 0 ? (
            <div className="flex items-start gap-3 px-4 py-5">
              <CalendarClock size={19} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">No published shifts for {weekLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">Shifts appear here as soon as your manager publishes the rota.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Phone: a day list. Days without a shift collapse to one line so the
                  days that matter are not buried under five empty cards. */}
              <div className="divide-y divide-rule/45 md:hidden">
                {days.map((date, index) => {
                  const isToday = sameDay(date, today);
                  const dayShifts = byDay[index];
                  const dayMins = dayShifts.reduce((sum, shift) => sum + durationMin(new Date(shift.startsAt), new Date(shift.endsAt)), 0);

                  if (dayShifts.length === 0) {
                    return (
                      <div
                        key={date.toISOString()}
                        className={cn('flex items-center justify-between gap-3 px-4 py-2.5', isToday && 'bg-measured/6')}
                      >
                        <p className={cn('text-xs font-semibold', isToday ? 'text-primary' : 'text-muted-foreground')}>
                          {DAY_LABELS[index]} {fmtDay(date)}
                          {isToday && ' · Today'}
                        </p>
                        <span className="text-xs text-muted-foreground">No shift</span>
                      </div>
                    );
                  }

                  return (
                    <article key={date.toISOString()} className={cn('px-4 py-3.5', isToday && 'bg-measured/6')}>
                      <div className="mb-2.5 flex items-baseline justify-between gap-3">
                        <h3 className={cn('text-sm font-semibold', isToday ? 'text-primary' : 'text-foreground')}>
                          {DAY_LABELS[index]} {fmtDay(date)}
                          {isToday && <span className="ml-1.5 text-micro uppercase text-primary">Today</span>}
                        </h3>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">{fmtHrs(dayMins)}</span>
                      </div>
                      <div className="space-y-2">
                        {dayShifts.map((shift) => {
                          const elapsedShare = elapsedShareOf(shift, now);
                          return (
                            <div
                              key={shift.id}
                              className={cn(
                                'relative overflow-hidden rounded-sm border bg-card px-3 py-2.5 shadow-sm',
                                elapsedShare === null ? 'border-primary/40' : 'border-primary/70',
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <p className="shrink-0 font-mono text-sm font-semibold text-foreground tabular-nums">
                                  {fmtTime(new Date(shift.startsAt))}
                                  <span className="text-muted-foreground">–</span>
                                  {fmtTime(new Date(shift.endsAt))}
                                </p>
                                <div className="min-w-0 flex-1 text-right">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {shift.location?.name ?? 'Location not listed'}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {shift.role ?? 'Scheduled shift'} ·{' '}
                                    {fmtHrs(durationMin(new Date(shift.startsAt), new Date(shift.endsAt)))}
                                  </p>
                                </div>
                              </div>
                              {/* This row is not a time axis, so progress reads as a rule along
                                  its foot rather than a wash across it. */}
                              {elapsedShare !== null && (
                                <>
                                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-band" aria-hidden="true" />
                                  <div
                                    className="absolute bottom-0 left-0 h-0.5 bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                                    style={{ width: `${elapsedShare * 100}%` }}
                                    role="progressbar"
                                    aria-valuenow={Math.round(elapsedShare * 100)}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-label="Shift elapsed"
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop: rows are days, x is the clock. Only the grid scrolls — the
                  header and legend above it stay put. */}
              <div className="hidden overflow-x-auto md:block">
                <div className="min-w-190 p-4">
                  <div className="mb-1.5 flex items-end">
                    <div className="w-28 shrink-0" />
                    <div className="relative h-4 flex-1">
                      {hourTicks.map((hour, tickIndex) => {
                        if ((hour - startHour) % labelStep !== 0) return null;
                        const isFirst = tickIndex === 0;
                        const isLast = tickIndex === hourTicks.length - 1;
                        return (
                          <span
                            key={hour}
                            className={cn(
                              'absolute font-mono text-micro text-muted-foreground tabular-nums',
                              isFirst ? 'translate-x-0' : isLast ? '-translate-x-full' : '-translate-x-1/2',
                            )}
                            style={{ left: `${pct(hour * 60)}%` }}
                          >
                            {String(hour).padStart(2, '0')}:00
                          </span>
                        );
                      })}
                      {todayInWeek && nowInRange && (
                        // Sits on the card so it masks any hour label it lands on.
                        <span
                          className="absolute -translate-x-1/2 rounded-sm bg-card px-1 text-micro uppercase text-foreground"
                          style={{ left: `${pct(nowMin)}%` }}
                        >
                          Now
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative space-y-1.5">
                    {todayInWeek && nowInRange && (
                      <div className="pointer-events-none absolute inset-y-0 left-28 right-0">
                        <div
                          className="absolute inset-y-0 z-10 w-px -translate-x-1/2 bg-foreground/60"
                          style={{ left: `${pct(nowMin)}%` }}
                          title={`Now · ${fmtTime(new Date(now))}`}
                        >
                          <span className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-foreground" />
                        </div>
                      </div>
                    )}

                    {days.map((date, index) => {
                      const isToday = sameDay(date, today);
                      const dayMins = byDay[index].reduce(
                        (sum, shift) => sum + durationMin(new Date(shift.startsAt), new Date(shift.endsAt)),
                        0,
                      );
                      return (
                        <div key={date.toISOString()} className="flex min-h-14 items-stretch">
                          <div className="flex w-28 shrink-0 flex-col justify-center pr-4">
                            <p className={cn('text-xs font-semibold', isToday ? 'text-primary' : 'text-foreground')}>
                              {DAY_LABELS[index]}
                              {isToday && <span className="ml-1.5 text-micro uppercase">Today</span>}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                              {fmtDay(date)}
                              {dayMins > 0 && ` · ${fmtHrs(dayMins)}`}
                            </p>
                          </div>
                          <div
                            className={cn(
                              'relative min-h-14 flex-1 overflow-hidden rounded-md border border-rule/55 bg-band/45',
                              isToday && 'border-primary/40 bg-measured/6',
                            )}
                          >
                            {openWindowsByDay[index].map((window, windowIndex) => (
                              <div
                                key={windowIndex}
                                className="absolute inset-y-0 border-x border-reference/30 bg-reference/6"
                                style={{ left: `${pct(window.open)}%`, width: `${Math.max(0, pct(window.close) - pct(window.open))}%` }}
                                title="Location opening hours"
                              />
                            ))}
                            {hourTicks.map((hour) => (
                              <div
                                key={hour}
                                className={cn(
                                  'absolute inset-y-0 border-l',
                                  (hour - startHour) % labelStep === 0 ? 'border-grid-major' : 'border-grid-minor',
                                )}
                                style={{ left: `${pct(hour * 60)}%` }}
                              />
                            ))}
                            {byDay[index].map((shift) => {
                              const starts = new Date(shift.startsAt);
                              const ends = new Date(shift.endsAt);
                              const startMinutes = minutesOfDay(starts);
                              const endMinutes = minutesOfDay(ends) <= startMinutes ? endHour * 60 : minutesOfDay(ends);
                              const left = pct(startMinutes);
                              const width = Math.max(4, pct(endMinutes) - left);
                              // A short shift has no room for two lines of detail; the
                              // tooltip keeps the full truth either way.
                              const narrow = width < 13;
                              // A shift running right now fills to the current time, so
                              // "how far through am I" is readable from the bar itself.
                              const elapsedShare = elapsedShareOf(shift, now);
                              // The contract break, placed inside the bar at the time it falls.
                              const blockMins = endMinutes - startMinutes;
                              const gap = blockMins > 0 && !narrow ? breakWindow(blockMins, employee) : null;
                              return (
                                <div
                                  key={shift.id}
                                  className={cn(
                                    'absolute inset-y-1 flex flex-col justify-center overflow-hidden rounded-sm border bg-card px-2 shadow-sm',
                                    elapsedShare === null ? 'border-primary/45' : 'border-primary/70',
                                  )}
                                  style={{ left: `${left}%`, width: `${width}%` }}
                                  title={`${fmtTime(starts)}–${fmtTime(ends)} · ${shift.location?.name ?? 'Location not listed'}${
                                    shift.role ? ` · ${shift.role}` : ''
                                  }${elapsedShare === null ? '' : ` · ${Math.round(elapsedShare * 100)}% elapsed`}`}
                                >
                                  {elapsedShare !== null && (
                                    <div
                                      className="absolute inset-y-0 left-0 border-r border-primary bg-measured/12 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                                      style={{ width: `${elapsedShare * 100}%` }}
                                      aria-hidden="true"
                                    />
                                  )}
                                  {gap && (
                                    <div
                                      className="absolute inset-y-0 border-x border-stock/55 bg-stock/15"
                                      style={{
                                        left: `${(gap.from / blockMins) * 100}%`,
                                        width: `${((gap.to - gap.from) / blockMins) * 100}%`,
                                      }}
                                      title={`${fmtHrs(gap.to - gap.from)} unpaid break`}
                                      aria-hidden="true"
                                    />
                                  )}
                                  {/* Positioned so the fill behind it never paints over the label. */}
                                  <div className="relative min-w-0">
                                    <p className="truncate font-mono text-xs font-semibold text-foreground tabular-nums">
                                      {narrow ? fmtTime(starts) : `${fmtTime(starts)}–${fmtTime(ends)}`}
                                    </p>
                                    {!narrow && (
                                      <p className="truncate text-micro text-muted-foreground">
                                        {shift.location?.name ?? 'Location not listed'}
                                        {shift.role ? ` · ${shift.role}` : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* What was actually worked, on its own rail under the plan. */}
                            {workedByDay[index].map((worked) => {
                              const span = workedSpan(worked, now);
                              const from = pct(span.from);
                              const to = pct(span.to);
                              return (
                                <div
                                  key={worked.id}
                                  className="absolute bottom-0.5 h-1 rounded-full bg-momentum"
                                  style={{ left: `${from}%`, width: `${Math.max(0.6, to - from)}%` }}
                                  title={`Worked ${fmtTime(new Date(worked.clockedIn))}–${
                                    worked.clockedOut ? fmtTime(new Date(worked.clockedOut)) : 'now'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {clockOutOpen && clockLocationId && (
          <ClockOutDialog
            locationId={clockLocationId}
            shiftId={myActive?.id}
            onClose={() => setClockOutOpen(false)}
            onClockedOut={invalidateClock}
          />
        )}
      </div>
    </EditorShell>
  );
}
