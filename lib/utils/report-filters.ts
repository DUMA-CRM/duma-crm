/**
 * The one filter model every report shares: a date range (a preset or a custom
 * pair of days), what to compare it with, and a location — read from and
 * written to the URL, so a report is a link that opens on exactly the same view.
 *
 * Reports had three range systems until 2026-10-04 (7/30/90, today/7/30, and a
 * custom pair on the compare tab). This replaces them. Pure and tested; dates
 * are local calendar days, and every range is [from, to) with `to` exclusive.
 */
import { zonedParts, zonedToInstant } from './workspace-time.ts';

export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'last-7'
  | 'this-month'
  | 'last-month'
  | 'last-30'
  | 'last-90'
  | 'this-quarter'
  | 'this-year'
  | 'custom';

export type CompareMode = 'previous' | 'year' | 'none';

export interface ReportFilters {
  preset: RangePreset;
  /** `YYYY-MM-DD`, only for `custom`. */
  from?: string;
  /** `YYYY-MM-DD`, inclusive, only for `custom`. */
  to?: string;
  compare: CompareMode;
  /** Empty means every location the reader can see. */
  locationId: string;
}

export interface DateRange {
  /** Inclusive start, local midnight. */
  from: Date;
  /** Exclusive end, local midnight of the day after the last day. */
  to: Date;
}

export const DEFAULT_FILTERS: ReportFilters = { preset: 'last-30', compare: 'previous', locationId: '' };

export const PRESETS: { value: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This week' },
  { value: 'last-week', label: 'Last week' },
  { value: 'last-7', label: 'Last 7 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-30', label: 'Last 30 days' },
  { value: 'last-90', label: 'Last 90 days' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'this-year', label: 'This year' },
];

export const COMPARE_LABEL: Record<CompareMode, string> = {
  previous: 'Previous period',
  year: 'Same days last year',
  none: 'No comparison',
};

const DAY = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** Monday of the week holding `date` — weeks start on Monday in the UK. */
const mondayOf = (date: Date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fromDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateKey(date) === key ? date : null;
}

/** The range a set of filters means at `now`. A custom range missing a day falls back to the default. */
export function resolveRange(filters: Pick<ReportFilters, 'preset' | 'from' | 'to'>, now: Date): DateRange {
  // "Today" is the workspace's; the range itself stays local calendar Dates.
  const { year, month, day } = zonedParts(now);
  const today = new Date(year, month - 1, day);
  switch (filters.preset) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'yesterday':
      return { from: addDays(today, -1), to: today };
    case 'this-week':
      return { from: mondayOf(today), to: addDays(today, 1) };
    case 'last-week': {
      const monday = addDays(mondayOf(today), -7);
      return { from: monday, to: addDays(monday, 7) };
    }
    case 'last-7':
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case 'this-month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
    case 'last-month':
      return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 1) };
    case 'last-90':
      return { from: addDays(today, -89), to: addDays(today, 1) };
    case 'this-quarter':
      return { from: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), to: addDays(today, 1) };
    case 'this-year':
      return { from: new Date(today.getFullYear(), 0, 1), to: addDays(today, 1) };
    case 'custom': {
      const from = filters.from ? fromDateKey(filters.from) : null;
      const to = filters.to ? fromDateKey(filters.to) : null;
      if (from && to) return from <= to ? { from, to: addDays(to, 1) } : { from: to, to: addDays(from, 1) };
      return resolveRange({ preset: 'last-30' }, now);
    }
    case 'last-30':
    default:
      return { from: addDays(today, -29), to: addDays(today, 1) };
  }
}

/** Whole days in a range. */
export function rangeDays(range: DateRange): number {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY));
}

/**
 * The range to compare with: the same number of days immediately before, or
 * the same calendar days a year earlier. Null when comparison is off.
 */
export function comparisonRange(range: DateRange, mode: CompareMode): DateRange | null {
  if (mode === 'none') return null;
  if (mode === 'year') {
    // Whole calendar months compare by calendar — September against last
    // September, as the accounts do. Anything else steps back 52 weeks, so a
    // Saturday meets a Saturday: by date, it would meet a Friday, and in
    // hospitality that alone moves a day's takings by a third.
    const wholeMonths = range.from.getDate() === 1 && range.to.getDate() === 1;
    if (wholeMonths) {
      const shift = (date: Date) => new Date(date.getFullYear() - 1, date.getMonth(), date.getDate());
      return { from: shift(range.from), to: shift(range.to) };
    }
    return { from: addDays(range.from, -364), to: addDays(range.to, -364) };
  }
  const days = rangeDays(range);
  return { from: addDays(range.from, -days), to: range.from };
}

