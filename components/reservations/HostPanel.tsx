'use client';

import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState } from 'react';

import { CalendarCheck, ChevronDown, ExternalLink, Gift, LayoutGrid, Loader2, Search, TriangleAlert, Users, X } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type Booking,
  type FloorTable,
  type WaitlistEntry,
  getCustomerBookings,
  setBookingStatus,
} from '@/lib/modules/reservations/client';
import { toast } from '@/lib/toast';
import { bookingMarkers, markerLabel } from '@/lib/utils/booking-markers';
import { cn } from '@/lib/utils/cn';
import { type FloorTableState, type HostGroupId, guestHistory, hostGroups, hostPrimaryStep, shortDuration } from '@/lib/utils/floor-status';
import { type ReservationStatus, STATUS_LABELS, isRunningLate, minutesBetween, slotOf } from '@/lib/utils/reservations';
import {
  HOST_FILTER_LABELS,
  type HostFilter,
  type HostPanelTab,
  inHostFilter,
  isOverQuote,
  lateBookings,
  matchesBookingSearch,
} from '@/lib/utils/reservations-lists';
import { formatCalendarDate, workspaceTimeZone, zonedParts } from '@/lib/utils/workspace-time';

import { GroupTitle, HOST_FOCUS, HOST_PICKED, HostWaitlist, PanelScroll } from './WaitlistPanel';
import { plural } from '@/lib/utils/format';

const GROUP_TITLES: Record<HostGroupId, string> = { late: 'Late', next: 'Next', seated: 'Seated', done: 'Done' };

const TABS: HostPanelTab[] = ['bookings', 'waitlist', 'tables'];
const TAB_LABELS: Record<HostPanelTab, string> = { bookings: 'Bookings', waitlist: 'Waitlist', tables: 'Tables' };

/** "T7+T8" — the tables a booking holds, as the chip at the end of its row shows them. */
export const tablesLabel = (booking: Pick<Booking, 'tables'>) => booking.tables.map((table) => table.label).join('+');

/**
 * The host stand's left panel: the day's bookings in the order a host works
 * them — late, next, seated, then done — the waitlist, and the tables. A
 * booking row opens in place with what the host needs at the door — a
 * returning guest, the phone, the note, the one next step — and *Open* for the
 * full drawer. Status steps go through the same `POST /reservations/:id/status`
 * as the drawer, and refetch everything after.
 */
export function HostPanel({
  locationId,
  bookings,
  waitlist,
  tables,
  statusById,
  at,
  now,
  live,
  isToday,
  isPast,
  canWrite,
  tab,
  onTab,
  focusBookingId,
  onFocusBooking,
  selectedTableId,
  onChooseTable,
  onOpenBooking,
  onSeatWaitlist,
  onClose,
  inert,
  className,
}: {
  locationId: string;
  bookings: UseQueryResult<Booking[]>;
  waitlist: UseQueryResult<WaitlistEntry[]>;
  /** Every table on the floor, in area order. */
  tables: { areaName: string; tables: FloorTable[] }[];
  statusById: Map<string, FloorTableState<Booking>>;
  /** The moment the floor shows. */
  at: Date;
  /** The wall clock — waits move with it whatever time the floor shows. */
  now: Date;
  /** Following the clock, rather than a chosen time. */
  live: boolean;
  isToday: boolean;
  /** A day gone by: nothing left to confirm. */
  isPast: boolean;
  canWrite: boolean;
  tab: HostPanelTab;
  onTab: (tab: HostPanelTab) => void;
  focusBookingId: string | null;
  onFocusBooking: (booking: Booking | null) => void;
  selectedTableId: string | null;
  onChooseTable: (id: string) => void;
  onOpenBooking: (booking: Booking) => void;
  onSeatWaitlist: (entry: WaitlistEntry) => void;
  /** The slide-over's close key, in portrait. */
  onClose?: () => void;
  /** Off screen (the closed slide-over): out of the tab order and the reading order. */
  inert?: boolean;
  className?: string;
}) {
  // A count is for what's waiting on someone; it turns red when one of them is overdue.
  const clock = { now: at, isToday: live };
  const counts: Partial<Record<HostPanelTab, { value: number; urgent: boolean }>> = {
    ...(bookings.isSuccess && {
      bookings: {
        value: bookings.data.filter((booking) => booking.status !== 'cancelled').length,
        urgent: lateBookings(bookings.data, clock).length > 0,
      },
    }),
    ...(waitlist.isSuccess && {
      waitlist: { value: waitlist.data.length, urgent: waitlist.data.some((entry) => isOverQuote(entry, now)) },
    }),
  };

  return (
    <section aria-label="Host stand" inert={inert} className={cn('flex min-h-0 flex-col bg-card', className)}>
      {/* One header band: the panel's tabs, as the page's own underline tabs. */}
      <div className="flex h-14 shrink-0 items-stretch border-b border-border pr-1 pl-2">
        <HostTabs tab={tab} onTab={onTab} counts={counts} />
        {onClose && (
          <Button variant="ghost" size="icon-touch" className="self-center" aria-label="Close the host panel" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </Button>
        )}
      </div>
      {tab === 'bookings' ? (
        <BookingsList
          query={bookings}
          at={at}
          live={live}
          isToday={isToday}
          isPast={isPast}
          canWrite={canWrite}
          focusBookingId={focusBookingId}
          onFocusBooking={onFocusBooking}
          onOpenBooking={onOpenBooking}
        />
      ) : tab === 'waitlist' ? (
        <HostWaitlist locationId={locationId} query={waitlist} now={now} canWrite={canWrite} onSeat={onSeatWaitlist} />
      ) : (
        <PanelScroll>
          <TableList areas={tables} statusById={statusById} live={live} selectedTableId={selectedTableId} onChoose={onChooseTable} />
        </PanelScroll>
      )}
    </section>
  );
}

