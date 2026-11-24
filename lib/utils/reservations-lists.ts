// ─── Reservations lists ───────────────────────────────────────────────────────
//
// What the Bookings and Waitlist tabs show: the figures over each list, the
// views their Show select and figures pick, the search, and the bookings'
// time-of-day groups. Kept free of React so it can be tested.
// Relative, not aliased: `node --experimental-strip-types` resolves value
// imports for real and does not know `@/`.
import { bookingMarkers } from './booking-markers.ts';
import { type BookingLike, type WaitlistStatus, isLive, isRunningLate, minutesBetween, waitTone } from './reservations.ts';
import { zonedParts } from './workspace-time.ts';

// ─── Bookings ────────────────────────────────────────────────────────────────

/** What the bookings list reads of a booking, on top of what the floor needs. */
export interface ListedBooking extends BookingLike {
  guestPhone?: string | null;
  guestEmail?: string | null;
  notes?: string | null;
}

export type BookingsView = 'all' | 'to_come' | 'seated' | 'late' | 'unconfirmed' | 'no_table' | 'finished' | 'no_show' | 'cancelled';

export const BOOKINGS_VIEW_LABELS: Record<BookingsView, string> = {
  all: 'All bookings',
  to_come: 'Still to come',
  seated: 'Seated',
  late: 'Running late',
  unconfirmed: 'Not confirmed',
  no_table: 'Without a table',
  finished: 'Finished',
  no_show: 'No-shows',
  cancelled: 'Cancelled',
};

/** The moment the list is read at, and whether the day shown is today — lateness only means something today. */
export interface BookingsClock {
  now: Date;
  isToday: boolean;
}

const toCome = (booking: BookingLike) => booking.status === 'booked' || booking.status === 'confirmed';

export function inBookingsView(booking: BookingLike, view: BookingsView, clock: BookingsClock): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'to_come':
      return toCome(booking);
    case 'seated':
      return booking.status === 'seated';
    case 'late':
      return clock.isToday && isRunningLate(booking, clock.now);
    case 'unconfirmed':
      return booking.status === 'booked';
    case 'no_table':
      return isLive(booking.status) && booking.tables.length === 0;
    case 'finished':
      return booking.status === 'completed';
    case 'no_show':
      return booking.status === 'no_show';
    case 'cancelled':
      return booking.status === 'cancelled';
  }
}

const digits = (value: string) => value.replace(/\D/g, '');

/** Name, phone, email, note or table — a phone matches on its digits, however it was typed. */
export function matchesBookingSearch(booking: ListedBooking, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const words = [booking.guestName, booking.guestEmail ?? '', booking.notes ?? '', ...booking.tables.map((table) => table.label)];
  if (words.some((word) => word.toLowerCase().includes(term))) return true;
  const number = digits(term);
  return number.length >= 3 && digits(booking.guestPhone ?? '').includes(number);
}

export function filterBookings<T extends ListedBooking>(
  bookings: readonly T[],
  { view, search }: { view: BookingsView; search: string },
  clock: BookingsClock,
): T[] {
  return bookings.filter((booking) => inBookingsView(booking, view, clock) && matchesBookingSearch(booking, search));
}

export interface BookingsOverview {
  /** Not cancelled. */
  bookings: number;
  /** Guests expected or in: neither cancelled nor a no-show. */
  covers: number;
  toCome: number;
  seated: number;
  /** Live and without a table. */
  noTable: number;
  late: number;
  /** Booked, not yet confirmed, and still ahead or due. */
  unconfirmed: number;
}

export function bookingsOverview(bookings: readonly BookingLike[], clock: BookingsClock): BookingsOverview {
  const counted = bookings.filter((booking) => booking.status !== 'cancelled');
  const count = (view: BookingsView) => bookings.filter((booking) => inBookingsView(booking, view, clock)).length;
  return {
    bookings: counted.length,
    covers: counted.filter((booking) => booking.status !== 'no_show').reduce((sum, booking) => sum + booking.partySize, 0),
    toCome: count('to_come'),
    seated: count('seated'),
    noTable: count('no_table'),
    late: count('late'),
    unconfirmed: count('unconfirmed'),
  };
}

