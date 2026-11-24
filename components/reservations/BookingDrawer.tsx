'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useMemo, useState } from 'react';

import {
  AlertTriangle,
  CalendarDays,
  Clock,
  LayoutGrid,
  Loader2,
  Mail,
  Phone,
  Search,
  Sparkles,
  StickyNote,
  Tag,
  Timer,
  UserRound,
  Users,
  X,
} from '@/components/icons';
import { RecordLink, useRecordHrefs } from '@/components/shared/RecordLink';
import { ChangeRow, Switch, ValueMissing } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { NumberStepper } from '@/components/shared/FormParts';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';

import { bookingFacts } from '@/lib/ai/reservation-assist';
import { getCustomers } from '@/lib/api/customers.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type Booking,
  type BookingSource,
  type DiningArea,
  createBooking,
  getAvailability,
  setBookingStatus,
  updateBooking,
} from '@/lib/modules/reservations/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import {
  type BookingDraft,
  SOURCE_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  bookingActions,
  bookingDraftProblems,
  bookingWindow,
  defaultDurationMinutes,
  isLive,
  minutesBetween,
  seatsAtMost,
  slotOf,
} from '@/lib/utils/reservations';
import { formatCalendarDate, workspaceDateKey, workspaceTimeZone } from '@/lib/utils/workspace-time';
import type { Customer } from '@/types/customers';

import { BookingAssist } from './BookingAssist';

export type BookingDrawerState =
  | { mode: 'new'; date: string; time?: string; tableIds?: string[]; partySize?: number; source?: BookingSource }
  | { mode: 'edit'; booking: Booking };

