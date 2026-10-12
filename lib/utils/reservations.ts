// ─── Reservations ─────────────────────────────────────────────────────────────
//
// The arithmetic behind the reservations screens, kept free of React so it can
// be tested: a day's window in the workspace zone, how long a party stays, what
// each table is doing at a moment, which steps a booking can take next, and the
// floor plan's geometry. The API decides clashes; nothing here books anything.
// The step rules mirror duma-api `src/lib/reservation-rules.ts` — they only
// choose which buttons to show, and the API refuses anything else.
// Relative, not aliased: `node --experimental-strip-types` resolves value
// imports for real and does not know `@/`.
import { zonedParts, zonedToInstant } from './workspace-time.ts';

export type ReservationStatus = 'booked' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export type BookingSource = 'phone' | 'walk_in' | 'online' | 'other';
export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'left' | 'cancelled';
export type DiningTableShape = 'square' | 'round' | 'rectangle';

export interface FloorTable {
  id: string;
  areaId: string;
  locationId: string;
  label: string;
  minCovers: number;
  maxCovers: number;
  shape: DiningTableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** What the floor and list screens need of a booking. */
export interface BookingLike {
  id: string;
  guestName: string;
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  tables: { id: string; label: string }[];
}

// ─── Status vocabulary ────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Finished',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export const STATUS_BADGE: Record<ReservationStatus, 'reference' | 'success' | 'warning' | 'muted' | 'destructive' | 'primary'> = {
  booked: 'primary',
  confirmed: 'reference',
  seated: 'success',
  completed: 'muted',
  cancelled: 'muted',
  no_show: 'destructive',
};

export const SOURCE_LABELS: Record<BookingSource, string> = { phone: 'Phone', walk_in: 'Walk-in', online: 'Online', other: 'Other' };

const LIVE: readonly ReservationStatus[] = ['booked', 'confirmed', 'seated'];
export const isLive = (status: ReservationStatus) => LIVE.includes(status);

const STEPS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  booked: ['confirmed', 'seated', 'cancelled', 'no_show'],
  confirmed: ['booked', 'seated', 'cancelled', 'no_show'],
  seated: ['confirmed', 'completed'],
  completed: [],
  cancelled: ['booked'],
  no_show: ['booked'],
};

export interface BookingAction {
  status: ReservationStatus;
  label: string;
  /** The one the host most likely wants next. */
  primary?: boolean;
  /** Takes the party off the night — asks first. */
  destructive?: boolean;
}

/** The buttons a booking shows, the likely next one first. */
export function bookingActions(status: ReservationStatus): BookingAction[] {
  const label: Record<ReservationStatus, string> = {
    booked: status === 'confirmed' ? 'Mark unconfirmed' : 'Restore booking',
    confirmed: status === 'seated' ? 'Unseat' : 'Confirm',
    seated: 'Seat',
    completed: 'Finish',
    cancelled: 'Cancel booking',
    no_show: 'No-show',
  };
  const primary: Partial<Record<ReservationStatus, ReservationStatus>> = {
    booked: 'seated',
    confirmed: 'seated',
    seated: 'completed',
    cancelled: 'booked',
    no_show: 'booked',
  };
  return STEPS[status]
    .map((next) => ({
      status: next,
      label: label[next],
      ...(primary[status] === next && { primary: true }),
      ...((next === 'cancelled' || next === 'no_show') && { destructive: true }),
    }))
    .sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
}