/** "1 Sep – 30 Sep 2026", "Today", or a single day — how the filter bar names the range. */
export function rangeLabel(filters: Pick<ReportFilters, 'preset' | 'from' | 'to'>, range: DateRange): string {
  const preset = PRESETS.find((option) => option.value === filters.preset);
  if (preset) return preset.label;
  const last = addDays(range.to, -1);
  const sameYear = range.from.getFullYear() === last.getFullYear();
  const day = (date: Date, withYear: boolean) =>
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
  if (toDateKey(range.from) === toDateKey(last)) return day(last, true);
  return `${day(range.from, !sameYear)} – ${day(last, true)}`;
}

/** The days a range covers, as `1 Sep – 30 Sep 2026` regardless of preset — for subtitles and exports. */
export function rangeDates(range: DateRange): string {
  return rangeLabel({ preset: 'custom' }, range);
}

/**
 * The API's window: ISO instants, `to` the last millisecond of the range. Each
 * day starts at midnight in `timeZone` (default: the workspace's), not the browser's.
 */
export function apiRange(range: DateRange, timeZone?: string): { from: string; to: string } {
  const midnight = (date: Date) => zonedToInstant(toDateKey(date), '00:00', timeZone) ?? date;
  return { from: midnight(range.from).toISOString(), to: new Date(midnight(range.to).getTime() - 1).toISOString() };
}

// ── URL ───────────────────────────────────────────────────────────────────────

const PRESET_VALUES = new Set<string>([...PRESETS.map((preset) => preset.value), 'custom']);
const COMPARE_VALUES = new Set<string>(['previous', 'year', 'none']);

export function readFilters(params: URLSearchParams): ReportFilters {
  const preset = params.get('range');
  const compare = params.get('compare');
  const filters: ReportFilters = {
    preset: preset && PRESET_VALUES.has(preset) ? (preset as RangePreset) : DEFAULT_FILTERS.preset,
    compare: compare && COMPARE_VALUES.has(compare) ? (compare as CompareMode) : DEFAULT_FILTERS.compare,
    locationId: params.get('location') ?? '',
  };
  if (filters.preset === 'custom') {
    const from = params.get('from');
    const to = params.get('to');
    if (from && to && fromDateKey(from) && fromDateKey(to)) {
      filters.from = from;
      filters.to = to;
    } else {
      filters.preset = DEFAULT_FILTERS.preset;
    }
  }
  return filters;
}

/** Writes only what differs from the defaults, so a default view keeps a clean URL. */
export function writeFilters(filters: ReportFilters, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of ['range', 'from', 'to', 'compare', 'location']) params.delete(key);
  if (filters.preset !== DEFAULT_FILTERS.preset) params.set('range', filters.preset);
  if (filters.preset === 'custom' && filters.from && filters.to) {
    params.set('from', filters.from);
    params.set('to', filters.to);
  }
  if (filters.compare !== DEFAULT_FILTERS.compare) params.set('compare', filters.compare);
  if (filters.locationId) params.set('location', filters.locationId);
  return params;
}

// ── Change ────────────────────────────────────────────────────────────────────

export interface Delta {
  /** current − previous. */
  change: number;
  /** Fractional change (0.12 = +12%), or null when there is nothing to divide by. */
  ratio: number | null;
}

export function delta(current: number, previous: number | null | undefined): Delta | null {
  if (previous === null || previous === undefined || !Number.isFinite(previous)) return null;
  const change = current - previous;
  return { change, ratio: previous === 0 ? null : change / Math.abs(previous) };
}

