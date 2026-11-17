// ─── Reservations overview ────────────────────────────────────────────────────
//
// The figures on the manager's Overview tab: today at a glance, covers over the
// next seven days split into lunch and dinner, service quality and the busiest
// hours over the last thirty days, and who the guests are. Every day and hour
// is read in the given zone (the workspace's), so a week across a clock change
// still has seven days and 19:00 stays 19:00. Free of React so it's tested.
//
// Which bookings count, per figure — the one rule each metric follows:
//   · covers (today, next 7 days, the heat grid) — neither cancelled nor a
//     no-show: the guests who came or are still expected
//   · rates — no-shows over bookings that could no-show (not cancelled, not a
//     walk-in); cancellations over every booking that wasn't a walk-in
//   · time at the table — completed bookings with both `seatedAt` and a later
//     `completedAt`
//   · lateness — seated or completed bookings with `seatedAt`, not walk-ins
//     (a walk-in is seated as it's taken); only positive gaps are averaged
//   · source, repeat guests, party sizes — every booking but a cancelled one
//
// Relative, not aliased: node's type stripping resolves value imports for real.
import { type BookingSource, type FloorTable, type ReservationStatus, addDays } from './reservations.ts';
import { zonedParts, zonedToInstant } from './workspace-time.ts';

/** What the overview reads of a booking — the API's `Booking`, minus what it doesn't use. */
export interface StatsBooking {
  id: string;
  guestName: string;
  customerId: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  source: BookingSource;
  seatedAt: string | null;
  completedAt: string | null;
  tables: { id: string; label: string }[];
}

/** Full days looked back over, not counting today. */
export const PAST_DAYS = 30;
/** Days looked ahead over, today included. */
export const AHEAD_DAYS = 7;
/** Lunch is a booking starting before this local hour; dinner from it on. */
export const DINNER_FROM_HOUR = 16;
/** A service is busy once its covers reach this share of the floor's seats — one full sitting. */
export const BUSY_SHARE = 0.8;
/** The bookings endpoint returns at most this many; reaching it means the range was cut short. */
export const BOOKINGS_LIMIT = 2000;

const MINUTE = 60_000;
const time = (instant: string) => new Date(instant).getTime();

/** Guests who came or are still expected. */
export const countsAsCovers = (booking: Pick<StatsBooking, 'status'>) => booking.status !== 'cancelled' && booking.status !== 'no_show';
const notCancelled = (booking: Pick<StatsBooking, 'status'>) => booking.status !== 'cancelled';
const sumCovers = (bookings: readonly Pick<StatsBooking, 'partySize'>[]) => bookings.reduce((sum, booking) => sum + booking.partySize, 0);

// ─── The range ────────────────────────────────────────────────────────────────

export interface OverviewRange {
  /** The instant the range starts: local midnight `PAST_DAYS` days ago. */
  from: string;
  /** The instant it ends: local midnight after the last day ahead. */
  to: string;
  /** First and last calendar days looked back over. */
  pastFirst: string;
  pastLast: string;
  /** Today and the following days, `AHEAD_DAYS` in all. */
  ahead: string[];
}

/** The one bookings call the overview makes: 30 full days back to 7 days ahead, in the zone (37 days, under the API's 62). */
export function overviewRange(today: string, timeZone?: string): OverviewRange {
  const pastFirst = addDays(today, -PAST_DAYS);
  const from = zonedToInstant(pastFirst, '00:00', timeZone);
  const to = zonedToInstant(addDays(today, AHEAD_DAYS), '00:00', timeZone);
  if (!from || !to) throw new Error(`Not a calendar date: ${today}`);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    pastFirst,
    pastLast: addDays(today, -1),
    ahead: Array.from({ length: AHEAD_DAYS }, (_, index) => addDays(today, index)),
  };
}

/** The calendar day a booking starts on, in the zone. */
export const localDay = (instant: string, timeZone?: string) => zonedParts(instant, timeZone).date;

