// ─── The live floor ───────────────────────────────────────────────────────────
//
// What each table is doing at a moment, for the host stand: free, a party due
// (and whether they're late), seated with how much of their stay is used, or
// seated past it. Also the day's bookings grouped the way the host panel lists
// them, and the floor's tables and covers in use. Free of React so it's tested.
// Relative, not aliased: node's type stripping resolves value imports for real.
import { type BookingLike, type FloorTable, type ReservationStatus, bookingActions, isLive, isRunningLate } from './reservations.ts';

/** What the floor reads of a booking — the list fields plus when they sat down. */
export type FloorBooking = BookingLike & { seatedAt?: string | null; completedAt?: string | null };

export type FloorState =
  /** Nothing on it now, and nothing due within the hour. */
  | 'free'
  /** A party is due within the hour — or their time has come and they aren't seated yet. */
  | 'upcoming'
  /** A party is at it, inside their stay. */
  | 'seated'
  /** A party is at it, past the end of their stay. */
  | 'overdue';

/** Why a table wants a look: the booking isn't confirmed, or the party is bigger than its tables seat. */
export type FloorAttention = 'unconfirmed' | 'too_big' | null;

export interface FloorTableState<B extends FloorBooking = FloorBooking> {
  state: FloorState;
  /** The booking behind the state; null when free. */
  booking: B | null;
  /** The next booking to start after this moment, other than `booking`. */
  next: B | null;
  /** Seated or over: the share of the stay used, 0 to 1. */
  progress: number | null;
  /** Seated or over: minutes until they're due to leave — negative once over. */
  minutesLeft: number | null;
  /** Upcoming: minutes since the booking's start, 0 while it's still ahead. */
  minutesLate: number;
  attention: FloorAttention;
  /** The other tables the booking holds — tables put together. */
  joined: string[];
}

type TableSeats = Pick<FloorTable, 'id' | 'maxCovers'>;

const MINUTE = 60_000;
const time = (instant: string) => new Date(instant).getTime();
/** When the party sat down — or, without a record of it, their booked start. */
const seatedFrom = (booking: FloorBooking) => time(booking.seatedAt ?? booking.startsAt);

/**
 * One table at one moment. A seated party counts from when they sat down, for
 * as long as they booked (`endsAt − startsAt`); past that they're over. A party
 * not yet seated shows from an hour before their start until their booked end,
 * with how late they are. `tables` gives the seats of every table, so a party
 * on tables put together is measured against all of them.
 */