/**
 * Underline tabs filling the band, drawn as the app's `SectionTabs`: muted
 * labels, the chosen one in heading ink over a short bar that slides between
 * them, each with a quiet count. The whole band's height is the target.
 */
function HostTabs({
  tab,
  onTab,
  counts,
}: {
  tab: HostPanelTab;
  onTab: (tab: HostPanelTab) => void;
  counts: Partial<Record<HostPanelTab, { value: number; urgent: boolean }>>;
}) {
  const reduceMotion = useReducedMotion();
  const indicatorId = useId();

  const step = (event: React.KeyboardEvent, by: number) => {
    event.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + by + TABS.length) % TABS.length];
    onTab(next);
    (event.currentTarget.parentElement?.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <div role="tablist" aria-label="Host stand" className="grid min-w-0 flex-1 grid-cols-3">
      {TABS.map((value) => {
        const active = tab === value;
        const count = counts[value];
        return (
          <button
            key={value}
            type="button"
            role="tab"
            data-tab={value}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onTab(value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') step(event, 1);
              if (event.key === 'ArrowLeft') step(event, -1);
            }}
            className={cn(
              'relative flex min-w-0 items-center justify-center gap-1.5 px-1.5 text-sm font-medium transition-colors duration-150',
              HOST_FOCUS,
              active ? 'text-heading' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-heading"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="truncate">{TAB_LABELS[value]}</span>
            {count && count.value > 0 && (
              <span
                className={cn(
                  'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm px-1 text-label font-semibold tabular-nums',
                  count.urgent ? 'bg-exception/8 text-exception' : active ? 'bg-band text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {count.value}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

/** Rows shaped like the real ones, under a search-shaped bar. */
function BookingsSkeleton() {
  return (
    <div className="px-3 pt-3" aria-label="Loading bookings" aria-busy="true">
      <Bone className="h-11 w-full rounded-md" />
      <Bone className="mt-5 mb-2 ml-2 h-4 w-20" />
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex min-h-14 items-center gap-3 px-2">
          <Bone className="h-4 w-11" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-20" />
          </span>
          <Bone className="h-4 w-6" />
          <Bone className="h-8 w-10 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function BookingsList({
  query,
  at,
  live,
  isToday,
  isPast,
  canWrite,
  focusBookingId,
  onFocusBooking,
  onOpenBooking,
}: {
  query: UseQueryResult<Booking[]>;
  at: Date;
  live: boolean;
  isToday: boolean;
  isPast: boolean;
  canWrite: boolean;
  focusBookingId: string | null;
  onFocusBooking: (booking: Booking | null) => void;
  onOpenBooking: (booking: Booking) => void;
}) {
  const [doneOpen, setDoneOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<HostFilter | null>(null);

  // A booking chosen from the floor scrolls into view.
  useEffect(() => {
    if (!focusBookingId) return;
    document.getElementById(`host-booking-${focusBookingId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusBookingId]);

  if (query.isPending) return <BookingsSkeleton />;
  if (query.isError) {
    return (
      <PanelScroll>
        <ErrorState title="Couldn’t load the bookings" onRetry={() => void query.refetch()} className="py-10" />
      </PanelScroll>
    );
  }
  if (query.data.length === 0) {
    return (
      <PanelScroll>
        <EmptyState
          compact
          icon={CalendarCheck}
          title="No bookings"
          description={canWrite && !isPast ? (isToday ? 'Tap a free table to seat a walk-in.' : 'Tap a free table to book it.') : undefined}
        />
      </PanelScroll>
    );
  }

  const clock = { now: at, isToday: live };
  // The quick filters a host reaches for, each offered only when it would find someone.
  const filters = (['unconfirmed', 'allergy'] as const)
    .filter((value) => !(value === 'unconfirmed' && isPast))
    .map((value) => ({ value, count: query.data.filter((booking) => inHostFilter(booking, value)).length }))
    .filter((option) => option.count > 0 || option.value === filter);

  const filtering = Boolean(search.trim()) || filter !== null;
  const shown = query.data.filter((booking) => matchesBookingSearch(booking, search) && inHostFilter(booking, filter));
  const groups = hostGroups(shown, clock);
  const active = groups.filter((group) => group.id !== 'done' && group.parties > 0);
  const done = groups.find((group) => group.id === 'done')!;
  const doneExpanded = filtering || doneOpen || done.bookings.some((booking) => booking.id === focusBookingId);

  const row = (booking: Booking) => (
    <BookingRow
      key={booking.id}
      booking={booking}
      at={at}
      live={live}
      isToday={isToday}
      canWrite={canWrite}
      expanded={booking.id === focusBookingId}
      onToggle={() => onFocusBooking(booking.id === focusBookingId ? null : booking)}
      onOpen={() => onOpenBooking(booking)}
    />
  );

  return (
    <>
      {/* The search and the quick filters stay put while the list scrolls under them. */}
      <div className="shrink-0 space-y-2 px-3 pt-3 pb-1">
        <Input
          type="search"
          aria-label="Find a booking by name, phone, note or table"
          placeholder="Name, phone or table…"
          value={search}
          className="pointer-coarse:h-11"
          leftIcon={<Search size={16} aria-hidden="true" />}
          onChange={(event) => setSearch(event.target.value)}
          rightAction={
            search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className={cn(
                  'flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:-mr-2 pointer-coarse:size-11',
                  HOST_FOCUS,
                )}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : undefined
          }
        />
        {filters.length > 0 && (
          <div role="group" aria-label="Show only" className="flex flex-wrap gap-1.5">
            {filters.map((option) => {
              const on = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(on ? null : option.value)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors pointer-coarse:h-11',
                    HOST_FOCUS,
                    on
                      ? 'border-primary/25 bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-band/40 hover:text-foreground',
                  )}
                >
                  {HOST_FILTER_LABELS[option.value]}
                  <span
                    className={cn(
                      'tabular-nums',
                      option.value === 'unconfirmed' && !on ? 'text-measured' : on ? 'text-muted-foreground' : undefined,
                    )}
                  >
                    {option.count}
                  </span>
                  {on && <X size={14} className="-mr-1 text-muted-foreground" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <PanelScroll className="space-y-4">
        {active.length === 0 && done.parties === 0 ? (
          <EmptyState compact kind="search" icon={Search} title="No booking matches" description="Try a name, phone or table." />
        ) : (
          <>
            {active.map((group) => (
              <section key={group.id} aria-label={GROUP_TITLES[group.id]}>
                <GroupTitle
                  title={GROUP_TITLES[group.id]}
                  count={group.parties}
                  aside={plural(group.guests, 'guest', 'guests')}
                  tone={group.id === 'late' ? 'exception' : undefined}
                />
                <ul className="space-y-0.5">{group.bookings.map(row)}</ul>
              </section>
            ))}
            {active.length === 0 && <p className="flex min-h-11 items-center px-2 text-sm text-muted-foreground">No one else due.</p>}
            {done.parties > 0 && (
              <section aria-label={GROUP_TITLES.done}>
                <button
                  type="button"
                  aria-expanded={doneExpanded}
                  onClick={() => setDoneOpen(!doneExpanded)}
                  className={cn(
                    'flex h-11 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-band/40',
                    HOST_FOCUS,
                  )}
                >
                  <span className="text-sm font-semibold text-heading">{GROUP_TITLES.done}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{done.parties}</span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={cn(
                      'ml-auto shrink-0 text-muted-foreground transition-transform duration-150',
                      !doneExpanded && '-rotate-90',
                    )}
                  />
                </button>
                {doneExpanded && <ul className="space-y-0.5">{done.bookings.map(row)}</ul>}
              </section>
            )}
          </>
        )}
      </PanelScroll>
    </>
  );
}

/** The tables a booking holds, on a quiet chip — or a dashed one when it has none yet. */
function TableChip({ booking, muted }: { booking: Pick<Booking, 'tables'>; muted: boolean }) {
  const label = tablesLabel(booking);
  return (
    <span
      aria-label={label ? `Table ${label}` : 'No table yet'}
      className={cn(
        'flex h-8 max-w-24 min-w-10 shrink-0 items-center justify-center rounded-md px-2 text-sm font-semibold tabular-nums',
        !label
          ? 'border border-dashed border-edge text-muted-foreground'
          : muted
            ? 'bg-band/50 text-muted-foreground'
            : 'bg-band/70 text-heading',
      )}
    >
      <span className="truncate">{label || '—'}</span>
    </span>
  );
}

/** A small mark when the notes name an allergen or an occasion. */
export function NoteMarkers({ notes }: { notes: string | null }) {
  const markers = bookingMarkers(notes);
  if (!markers) return null;
  const label = markerLabel(markers);
  return (
    <span role="img" aria-label={label} title={label} className="flex shrink-0 items-center gap-0.5">
      {markers.allergy && <TriangleAlert size={14} className="text-exception" aria-hidden="true" />}
      {markers.occasions.length > 0 && <Gift size={14} className="text-reference" aria-hidden="true" />}
    </span>
  );
}

/**
 * Where the booking stands, in a word — only when it's worth saying: late,
 * not confirmed, how long they've been seated, or how it ended. A confirmed
 * booking on time says nothing; the time and the table say it.
 */
function statusWord(status: ReservationStatus, late: number, seatedFor: string | null): { text: string; tone: string } | null {
  if (late > 0) return { text: `${shortDuration(late)} late`, tone: 'font-medium text-exception' };
  if (status === 'booked') return { text: 'Not confirmed', tone: 'font-medium text-measured' };
  if (status === 'confirmed') return null;
  if (status === 'seated') return { text: seatedFor ? `Seated ${seatedFor}` : 'Seated', tone: 'font-medium text-primary' };
  return { text: STATUS_LABELS[status], tone: 'text-muted-foreground' };
}

function BookingRow({
  booking,
  at,
  live,
  isToday,
  canWrite,
  expanded,
  onToggle,
  onOpen,
}: {
  booking: Booking;
  at: Date;
  live: boolean;
  isToday: boolean;
  canWrite: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const queryClient = useQueryClient();
  const timeZone = workspaceTimeZone();
  const step = useMutation({
    mutationFn: (status: ReservationStatus) => setBookingStatus(booking.id, status),
    onSuccess: (saved) => {
      toast('success', `${saved.guestName}: ${STATUS_LABELS[saved.status].toLowerCase()}.`);
      return queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
    },
    onError: (error) => toast('error', error.message),
  });
  const late = live && isRunningLate(booking, at) ? minutesBetween(booking.startsAt, at) : 0;
  const seatedFor = live && booking.status === 'seated' ? shortDuration(minutesBetween(booking.seatedAt ?? booking.startsAt, at)) : null;
  const next = canWrite ? hostPrimaryStep(booking, isToday) : null;
  const done = booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'no_show';
  const word = statusWord(booking.status, late, seatedFor);
  const note = booking.notes?.trim();
  // Closed, the note's first line rides on the status line; open, it's shown whole below.
  const noteLine = !expanded && note ? note.split('\n')[0] : null;

  return (
    <li id={`host-booking-${booking.id}`} className={cn('scroll-my-3 rounded-lg transition-colors', expanded && HOST_PICKED)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
          HOST_FOCUS,
          !expanded && 'hover:bg-band/40',
        )}
      >
        {/* One width for every time, so the names line up. */}
        <span className={cn('w-12 shrink-0 text-sm font-medium tabular-nums', done ? 'text-muted-foreground' : 'text-foreground')}>
          {slotOf(booking.startsAt, timeZone)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn('truncate text-base font-semibold', done ? 'text-muted-foreground' : 'text-heading')}>
              {booking.guestName}
            </span>
            <NoteMarkers notes={booking.notes} />
          </span>
          {(word || noteLine) && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {word && <span className={word.tone}>{word.text}</span>}
              {word && noteLine && ' · '}
              {noteLine}
            </span>
          )}
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums text-muted-foreground"
          aria-label={plural(booking.partySize, 'guest', 'guests')}
        >
          <Users size={14} aria-hidden="true" />
          {booking.partySize}
        </span>
        <TableChip booking={booking} muted={done} />
      </button>
      {expanded && (
        // Lined up under the name, past the time column.
        <div className="space-y-1.5 pr-2 pb-3 pl-[4.25rem] text-sm">
          {booking.customerId ? (
            <GuestFacts customerId={booking.customerId} bookingId={booking.id} at={at} />
          ) : (
            <p className="text-muted-foreground">Not linked to a customer</p>
          )}
          {booking.guestPhone && (
            <p>
              <a href={`tel:${booking.guestPhone}`} className="tabular-nums text-foreground underline-offset-4 hover:underline">
                {booking.guestPhone}
              </a>
            </p>
          )}
          {note && <p className="leading-relaxed break-words whitespace-pre-line text-foreground">{note}</p>}
          <div className="flex gap-2 pt-1.5">
            {next && (
              <Button size="touch" className="min-w-0 flex-1" disabled={step.isPending} onClick={() => step.mutate(next.status)}>
                {step.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                <span className="truncate">{next.label}</span>
              </Button>
            )}
            <Button size="touch" variant="outline" className={cn(!next && 'flex-1')} onClick={onOpen}>
              <ExternalLink size={16} aria-hidden="true" />
              Open
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** What the guest's own booking history says: visits, the last one, no-shows. A bone while it loads; a word if it can't. */
function GuestFacts({ customerId, bookingId, at }: { customerId: string; bookingId: string; at: Date }) {
  const history = useQuery({
    queryKey: moduleQueryKeys.reservations.key('customer', customerId),
    queryFn: () => getCustomerBookings(customerId),
    staleTime: 5 * 60_000,
  });
  if (history.isPending) return <Bone className="h-4 w-40" />;
  if (!history.isSuccess) return <p className="text-muted-foreground">Guest history unavailable</p>;
  const facts = guestHistory(history.data, at, bookingId);
  if (facts.visits === 0 && facts.noShows === 0) return <p className="font-medium text-foreground">First visit</p>;
  const last = facts.lastVisit ? formatCalendarDate(zonedParts(facts.lastVisit).date, { day: 'numeric', month: 'short' }) : null;
  return (
    <p className="text-foreground">
      <span className="font-medium">Returning</span>
      {facts.visits > 0 && <span className="text-muted-foreground"> · {plural(facts.visits, 'visit', 'visits')}</span>}
      {last && <span className="text-muted-foreground"> · last {last}</span>}
      {facts.noShows > 0 && <span className="font-medium text-exception"> · {plural(facts.noShows, 'no-show', 'no-shows')}</span>}
    </p>
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

/** One table's state as a line of words: "Free", "Due 19:30 · Patel", "Seated · 40m left · Patel", "Over by 10m · Patel". */
export function tableStateLine(status: FloorTableState<Booking> | undefined, live: boolean): { text: string; tone: string } {
  const timeZone = workspaceTimeZone();
  if (!status || status.state === 'free') return { text: 'Free', tone: 'text-muted-foreground' };
  const booking = status.booking!;
  if (status.state === 'upcoming') {
    const late = live && status.minutesLate > 15;
    return {
      text: `Due ${slotOf(booking.startsAt, timeZone)} · ${booking.guestName}${late ? ` · ${shortDuration(status.minutesLate)} late` : ''}`,
      tone: late ? 'text-exception' : 'text-reference',
    };
  }
  if (status.state === 'overdue')
    return { text: `Over by ${shortDuration(-(status.minutesLeft ?? 0))} · ${booking.guestName}`, tone: 'text-warning' };
  return { text: `Seated · ${shortDuration(status.minutesLeft ?? 0)} left · ${booking.guestName}`, tone: 'text-primary' };
}

/** The next booking at the table after the one it shows: "Next 20:30 · Okafor · 4". */
export function nextBookingLine(status: FloorTableState<Booking> | undefined): string | null {
  const next = status?.next;
  if (!next) return null;
  return `Next ${slotOf(next.startsAt, workspaceTimeZone())} · ${next.guestName} · ${next.partySize}`;
}

/** The table's label on a swatch in the floor's own colours (`FloorCanvas` FACE_CLASS): porcelain, periwinkle, brand, saffron. */
const TABLE_SWATCH: Record<string, string> = {
  free: 'border-edge bg-card text-heading',
  upcoming: 'border-reference/70 bg-reference/8 text-heading',
  seated: 'border-transparent text-primary-foreground',
  overdue: 'border-warning bg-warning/14 text-heading',
};

export function TableList({
  areas,
  statusById,
  live,
  selectedTableId,
  onChoose,
}: {
  areas: { areaName: string; tables: FloorTable[] }[];
  statusById: Map<string, FloorTableState<Booking>>;
  live: boolean;
  selectedTableId: string | null;
  onChoose: (id: string) => void;
}) {
  // A table chosen on the floor scrolls into view.
  useEffect(() => {
    if (!selectedTableId) return;
    document.getElementById(`host-table-${selectedTableId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedTableId]);

  const shown = areas.filter((area) => area.tables.length > 0);
  if (shown.length === 0) return <EmptyState compact icon={LayoutGrid} title="No tables" description="Draw them in Floor plan." />;
  return (
    <div className="space-y-4">
      {shown.map((area) => {
        const free = area.tables.filter((table) => (statusById.get(table.id)?.state ?? 'free') === 'free').length;
        return (
          <section key={area.areaName} aria-label={area.areaName}>
            <GroupTitle title={shown.length > 1 ? area.areaName : 'Tables'} count={area.tables.length} aside={`${free} free`} />
            <ul className="space-y-0.5">
              {[...area.tables]
                .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
                .map((table) => {
                  const status = statusById.get(table.id);
                  const state = status?.state ?? 'free';
                  const line = tableStateLine(status, live);
                  const next = nextBookingLine(status);
                  const selected = table.id === selectedTableId;
                  const attention =
                    status?.attention === 'too_big' ? 'Party bigger than the table' : status?.attention ? 'Not confirmed' : null;
                  return (
                    <li key={table.id} id={`host-table-${table.id}`} className="scroll-my-3">
                      <button
                        type="button"
                        onClick={() => onChoose(table.id)}
                        aria-pressed={selected}
                        className={cn(
                          'flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                          HOST_FOCUS,
                          selected ? HOST_PICKED : 'hover:bg-band/40',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-10 max-w-20 min-w-12 shrink-0 items-center justify-center rounded-md border-[1.5px] px-1.5 text-sm font-semibold tabular-nums',
                            TABLE_SWATCH[state],
                          )}
                          style={state === 'seated' ? { background: 'var(--brand-fill, var(--primary))' } : undefined}
                        >
                          <span className="truncate">{table.label}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm font-medium', line.tone)}>{line.text}</span>
                          {next && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{next}</span>}
                        </span>
                        {attention && (
                          <span
                            role="img"
                            aria-label={attention}
                            title={attention}
                            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-measured text-[11px] font-bold text-card"
                          >
                            ?
                          </span>
                        )}
                        <span
                          className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-muted-foreground"
                          aria-label={`Seats ${table.maxCovers}`}
                        >
                          <Users size={14} aria-hidden="true" />
                          {table.maxCovers}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