/** The range's bookings by when they start: the last 30 days, today, and today onward (the next 7 days). */
export function splitBookings<B extends StatsBooking>(
  bookings: readonly B[],
  today: string,
  timeZone?: string,
): { past: B[]; today: B[]; ahead: B[] } {
  const past: B[] = [];
  const todays: B[] = [];
  const ahead: B[] = [];
  for (const booking of bookings) {
    const day = localDay(booking.startsAt, timeZone);
    if (day < today) past.push(booking);
    else {
      ahead.push(booking);
      if (day === today) todays.push(booking);
    }
  }
  return { past, today: todays, ahead };
}

// ─── Today ────────────────────────────────────────────────────────────────────

export interface TodayGlance {
  /** Covers expected today: neither cancelled nor a no-show. */
  coversBooked: number;
  /** Of those, the covers seated so far — seated now or finished. */
  coversSeated: number;
  /** Booked or confirmed, not yet seated (late ones included). */
  toCome: number;
  toComeCovers: number;
  /** Walk-ins taken today, not cancelled. */
  walkIns: number;
  walkInCovers: number;
  noShows: number;
  noShowCovers: number;
}

export function todayGlance(bookings: readonly StatsBooking[]): TodayGlance {
  const toCome = bookings.filter((booking) => booking.status === 'booked' || booking.status === 'confirmed');
  const walkIns = bookings.filter((booking) => booking.source === 'walk_in' && notCancelled(booking));
  const noShows = bookings.filter((booking) => booking.status === 'no_show');
  return {
    coversBooked: sumCovers(bookings.filter(countsAsCovers)),
    coversSeated: sumCovers(bookings.filter((booking) => booking.status === 'seated' || booking.status === 'completed')),
    toCome: toCome.length,
    toComeCovers: sumCovers(toCome),
    walkIns: walkIns.length,
    walkInCovers: sumCovers(walkIns),
    noShows: noShows.length,
    noShowCovers: sumCovers(noShows),
  };
}

/** Booked but not confirmed, and not over yet — the ones to ring today and tonight. */
export function unconfirmedToday<B extends StatsBooking>(bookings: readonly B[], now: Date): B[] {
  return bookings.filter((booking) => booking.status === 'booked' && time(booking.endsAt) > now.getTime());
}

/**
 * Live bookings whose party is bigger than the tables they hold seat. A
 * booking without a table, or on a table no longer on the floor plan, can't be
 * judged and is left out.
 */
export function overCapacity<B extends StatsBooking>(bookings: readonly B[], tables: readonly Pick<FloorTable, 'id' | 'maxCovers'>[]): B[] {
  const seats = new Map(tables.map((table) => [table.id, table.maxCovers]));
  return bookings.filter((booking) => {
    if (!['booked', 'confirmed', 'seated'].includes(booking.status) || booking.tables.length === 0) return false;
    if (booking.tables.some((table) => !seats.has(table.id))) return false;
    return booking.partySize > booking.tables.reduce((sum, table) => sum + seats.get(table.id)!, 0);
  });
}

// ─── The next seven days ──────────────────────────────────────────────────────

export interface DayCovers {
  date: string;
  /** Covers booked to start before `DINNER_FROM_HOUR`. */
  lunch: number;
  dinner: number;
  total: number;
  bookings: number;
  /** Either service reaches `BUSY_SHARE` of the floor's seats. */
  busy: boolean;
  /** The day with the most covers (the first, on a tie); never a day with none. */
  peak: boolean;
}

export const isDinner = (instant: string, timeZone?: string) => zonedParts(instant, timeZone).hour >= DINNER_FROM_HOUR;

