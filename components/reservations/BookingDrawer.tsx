'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';

import { RowTile } from '@/components/cms/rows';
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
  Timer,
  UserRound,
  Users,
  X,
} from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { DetailRow, DrawerSection, FieldLine } from '@/components/shared/DrawerSection';
import { NumberStepper } from '@/components/shared/FormParts';
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
import { toast } from '@/stores/toastStore';
import type { Customer } from '@/types/customers';

import { BookingAssist } from './BookingAssist';

export type BookingDrawerState =
  | { mode: 'new'; date: string; time?: string; tableIds?: string[]; partySize?: number; source?: BookingSource }
  | { mode: 'edit'; booking: Booking };

const DURATIONS = [60, 90, 120, 150, 180];
const stayLabel = (minutes: number) => (minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}` : `${minutes / 60}h`);
const SOURCE_OPTIONS = (Object.keys(SOURCE_LABELS) as BookingSource[]).map((value) => ({ value, label: SOURCE_LABELS[value] }));

/** The rows that open their input underneath — one at a time. */
type Row = 'party' | 'day' | 'time' | 'stay' | 'tables';

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
  const [openRow, setOpenRow] = useState<Row | null>(null);
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
      const first = Object.keys(problems)[0];
      if (first === 'date' || first === 'time') setOpenRow(first === 'date' ? 'day' : 'time');
      if (first === 'partySize') setOpenRow('party');
      return;
    }
    save.mutate();
  };

  const toggleTable = (id: string) =>
    setTableIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const problem = (key: keyof BookingDraft) => (showProblems ? problems[key] : undefined);
  const toggleRow = (row: Row) => setOpenRow((current) => (current === row ? null : row));
  const clashing = chosen.some((table) => byId.get(table.id) && !byId.get(table.id)!.free);

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

  return (
    <Drawer
      title={existing ? existing.guestName : 'New booking'}
      description={
        existing ? (
          <span className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE[existing.status]}>{STATUS_LABELS[existing.status]}</Badge>
            <span>
              {existing.partySize} · {slotOf(existing.startsAt, timeZone)} · {SOURCE_LABELS[existing.source]}
            </span>
          </span>
        ) : (
          'Who, when, and which tables.'
        )
      }
      onClose={onClose}
      // The file drawer's footer: leaving on the left, saving on the right.
      footer={
        editable ? (
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="booking-form" className="min-w-32" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {existing ? 'Save booking' : 'Book'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {existing && canWrite && bookingActions(existing.status).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bookingActions(existing.status).map((action) => (
              <Button
                key={action.status}
                type="button"
                variant={action.primary ? 'default' : action.destructive ? 'destructive' : 'outline'}
                className="flex-1"
                disabled={step.isPending}
                onClick={() => (action.destructive ? setConfirm(action.status) : step.mutate(action.status))}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        <form id="booking-form" onSubmit={submit}>
          <fieldset disabled={!editable} className="space-y-6">
            <DrawerSection id={`${id}-guest`} title="Guest">
              <CustomerLink
                id={`${id}-customer`}
                customer={customer}
                onChange={setCustomer}
                onPick={(picked) => {
                  setCustomer(picked);
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
                editable={editable}
              />
              <FieldLine icon={UserRound} title="Name" htmlFor={`${id}-name`} error={problem('guestName')}>
                <Input
                  id={`${id}-name`}
                  value={draft.guestName}
                  onChange={(event) => set('guestName', event.target.value)}
                  placeholder="Who the table is for"
                  aria-invalid={Boolean(problem('guestName')) || undefined}
                  autoFocus={!existing}
                />
              </FieldLine>
              <FieldLine icon={Phone} title="Phone" htmlFor={`${id}-phone`}>
                <Input
                  id={`${id}-phone`}
                  type="tel"
                  value={draft.guestPhone}
                  onChange={(event) => set('guestPhone', event.target.value)}
                  placeholder="Optional"
                />
              </FieldLine>
              <FieldLine icon={Mail} title="Email" htmlFor={`${id}-email`} error={problem('guestEmail')}>
                <Input
                  id={`${id}-email`}
                  type="email"
                  value={draft.guestEmail}
                  onChange={(event) => set('guestEmail', event.target.value)}
                  placeholder="Optional — for the confirmation"
                  aria-invalid={Boolean(problem('guestEmail')) || undefined}
                />
              </FieldLine>
            </DrawerSection>

            {/* One line each — what it is set to — and the control opens underneath on a tap. */}
            <DrawerSection id={`${id}-when`} title="When">
              <DetailRow
                icon={Users}
                title="Party"
                value={`${draft.partySize} ${draft.partySize === 1 ? 'guest' : 'guests'}`}
                open={openRow === 'party'}
                onToggle={() => toggleRow('party')}
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
              </DetailRow>
              <DetailRow
                icon={CalendarDays}
                title="Day"
                value={problem('date') ?? formatCalendarDate(draft.date, { weekday: 'short', day: 'numeric', month: 'short' }, 'Choose a day')}
                tone={problem('date') ? 'warning' : undefined}
                open={openRow === 'day'}
                onToggle={() => toggleRow('day')}
              >
                <DatePicker value={draft.date} onValueChange={(value) => set('date', value)} aria-label="Day" error={problem('date')} />
              </DetailRow>
              <DetailRow
                icon={Clock}
                title="Time"
                value={problem('time') ?? (draft.time || 'Choose a time')}
                tone={problem('time') ? 'warning' : undefined}
                open={openRow === 'time'}
                onToggle={() => toggleRow('time')}
              >
                <TimePicker value={draft.time} onValueChange={(value) => set('time', value)} minuteStep={15} aria-label="Time" />
              </DetailRow>
              <DetailRow
                icon={Timer}
                title="Stay"
                value={stayLabel(draft.durationMinutes)}
                open={openRow === 'stay'}
                onToggle={() => toggleRow('stay')}
              >
                <SegmentedControl<string>
                  value={String(draft.durationMinutes)}
                  onChange={(value) => {
                    setDurationTouched(true);
                    set('durationMinutes', Number(value));
                  }}
                  ariaLabel="How long they stay"
                  options={DURATIONS.map((minutes) => ({ value: String(minutes), label: stayLabel(minutes) }))}
                />
              </DetailRow>
              <DetailRow
                icon={LayoutGrid}
                title="Tables"
                value={
                  clashing
                    ? 'Booked then'
                    : short
                      ? `Seats ${seatsAtMost(chosen)} of ${draft.partySize}`
                      : chosen.length
                        ? chosen.map((table) => table.label).join(' + ')
                        : 'None yet'
                }
                muted={chosen.length === 0}
                tone={clashing || short ? 'warning' : undefined}
                open={openRow === 'tables'}
                onToggle={() => toggleRow('tables')}
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
              </DetailRow>
            </DrawerSection>

            <DrawerSection id={`${id}-details`} title="Details">
              <FieldLine icon={Phone} title="Taken by" htmlFor={`${id}-source`}>
                <Select
                  id={`${id}-source`}
                  value={source}
                  onValueChange={(value) => setSource(value as BookingSource)}
                  options={SOURCE_OPTIONS}
                  ariaLabel="How the booking came in"
                  className="w-full"
                  disabled={!editable}
                />
              </FieldLine>
              <FieldLine icon={StickyNote} title="Notes" htmlFor={`${id}-notes`}>
                <textarea
                  id={`${id}-notes`}
                  value={draft.notes}
                  onChange={(event) => set('notes', event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Allergies, an occasion, a high chair…"
                  className="w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-measured focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-measured disabled:opacity-60"
                />
              </FieldLine>
              {!existing && draft.guestEmail.trim() && (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <RowTile icon={Mail} tone={sendConfirmation ? 'success' : 'default'} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">Email a confirmation</span>
                    <span className="block text-xs text-muted-foreground">
                      To {draft.guestEmail.trim()}, if a confirmation automation is set up. The reminder goes either way.
                    </span>
                  </span>
                  <Switch checked={sendConfirmation} onChange={setSendConfirmation} label="Email a confirmation" />
                </div>
              )}
            </DrawerSection>
          </fieldset>
        </form>

        {facts && (
          <DrawerSection id={`${id}-ask`} title="Ask DUMA" action={<Sparkles size={14} className="text-primary" aria-hidden="true" />}>
            <BookingAssist facts={facts} />
          </DrawerSection>
        )}
      </div>

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
                    title={clash ? `${clash.guestName} at ${slotOf(clash.startsAt, timeZone)}` : `Seats ${table.minCovers}–${table.maxCovers}`}
                    onClick={() => onToggle(table.id)}
                    className={cn(
                      'flex h-10 min-w-16 flex-col items-center justify-center rounded-md border px-2 text-xs transition-colors',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-rule bg-field text-foreground hover:bg-band',
                      busy && !selected && 'cursor-not-allowed border-dashed opacity-50',
                      busy && selected && 'border-exception bg-exception/10 text-exception',
                      info && !info.seatsParty && !selected && !busy && 'text-muted-foreground',
                    )}
                  >
                    <span className="font-semibold">{table.label}</span>
                    <span className={cn('text-[10px]', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {busy ? 'Booked' : table.minCovers === table.maxCovers ? table.maxCovers : `${table.minCovers}–${table.maxCovers}`}
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
 * Link the booking to a customer record — their allergies and history come
 * with them. Searches name, phone or email, like the till.
 */
function CustomerLink({
  id,
  customer,
  onChange,
  onPick,
  editable,
}: {
  id: string;
  customer: Pick<Customer, 'id' | 'firstName' | 'lastName' | 'allergies'> | null;
  onChange: (customer: null) => void;
  onPick: (customer: Customer) => void;
  editable: boolean;
}) {
  const [term, setTerm] = useState('');
  const search = term.trim();
  const results = useQuery({
    queryKey: moduleQueryKeys.customers.key('booking-search', search),
    queryFn: () => getCustomers({ search, limit: 6 }),
    enabled: search.length >= 2,
    staleTime: 30_000,
  });

  if (customer) {
    const allergies = customer.allergies?.length ? customer.allergies.join(', ') : null;
    return (
      <div className="flex items-center gap-3 border-b border-rule/45 px-4 py-2.5">
        <RowTile icon={UserRound} tone={allergies ? 'warning' : 'success'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {`${customer.firstName} ${customer.lastName}`.trim()}
          </span>
          <span className={cn('block text-xs', allergies ? 'font-medium text-measured' : 'text-muted-foreground')}>
            {allergies ? `Allergies: ${allergies}` : 'Customer record linked'}
          </span>
        </span>
        {editable && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Unlink the customer" onClick={() => onChange(null)}>
            <X size={15} />
          </Button>
        )}
      </div>
    );
  }
  if (!editable) return null;
  return (
    <FieldLine icon={Search} title="Customer" htmlFor={id}>
      <Input
        id={id}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Name, phone or email — optional"
      />
      {search.length >= 2 && (
        <div className="mt-1.5 rounded-md border border-rule/60 bg-card p-1">
          {results.isPending ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>
          ) : results.isError ? (
            <p className="px-2 py-1.5 text-xs text-exception">Couldn’t search customers.</p>
          ) : results.data.data.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No customer matches — the booking can be taken without one.</p>
          ) : (
            results.data.data.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => {
                  onPick(match);
                  setTerm('');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-band"
              >
                <span className="truncate font-medium text-foreground">{`${match.firstName} ${match.lastName}`.trim()}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{match.phone ?? match.email ?? ''}</span>
              </button>
            ))
          )}
        </div>
      )}
    </FieldLine>
  );
}
