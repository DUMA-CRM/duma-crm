'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Clock, LogIn, LogOut, MapPin, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Toast, type ToastMessage } from '@/components/shared/Toast';

import { createScheduledShift, getMyScheduledShifts } from '@/lib/api/scheduling.service';
import { clockIn, clockOut, getMyShifts } from '@/lib/api/shifts.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const two = (n: number) => String(n).padStart(2, '0');
const fmtClock = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDayDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDur = (mins: number) => `${Math.floor(mins / 60)}h ${two(Math.round(mins % 60))}m`;

// Minutes between two "HH:MM" strings on the same day (0 if invalid / not positive).
function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return eh * 60 + em - (sh * 60 + sm);
}

function greeting(h: number) {
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const inp =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

// ── Component ───────────────────────────────────────────────────────────────────

export function MyDashboard() {
  const user = useAuthStore((s) => s.user);
  const { locationId } = useWorkspaceStore();
  const qc = useQueryClient();

  // Start unmounted so the first client render matches the server (no live time yet),
  // then tick every second once mounted — avoids a hydration mismatch on the clock.
  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], message: string) => setToasts((p) => [...p, { id: Date.now(), type, message }]);
  const dismissToast = (id: number) => setToasts((p) => p.filter((t) => t.id !== id));

  // My shifts → the active one (not clocked out).
  const { data: myShifts = [] } = useQuery({ queryKey: ['shifts-my'], queryFn: getMyShifts });
  const active = myShifts.find((s) => !s.clockedOut);

  // This week's published rota.
  const week = useMemo(() => startOfWeek(), []);
  const { data: rota = [] } = useQuery({
    queryKey: ['my-rota-dash', week.toISOString()],
    queryFn: () => {
      const end = new Date(week);
      end.setDate(end.getDate() + 7);
      return getMyScheduledShifts({ from: week.toISOString(), to: end.toISOString() });
    },
  });
  const upcoming = [...rota].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const invalidateShifts = () => qc.invalidateQueries({ queryKey: ['shifts-my'] });
  const clockInM = useMutation({
    mutationFn: () => clockIn({ locationId: locationId! }),
    onSuccess: invalidateShifts,
    onError: (e) => addToast('error', (e as Error).message || 'Could not clock in.'),
  });
  const clockOutM = useMutation({
    mutationFn: () => clockOut({ locationId: locationId! }),
    onSuccess: invalidateShifts,
    onError: (e) => addToast('error', (e as Error).message || 'Could not clock out.'),
  });
  const busy = clockInM.isPending || clockOutM.isPending;

  return (
    <>
      <div className="space-y-6">
        {/* Greeting + live clock */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">My day</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
              {greeting(now.getHours())}
              {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <p className="text-4xl font-bold tabular-nums text-foreground tracking-tight">{mounted ? fmtClock(now) : ' '}</p>
        </div>

        {/* Clock in / out card */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
              >
                <Clock size={22} />
              </div>
              <div className="min-w-0">
                {active ? (
                  <>
                    <p className="text-sm font-semibold text-success">On shift</p>
                    <p className="text-sm text-muted-foreground">
                      Clocked in at {fmtTime(active.clockedIn)} ·{' '}
                      {fmtDur(Math.max(0, (now.getTime() - new Date(active.clockedIn).getTime()) / 60000))} elapsed
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">Not clocked in</p>
                    <p className="text-sm text-muted-foreground">
                      {locationId ? 'Tap clock in to start your shift.' : 'Select your location in the header to clock in.'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {active ? (
              <button
                onClick={() => clockOutM.mutate()}
                disabled={busy}
                className="h-14 px-5 md:px-8 rounded-2xl bg-destructive hover:bg-destructive/90 active:translate-y-px text-white text-base font-bold flex items-center gap-2.5 transition-colors disabled:opacity-60"
              >
                <LogOut size={20} />
                {clockOutM.isPending ? 'Clocking out…' : 'Clock Out'}
              </button>
            ) : (
              <button
                onClick={() => clockInM.mutate()}
                disabled={busy || !locationId}
                className="h-14 px-5 md:px-8 rounded-2xl bg-primary hover:bg-primary-hover active:translate-y-px text-white text-base font-bold flex items-center gap-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn size={20} />
                {clockInM.isPending ? 'Clocking in…' : 'Clock In'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* My rota this week */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <CalendarClock size={15} className="text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">My rota this week</p>
              </div>
              <Link href="/scheduling" className="text-xs text-primary hover:underline">
                Full rota
              </Link>
            </div>
            <div className="px-5 py-2 flex-1">
              {upcoming.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No shifts this week" description="Published shifts will appear here." />
              ) : (
                upcoming.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{fmtDayDate(s.startsAt)}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin size={11} /> {s.location?.name ?? '—'}
                        {s.role ? ` · ${s.role}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                      {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Suggest a shift */}
          <SuggestShiftCard locationId={locationId} onDone={(msg) => addToast('success', msg)} onError={(msg) => addToast('error', msg)} />
        </div>
      </div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

// ── Suggest-a-shift form ─────────────────────────────────────────────────────

function SuggestShiftCard({
  locationId,
  onDone,
  onError,
}: {
  locationId: string | null;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [notes, setNotes] = useState('');

  const durationMins = minutesBetween(start, end);

  const { mutate, isPending, reset } = useMutation({
    mutationFn: () =>
      createScheduledShift({
        locationId: locationId!,
        startsAt: new Date(`${date}T${start}`).toISOString(),
        endsAt: new Date(`${date}T${end}`).toISOString(),
        ...(notes ? { notes } : {}),
      }),
    onSuccess: () => {
      onDone('Shift suggestion sent — a manager will review it.');
      setDate('');
      setNotes('');
      reset();
    },
    onError: (e) => onError((e as Error).message || 'Could not send suggestion.'),
  });

  const valid = !!(locationId && date && start && end && durationMins > 0);

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Send size={15} className="text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Suggest a shift</p>
        </div>
        {durationMins > 0 && (
          <span className="text-[11px] font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1 tabular-nums">
            {fmtDur(durationMins)}
          </span>
        )}
      </div>
      <form
        className="px-5 py-4 space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) mutate();
        }}
      >
        <p className="text-xs text-muted-foreground">Propose when you can work. Your manager reviews and approves it onto the rota.</p>
        <div>
          <label className={lbl}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>From</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required className={inp} />
          </div>
          <div>
            <label className={lbl}>To</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required className={inp} />
          </div>
        </div>
        {end && start && durationMins <= 0 && <p className="text-xs text-destructive">End time must be after the start time.</p>}
        <div>
          <label className={lbl}>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the manager should know" className={inp} />
        </div>
        {!locationId && <p className="text-xs text-muted-foreground">Select your location in the header first.</p>}
        <button
          type="submit"
          disabled={!valid || isPending}
          className="w-full h-10 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={15} />
          {isPending ? 'Sending…' : 'Send suggestion'}
        </button>
      </form>
    </section>
  );
}