/** Covers per day for `days`, split into lunch and dinner. `seats` is the floor's total; 0 flags nothing busy. */
export function coversByDay(bookings: readonly StatsBooking[], days: readonly string[], seats: number, timeZone?: string): DayCovers[] {
  const rows = days.map((date) => ({ date, lunch: 0, dinner: 0, total: 0, bookings: 0, busy: false, peak: false }));
  const byDate = new Map(rows.map((row) => [row.date, row]));
  for (const booking of bookings) {
    if (!countsAsCovers(booking)) continue;
    const row = byDate.get(localDay(booking.startsAt, timeZone));
    if (!row) continue;
    if (isDinner(booking.startsAt, timeZone)) row.dinner += booking.partySize;
    else row.lunch += booking.partySize;
    row.total += booking.partySize;
    row.bookings += 1;
  }
  const threshold = seats * BUSY_SHARE;
  let peak: DayCovers | null = null;
  for (const row of rows) {
    row.busy = seats > 0 && (row.lunch >= threshold || row.dinner >= threshold);
    if (row.total > 0 && (!peak || row.total > peak.total)) peak = row;
  }
  if (peak) peak.peak = true;
  return rows;
}

// ─── Service quality ──────────────────────────────────────────────────────────

/** The middle value — the mean of the two middle ones for an even count; null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const mean = (values: readonly number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export interface ServiceQuality {
  /** Mean minutes from seated to finished; null with no finished stay on record. */
  averageStayMinutes: number | null;
  staysMeasured: number;
  /** Table uses by finished parties per table per day — a party on two tables turns both. Null without tables. */
  turnsPerTableDay: number | null;
  /** Of the parties seated with a booking, those who sat down after their booked time. */
  lateness: { late: number; measured: number; medianMinutes: number | null; averageMinutes: number | null };
  /** No-shows over bookings that could have been one: not cancelled, not walk-ins. */
  noShowRate: number | null;
  noShows: number;
  expected: number;
  /** Cancellations over every booking that wasn't a walk-in. */
  cancellationRate: number | null;
  cancelled: number;
  booked: number;
}

/** The last `days` days' service, read from the bookings that started in them. */
export function serviceQuality(bookings: readonly StatsBooking[], tableCount: number, days: number): ServiceQuality {
  const stays = bookings
    .filter((booking) => booking.status === 'completed' && booking.seatedAt && booking.completedAt)
    .map((booking) => (time(booking.completedAt!) - time(booking.seatedAt!)) / MINUTE)
    .filter((minutes) => minutes > 0);

  const tableUses = bookings.filter((booking) => booking.status === 'completed').reduce((sum, booking) => sum + booking.tables.length, 0);

  const seatedWithBooking = bookings.filter(
    (booking) => (booking.status === 'seated' || booking.status === 'completed') && booking.seatedAt && booking.source !== 'walk_in',
  );
  const lateBy = seatedWithBooking
    .map((booking) => (time(booking.seatedAt!) - time(booking.startsAt)) / MINUTE)
    .filter((minutes) => minutes > 0);

  const booked = bookings.filter((booking) => booking.source !== 'walk_in');
  const expected = booked.filter(notCancelled);
  const noShows = expected.filter((booking) => booking.status === 'no_show').length;
  const cancelled = booked.length - expected.length;

  return {
    averageStayMinutes: mean(stays),
    staysMeasured: stays.length,
    turnsPerTableDay: tableCount > 0 && days > 0 ? tableUses / tableCount / days : null,
    lateness: { late: lateBy.length, measured: seatedWithBooking.length, medianMinutes: median(lateBy), averageMinutes: mean(lateBy) },
    noShowRate: rate(noShows, expected.length),
    noShows,
    expected: expected.length,
    cancellationRate: rate(cancelled, booked.length),
    cancelled,
    booked: booked.length,
  };
}

// ─── Busiest hours ────────────────────────────────────────────────────────────

/** Monday first, as the week reads in the UK. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Covers by weekday (Monday = 0) and the local hour the booking starts in: 7 rows of 24. */
export function coversHeatGrid(bookings: readonly StatsBooking[], timeZone?: string): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const booking of bookings) {
    if (!countsAsCovers(booking)) continue;
    const parts = zonedParts(booking.startsAt, timeZone);
    grid[(parts.weekday + 6) % 7]![parts.hour]! += booking.partySize;
  }
  return grid;
}