/** "+12%", "−4%", "New" (from zero), or "No change". */
export function formatDelta(value: Delta | null): string | null {
  if (!value) return null;
  if (value.ratio === null) return value.change === 0 ? 'No change' : 'New';
  const pct = Math.round(value.ratio * 100);
  if (pct === 0) return 'No change';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

/** Share of a total, 0–1; 0 when the total is 0. */
export function share(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * RFC 4180: a field holding a comma, quote or newline is quoted, inner quotes
 * doubled. A text cell that starts like a formula is prefixed with `'` so a
 * spreadsheet shows it rather than running it.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const cell = (raw: string | number | null | undefined) => {
    if (raw === null || raw === undefined) return '';
    let text = String(raw);
    if (typeof raw === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [columns.map((column) => cell(column.header)).join(',')];
  for (const row of rows) lines.push(columns.map((column) => cell(column.value(row))).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** `sales-summary_2026-09-01_2026-09-30.csv` — the last day, not the exclusive end. */
export function exportFileName(reportId: string, range: DateRange): string {
  return `${reportId}_${toDateKey(range.from)}_${toDateKey(addDays(range.to, -1))}.csv`;
}

// ── Days ──────────────────────────────────────────────────────────────────────

/** Every day in a range, as `YYYY-MM-DD`. */
export function daysIn(range: DateRange): string[] {
  const keys: string[] = [];
  for (let day = range.from; day < range.to; day = addDays(day, 1)) keys.push(toDateKey(day));
  return keys;
}

/**
 * A daily series with every day in the range present — the API returns only
 * days that had orders, and a chart or table with gaps would read a closed day
 * as a missing one. `pick` reads a row's value; absent days are zero.
 */
export function fillDays<T extends { date: string }>(
  rows: T[],
  range: DateRange,
  pick: (row: T) => number,
): { date: string; value: number }[] {
  const byDay = new Map(rows.map((row) => [row.date.slice(0, 10), row]));
  return daysIn(range).map((date) => {
    const row = byDay.get(date);
    return { date, value: row ? pick(row) : 0 };
  });
}

/** "Mon 6 Oct" for a day key — chart axes and table rows. */
export function dayLabel(key: string): string {
  const date = fromDateKey(key);
  return date ? date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : key;
}

// ── Grouping ──────────────────────────────────────────────────────────────────

export type Granularity = 'day' | 'week' | 'month';

/** The bucket a day falls in: itself, its week's Monday, or its month. */
export function bucketKey(dateKey: string, by: Granularity): string {
  if (by === 'day') return dateKey;
  if (by === 'month') return dateKey.slice(0, 7);
  const date = fromDateKey(dateKey);
  return date ? toDateKey(mondayOf(date)) : dateKey;
}

/** "Mon 6 Oct", "w/c 6 Oct", "Oct 2026". */
export function bucketLabel(key: string, by: Granularity): string {
  if (by === 'day') return dayLabel(key);
  if (by === 'month') {
    const date = fromDateKey(`${key}-01`);
    return date ? date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : key;
  }
  const date = fromDateKey(key);
  return date ? `w/c ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : key;
}

/** The short form for a chart axis: "6 Oct" for a day or a week's Monday, "Oct" for a month. */
export function bucketAxisLabel(key: string, by: Granularity): string {
  const date = fromDateKey(by === 'month' ? `${key}-01` : key);
  if (!date) return key;
  return date.toLocaleDateString('en-GB', by === 'month' ? { month: 'short' } : { day: 'numeric', month: 'short' });
}

/**
 * Daily rows summed into weeks or months, in order. Every numeric field named
 * in `fields` is added; `days` counts the days that fell in each bucket, so a
 * part-week at either end of the range reads as one.
 */
export function groupDays<T extends { date: string }, K extends keyof T>(
  rows: T[],
  by: Granularity,
  fields: K[],
): ({ key: string; label: string; days: number } & Record<K, number>)[] {
  const buckets = new Map<string, { key: string; label: string; days: number } & Record<K, number>>();
  for (const row of rows) {
    const key = bucketKey(row.date.slice(0, 10), by);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label: bucketLabel(key, by), days: 0, ...Object.fromEntries(fields.map((field) => [field, 0])) } as {
        key: string;
        label: string;
        days: number;
      } & Record<K, number>;
      buckets.set(key, bucket);
    }
    bucket.days += 1;
    for (const field of fields) (bucket as Record<K, number>)[field] += Number(row[field]) || 0;
  }
  return [...buckets.values()];
}

/** The grouping a range reads best at: days up to ~5 weeks, weeks up to ~6 months, then months. */
export function suggestedGranularity(range: DateRange): Granularity {
  const days = rangeDays(range);
  return days <= 35 ? 'day' : days <= 190 ? 'week' : 'month';
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * How each weekday trades across the range: the total, how many of that
 * weekday there were, and the average per day — the average is the fair
 * comparison, since a month can hold five Mondays and four Sundays.
 */
export function weekdayPattern(
  days: { date: string; value: number }[],
): { weekday: string; short: string; total: number; days: number; average: number }[] {
  const pattern = WEEKDAY_NAMES.map((weekday) => ({ weekday, short: weekday.slice(0, 3), total: 0, days: 0, average: 0 }));
  for (const day of days) {
    const date = fromDateKey(day.date);
    if (!date) continue;
    const slot = pattern[(date.getDay() + 6) % 7];
    slot.total += day.value;
    slot.days += 1;
  }
  for (const slot of pattern) slot.average = slot.days ? slot.total / slot.days : 0;
  return pattern;
}

/**
 * The Orders page for a span of days — a report's drill-down from a figure to
 * the sales behind it. Always names the location (`all` for every site), since
 * the Orders page otherwise scopes by the header's and the totals stop agreeing.
 */
export function ordersHref(fromKey: string, toKey: string, locationId: string, extra: Record<string, string> = {}): string {
  return `/orders?${new URLSearchParams({ range: 'custom', from: fromKey, to: toKey, location: locationId || 'all', ...extra })}`;
}
