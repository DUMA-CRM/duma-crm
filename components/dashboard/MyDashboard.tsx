'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { ArrowUpRight, CalendarClock, ChevronDown, Clock, LogOut, Send } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListRow } from '@/components/shared/ListRow';
import { StatusDot } from '@/components/shared/StatusDot';
import { Toast, type ToastMessage } from '@/components/shared/Toast';
import { Tooltip } from '@/components/shared/Tooltip';
import { TONE_TINT } from '@/components/shared/tone';
import { ClockOutDialog } from '@/components/shifts/ClockOutDialog';
import { SlideToClockIn } from '@/components/shifts/SlideToClockIn';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { createScheduledShift, getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { clockIn, getMyShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { relativeTime } from '@/lib/utils/relative-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const two = (n: number) => String(n).padStart(2, '0');
const fmtClock = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDayDate = (iso: string) => `${new Date(iso).toLocaleDateString('en-GB', { weekday: 'short' })} ${formatDate(iso)}`;
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
  'w-full h-9 bg-control border border-input rounded-sm px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

/** Weekday over day number — the rota row's leading tile. */
function DateTile({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className={cn('flex size-9 shrink-0 flex-col items-center justify-center rounded-md leading-none', TONE_TINT.primary)}>
      {/* The tile is the row's only date, so screen readers get it in full. */}
      <span className="sr-only">{d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <span className="text-[10px] font-semibold uppercase" aria-hidden="true">
        {d.toLocaleDateString('en-GB', { weekday: 'short' })}
      </span>
      <span className="mt-0.5 text-sm font-semibold tabular-nums" aria-hidden="true">
        {d.getDate()}
      </span>
    </span>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────

export function MyDashboard({ toolbar, supplemental }: { toolbar?: ReactNode; supplemental?: ReactNode } = {}) {
  const user = useAuthStore((s) => s.user);
  const { locationId } = useWorkspaceStore();
  const qc = useQueryClient();

  // Keep the live clock client-only so the first render matches the server.
  const [now, setNow] = useState(() => new Date());
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], message: string) => setToasts((p) => [...p, { id: Date.now(), type, message }]);
  const dismissToast = (id: number) => setToasts((p) => p.filter((t) => t.id !== id));

  // My shifts → the active one (not clocked out).
  const { data: myShifts = [] } = useQuery({ queryKey: moduleQueryKeys.workforce.key('shifts-my'), queryFn: getMyShifts });
  const active = myShifts.find((s) => !s.clockedOut);

  // This week's published rota.
  const week = useMemo(() => startOfWeek(), []);
  const { data: rota = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-rota-dash', week.toISOString()),
    queryFn: () => {
      const end = new Date(week);
      end.setDate(end.getDate() + 7);
      return getMyScheduledShifts({ from: week.toISOString(), to: end.toISOString() });
    },
  });
  const upcoming = [...rota]
    .filter((shift) => new Date(shift.endsAt).getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  // A location on every row only says something when the rows disagree.
  const showRotaLocation = new Set(upcoming.map((shift) => shift.location?.name ?? '')).size > 1;

  const invalidateShifts = () => qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-my') });
  const clockInM = useMutation({
    mutationFn: () => clockIn({ locationId: locationId! }),
    onSuccess: invalidateShifts,
    onError: (e) => addToast('error', (e as Error).message || 'You weren’t clocked in. Check the location and try again.'),
  });
  // Order completion already consumed recipe inventory; clock-out only ends the shift.
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const busy = clockInM.isPending;

  return (
    <>
      <div className="space-y-5 pb-8">
        {toolbar}
        {/* Greeting + live clock */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">My workday</p>
            </div>
            <h1 className="text-2xl font-semibold tracking-headline text-foreground md:text-metric">
              {greeting(now.getHours())}
              {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {now.toLocaleDateString('en-GB', { weekday: 'long' })}, {formatDate(now)}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-sm border border-rule bg-card px-4 py-2.5 shadow-sm">
            <Clock size={15} className="text-muted-foreground" aria-hidden="true" />
            <p className="text-xl font-bold tabular-nums tracking-figure text-foreground">{mounted ? fmtClock(now) : ' '}</p>
          </div>
        </div>

        {/* Clock in / out card */}
        <div className="relative overflow-hidden rounded-sm border border-rule bg-card p-5 shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_5%,transparent),0_10px_32px_color-mix(in_oklab,var(--foreground)_3%,transparent)] md:p-6">
          <div className="pointer-events-none absolute -right-12 -top-20 size-56 rounded-full bg-primary/8 blur-3xl" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex min-w-0 items-center gap-4">
              <div
                className={`flex size-12 shrink-0 items-center justify-center rounded-sm ${active ? 'bg-success/6 text-success' : 'bg-muted text-muted-foreground'}`}
              >
                <Clock size={21} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                {active ? (
                  <>
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <StatusDot tone="success" pulse label="On shift" />
                      Clocked in at {fmtTime(active.clockedIn)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fmtDur(Math.max(0, (now.getTime() - new Date(active.clockedIn).getTime()) / 60000))} elapsed
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">Ready to start your shift?</p>
                    <p className="text-sm text-muted-foreground">
                      {locationId ? 'Slide to clock in and start your shift.' : 'Use the location picker before you clock in.'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {active ? (
              <button
                onClick={() => setClockOutOpen(true)}
                disabled={busy}
                className="relative flex h-11 items-center gap-2 rounded-sm bg-destructive px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-destructive/90 active:translate-y-px disabled:opacity-60"
              >
                <LogOut size={20} />
                Clock Out
              </button>
            ) : (
              <SlideToClockIn
                onClockIn={() => clockInM.mutateAsync()}
                pending={clockInM.isPending}
                disabled={!locationId}
                className="relative w-full sm:w-64"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* My rota this week */}
          <section className="flex flex-col overflow-hidden rounded-sm border border-rule bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-rule px-5 py-2.5">
              <div className="flex items-center gap-2">
                <CalendarClock size={15} className="text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">My rota this week</p>
              </div>
              <Tooltip label="Full rota" side="top">
                <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
                  <Link href="/scheduling" aria-label="Open the full rota">
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </Button>
              </Tooltip>
            </div>
            {upcoming.length === 0 ? (
              <div className="flex-1 px-5 py-2">
                <EmptyState
                  icon={CalendarClock}
                  title="No shifts this week"
                  description="Your shifts appear here once the rota is published."
                  compact
                />
              </div>
            ) : (
              <ul className="flex-1">
                {upcoming.map((s) => {
                  const started = new Date(s.startsAt).getTime() <= now.getTime();
                  const meta = [showRotaLocation ? (s.location?.name ?? '—') : null, s.role].filter(Boolean).join(' · ');
                  return (
                    <ListRow
                      key={s.id}
                      leading={<DateTile iso={s.startsAt} />}
                      title={
                        <span className="tabular-nums">
                          {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}
                        </span>
                      }
                      meta={meta || undefined}
                      trailing={
                        mounted &&
                        (started ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-momentum">
                            <StatusDot tone="success" pulse label="Happening now" />
                            Now
                          </span>
                        ) : (
                          <time
                            dateTime={s.startsAt}
                            title={fmtDayDate(s.startsAt)}
                            className="rounded-sm bg-band px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-muted-foreground"
                          >
                            {relativeTime(s.startsAt, now.getTime())}
                          </time>
                        ))
                      }
                    />
                  );
                })}
              </ul>
            )}
          </section>

          {/* Suggest a shift */}
          <SuggestShiftCard locationId={locationId} onDone={(msg) => addToast('success', msg)} onError={(msg) => addToast('error', msg)} />
        </div>
        {supplemental}
      </div>
      {clockOutOpen && locationId && (
        <ClockOutDialog
          locationId={locationId}
          shiftId={active?.id}
          onClose={() => setClockOutOpen(false)}
          onClockedOut={invalidateShifts}
        />
      )}
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

  const [sent, flashSent] = useDoneBeat(1800);
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
      flashSent();
      setDate('');
      setNotes('');
      reset();
    },
    onError: (e) => onError((e as Error).message || 'Your suggestion wasn’t sent. Try again.'),
  });

  const valid = !!(locationId && date && start && end && durationMins > 0);

  return (
    <details className="group flex flex-col overflow-hidden rounded-sm border border-rule bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-sm bg-muted text-muted-foreground">
            <Send size={15} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Suggest a shift</p>
            <p className="text-xs text-muted-foreground">Propose availability for manager review.</p>
          </div>
        </div>
        <ChevronDown size={16} className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <form
        className="border-t border-rule px-5 py-4 space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) mutate();
        }}
      >
        {durationMins > 0 && <p className="text-xs font-semibold text-primary">Proposed shift: {fmtDur(durationMins)}</p>}
        <DatePicker label="Date" value={date} onValueChange={setDate} required />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>From</label>
            <TimePicker value={start} onValueChange={setStart} required aria-label="From" />
          </div>
          <div>
            <label className={lbl}>To</label>
            <TimePicker value={end} onValueChange={setEnd} required aria-label="To" />
          </div>
        </div>
        {end && start && durationMins <= 0 && <p className="text-xs text-destructive">End time must be after the start time.</p>}
        <div>
          <label className={lbl}>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the manager should know" className={inp} />
        </div>
        {!locationId && <p className="text-xs text-muted-foreground">Select your location before sending a suggestion.</p>}
        <ActionButton
          type="submit"
          disabled={!valid}
          pending={isPending}
          pendingLabel="Sending…"
          done={sent}
          doneLabel="Suggestion sent"
          icon={<Send size={15} aria-hidden="true" />}
          className="h-10 w-full rounded-sm"
        >
          Send suggestion
        </ActionButton>
      </form>
    </details>
  );
}