const DURATIONS = [60, 90, 120, 150, 180];
const stayLabel = (minutes: number) => (minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}` : `${minutes / 60}h`);
const SOURCE_OPTIONS = (Object.keys(SOURCE_LABELS) as BookingSource[]).map((value) => ({ value, label: SOURCE_LABELS[value] }));
const STAGGER = { hidden: {}, shown: { transition: { staggerChildren: 0.05 } } };
/** A row here closes on "Done" and keeps what was typed: the footer's Cancel is what throws the booking's changes away. */
const VERBS = ['Change', 'Done'] as const;

/** The rows that open their input underneath — one at a time. */
type Row = 'customer' | 'name' | 'phone' | 'email' | 'party' | 'day' | 'time' | 'stay' | 'tables' | 'notes' | 'source';

/** Which row holds the field a problem is about, so the fix is in view. */
const PROBLEM_ROW: Partial<Record<keyof BookingDraft, Row>> = {
  guestName: 'name',
  guestEmail: 'email',
  partySize: 'party',
  date: 'day',
  time: 'time',
  durationMinutes: 'stay',
};

/** Next quarter hour from now, as HH:MM — a sensible time for a booking taken now. */
function nextQuarter(now = new Date()): string {
  const timeZone = workspaceTimeZone();
  const [hour, minute] = slotOf(now.toISOString(), timeZone).split(':').map(Number);
  const total = Math.ceil((hour! * 60 + minute! + 1) / 15) * 15;
  return total >= 24 * 60 ? '23:45' : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Take or change a booking. The tables offered are what's free for the chosen
 * window — the API decides, and a booking taken in the meantime by someone
 * else comes back as a refusal naming the table, not a double booking.
 *
 * Laid out for the host stand: the status steps as big keys at the top, then
 * plain titled groups of rows (Guest, When, Details), each showing its value
 * with a Change that opens the field underneath, one at a time.
 */
export function BookingDrawer({
  locationId,
  state,
  floor,
  canWrite,
  onClose,
}: {
  locationId: string;
  state: BookingDrawerState;
  floor: DiningArea[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const timeZone = workspaceTimeZone();
  const existing = state.mode === 'edit' ? state.booking : null;
  const editable = canWrite && (!existing || isLive(existing.status));

  const [draft, setDraft] = useState<BookingDraft>(() =>
    existing
      ? {
          guestName: existing.guestName,
          guestPhone: existing.guestPhone ?? '',
          guestEmail: existing.guestEmail ?? '',
          partySize: existing.partySize,
          date: workspaceDateKey(existing.startsAt, timeZone),
          time: slotOf(existing.startsAt, timeZone),
          durationMinutes: minutesBetween(existing.startsAt, existing.endsAt),
          notes: existing.notes ?? '',
        }
      : {
          guestName: state.mode === 'new' && state.source === 'walk_in' ? 'Walk-in' : '',
          guestPhone: '',
          guestEmail: '',
          partySize: state.mode === 'new' ? (state.partySize ?? 2) : 2,
          date: state.mode === 'new' ? state.date : workspaceDateKey(),
          time: (state.mode === 'new' && state.time) || nextQuarter(),
          durationMinutes: defaultDurationMinutes(state.mode === 'new' ? (state.partySize ?? 2) : 2),
          notes: '',
        },
  );
  const [source, setSource] = useState<BookingSource>(existing?.source ?? (state.mode === 'new' ? (state.source ?? 'phone') : 'phone'));
  const [tableIds, setTableIds] = useState<string[]>(
    existing ? existing.tables.map((table) => table.id) : state.mode === 'new' ? (state.tableIds ?? []) : [],
  );
  const [customer, setCustomer] = useState<Pick<Customer, 'id' | 'firstName' | 'lastName' | 'allergies'> | null>(
    existing?.customerId ? { id: existing.customerId, firstName: existing.guestName, lastName: '', allergies: null } : null,
  );
  const [durationTouched, setDurationTouched] = useState(Boolean(existing));
  const [confirm, setConfirm] = useState<Booking['status'] | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(true);
  // A new booking starts on the name; a saved one starts closed.
  const [openRow, setOpenRow] = useState<Row | null>(existing ? null : 'name');
  const id = useId();

  const set = <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const problems = bookingDraftProblems(draft);
  const window = bookingWindow(draft.date, draft.time, draft.durationMinutes, timeZone);

  const availability = useQuery({
    queryKey: moduleQueryKeys.reservations.key('availability', locationId, window?.startsAt, window?.endsAt, draft.partySize, existing?.id),
    queryFn: () => getAvailability(locationId, { ...window!, partySize: draft.partySize, excludeReservationId: existing?.id ?? null }),
    enabled: Boolean(window) && editable,
  });
  const byId = new Map((availability.data ?? []).map((table) => [table.id, table]));
  const chosen = floor.flatMap((area) => area.tables).filter((table) => tableIds.includes(table.id));
  const short = chosen.length > 0 && seatsAtMost(chosen) < draft.partySize;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });

  const save = useMutation({
    mutationFn: () => {
      if (!window) throw new Error('Choose the day and time');
      const input = {
        guestName: draft.guestName.trim(),
        guestPhone: draft.guestPhone.trim() || null,
        guestEmail: draft.guestEmail.trim() || null,
        customerId: customer?.id ?? null,
        partySize: draft.partySize,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        notes: draft.notes.trim() || null,
        source,
        tableIds,
      };
      return existing ? updateBooking(existing.id, input) : createBooking(locationId, { ...input, sendConfirmation });
    },
    onSuccess: async (result) => {
      toast(
        'success',
        existing
          ? 'Booking saved.'
          : `Booked: ${result.data.guestName}, ${result.data.partySize} at ${slotOf(result.data.startsAt, timeZone)}.`,
      );
      for (const warning of result.warnings ?? []) toast('info', `${warning}.`);
      await invalidate();
      onClose();
    },
    onError: async (error) => {
      toast('error', error.message);
      // A clash means the picture of free tables is out of date.
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.key('availability') });
    },
  });

  const step = useMutation({
    mutationFn: (status: Booking['status']) => setBookingStatus(existing!.id, status),
    onSuccess: async (booking) => {
      toast('success', `${booking.guestName}: ${STATUS_LABELS[booking.status].toLowerCase()}.`);
      setConfirm(null);
      await invalidate();
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      toast('error', Object.values(problems)[0]!);
      // A problem behind a closed row is opened, so the fix is in view.
      const row = PROBLEM_ROW[Object.keys(problems)[0] as keyof BookingDraft];
      if (row) setOpenRow(row);
      return;
    }
    save.mutate();
  };

  const toggleTable = (id: string) =>
    setTableIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const problem = (key: keyof BookingDraft) => (showProblems ? problems[key] : undefined);
  const toggleRow = (row: Row) => setOpenRow((current) => (current === row ? null : row));
  /** A row's Change, only while the booking can be edited — read-only rows show the value alone. */
  const changer = (row: Row) => (editable ? { open: openRow === row, onToggle: () => toggleRow(row), verbs: VERBS, touch: true } : {});
  const clashing = chosen.some((table) => byId.get(table.id) && !byId.get(table.id)!.free);
  const actions = existing && canWrite ? bookingActions(existing.status) : [];

  // What Ask DUMA is told about the saved booking — the one the drawer opened on.
  const facts = useMemo(() => {
    if (!existing) return null;
    const tables = floor.flatMap((area) => area.tables);
    return bookingFacts(existing, {
      timeZone,
      tables: existing.tables.map((table) => tables.find((candidate) => candidate.id === table.id) ?? table),
      allergies: customer?.allergies ?? null,
      now: new Date(),
    });
  }, [existing, floor, customer, timeZone]);

  const hrefs = useRecordHrefs();
  const allergies = customer?.allergies?.length ? customer.allergies.join(', ') : null;
  const text = (value: string, empty: string) =>
    value.trim() ? <span className="truncate">{value.trim()}</span> : <ValueMissing>{empty}</ValueMissing>;

  return (
    <Drawer
      icon={CalendarDays}
      title={existing ? existing.guestName : 'New booking'}
      description={
        existing ? (
          <span className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE[existing.status]}>{STATUS_LABELS[existing.status]}</Badge>
            <span>
              {existing.partySize} · {slotOf(existing.startsAt, timeZone)} · {SOURCE_LABELS[existing.source]}
            </span>
          </span>
        ) : undefined
      }
      onClose={onClose}
      // The file drawer's footer: leaving on the left, saving on the right.
      footer={
        editable ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 pointer-coarse:h-11" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="booking-form" className="flex-1 pointer-coarse:h-11" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {existing ? 'Save booking' : 'Create booking'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <motion.div className="space-y-6" initial={reduceMotion ? false : 'hidden'} animate="shown" variants={STAGGER}>
        {/* The steps a host takes standing up: big keys, the likely next one across the top. */}
        {actions.length > 0 && (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Booking status">
            {actions.map((action) => (
              <Button
                key={action.status}
                type="button"
                size="touch"
                variant={action.primary ? 'default' : action.destructive ? 'destructive' : 'outline'}
                className={cn(action.primary && 'col-span-2')}
                disabled={step.isPending}
                onClick={() => (action.destructive ? setConfirm(action.status) : step.mutate(action.status))}
              >
                {step.isPending && step.variables === action.status && <Loader2 className="animate-spin" aria-hidden="true" />}
                {action.label}
              </Button>
            ))}
          </div>
        )}

        <form id="booking-form" onSubmit={submit}>
          <fieldset disabled={!editable} className="min-w-0 space-y-6">
            <RecordGroup id={`${id}-guest`} title="Guest">
              <div>
                <ChangeRow
                  icon={UserRound}
                  label="Customer record"
                  tone={allergies ? 'warning' : undefined}
                  value={
                    customer ? (
                      <span className="min-w-0">
                        <span className="block truncate">
                          <RecordLink href={hrefs.customer(customer.id)}>{`${customer.firstName} ${customer.lastName}`.trim()}</RecordLink>
                        </span>
                        {allergies && <span className="block truncate text-xs font-medium text-measured">Allergies: {allergies}</span>}
                      </span>
                    ) : (
                      <ValueMissing>Not linked</ValueMissing>
                    )
                  }
                  trailing={
                    customer && editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="pointer-coarse:size-11"
                        aria-label="Unlink the customer"
                        onClick={() => setCustomer(null)}
                      >
                        <X size={15} aria-hidden="true" />
                      </Button>
                    ) : undefined
                  }
                  {...(editable && !customer
                    ? {
                        open: openRow === 'customer',
                        onToggle: () => toggleRow('customer'),
                        verbs: ['Find', 'Close'] as const,
                        touch: true,
                      }
                    : {})}
                >
                  <CustomerSearch
                    id={`${id}-customer`}
                    onPick={(picked) => {
                      setCustomer(picked);
                      setOpenRow(null);
                      setDraft((current) => ({
                        ...current,
                        guestName:
                          current.guestName && current.guestName !== 'Walk-in'
                            ? current.guestName
                            : `${picked.firstName} ${picked.lastName}`.trim(),
                        guestPhone: current.guestPhone || picked.phone || '',
                        guestEmail: current.guestEmail || picked.email || '',
                      }));
                    }}
                  />
                </ChangeRow>
                <ChangeRow
                  icon={UserRound}
                  label="Name"
                  tone={problem('guestName') ? 'danger' : undefined}
                  value={
                    problem('guestName') ? <span className="text-exception">{problem('guestName')}</span> : text(draft.guestName, 'Not set')
                  }
                  {...changer('name')}
                >
                  <Input
                    id={`${id}-name`}
                    aria-label="Guest name"
                    required
                    value={draft.guestName}
                    onChange={(event) => set('guestName', event.target.value)}
                    placeholder="Who the table is for"
                    error={problem('guestName')}
                    autoFocus
                  />
                </ChangeRow>
                <ChangeRow icon={Phone} label="Phone" value={text(draft.guestPhone, 'None')} {...changer('phone')}>
                  <Input
                    aria-label="Phone"
                    type="tel"
                    autoComplete="tel"
                    value={draft.guestPhone}
                    onChange={(event) => set('guestPhone', event.target.value)}
                    autoFocus
                  />
                </ChangeRow>
                <ChangeRow
                  icon={Mail}
                  label="Email"
                  tone={problem('guestEmail') ? 'danger' : undefined}
                  value={
                    problem('guestEmail') ? <span className="text-exception">{problem('guestEmail')}</span> : text(draft.guestEmail, 'None')
                  }
                  {...changer('email')}
                >
                  <Input
                    aria-label="Email"
                    type="email"
                    autoComplete="email"
                    value={draft.guestEmail}
                    onChange={(event) => set('guestEmail', event.target.value)}
                    error={problem('guestEmail')}
                    autoFocus
                  />
                </ChangeRow>
                {!existing && draft.guestEmail.trim() && (
                  <>
                    <ChangeRow
                      icon={Mail}
                      label="Email a confirmation"
                      value={sendConfirmation ? 'Yes' : <ValueMissing>No</ValueMissing>}
                      trailing={<Switch checked={sendConfirmation} onChange={setSendConfirmation} label="Email a confirmation" />}
                    />
                    <p className="pb-1 text-xs leading-relaxed text-muted-foreground sm:pl-13">
                      To {draft.guestEmail.trim()}, if a confirmation automation is set up. The reminder goes either way.
                    </p>
                  </>
                )}
              </div>
            </RecordGroup>

            <RecordGroup id={`${id}-when`} title="When">
              <div>
                <ChangeRow
                  icon={Users}
                  label="Party"
                  value={`${draft.partySize} ${draft.partySize === 1 ? 'guest' : 'guests'}`}
                  tone={problem('partySize') ? 'danger' : undefined}
                  {...changer('party')}
                >
                  <NumberStepper
                    label="Guests"
                    value={draft.partySize}
                    min={1}
                    max={200}
                    unit={draft.partySize === 1 ? 'guest' : 'guests'}
                    onChange={(value) => {
                      setDraft((current) => ({
                        ...current,
                        partySize: value,
                        ...(!durationTouched && { durationMinutes: defaultDurationMinutes(value) }),
                      }));
                    }}
                  />
                </ChangeRow>
                <ChangeRow
                  icon={CalendarDays}
                  label="Day"
                  tone={problem('date') ? 'danger' : undefined}
                  value={
                    problem('date') ? (
                      <span className="text-exception">{problem('date')}</span>
                    ) : (
                      formatCalendarDate(draft.date, { weekday: 'short', day: 'numeric', month: 'short' }, 'Choose a day')
                    )
                  }
                  {...changer('day')}
                >
                  <DatePicker value={draft.date} onValueChange={(value) => set('date', value)} aria-label="Day" error={problem('date')} />
                </ChangeRow>
                <ChangeRow
                  icon={Clock}
                  label="Time"
                  tone={problem('time') ? 'danger' : undefined}
                  value={
                    problem('time') ? (
                      <span className="text-exception">{problem('time')}</span>
                    ) : (
                      draft.time || <ValueMissing>Choose a time</ValueMissing>
                    )
                  }
                  {...changer('time')}
                >
                  <TimePicker value={draft.time} onValueChange={(value) => set('time', value)} minuteStep={15} aria-label="Time" />
                </ChangeRow>
                <ChangeRow icon={Timer} label="Stay" value={stayLabel(draft.durationMinutes)} {...changer('stay')}>
                  <SegmentedControl<string>
                    value={String(draft.durationMinutes)}
                    onChange={(value) => {
                      setDurationTouched(true);
                      set('durationMinutes', Number(value));
                    }}
                    ariaLabel="How long they stay"
                    options={DURATIONS.map((minutes) => ({ value: String(minutes), label: stayLabel(minutes) }))}
                    className="w-full [&>button]:flex-1"
                  />
                </ChangeRow>
                <ChangeRow
                  icon={LayoutGrid}
                  label="Tables"
                  tone={clashing ? 'danger' : short ? 'warning' : undefined}
                  value={
                    clashing ? (
                      <span className="text-exception">Booked then</span>
                    ) : short ? (
                      <span className="text-measured">
                        Seats {seatsAtMost(chosen)} of {draft.partySize}
                      </span>
                    ) : chosen.length ? (
                      <span className="truncate">{chosen.map((table) => table.label).join(' + ')}</span>
                    ) : (
                      <ValueMissing>None yet</ValueMissing>
                    )
                  }
                  {...changer('tables')}
                >
                  <TablePicker
                    floor={floor}
                    tableIds={tableIds}
                    byId={byId}
                    editable={editable}
                    timeZone={timeZone}
                    onToggle={toggleTable}
                  />
                  {availability.isError && (
                    <p className="mt-2 text-xs text-exception">Couldn’t check which tables are free — saving still checks.</p>
                  )}
                  {short && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-measured">
                      <AlertTriangle size={13} aria-hidden="true" />
                      Those tables seat {seatsAtMost(chosen)}; the party is {draft.partySize}.
                    </p>
                  )}
                  {clashing && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-exception">
                      <AlertTriangle size={13} aria-hidden="true" />A chosen table is booked then — choose another or change the time.
                    </p>
                  )}
                </ChangeRow>
              </div>
            </RecordGroup>

            <RecordGroup id={`${id}-details`} title="Details">
              <div>
                <ChangeRow icon={StickyNote} label="Notes" value={text(draft.notes, 'None')} {...changer('notes')}>
                  <textarea
                    id={`${id}-notes`}
                    aria-label="Notes"
                    value={draft.notes}
                    onChange={(event) => set('notes', event.target.value)}
                    maxLength={500}
                    rows={3}
                    autoFocus
                    placeholder="Allergies, an occasion, a high chair…"
                    className="w-full rounded-md border border-input bg-control px-3 py-2 text-base sm:text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 disabled:opacity-60"
                  />
                </ChangeRow>
                <ChangeRow icon={Tag} label="Taken by" value={SOURCE_LABELS[source]} {...changer('source')}>
                  <Select
                    id={`${id}-source`}
                    value={source}
                    onValueChange={(value) => setSource(value as BookingSource)}
                    options={SOURCE_OPTIONS}
                    ariaLabel="How the booking came in"
                    className="w-full"
                    disabled={!editable}
                  />
                </ChangeRow>
              </div>
            </RecordGroup>
          </fieldset>
        </form>

        {facts && (
          <RecordGroup id={`${id}-ask`} title="Ask DUMA" actions={<Sparkles size={14} className="text-primary" aria-hidden="true" />}>
            <BookingAssist facts={facts} />
          </RecordGroup>
        )}
      </motion.div>

      {confirm && (
        <ConfirmModal
          title={confirm === 'cancelled' ? 'Cancel this booking?' : 'Mark as a no-show?'}
          message={
            confirm === 'cancelled'
              ? `${existing?.guestName}’s tables are freed. You can restore the booking later if they’re still free.`
              : `${existing?.guestName} is marked as not having come, and their tables are freed.`
          }
          confirmLabel={confirm === 'cancelled' ? 'Cancel booking' : 'Mark no-show'}
          pendingLabel="Saving…"
          isPending={step.isPending}
          onConfirm={() => step.mutate(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </Drawer>
  );
}

/** The floor's tables as keys — free, booked then, or chosen — grouped by area when there's more than one. */
function TablePicker({
  floor,
  tableIds,
  byId,
  editable,
  timeZone,
  onToggle,
}: {
  floor: DiningArea[];
  tableIds: string[];
  byId: Map<string, Awaited<ReturnType<typeof getAvailability>>[number]>;
  editable: boolean;
  timeZone?: string;
  onToggle: (id: string) => void;
}) {
  if (floor.every((area) => area.tables.length === 0)) {
    return (
      <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
        No tables on the floor plan yet — the booking is kept without one. A manager adds tables on the Floor plan tab.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {floor
        .filter((area) => area.tables.length > 0)
        .map((area) => (
          <div key={area.id}>
            {floor.length > 1 && <p className="mb-1.5 text-xs font-medium text-muted-foreground">{area.name}</p>}
            <div className="flex flex-wrap gap-1.5">
              {area.tables.map((table) => {
                const info = byId.get(table.id);
                const selected = tableIds.includes(table.id);
                const busy = info ? !info.free : false;
                const clash = info?.clashes[0];
                return (
                  <button
                    key={table.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={!editable || (busy && !selected)}
                    aria-label={
                      clash
                        ? `${table.label}, booked by ${clash.guestName} at ${slotOf(clash.startsAt, timeZone)}`
                        : `${table.label}, seats ${table.minCovers}–${table.maxCovers}`
                    }
                    onClick={() => onToggle(table.id)}
                    className={cn(
                      'flex h-11 min-w-16 flex-col items-center justify-center rounded-md border px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      selected ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-card text-foreground hover:bg-band/60',
                      busy && !selected && 'cursor-not-allowed border-dashed opacity-50',
                      busy && selected && 'border-exception bg-exception/10 text-exception',
                      info && !info.seatsParty && !selected && !busy && 'text-muted-foreground',
                    )}
                  >
                    <span className="font-semibold">{table.label}</span>
                    <span className={cn('text-[10px]', selected ? 'text-primary/80' : 'text-muted-foreground')}>
                      {busy
                        ? clash
                          ? `${clash.guestName.split(' ')[0]} ${slotOf(clash.startsAt, timeZone)}`
                          : 'Booked'
                        : table.minCovers === table.maxCovers
                          ? table.maxCovers
                          : `${table.minCovers}–${table.maxCovers}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

/**
 * Find a customer record to link — their allergies and history come with
 * them. Searches name, phone or email, like the till.
 */
function CustomerSearch({ id, onPick }: { id: string; onPick: (customer: Customer) => void }) {
  const [term, setTerm] = useState('');
  const search = term.trim();
  const results = useQuery({
    queryKey: moduleQueryKeys.customers.key('booking-search', search),
    queryFn: () => getCustomers({ search, limit: 6 }),
    enabled: search.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div>
      <Input
        id={id}
        aria-label="Find a customer"
        leftIcon={<Search size={14} aria-hidden="true" />}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Name, phone or email"
        autoFocus
      />
      {search.length >= 2 && (
        <div className="mt-1.5">
          {results.isPending ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : results.isError ? (
            <p className="px-1 py-2 text-xs text-exception">Couldn’t search customers.</p>
          ) : results.data.data.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">No customer matches — the booking can be taken without one.</p>
          ) : (
            <ul className="-mx-1 flex flex-col">
              {results.data.data.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(match);
                      setTerm('');
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-band/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="truncate font-medium text-foreground">{`${match.firstName} ${match.lastName}`.trim()}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{match.phone ?? match.email ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