export function floorTableState<B extends FloorBooking>(
  table: TableSeats,
  bookings: readonly B[],
  at: Date,
  options: { tables?: readonly TableSeats[]; soonMinutes?: number } = {},
): FloorTableState<B> {
  const now = at.getTime();
  const soon = (options.soonMinutes ?? 60) * MINUTE;
  const mine = bookings.filter((booking) => isLive(booking.status) && booking.tables.some((held) => held.id === table.id));

  const seated =
    mine.filter((booking) => booking.status === 'seated' && seatedFrom(booking) <= now).sort((a, b) => seatedFrom(a) - seatedFrom(b))[0] ??
    null;
  // Not seated at this moment: still to come, or (looking back) seated later.
  const waiting = mine
    .filter((booking) => booking !== seated && time(booking.endsAt) > now && (booking.status !== 'seated' || seatedFrom(booking) > now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const due = seated ? null : (waiting.find((booking) => time(booking.startsAt) - now <= soon) ?? null);
  const booking = seated ?? due;
  const next = waiting.find((candidate) => candidate !== booking && time(candidate.startsAt) > now) ?? null;

  const seatsOf = (held: B) => {
    const known = options.tables ?? [];
    return held.tables.reduce(
      (sum, ref) => sum + (known.find((candidate) => candidate.id === ref.id)?.maxCovers ?? (ref.id === table.id ? table.maxCovers : 0)),
      0,
    );
  };
  const attention: FloorAttention = !booking
    ? null
    : booking.partySize > seatsOf(booking)
      ? 'too_big'
      : booking === due && booking.status === 'booked'
        ? 'unconfirmed'
        : null;
  const joined = booking ? booking.tables.map((ref) => ref.id).filter((id) => id !== table.id) : [];

  if (seated) {
    const from = seatedFrom(seated);
    const stay = Math.max(0, time(seated.endsAt) - time(seated.startsAt));
    const dueOut = from + stay;
    return {
      state: now >= dueOut ? 'overdue' : 'seated',
      booking: seated,
      next,
      progress: stay === 0 ? 1 : Math.min(1, Math.max(0, (now - from) / stay)),
      minutesLeft: Math.round((dueOut - now) / MINUTE),
      minutesLate: 0,
      attention,
      joined,
    };
  }
  if (due) {
    return {
      state: 'upcoming',
      booking: due,
      next,
      progress: null,
      minutesLeft: null,
      minutesLate: Math.max(0, Math.floor((now - time(due.startsAt)) / MINUTE)),
      attention,
      joined,
    };
  }
  return { state: 'free', booking: null, next, progress: null, minutesLeft: null, minutesLate: 0, attention: null, joined: [] };
}

export interface FloorUsage {
  tables: number;
  tablesTotal: number;
  covers: number;
  coversTotal: number;
}

/**
 * Tables and covers in use at a moment, against what the floor holds. A table
 * is in use when a party is at it, or when a party's time has come and the
 * table is held for them. Covers are counted once per booking, however many
 * tables it holds.
 */
export function floorUsage(tables: readonly TableSeats[], bookings: readonly FloorBooking[], at: Date): FloorUsage {
  const inUse = new Set<FloorBooking>();
  let used = 0;
  for (const table of tables) {
    const status = floorTableState(table, bookings, at, { tables });
    if (status.state === 'free' || (status.state === 'upcoming' && time(status.booking!.startsAt) > at.getTime())) continue;
    used += 1;
    inUse.add(status.booking!);
  }
  return {
    tables: used,
    tablesTotal: tables.length,
    covers: [...inUse].reduce((sum, booking) => sum + booking.partySize, 0),
    coversTotal: tables.reduce((sum, table) => sum + table.maxCovers, 0),
  };
}

// ─── The host panel's sections ────────────────────────────────────────────────

export type HostSectionId = 'arriving' | 'seated' | 'departed' | 'cancelled' | 'no_show';

export interface HostSection<B extends FloorBooking = FloorBooking> {
  id: HostSectionId;
  bookings: B[];
  /** Bookings in the section. */
  parties: number;
  /** Guests across them. */
  guests: number;
}

/** Whether a section starts open: the two the host works from. */
export const HOST_SECTION_OPEN: Record<HostSectionId, boolean> = {
  arriving: true,
  seated: true,
  departed: false,
  cancelled: false,
  no_show: false,
};

/**
 * The day's bookings as the host panel lists them: arriving (soonest first),
 * seated (longest there first), then departed, cancelled and no-shows. Every
 * section is returned, empty or not, in that order.
 */
export function hostSections<B extends FloorBooking>(bookings: readonly B[]): HostSection<B>[] {
  const byStart = (a: B, b: B) => a.startsAt.localeCompare(b.startsAt);
  const pick: Record<HostSectionId, B[]> = {
    arriving: bookings.filter((booking) => booking.status === 'booked' || booking.status === 'confirmed').sort(byStart),
    seated: bookings.filter((booking) => booking.status === 'seated').sort((a, b) => seatedFrom(a) - seatedFrom(b)),
    departed: bookings.filter((booking) => booking.status === 'completed').sort(byStart),
    cancelled: bookings.filter((booking) => booking.status === 'cancelled').sort(byStart),
    no_show: bookings.filter((booking) => booking.status === 'no_show').sort(byStart),
  };
  return (Object.keys(pick) as HostSectionId[]).map((id) => ({
    id,
    bookings: pick[id],
    parties: pick[id].length,
    guests: pick[id].reduce((sum, booking) => sum + booking.partySize, 0),
  }));
}

export type HostGroupId = 'late' | 'next' | 'seated' | 'done';

export interface HostGroup<B extends FloorBooking = FloorBooking> {
  id: HostGroupId;
  bookings: B[];
  parties: number;
  guests: number;
}

/**
 * The day's bookings in the order a host works them: late (still not here,
 * more than 15 minutes past their time — only while the floor follows the
 * clock; longest overdue first), next (still to come, soonest first), seated
 * (longest there first), then done — finished, no-shows and cancelled
 * together, by start. Every group is returned, empty or not, in that order.
 */
export function hostGroups<B extends FloorBooking>(bookings: readonly B[], clock: { now: Date; isToday: boolean }): HostGroup<B>[] {
  const byStart = (a: B, b: B) => a.startsAt.localeCompare(b.startsAt);
  const toCome = bookings.filter((booking) => booking.status === 'booked' || booking.status === 'confirmed').sort(byStart);
  const late = clock.isToday ? toCome.filter((booking) => isRunningLate(booking, clock.now)) : [];
  const pick: Record<HostGroupId, B[]> = {
    late,
    next: toCome.filter((booking) => !late.includes(booking)),
    seated: bookings.filter((booking) => booking.status === 'seated').sort((a, b) => seatedFrom(a) - seatedFrom(b)),
    done: bookings
      .filter((booking) => booking.status === 'completed' || booking.status === 'no_show' || booking.status === 'cancelled')
      .sort(byStart),
  };
  return (Object.keys(pick) as HostGroupId[]).map((id) => ({
    id,
    bookings: pick[id],
    parties: pick[id].length,
    guests: pick[id].reduce((sum, booking) => sum + booking.partySize, 0),
  }));
}

/** "4m", "1h 05" — how long, as the host panel shows it. */
export function shortDuration(minutes: number): string {
  const whole = Math.max(0, Math.floor(minutes));
  if (whole < 60) return `${whole}m`;
  return `${Math.floor(whole / 60)}h ${String(whole % 60).padStart(2, '0')}`;
}

// ─── A returning guest ────────────────────────────────────────────────────────

export interface GuestHistory {
  /** Past bookings they came to and finished. */
  visits: number;
  noShows: number;
  /** When they last came, or null. */
  lastVisit: string | null;
}

/**
 * What the host can say about a guest from their own bookings (the customer's
 * booking list): visits finished before this moment, no-shows, and the last
 * visit. The booking in hand is left out.
 */
export function guestHistory(
  bookings: readonly Pick<FloorBooking, 'id' | 'status' | 'startsAt'>[],
  at: Date,
  excludeId?: string,
): GuestHistory {
  const past = bookings.filter((booking) => booking.id !== excludeId && time(booking.startsAt) < at.getTime());
  const visits = past.filter((booking) => booking.status === 'completed');
  return {
    visits: visits.length,
    noShows: past.filter((booking) => booking.status === 'no_show').length,
    lastVisit:
      visits
        .map((booking) => booking.startsAt)
        .sort()
        .at(-1) ?? null,
  };
}

// ─── The host's one step ──────────────────────────────────────────────────────

export interface HostStep {
  status: ReservationStatus;
  label: string;
}

/**
 * The one step a booking row offers when it's opened at the host stand: seat
 * them (today only, naming the tables: "Seat at T7+T8"), confirm a booking on
 * another day, mark a seated party left, or bring back a cancelled one or a
 * no-show. Null when there's nothing to do from the row — the drawer has the
 * rest. Only steps `bookingActions` allows are ever offered.
 */
export function hostPrimaryStep(booking: Pick<FloorBooking, 'status' | 'tables'>, isToday: boolean): HostStep | null {
  const allowed = bookingActions(booking.status);
  const can = (status: ReservationStatus) => allowed.some((action) => action.status === status);
  if (booking.status === 'booked' || booking.status === 'confirmed') {
    if (isToday && can('seated')) {
      const label = booking.tables.map((table) => table.label).join('+');
      return { status: 'seated', label: label ? `Seat at ${label}` : 'Seat' };
    }
    return booking.status === 'booked' && can('confirmed') ? { status: 'confirmed', label: 'Confirm' } : null;
  }
  if (booking.status === 'seated') return can('completed') ? { status: 'completed', label: 'Mark left' } : null;
  if (booking.status === 'cancelled' || booking.status === 'no_show') return can('booked') ? { status: 'booked', label: 'Restore' } : null;
  return null;
}

// ─── Seating a free table from the waitlist ──────────────────────────────────

/**
 * The parties still waiting, for a free table: those the table seats first
 * (between its smallest party and its seats), then the rest — each group
 * longest wait first. Parties already seated or gone are left out; a party
 * told it's ready still counts as waiting.
 */
export function waitlistForTable<E extends { partySize: number; createdAt: string; status: string }>(
  entries: readonly E[],
  table: Pick<FloorTable, 'minCovers' | 'maxCovers'>,
): { entry: E; fits: boolean }[] {
  return entries
    .filter((entry) => entry.status === 'waiting' || entry.status === 'notified')
    .map((entry) => ({ entry, fits: entry.partySize >= table.minCovers && entry.partySize <= table.maxCovers }))
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.entry.createdAt.localeCompare(b.entry.createdAt));
}