/**
 * The hours worth drawing: from the first hour with covers on any day to the
 * last, widened evenly to at least `minimum` (and kept within the day). Null
 * when the grid is empty.
 */
export function busyHourSpan(grid: readonly number[][], minimum = 8): { from: number; to: number } | null {
  const used = Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => grid.some((row) => (row[hour] ?? 0) > 0));
  if (used.length === 0) return null;
  let from = used[0]!;
  let to = used.at(-1)!;
  while (to - from + 1 < minimum && (from > 0 || to < 23)) {
    if (to < 23) to += 1;
    if (to - from + 1 < minimum && from > 0) from -= 1;
  }
  return { from, to };
}

// ─── Guests ───────────────────────────────────────────────────────────────────

export const SOURCE_ORDER: readonly BookingSource[] = ['online', 'phone', 'walk_in', 'other'];

export interface Share<K extends string> {
  key: K;
  bookings: number;
  /** Of every counted booking, 0 to 1; 0 when there are none. */
  share: number;
}

/** Bookings by where they came from, cancelled ones left out, always in the same order. */
export function sourceMix(bookings: readonly StatsBooking[]): Share<BookingSource>[] {
  const counted = bookings.filter(notCancelled);
  return SOURCE_ORDER.map((key) => {
    const count = counted.filter((booking) => booking.source === key).length;
    return { key, bookings: count, share: counted.length ? count / counted.length : 0 };
  });
}

export interface RepeatGuests {
  /** Bookings by a customer record seen on more than one booking in the range. */
  repeatBookings: number;
  /** Customers behind those bookings. */
  returningGuests: number;
  /** Bookings linked to any customer record. */
  linked: number;
  /** Every counted booking. */
  total: number;
  /** `repeatBookings / total`; null with no bookings. */
  share: number | null;
}

/** Returning guests over the range: only bookings linked to a customer record can be recognised. Cancelled ones don't count. */
export function repeatGuests(bookings: readonly StatsBooking[]): RepeatGuests {
  const counted = bookings.filter(notCancelled);
  const seen = new Map<string, number>();
  for (const booking of counted) if (booking.customerId) seen.set(booking.customerId, (seen.get(booking.customerId) ?? 0) + 1);
  const returning = [...seen.values()].filter((count) => count > 1);
  const repeatBookings = returning.reduce((sum, count) => sum + count, 0);
  return {
    repeatBookings,
    returningGuests: returning.length,
    linked: [...seen.values()].reduce((sum, count) => sum + count, 0),
    total: counted.length,
    share: counted.length ? repeatBookings / counted.length : null,
  };
}

export type PartyBand = '1-2' | '3-4' | '5-6' | '7+';
export const PARTY_BANDS: readonly PartyBand[] = ['1-2', '3-4', '5-6', '7+'];
export const PARTY_BAND_LABELS: Record<PartyBand, string> = { '1-2': '1–2', '3-4': '3–4', '5-6': '5–6', '7+': '7+' };

export const partyBand = (partySize: number): PartyBand =>
  partySize <= 2 ? '1-2' : partySize <= 4 ? '3-4' : partySize <= 6 ? '5-6' : '7+';

/** Bookings by party size, cancelled ones left out. */
export function partyMix(bookings: readonly StatsBooking[]): Share<PartyBand>[] {
  const counted = bookings.filter(notCancelled);
  return PARTY_BANDS.map((key) => {
    const count = counted.filter((booking) => partyBand(booking.partySize) === key).length;
    return { key, bookings: count, share: counted.length ? count / counted.length : 0 };
  });
}

// ─── Words ────────────────────────────────────────────────────────────────────

/** 0.124 → "12%", 0.004 → "0.4%" (a small rate keeps a decimal so it doesn't read as none). */
export function percentLabel(value: number | null): string {
  if (value === null) return '—';
  const percent = value * 100;
  if (percent > 0 && percent < 1) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

/** Minutes as "45 min" or "1 h 50 min"; null as a dash. */
export function stayLabel(minutes: number | null): string {
  if (minutes === null) return '—';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