/** Bookings late enough to chase, the longest overdue first — today only. */
export function lateBookings<T extends BookingLike>(bookings: readonly T[], clock: BookingsClock): T[] {
  if (!clock.isToday) return [];
  return bookings.filter((booking) => isRunningLate(booking, clock.now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** The host panel's quick filters: one at a time, as a host stand's list offers them. */
export type HostFilter = 'unconfirmed' | 'allergy';

export const HOST_FILTER_LABELS: Record<HostFilter, string> = { unconfirmed: 'Not confirmed', allergy: 'Allergies' };

/**
 * Whether a booking is in the host's quick filter: booked and not yet
 * confirmed (a booking still to come — nothing to confirm once it's over), or
 * notes that mention an allergy. No filter lets everything through.
 */
export function inHostFilter(booking: ListedBooking, filter: HostFilter | null): boolean {
  if (filter === 'unconfirmed') return booking.status === 'booked';
  if (filter === 'allergy') return Boolean(bookingMarkers(booking.notes)?.allergy);
  return true;
}

export type DayPart = 'morning' | 'afternoon' | 'evening';
export const DAY_PART_LABELS: Record<DayPart, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

/** Before noon, before five, or after — by the booking's start in the zone. */
export function dayPartOf(instant: string, timeZone?: string): DayPart {
  const hour = Number(zonedParts(instant, timeZone).time.slice(0, 2));
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * The list's groups: live and finished bookings by time of day, in start
 * order, then cancelled ones together at the foot. Empty groups are left out.
 */
export function groupBookings<T extends BookingLike>(
  bookings: readonly T[],
  timeZone?: string,
): { key: DayPart | 'cancelled'; title: string; covers: number; bookings: T[] }[] {
  const sorted = [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const parts: DayPart[] = ['morning', 'afternoon', 'evening'];
  const groups = parts.map((part) => {
    const items = sorted.filter((booking) => booking.status !== 'cancelled' && dayPartOf(booking.startsAt, timeZone) === part);
    return {
      key: part as DayPart | 'cancelled',
      title: DAY_PART_LABELS[part],
      covers: items.filter((booking) => booking.status !== 'no_show').reduce((sum, booking) => sum + booking.partySize, 0),
      bookings: items,
    };
  });
  const cancelled = sorted.filter((booking) => booking.status === 'cancelled');
  return [...groups, { key: 'cancelled' as const, title: 'Cancelled', covers: 0, bookings: cancelled }].filter(
    (group) => group.bookings.length > 0,
  );
}

// ─── Waitlist ────────────────────────────────────────────────────────────────

export interface ListedWaitlistEntry {
  guestName: string;
  guestPhone: string | null;
  partySize: number;
  quotedWaitMinutes: number | null;
  status: WaitlistStatus;
  notes: string | null;
  createdAt: string;
}

/** Waited longer than they were told. */
export const isOverQuote = (entry: ListedWaitlistEntry, now: Date) =>
  waitTone(minutesBetween(entry.createdAt, now), entry.quotedWaitMinutes) === 'over';

export function matchesWaitlistSearch(entry: ListedWaitlistEntry, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  if (entry.guestName.toLowerCase().includes(term) || (entry.notes ?? '').toLowerCase().includes(term)) return true;
  const number = digits(term);
  return number.length >= 3 && digits(entry.guestPhone ?? '').includes(number);
}

/**
 * The waitlist as the host panel groups it: parties told their table is ready
 * (the next to seat), then those still waiting — each longest wait first.
 * Parties seated or gone are left out.
 */
export function waitlistGroups<E extends ListedWaitlistEntry>(entries: readonly E[]): { ready: E[]; waiting: E[] } {
  const longestFirst = (a: E, b: E) => a.createdAt.localeCompare(b.createdAt);
  return {
    ready: entries.filter((entry) => entry.status === 'notified').sort(longestFirst),
    waiting: entries.filter((entry) => entry.status === 'waiting').sort(longestFirst),
  };
}

export interface WaitlistOverview {
  parties: number;
  guests: number;
  /** Minutes the longest-waiting party has waited; 0 with nobody waiting. */
  longest: number;
  notified: number;
  over: number;
}

export function waitlistOverview(entries: readonly ListedWaitlistEntry[], now: Date): WaitlistOverview {
  return {
    parties: entries.length,
    guests: entries.reduce((sum, entry) => sum + entry.partySize, 0),
    longest: entries.reduce((max, entry) => Math.max(max, minutesBetween(entry.createdAt, now)), 0),
    notified: entries.filter((entry) => entry.status === 'notified').length,
    over: entries.filter((entry) => isOverQuote(entry, now)).length,
  };
}

// ─── The page's tabs ─────────────────────────────────────────────────────────

/** Reservations' tabs: the overview, the host stand, the floor plan editor and the booking rules. */
export type ReservationsTab = 'overview' | 'host' | 'plan' | 'rules';
/** The host stand's left panel. */
export type HostPanelTab = 'bookings' | 'waitlist' | 'tables';

/**
 * Which tab a `?tab=` lands on. The page opens on the overview. Bookings, Floor
 * and Waitlist were tabs of their own until they became the host stand; their
 * old links still land there, with the panel on the matching list. The floor
 * plan and the rules need their capability — without it they fall back to the
 * overview rather than show a page whose saves would all be refused.
 */
export function resolveReservationsTab(
  requested: string | null,
  access: { canDrawFloor: boolean; canSetRules: boolean },
): { tab: ReservationsTab; panel: HostPanelTab } {
  switch (requested) {
    case 'host':
    case 'bookings':
    case 'floor':
      return { tab: 'host', panel: 'bookings' };
    case 'waitlist':
      return { tab: 'host', panel: 'waitlist' };
    case 'plan':
      return { tab: access.canDrawFloor ? 'plan' : 'overview', panel: 'bookings' };
    case 'rules':
      return { tab: access.canSetRules ? 'rules' : 'overview', panel: 'bookings' };
    default:
      return { tab: 'overview', panel: 'bookings' };
  }
}
