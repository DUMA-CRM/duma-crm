'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { ArrowUpRight, CalendarClock, ChevronDown, Clock, LogOut, Send } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { StatusDot } from '@/components/shared/StatusDot';
import { TONE_TINT } from '@/components/shared/tone';
import { ClockOutDialog } from '@/components/shifts/ClockOutDialog';
import { SlideToClockIn } from '@/components/shifts/SlideToClockIn';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FieldLabel } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { createScheduledShift, getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { clockIn, getMyShifts } from '@/lib/modules/workforce/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { relativeTime } from '@/lib/utils/relative-time';
import { formatInstant, workspaceDateKey, zonedParts, zonedToInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const two = (n: number) => String(n).padStart(2, '0');
const fmtClock = (d: Date) => {
  const parts = zonedParts(d);
  return `${parts.time}:${two(parts.second)}`;
};
const fmtTime = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });
const fmtDayDate = (iso: string) => `${formatInstant(iso, { weekday: 'short' })} ${formatDate(iso)}`;
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

/** Monday 00:00 at the business, this week. */
function startOfWeek(): Date {
  const today = zonedParts();
  const monday = new Date(Date.UTC(today.year, today.month - 1, today.day - ((today.weekday + 6) % 7))).toISOString().slice(0, 10);
  return zonedToInstant(monday, '00:00') ?? new Date();
}

const inp =
  'w-full h-9 bg-control border border-input rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

/** Weekday over day number — the rota row's leading tile. */
function DateTile({ iso }: { iso: string }) {
  return (
    <span className={cn('flex size-9 shrink-0 flex-col items-center justify-center rounded-md leading-none', TONE_TINT.primary)}>
      {/* The tile is the row's only date, so screen readers get it in full. */}
      <span className="sr-only">{formatInstant(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <span className="text-[10px] font-semibold uppercase" aria-hidden="true">
        {formatInstant(iso, { weekday: 'short' })}
      </span>
      <span className="mt-0.5 text-sm font-semibold tabular-nums" aria-hidden="true">
        {zonedParts(iso).day}
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
    onError: (e) => toast('error', (e as Error).message || 'You weren’t clocked in. Check the location and try again.'),
  });
  // Order completion already consumed recipe inventory; clock-out only ends the shift.
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const busy = clockInM.isPending;

  return (
    <>
      <div className="flex flex-col gap-5 pb-8">
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
            <h1 className="text-2xl font-semibold tracking-headline text-heading md:text-metric">
              {greeting(zonedParts(now).hour)}
              {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {formatInstant(now, { weekday: 'long' })}, {formatDate(workspaceDateKey(now))}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-sm">
            <Clock size={15} className="text-muted-foreground" aria-hidden="true" />
            <p className="text-xl font-bold tabular-nums tracking-figure text-foreground">{mounted ? fmtClock(now) : ' '}</p>
          </div>
        </div>

        {/* Clock in / out card */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={`flex size-12 shrink-0 items-center justify-center rounded-md ${active ? 'bg-success/10 text-success' : 'bg-band text-muted-foreground'}`}
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
              <Button variant="destructive" size="touch" onClick={() => setClockOutOpen(true)} disabled={busy}>
                <LogOut aria-hidden="true" />
                Clock out
              </Button>
            ) : (
              <SlideToClockIn
                onClockIn={() => clockInM.mutateAsync()}
                pending={clockInM.isPending}
                disabled={!locationId}
                className="w-full sm:w-64"
              />
            )}
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          {/* My rota this week */}
          <RecordGroup
            id="my-day-rota"
            title="My rota this week"
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/scheduling" aria-label="Open the full rota">
                  Rota
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            }
          >
            {upcoming.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-5 py-2 shadow-sm">
                <EmptyState
                  icon={CalendarClock}
                  title="No shifts this week"
                  description="Your shifts appear here once the rota is published."
                  compact
                />
              </div>
            ) : (
              <ListRowGroup>
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
              </ListRowGroup>
            )}
          </RecordGroup>

          {/* Suggest a shift */}
          <SuggestShiftCard locationId={locationId} onDone={(msg) => toast('success', msg)} onError={(msg) => toast('error', msg)} />
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
    <details className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:mt-10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-band/40">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/8 text-primary">
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
        className="space-y-3.5 border-t border-border px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) mutate();
        }}
      >
        {durationMins > 0 && <p className="text-xs font-semibold text-primary">Proposed shift: {fmtDur(durationMins)}</p>}
        <DatePicker label="Date" value={date} onValueChange={setDate} required />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel as="span" className="mb-1.5" required>
              From
            </FieldLabel>
            <TimePicker value={start} onValueChange={setStart} required aria-label="From" />
          </div>
          <div>
            <FieldLabel as="span" className="mb-1.5" required>
              To
            </FieldLabel>
            <TimePicker value={end} onValueChange={setEnd} required aria-label="To" />
          </div>
        </div>
        {end && start && durationMins <= 0 && <p className="text-xs text-destructive">End time must be after the start time.</p>}
        <div>
          <FieldLabel as="span" className="mb-1.5">
            Notes (optional)
          </FieldLabel>
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
          className="h-10 w-full"
        >
          Send suggestion
        </ActionButton>
      </form>
    </details>
  );
}
