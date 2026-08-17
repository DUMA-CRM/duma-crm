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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "2026-08-14" → "14 Aug". Date-only values, so no timezone is involved. */
export function calendarLabel(iso: string, withYear = false): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  const name = MONTHS[Number(month) - 1];
  if (!name) return iso;
  return `${Number(day)} ${name}${withYear ? ` ${year}` : ''}`;
}

/**
 * A date range said the way a person says it: "14 Aug", "9–14 Aug",
 * "28 Jul – 4 Aug". Cards used to print raw ISO on both ends of an arrow, which
 * is a database value standing in for a period a reader has to decode.
 *
 * The year appears only when the range leaves the current one, so a question
 * about last week does not carry a year it never needed.
 */
export function rangeLabel(from: string, to: string, now = new Date()): string {
  const start = from.slice(0, 10);
  const end = to.slice(0, 10);
  const [startYear, startMonth] = start.split('-');
  const [endYear, endMonth] = end.split('-');
  const thisYear = String(now.getFullYear());
  const needsYear = startYear !== thisYear || endYear !== thisYear;

  if (start === end) return calendarLabel(start, needsYear);
  if (startYear === endYear && startMonth === endMonth) {
    return `${Number(start.slice(8, 10))}–${calendarLabel(end, needsYear)}`;
  }
  return `${calendarLabel(start, needsYear && startYear !== endYear)} – ${calendarLabel(end, needsYear)}`;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * Openers that make a suggestion the assistant's question rather than the
 * operator's next request. Ordered longest-first so "would you like me to"
 * is taken before "would you like".
 */
const ASSISTANT_VOICE = [
  'would you like me to',
  'would you like us to',
  'would you like to',
  'would you like',
  'would it help if i',
  'would it help to',
  'do you want me to',
  'do you want to',
  'do you need me to',
  'shall i',
  'shall we',
  'should i',
  'should we',
  'want me to',
  'can i',
  'may i',
];

/**
 * Rewrites a follow-up into something the operator could have typed.
 *
 * A suggestion chip is a shortcut for the *next message*, so clicking
 * "Would you like to check the failures?" used to send the assistant's own
 * question back to it. Stripping the opener leaves the request underneath —
 * "Check the failures" — which is what the click was always meant to say.
 *
 * A question in the operator's own voice ("What needs attention today?") is
 * already sendable and is left exactly as it is, question mark included.
 */
export function asOperatorRequest(value: string): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  // Anything non-alphanumeric ends the opener — a space, a comma, or the
  // question mark in "Would you like to?", which would otherwise match the
  // shorter phrase and leave a stranded particle behind.
  const opener = ASSISTANT_VOICE.find((phrase) => {
    if (!lower.startsWith(phrase)) return false;
    const next = lower.charAt(phrase.length);
    return next === '' || !/[a-z0-9]/.test(next);
  });
  if (!opener) return trimmed;

  // Only now is the remainder an imperative, so only now does the question
  // mark stop making sense.
  const rest = trimmed
    .slice(opener.length)
    .replace(/^[\s,:;—-]+/, '')
    .replace(/\s*\?+\s*$/, '');
  // Nothing but a particle left means the opener was the whole sentence.
  if (rest.length < 3) return trimmed;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
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
