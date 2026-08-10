// Pure value and calendar helpers shared by the agent's tools, its action
// specs and the approval replay. Kept free of server-only imports so the
// approval rules can be unit-tested on their own.

export function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function gbp(value: unknown) {
  return `£${toNumber(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function text(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Optional string argument from the model: empty string and "null" both mean absent. */
export function optionalText(value: unknown, max = 500) {
  const trimmed = text(value, max);
  return trimmed && trimmed.toLowerCase() !== 'null' ? trimmed : '';
}

// ── Calendar ─────────────────────────────────────────────────────────────────
// The model is bad at date arithmetic and an answer is only as good as the
// range it asked for, so every anchor it might need is computed here and handed
// to it in the system prompt.

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Move a YYYY-MM-DD calendar date by whole days. */
export function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}

const shift = addDays;

export function calendarAnchors(now = new Date()) {
  const today = isoDay(now);
  // Monday-first week index; the product is UK-based and rotas start Monday.
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = shift(today, -weekday);
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = shift(monthStart, -1);
  return {
    today,
    yesterday: shift(today, -1),
    weekStart,
    lastWeekStart: shift(weekStart, -7),
    lastWeekSameDay: shift(today, -7),
    lastWeekEnd: shift(weekStart, -1),
    monthStart,
    lastMonthStart: `${lastMonthEnd.slice(0, 7)}-01`,
    lastMonthEnd,
    thirtyDaysAgo: shift(today, -29),
    sixtyDaysAgo: shift(today, -59),
  };
}

/** Combine a calendar date and HH:MM in a location's timezone into a UTC instant. */
export function zonedIso(date: string, time: string, timeZone: string) {
  const naive = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(naive)) return '';
  return new Date(naive - timezoneOffsetMs(new Date(naive), timeZone)).toISOString();
}

function timezoneOffsetMs(at: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
    const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour') % 24, read('minute'), read('second'));
    return asUtc - at.getTime();
  } catch {
    return 0;
  }
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const WEEKDAY_KEYS: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Now, as the shop floor sees it. A café's opening hours are local wall-clock
 * facts, so "what time do we close today" has to be answered in the location's
 * timezone rather than the server's.
 */
export function zonedNow(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = read('weekday').slice(0, 3).toLowerCase() as WeekdayKey;
  const hour = read('hour') === '24' ? '00' : read('hour');
  return {
    weekday: WEEKDAY_KEYS.includes(weekday) ? weekday : WEEKDAY_KEYS[now.getUTCDay()],
    date: `${read('year')}-${read('month')}-${read('day')}`,
    time: `${hour}:${read('minute')}`,
  };
}

/**
 * Whether a zero-padded "HH:MM" falls inside an opening window. A close at or
 * before the open is the late shift — it runs past midnight into the next day.
 */
export function isWithinHours(time: string, open: string, close: string) {
  if (close === open) return false;
  return close > open ? time >= open && time < close : time >= open || time < close;
}

export function formatDateTime(value: string | null | undefined, timeZone = 'Europe/London') {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}
