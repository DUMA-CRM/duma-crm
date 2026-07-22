'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ClockOutDialog } from '@/components/shifts/ClockOutDialog';

import { type ScheduledShift, getMyScheduledShifts } from '@/lib/api/scheduling.service';
import { clockIn, getActiveShifts } from '@/lib/api/shifts.service';
import { type OpeningHours, type Weekday, getLocations } from '@/lib/api/workspace.service';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
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
const fmtHrs = (mins: number) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`;
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

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

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['my-rota', weekStart.toISOString()],
    queryFn: () => getMyScheduledShifts({ from: weekStart.toISOString(), to: weekEndExclusive.toISOString() }),
  });

  const { data: locations = [] } = useQuery({ queryKey: ['locations-all'], queryFn: getLocations });
  const hoursByLocation = useMemo(() => {
    const m = new Map<string, OpeningHours | null | undefined>();
    for (const l of locations) m.set(l.id, l.openingHours);
    return m;
  }, [locations]);

  // ── Time clock ──────────────────────────────────────────────────────────────
  const { data: active = [] } = useQuery({ queryKey: ['shifts-active'], queryFn: getActiveShifts });
  const myActive = user ? active.find((s) => s.userId === user.id) : undefined;
  const invalidateClock = () => {
    qc.invalidateQueries({ queryKey: ['shifts-active'] });
    qc.invalidateQueries({ queryKey: ['shifts'] });
  };
  const clockInM = useMutation({ mutationFn: () => clockIn({ locationId: locationId! }), onSuccess: invalidateClock });
  // Order completion already consumed recipe inventory; clock-out only ends the shift.
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const clockError = clockInM.error as Error | undefined;
  const clockedMins = myActive ? Math.max(0, Math.floor((now - new Date(myActive.clockedIn).getTime()) / 60000)) : 0;

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

  // Current time, for the "now" indicator line spanning the timeline.
  const nowMin = useMemo(() => minutesOfDay(new Date(now)), [now]);
  const nowInRange = nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const todayInWeek = useMemo(() => days.some((d) => sameDay(d, today)), [days, today]);

  const totalMins = useMemo(() => shifts.reduce((sum, s) => sum + durationMin(new Date(s.startsAt), new Date(s.endsAt)), 0), [shifts]);
  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const navBtn =
    'h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface-offset transition-colors';

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar: week nav + time clock */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setOffset((o) => o - 1)} className={navBtn} aria-label="Previous week">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setOffset(0)}
              className="h-9 px-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-surface-offset transition-colors"
            >
              Today
            </button>
            <button onClick={() => setOffset((o) => o + 1)} className={navBtn} aria-label="Next week">
              <ChevronRight size={16} />
            </button>
          </div>
          <p className="text-sm font-semibold text-foreground tabular-nums">{weekLabel}</p>
          <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2.5 py-1">
            {shifts.length} {shifts.length === 1 ? 'shift' : 'shifts'} · {fmtHrs(totalMins)}
          </span>
        </div>

        {/* Time clock */}
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {!locationId
              ? 'Select a location to clock in'
              : myActive
                ? `Clocked in ${fmtClock(myActive.clockedIn)} · ${fmtHrs(clockedMins)}`
                : 'Not clocked in'}
          </p>
          {myActive ? (
            <button
              onClick={() => setClockOutOpen(true)}
              disabled={!locationId}
              className="h-9 px-3 border border-border rounded-lg flex items-center gap-1.5 text-sm font-semibold text-foreground hover:bg-surface-offset transition-colors disabled:opacity-50"
            >
              <LogOut size={15} /> Clock out
            </button>
          ) : (
            <button
              onClick={() => clockInM.mutate()}
              disabled={!locationId || clockInM.isPending}
              className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <LogIn size={15} /> {clockInM.isPending ? 'Clocking in…' : 'Clock in'}
            </button>
          )}
        </div>
      </div>

      {clockError && <p className="text-xs text-destructive shrink-0 -mt-2">{clockError.message}</p>}

      {/* Timeline */}
      <div className="min-h-0 overflow-auto bg-card border border-border rounded-2xl p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="min-w-[640px]">
            {/* Hour ruler */}
            <div className="flex items-end mb-1">
              <div className="w-24 shrink-0" />
              <div className="relative flex-1 h-5">
                {hourTicks.map((h) => (
                  <span
                    key={h}
                    className="absolute -translate-x-1/2 text-[10px] font-medium text-muted-foreground tabular-nums"
                    style={{ left: `${pct(h * 60)}%` }}
                  >
                    {String(h).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>

            {/* Day lanes */}
            <div className="relative flex flex-col gap-1.5">
              {/* Now indicator — spans every lane */}
              {todayInWeek && nowInRange && (
                <div className="pointer-events-none absolute inset-y-0 left-24 right-0">
                  <div
                    className="absolute top-0 bottom-0 z-10 w-0.5 -translate-x-1/2 bg-destructive shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
                    style={{ left: `${pct(nowMin)}%` }}
                    title={`Now · ${fmtTime(new Date(now))}`}
                  >
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-destructive ring-2 ring-white" />
                  </div>
                </div>
              )}
              {days.map((date, i) => {
                const isToday = sameDay(date, today);
                const dayShifts = byDay[i];
                const openWins = openWindowsByDay[i];
                return (
                  <div key={i} className="flex items-stretch">
                    <div className={cn('w-24 shrink-0 flex flex-col justify-center pr-3', isToday && 'text-primary')}>
                      <p
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-widest',
                          isToday ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {DAY_LABELS[i]}
                      </p>
                      <p className={cn('text-sm font-semibold tabular-nums', isToday ? 'text-primary' : 'text-foreground')}>
                        {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'relative flex-1 h-14 rounded-lg border border-border overflow-hidden bg-muted/60',
                        isToday && 'ring-1 ring-inset ring-primary/40',
                      )}
                    >
                      {openWins.map((w, wi) => (
                        <div
                          key={wi}
                          className="absolute inset-y-0 bg-success/20 border-x-2 border-success/50"
                          style={{ left: `${pct(w.open)}%`, width: `${Math.max(0, pct(w.close) - pct(w.open))}%` }}
                          title="Working hours"
                        />
                      ))}
                      {hourTicks.map((h) => (
                        <div key={h} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: `${pct(h * 60)}%` }} />
                      ))}
                      {dayShifts.map((s) => {
                        const a = new Date(s.startsAt);
                        const b = new Date(s.endsAt);
                        const startMin = minutesOfDay(a);
                        const endMin = minutesOfDay(b) <= startMin ? endHour * 60 : minutesOfDay(b);
                        const left = pct(startMin);
                        const width = Math.max(3, pct(endMin) - left);
                        return (
                          <div
                            key={s.id}
                            className="absolute top-0 bottom-0 bg-primary px-1.5 py-1 overflow-hidden"
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${fmtTime(a)}–${fmtTime(b)} · ${s.location?.name ?? ''}${s.role ? ` · ${s.role}` : ''}`}
                          >
                            <p className="text-[11px] font-semibold text-white tabular-nums leading-tight truncate">
                              {fmtTime(a)}–{fmtTime(b)}
                            </p>
                            <p className="text-[10px] text-white/80 truncate leading-tight">
                              {s.location?.name}
                              {s.role ? ` · ${s.role}` : ''}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pl-24">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-success/20 border border-success/50" /> Working hours
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-muted/60 border border-border" /> Closed / outside hours
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-primary" /> Shift
              </span>
            </div>

            {shifts.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <CalendarClock size={26} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">No shifts scheduled</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Published shifts for this week will appear on the timeline.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {clockOutOpen && locationId && (
        <ClockOutDialog
          locationId={locationId}
          shiftId={myActive?.id}
          onClose={() => setClockOutOpen(false)}
          onClockedOut={invalidateClock}
        />
      )}
    </div>
  );
}
