// ---------------------------------------------------------------------------
// The workspace clock. Every moment the app shows — an order placed, a shift
// clocked, a post scheduled — is read in the workspace's timezone, not the
// browser's, so a manager abroad sees the times the shop floor sees.
//
// Two kinds of value, never mixed:
//   · an instant (ISO timestamp, Date from the API) → shown in the workspace zone
//   · a calendar date (`YYYY-MM-DD`: a birthday, a trading day, a report bucket)
//     → not a moment at all; shown as written, never shifted by any zone.
//
// The zone is module state rather than React context because the formatters
// are plain functions called from utils, columns and closures. It is only set
// in the browser (WorkspaceSettingsSync); on the server it stays unset, so a
// render there falls back to the runtime zone exactly as before — and one
// request can never leak its workspace's zone into another's.
// ---------------------------------------------------------------------------

export const DEFAULT_TIME_ZONE = 'Europe/London';

let zone: string | undefined;

/** A zone the runtime can actually format in. */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Set by WorkspaceSettingsSync. An invalid zone clears it rather than throwing on every format. */
export function setWorkspaceTimeZone(next: string | null | undefined) {
  zone = isValidTimeZone(next) ? next : undefined;
}

/** The workspace's zone, or undefined before it is known (and always on the server). */
export const workspaceTimeZone = (): string | undefined => zone;

/** The workspace's zone, else the browser's — for things that need a name, like a report query. */
export function resolvedTimeZone(): string {
  return zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? DEFAULT_TIME_ZONE;
}

/** Adds the workspace zone to Intl options — for call sites that format an instant inline. */
export function inWorkspaceZone<T extends Intl.DateTimeFormatOptions>(options: T): T {
  return zone ? { ...options, timeZone: zone } : options;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * A formatter for instants in the workspace zone. Cached per zone, so swapping a
 * module-level `new Intl.DateTimeFormat(...)` for this costs nothing — and,
 * unlike that constant, it follows the zone once it is known.
 */
export function workspaceFormatter(options: Intl.DateTimeFormatOptions, locale: string | string[] | undefined = 'en-GB') {
  const key = `${String(locale)}|${zone ?? ''}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, inWorkspaceZone(options));
    formatters.set(key, formatter);
  }
  return formatter;
}

/** An instant, formatted in the workspace zone. Invalid input gives `fallback`. */
export function formatInstant(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = '—',
  locale: string | string[] | undefined = 'en-GB',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : workspaceFormatter(options, locale).format(date);
}

/**
 * A calendar date (`YYYY-MM-DD`, or the date part of a longer string) formatted
 * as written. Read at UTC noon and formatted in UTC, so no zone — the
 * browser's or the workspace's — can move it onto a neighbouring day.
 */
export function formatCalendarDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = '—',
  locale: string | string[] | undefined = 'en-GB',
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return fallback;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date);
}

export interface ZonedParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday, like Date#getDay. */
  weekday: number;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM` */
  time: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (value: number) => String(value).padStart(2, '0');

/** Wall-clock parts of an instant in a zone (default: the workspace's) — the zoned getHours/getDate. */
export function zonedParts(at: Date | string | number = new Date(), timeZone: string | undefined = zone): ZonedParts {
  const date = at instanceof Date ? at : new Date(at);
  const parts = new Intl.DateTimeFormat('en-GB', {
    ...(timeZone ? { timeZone } : {}),
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const year = Number(read('year'));
  const month = Number(read('month'));
  const day = Number(read('day'));
  const hour = Number(read('hour')) % 24;
  const minute = Number(read('minute'));
  return {
    year,
    month,
    day,
    hour,
    minute,
    second: Number(read('second')),
    weekday: Math.max(0, WEEKDAYS.indexOf(read('weekday'))),
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
  };
}

/** The calendar day an instant falls on in the workspace — "today" is `workspaceDateKey()`. */
export const workspaceDateKey = (at: Date | string | number = new Date(), timeZone: string | undefined = zone) =>
  zonedParts(at, timeZone).date;

/**
 * A wall-clock date and `HH:MM` in a zone (default: the workspace's) → the UTC
 * instant. Used wherever a person picks a time — "publish at 09:00" means 09:00
 * at the business, wherever the person happens to be. A time skipped by a DST
 * jump resolves forward, as clocks do.
 */
export function zonedToInstant(date: string, time: string, timeZone: string | undefined = zone): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match || !clock) return null;
  const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(clock[1]), Number(clock[2]));
  if (Number.isNaN(wall)) return null;
  const offsetAt = (instant: number) => {
    const parts = zonedParts(new Date(instant), timeZone);
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant;
  };
  // Two passes: the offset at the guess can differ from the offset at the answer across a DST change.
  let instant = wall - offsetAt(wall);
  instant = wall - offsetAt(instant);
  return new Date(instant);
}

// ── Describing a zone ────────────────────────────────────────────────────────

/** "Europe/London" → "London", "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function timeZoneCity(timeZone: string): string {
  return (timeZone.split('/').pop() ?? timeZone).replaceAll('_', ' ');
}

/** Minutes the zone is ahead of UTC at `at` — negative west of Greenwich. */
export function timeZoneOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const parts = zonedParts(at, timeZone);
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((wall - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** "GMT", "GMT+1", "GMT+5:30", "GMT−3" — written out, not left to a locale's abbreviation. */
export function timeZoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  const minutes = timeZoneOffsetMinutes(timeZone, at);
  if (minutes === 0) return 'GMT';
  const sign = minutes > 0 ? '+' : '−';
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `GMT${sign}${hours}${rest ? `:${pad(rest)}` : ''}`;
}

/** How a zone sits against another (default: this device's) — "Same as this device", "2 h ahead", "5 h 30 min behind". */
export function timeZoneGap(timeZone: string, other: string | undefined = undefined, at: Date = new Date()): string {
  const theirs = other ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const gap = timeZoneOffsetMinutes(timeZone, at) - timeZoneOffsetMinutes(theirs, at);
  if (gap === 0) return 'Same time as this device';
  const hours = Math.floor(Math.abs(gap) / 60);
  const minutes = Math.abs(gap) % 60;
  const span = [hours ? `${hours} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean).join(' ');
  return `${span} ${gap > 0 ? 'ahead of' : 'behind'} this device`;
}