// ─── Days and windows ─────────────────────────────────────────────────────────

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` plus or minus whole days — calendar arithmetic, no zone involved. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** The instants a calendar day runs between, in a zone: [midnight, next midnight). */
export function dayRange(date: string, timeZone?: string): { from: string; to: string } {
  const from = zonedToInstant(date, '00:00', timeZone);
  const to = zonedToInstant(addDays(date, 1), '00:00', timeZone);
  if (!from || !to) throw new Error(`Not a calendar date: ${date}`);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** How long a party usually stays: longer for a bigger table. */
export function defaultDurationMinutes(partySize: number): number {
  if (partySize <= 2) return 90;
  if (partySize <= 6) return 120;
  return 150;
}

/** A wall-clock date and time plus a stay → the booking's window. */
export function bookingWindow(
  date: string,
  time: string,
  durationMinutes: number,
  timeZone?: string,
): { startsAt: string; endsAt: string } | null {
  const start = zonedToInstant(date, time, timeZone);
  if (!start || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + durationMinutes * 60_000).toISOString() };
}

/** Minutes between two instants, rounded. */
export const minutesBetween = (from: string | Date, to: string | Date) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);

/** "19:00" — the slot a booking is listed under, in the zone. */
export const slotOf = (instant: string, timeZone?: string) => zonedParts(instant, timeZone).time;

/** Bookings grouped by their start time, in order. */
export function groupBySlot<T extends BookingLike>(bookings: readonly T[], timeZone?: string): { slot: string; bookings: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const booking of [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const slot = slotOf(booking.startsAt, timeZone);
    groups.set(slot, [...(groups.get(slot) ?? []), booking]);
  }
  return [...groups].map(([slot, items]) => ({ slot, bookings: items }));
}

export interface DaySummary {
  bookings: number;
  covers: number;
  seated: number;
  /** Live and not yet seated. */
  toCome: number;
  noShows: number;
}

/** Counts for the day, leaving cancellations out of bookings and covers. */
export function summariseDay(bookings: readonly BookingLike[]): DaySummary {
  const counted = bookings.filter((booking) => booking.status !== 'cancelled');
  return {
    bookings: counted.length,
    covers: counted.filter((booking) => booking.status !== 'no_show').reduce((sum, booking) => sum + booking.partySize, 0),
    seated: bookings.filter((booking) => booking.status === 'seated').length,
    toCome: bookings.filter((booking) => booking.status === 'booked' || booking.status === 'confirmed').length,
    noShows: bookings.filter((booking) => booking.status === 'no_show').length,
  };
}

/**
 * A booking still waiting to be seated well past its start — the host should
 * chase it or mark a no-show.
 */
export const isRunningLate = (booking: BookingLike, now: Date, graceMinutes = 15) =>
  (booking.status === 'booked' || booking.status === 'confirmed') && minutesBetween(booking.startsAt, now) > graceMinutes;

// ─── What a table is doing ────────────────────────────────────────────────────

export type TableState =
  /** A seated party is at it. */
  | 'seated'
  /** A booking's window covers this moment, but they haven't been seated. */
  | 'held'
  /** Free now; a booking starts within the hour. */
  | 'soon'
  | 'free';

export interface TableStatus {
  state: TableState;
  /** The booking that explains the state. */
  booking: BookingLike | null;
  /** The next booking to start after this moment. */
  next: BookingLike | null;
}

export const TABLE_STATE_LABELS: Record<TableState, string> = { seated: 'Seated', held: 'Held', soon: 'Booked soon', free: 'Free' };

/**
 * One table at one moment. A seated party counts until it is finished, even
 * past its booked end — they're still eating.
 */
export function tableStatus(tableId: string, bookings: readonly BookingLike[], at: Date, soonMinutes = 60): TableStatus {
  const mine = bookings.filter((booking) => isLive(booking.status) && booking.tables.some((table) => table.id === tableId));
  const time = at.getTime();
  const seated = mine.find((booking) => booking.status === 'seated');
  const next =
    mine
      .filter((booking) => booking.status !== 'seated' && new Date(booking.startsAt).getTime() > time)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
  if (seated) return { state: 'seated', booking: seated, next };
  const held = mine.find((booking) => new Date(booking.startsAt).getTime() <= time && time < new Date(booking.endsAt).getTime());
  if (held) return { state: 'held', booking: held, next };
  if (next && new Date(next.startsAt).getTime() - time <= soonMinutes * 60_000) return { state: 'soon', booking: next, next };
  return { state: 'free', booking: null, next };
}

/** Whether a table suits a party on its own. */
export const seatsParty = (table: Pick<FloorTable, 'minCovers' | 'maxCovers'>, partySize: number) =>
  table.minCovers <= partySize && partySize <= table.maxCovers;

/** The covers a set of tables seats pushed together. */
/**
 * The table to offer first for a party: free, seats them, and wastes the
 * fewest chairs (then the lowest label). Null when no single table will do.
 */
export function bestFitTable<T extends Pick<FloorTable, 'id' | 'label' | 'maxCovers'> & { free: boolean; seatsParty: boolean }>(
  tables: readonly T[],
): T | null {
  return (
    [...tables]
      .filter((table) => table.free && table.seatsParty)
      .sort((a, b) => a.maxCovers - b.maxCovers || a.label.localeCompare(b.label, undefined, { numeric: true }))[0] ?? null
  );
}

export const seatsAtMost = (tables: readonly Pick<FloorTable, 'maxCovers'>[]) => tables.reduce((sum, table) => sum + table.maxCovers, 0);

// ─── The waitlist ─────────────────────────────────────────────────────────────

export const WAITLIST_LABELS: Record<WaitlistStatus, string> = {
  waiting: 'Waiting',
  notified: 'Told it’s ready',
  seated: 'Seated',
  left: 'Left',
  cancelled: 'Removed',
};

/** How the wait is going against what they were told. */
export function waitTone(waitedMinutes: number, quotedMinutes: number | null): 'ok' | 'near' | 'over' {
  if (quotedMinutes === null) return waitedMinutes >= 30 ? 'near' : 'ok';
  if (waitedMinutes > quotedMinutes) return 'over';
  return quotedMinutes - waitedMinutes <= 5 ? 'near' : 'ok';
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export interface BookingDraft {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  partySize: number;
  date: string;
  time: string;
  durationMinutes: number;
  notes: string;
}

export function bookingDraftProblems(draft: BookingDraft): Partial<Record<keyof BookingDraft, string>> {
  const problems: Partial<Record<keyof BookingDraft, string>> = {};
  if (!draft.guestName.trim()) problems.guestName = 'Who is the booking for?';
  if (!Number.isInteger(draft.partySize) || draft.partySize < 1 || draft.partySize > 200) problems.partySize = 'A party of 1 to 200';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) problems.date = 'Choose the day';
  if (!/^\d{1,2}:\d{2}$/.test(draft.time)) problems.time = 'Choose the time';
  if (!Number.isFinite(draft.durationMinutes) || draft.durationMinutes < 15 || draft.durationMinutes > 720)
    problems.durationMinutes = 'Between 15 minutes and 12 hours';
  if (draft.guestEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.guestEmail.trim()))
    problems.guestEmail = 'That email doesn’t look right';
  return problems;
}

/** A span of minutes as a person says it: "None", "45 min", "2 h", "1 h 30", "2 days 3 h". */
export function minutesLabel(minutes: number, none = 'None'): string {
  if (minutes <= 0) return none;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) return [`${days} ${days === 1 ? 'day' : 'days'}`, hours && `${hours} h`, rest && `${rest} min`].filter(Boolean).join(' ');
  if (hours > 0) return rest ? `${hours} h ${rest}` : `${hours} h`;
  return `${rest} min`;
}

// ─── The floor plan's geometry ────────────────────────────────────────────────

/** The floor plan's own units — the API stores positions on this canvas. */
export const CANVAS = { width: 1200, height: 800 } as const;
export const GRID = 10;

export const snap = (value: number, grid = GRID) => Math.round(value / grid) * grid;

/** Keep a table wholly on the canvas, snapped to the grid. */
export function placeOnCanvas<T extends Pick<FloorTable, 'x' | 'y' | 'width' | 'height'>>(table: T, x: number, y: number): T {
  return {
    ...table,
    x: Math.min(Math.max(0, snap(x)), CANVAS.width - table.width),
    y: Math.min(Math.max(0, snap(y)), CANVAS.height - table.height),
  };
}

export const SHAPE_SIZE: Record<DiningTableShape, { width: number; height: number }> = {
  square: { width: 80, height: 80 },
  round: { width: 80, height: 80 },
  rectangle: { width: 140, height: 80 },
};

/** The next free "T7"-style label, after the highest number already used. */
export function nextTableLabel(labels: readonly string[]): string {
  const numbers = labels
    .map((label) => /^T?(\d+)$/i.exec(label.trim())?.[1])
    .filter(Boolean)
    .map(Number);
  return `T${(numbers.length ? Math.max(...numbers) : 0) + 1}`;
}

/** A spot for a new table: the first grid cell, left to right, top to bottom, not covered by another. */
export function freeSpot(
  tables: readonly Pick<FloorTable, 'x' | 'y' | 'width' | 'height'>[],
  size: { width: number; height: number },
): { x: number; y: number } {
  const gap = 20;
  for (let y = 40; y + size.height <= CANVAS.height; y += 40) {
    for (let x = 40; x + size.width <= CANVAS.width; x += 40) {
      const clear = tables.every(
        (table) =>
          x + size.width + gap <= table.x ||
          table.x + table.width + gap <= x ||
          y + size.height + gap <= table.y ||
          table.y + table.height + gap <= y,
      );
      if (clear) return { x, y };
    }
  }
  return { x: 40, y: 40 };
}

/** A chair as drawn: its centre on the canvas and the way it faces (0 = the table is below it). */
export interface ChairSpot {
  x: number;
  y: number;
  angle: number;
}

export const CHAIR = { width: 22, depth: 14, gap: 6, pitch: 40 } as const;

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Where `count` chairs sit around a table, in canvas units before the table's
 * rotation (they're drawn inside its rotated group, so they turn with it).
 * Round tables space them evenly from twelve o'clock. Square and long tables
 * fill the long sides first, as far as the side has room, then the ends; past
 * that, chairs squeeze in round the table. Each side's chairs are centred.
 */
export function chairSpots(table: Pick<FloorTable, 'x' | 'y' | 'width' | 'height' | 'shape'>, count: number): ChairSpot[] {
  const n = Math.max(0, Math.min(50, Math.floor(count)));
  if (n === 0) return [];
  const { x, y, width: w, height: h } = table;
  const offset = CHAIR.gap + CHAIR.depth / 2;

  if (table.shape === 'round') {
    const rx = w / 2 + offset;
    const ry = h / 2 + offset;
    return Array.from({ length: n }, (_, i) => {
      const angle = -90 + (360 * i) / n;
      const radians = (angle * Math.PI) / 180;
      return { x: x + w / 2 + rx * Math.cos(radians), y: y + h / 2 + ry * Math.sin(radians), angle: angle + 90 };
    });
  }

  const length: Record<Side, number> = { top: w, bottom: w, left: h, right: h };
  const room = (side: Side) => Math.max(1, Math.floor(length[side] / CHAIR.pitch));
  const phases: Side[][] = w === h ? [['top', 'bottom', 'left', 'right']] : w > h ? [['top', 'bottom'], ['left', 'right']] : [['left', 'right'], ['top', 'bottom']];
  const placed: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 };
  let left = n;
  for (const phase of phases) {
    while (left > 0 && phase.some((side) => placed[side] < room(side))) {
      for (const side of phase) {
        if (left > 0 && placed[side] < room(side)) {
          placed[side] += 1;
          left -= 1;
        }
      }
    }
  }
  const order = phases.flat();
  for (let i = 0; left > 0; i += 1, left -= 1) placed[order[i % order.length]!] += 1;

  const spots: ChairSpot[] = [];
  const along = (side: Side, i: number) => (length[side] * (i + 0.5)) / placed[side];
  for (let i = 0; i < placed.top; i += 1) spots.push({ x: x + along('top', i), y: y - offset, angle: 0 });
  for (let i = 0; i < placed.right; i += 1) spots.push({ x: x + w + offset, y: y + along('right', i), angle: 90 });
  for (let i = 0; i < placed.bottom; i += 1) spots.push({ x: x + w - along('bottom', i), y: y + h + offset, angle: 180 });
  for (let i = 0; i < placed.left; i += 1) spots.push({ x: x - offset, y: y + h - along('left', i), angle: 270 });
  return spots;
}

/** Positions that differ from what was saved — the editor's unsaved changes. */
export function movedTables<T extends Pick<FloorTable, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'>>(
  saved: readonly T[],
  current: readonly T[],
): T[] {
  const before = new Map(saved.map((table) => [table.id, table]));
  return current.filter((table) => {
    const was = before.get(table.id);
    return (
      was &&
      (was.x !== table.x ||
        was.y !== table.y ||
        was.width !== table.width ||
        was.height !== table.height ||
        was.rotation !== table.rotation)
    );
  });
}

// ─── The guest's booking page ─────────────────────────────────────────────────

/** The days offered as quick picks: today on, up to the horizon, at most `count`. */
export function upcomingDays(today: string, horizonDays: number, count = 14): string[] {
  return Array.from({ length: Math.max(0, Math.min(count, horizonDays)) }, (_, index) => addDays(today, index));
}

export type NoTimesReason = 'no_hours' | 'closed' | 'too_far' | 'past' | 'no_table' | 'full' | null;

/** Why a day has no times, in the guest's words. */
export function noTimesMessage(reason: NoTimesReason, phone: string | null): string {
  const call = phone ? ` Call us on ${phone}.` : '';
  switch (reason) {
    case 'closed':
      return 'We’re closed that day — try another.';
    case 'too_far':
      return `That’s further ahead than we take bookings online.${call}`;
    case 'past':
      return 'That day has passed — choose another.';
    case 'no_hours':
      return `We aren’t taking online bookings just now.${call}`;
    case 'no_table':
      return `We don’t have a table for that many online.${call}`;
    default:
      return `We’re fully booked that day — try another day.${call}`;
  }
}

export interface GuestDetails {
  name: string;
  email: string;
  phone: string;
}

export function guestDetailsProblems(details: GuestDetails): Partial<Record<keyof GuestDetails, string>> {
  const problems: Partial<Record<keyof GuestDetails, string>> = {};
  if (!details.name.trim()) problems.name = 'Add the name for the booking';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) problems.email = 'Add an email for your confirmation';
  if (details.phone.replace(/\D/g, '').length < 6) problems.phone = 'Add a phone number we can reach you on';
  return problems;
}
