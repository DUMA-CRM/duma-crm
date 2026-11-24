'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { Widget, WidgetCaption, WidgetFigure, WidgetRow, useFamily, useRows } from '@/components/dashboard/widget/Widget';
import { CalendarClock, Clock, LogOut, Send } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
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
import { greeting } from '@/lib/utils/day-story';
import { relativeTime } from '@/lib/utils/relative-time';
import { formatInstant, workspaceDateKey, zonedParts, zonedToInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const two = (n: number) => String(n).padStart(2, '0');
const fmtTime = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });
const fmtDur = (mins: number) => `${Math.floor(mins / 60)}h ${two(Math.round(mins % 60))}m`;

// Minutes between two "HH:MM" strings on the same day (0 if invalid / not positive).
function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return eh * 60 + em - (sh * 60 + sm);
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
    <span className={cn('flex size-9 shrink-0 flex-col items-center justify-center rounded-md leading-none', TONE_TINT.success)}>
      {/* The tile is the row's only date, so screen readers get it in full. */}
      <span className="sr-only">{formatInstant(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <span className="text-[11px] font-semibold uppercase" aria-hidden="true">
        {formatInstant(iso, { weekday: 'short' })}
      </span>
      <span className="mt-0.5 text-sm font-semibold tabular-nums" aria-hidden="true">
        {zonedParts(iso).day}
      </span>
    </span>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────

/**
 * My workday as a widget, for the people who work the floor: the time and
 * whose day it is, as a Clock widget would lead; clocking in and out in place;
 * from large up, this week's shifts; and a way to suggest one.
 */
export function MyDashboard() {
  const user = useAuthStore((s) => s.user);
  const { locationId } = useWorkspaceStore();
  const qc = useQueryClient();
  const family = useFamily();
  const rowsFit = useRows(42, family === 'large' ? 128 : 0);

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
  const shifts = useQuery({ queryKey: moduleQueryKeys.workforce.key('shifts-my'), queryFn: getMyShifts });
  const active = (shifts.data ?? []).find((s) => !s.clockedOut);

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
  const [suggestOpen, setSuggestOpen] = useState(false);

  const firstName = user?.name ? `, ${user.name.split(' ')[0]}` : '';
  const time = mounted ? zonedParts(now).time : '\u00a0';

  const clockBlock = active ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-heading">
          <StatusDot tone="success" pulse label="On shift" />
          On shift since {fmtTime(active.clockedIn)}
        </span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {fmtDur(Math.max(0, (now.getTime() - new Date(active.clockedIn).getTime()) / 60000))} so far
        </span>
      </span>
      <Button variant="destructive" size="sm" onClick={() => setClockOutOpen(true)}>
        <LogOut aria-hidden="true" /> Clock out
      </Button>
    </div>
  ) : (
    <div>
      <SlideToClockIn onClockIn={() => clockInM.mutateAsync()} pending={clockInM.isPending} disabled={!locationId} className="w-full" />
      {!locationId && <p className="mt-1.5 text-[11px] text-muted-foreground">Pick your location before you clock in.</p>}
    </div>
  );

  const rotaList =
    upcoming.length === 0 ? (
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <CalendarClock size={14} className="shrink-0" aria-hidden="true" />
        No shifts this week yet
      </p>
    ) : (
      <ul>
        {upcoming.slice(0, rowsFit).map((s) => {
          const started = new Date(s.startsAt).getTime() <= now.getTime();
          const meta = [showRotaLocation ? (s.location?.name ?? '—') : null, s.role].filter(Boolean).join(' · ');
          return (
            <WidgetRow
              key={s.id}
              href="/my-work?tab=rota"
              mark={<DateTile iso={s.startsAt} />}
              title={
                <span className="tabular-nums">
                  {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}
                </span>
              }
              detail={meta || undefined}
              value={mounted ? (started ? 'Now' : relativeTime(s.startsAt, now.getTime())) : undefined}
              valueClassName={started ? 'text-momentum' : 'font-medium text-muted-foreground'}
            />
          );
        })}
      </ul>
    );

  const reading = (
    <div className="min-w-0">
      <WidgetFigure value={time} size={family === 'medium' ? 'medium' : 'large'} />
      <WidgetCaption className="mt-1.5">
        {greeting(zonedParts(now).hour)}
        {firstName}
      </WidgetCaption>
      <WidgetCaption className="text-xs">
        {formatInstant(now, { weekday: 'long' })}, {formatDate(workspaceDateKey(now))}
      </WidgetCaption>
    </div>
  );

  return (
    <>
      <Widget
        title="My workday"
        icon={Clock}
        tint="team"
        href="/my-work?tab=rota"
        hrefLabel="Open my rota"
        accessory={
          family !== 'medium' ? (
            <Button variant="outline" size="xs" onClick={() => setSuggestOpen(true)}>
              <Send aria-hidden="true" /> Suggest a shift
            </Button>
          ) : undefined
        }
        loading={shifts.isPending}
        error={shifts.isError}
        onRetry={() => void shifts.refetch()}
      >
        {family === 'medium' ? (
          <div className="flex min-h-0 flex-1 gap-4">
            <div className="mt-auto min-w-0 flex-1">{reading}</div>
            <div className="mt-auto w-[52%] shrink-0">{clockBlock}</div>
          </div>
        ) : family === 'extraLarge' ? (
          <div className="flex min-h-0 flex-1 gap-6">
            <div className="flex w-[40%] shrink-0 flex-col justify-between">
              {reading}
              {clockBlock}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-semibold text-muted-foreground">This week</p>
              {rotaList}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {reading}
            <div className="mt-3">{clockBlock}</div>
            <div className="mt-auto pt-3">{rotaList}</div>
          </div>
        )}
      </Widget>
      {clockOutOpen && locationId && (
        <ClockOutDialog
          locationId={locationId}
          shiftId={active?.id}
          onClose={() => setClockOutOpen(false)}
          onClockedOut={invalidateShifts}
        />
      )}
      {suggestOpen && (
        <Modal title="Suggest a shift" description="Propose availability for a manager to review." onClose={() => setSuggestOpen(false)}>
          <SuggestShiftForm
            locationId={locationId}
            onDone={(msg) => {
              toast('success', msg);
              setSuggestOpen(false);
            }}
            onError={(msg) => toast('error', msg)}
          />
        </Modal>
      )}
    </>
  );
}

// ── Suggest-a-shift form ─────────────────────────────────────────────────────

function SuggestShiftForm({
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
    <form
      className="space-y-3.5"
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
  );
}
