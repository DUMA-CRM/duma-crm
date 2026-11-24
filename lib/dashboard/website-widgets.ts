import { zonedParts, zonedToInstant } from '../utils/workspace-time.ts';

// ---------------------------------------------------------------------------
// The website analytics dashboard widgets, kept pure: which whole days each
// one reads in the workspace's zone, today against the same time yesterday,
// the last fourteen days against the fourteen before, and a top-N list.
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` moved by whole calendar days. */
export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** `count` day keys ending on `lastKey`, oldest first. */
export function dayKeys(lastKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(lastKey, index - count + 1));
}

/**
 * Whole days as the report's API window: the first day's midnight in the zone
 * to the instant before the day after the last begins — the Website report's
 * own `apiRange`, so a day means the same thing on both screens.
 */
export function dayWindow(firstKey: string, lastKey: string, timeZone: string): { from: string; to: string } {
  const from = zonedToInstant(firstKey, '00:00', timeZone)!;
  const end = zonedToInstant(addDays(lastKey, 1), '00:00', timeZone)!;
  return { from: from.toISOString(), to: new Date(end.getTime() - 1).toISOString() };
}

/**
 * Every window the website widgets read, from one "now". Keyed by date, not
 * by the instant, so a card's cache key holds still all day.
 *
 * - today / yesterday: one whole day each (today's later hours are simply empty).
 * - week: the last seven days, today included — pages and sources.
 * - fortnight: the fourteen whole days to yesterday and the fourteen before,
 *   read as one window so a partial today never sits in the comparison.
 */
export function webWindows(now: Date, timeZone: string) {
  const today = zonedParts(now, timeZone).date;
  const yesterday = addDays(today, -1);
  return {
    today,
    yesterday,
    todayWindow: dayWindow(today, today, timeZone),
    yesterdayWindow: dayWindow(yesterday, yesterday, timeZone),
    week: { keys: dayKeys(today, 7), window: dayWindow(addDays(today, -6), today, timeZone) },
    fortnight: {
      current: dayKeys(yesterday, 14),
      previous: dayKeys(addDays(yesterday, -14), 14),
      window: dayWindow(addDays(yesterday, -27), yesterday, timeZone),
    },
  };
}

/** Change against a comparison: the ratio, or null from zero; null overall with nothing to compare. */
export interface Change {
  change: number;
  /** null when the comparison was zero — "new", not infinite. */
  ratio: number | null;
}

export function changeOf(now: number, before: number | null | undefined): Change | null {
  if (before === null || before === undefined || !Number.isFinite(before)) return null;
  const change = now - before;
  return { change, ratio: before === 0 ? null : change / Math.abs(before) };
}

// ── Today ───────────────────────────────────────────────────────────────────

export interface HourRow {
  hour: string;
  visitors: number;
  pageviews: number;
}

export interface DayHour {
  /** 0–23, wall clock in the zone. */
  hour: number;
  visitors: number;
  pageviews: number;
}

/** One day's 24 hours from the API's `YYYY-MM-DD HH` rows; hours with no visits are zero. */
export function dayHours(rows: readonly HourRow[] | null | undefined, dateKey: string): DayHour[] {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, visitors: 0, pageviews: 0 }));
  for (const row of rows ?? []) {
    const [date, hour] = row.hour.split(' ');
    const at = Number(hour);
    if (date !== dateKey || !Number.isInteger(at) || at < 0 || at > 23) continue;
    // A day that repeats an hour (clocks back) adds both into the one wall-clock hour.
    hours[at]!.visitors += row.visitors;
    hours[at]!.pageviews += row.pageviews;
  }
  return hours;
}

/**
 * Today so far against yesterday up to the same time, from both days' hourly
 * rows. Today counts every visit in so far, the current hour included;
 * yesterday counts its hours before this one plus the share of this hour
 * already gone — so at 14:30 it is yesterday to 14:30, not to 15:00.
 *
 * Visitors here are summed hour by hour, so one person visiting at 9 and at 2
 * counts twice — the same on both days, which keeps the comparison fair; the
 * card's headline uses the day's unique count where the provider gives one.
 *
 * Without yesterday's hours (`yesterdayHours` null), `compared` is 'day' and
 * the comparison is yesterday's whole-day total — the card says so.
 */
export function todaySoFar({
  todayRows,
  yesterdayRows,
  yesterdayTotal,
  today,
  yesterday,
  now,
  timeZone,
}: {
  todayRows: readonly HourRow[] | null | undefined;
  yesterdayRows: readonly HourRow[] | null | undefined;
  /** Yesterday's whole-day summary, the fallback when its hours are missing. */
  yesterdayTotal?: { visitors: number | null; pageviews: number | null } | null;
  today: string;
  yesterday: string;
  now: Date;
  timeZone: string;
}) {
  const { hour, minute } = zonedParts(now, timeZone);
  const hours = dayHours(todayRows, today).map((entry) => ({ ...entry, future: entry.hour > hour }));
  const sum = (list: readonly DayHour[], key: 'visitors' | 'pageviews') => list.reduce((total, entry) => total + entry[key], 0);
  const visitors = sum(hours, 'visitors');
  const pageviews = sum(hours, 'pageviews');

  if (yesterdayRows) {
    const before = dayHours(yesterdayRows, yesterday);
    const upTo = (key: 'visitors' | 'pageviews') => sum(before.slice(0, hour), key) + before[hour]![key] * (minute / 60);
    const then = { visitors: upTo('visitors'), pageviews: upTo('pageviews') };
    return {
      hours,
      currentHour: hour,
      visitors,
      pageviews,
      compared: 'same-time' as const,
      then,
      visitorsChange: changeOf(visitors, then.visitors),
      pageviewsChange: changeOf(pageviews, then.pageviews),
    };
  }
  const then = { visitors: yesterdayTotal?.visitors ?? null, pageviews: yesterdayTotal?.pageviews ?? null };
  return {
    hours,
    currentHour: hour,
    visitors,
    pageviews,
    compared: then.visitors === null && then.pageviews === null ? ('none' as const) : ('day' as const),
    then,
    visitorsChange: changeOf(visitors, then.visitors),
    pageviewsChange: changeOf(pageviews, then.pageviews),
  };
}

// ── Visits per day ──────────────────────────────────────────────────────────

/**
 * The last fourteen whole days against the fourteen before. The headline is
 * visitors a day on average — exact, unlike a fortnight's "visitors" summed
 * from days, which counts a regular once per visit day. Pageviews add up.
 */
export function fortnightReading(
  daily: readonly { date: string; visitors: number; pageviews: number }[] | null | undefined,
  current: readonly string[],
  previous: readonly string[],
) {
  const byDay = new Map((daily ?? []).map((row) => [row.date.slice(0, 10), row]));
  const pick = (keys: readonly string[]) =>
    keys.map((date) => ({ date, visitors: byDay.get(date)?.visitors ?? 0, pageviews: byDay.get(date)?.pageviews ?? 0 }));
  const days = pick(current);
  const before = pick(previous);
  const total = (list: typeof days, key: 'visitors' | 'pageviews') => list.reduce((sum, day) => sum + day[key], 0);
  const average = (list: typeof days) => (list.length ? total(list, 'visitors') / list.length : 0);
  // The comparison exists only if the earlier fortnight had any traffic at all — a site connected last week has none.
  const hadBefore = before.some((day) => day.visitors > 0 || day.pageviews > 0);
  return {
    days,
    perDay: average(days),
    pageviews: total(days, 'pageviews'),
    perDayChange: hadBefore ? changeOf(average(days), average(before)) : null,
    pageviewsChange: hadBefore ? changeOf(total(days, 'pageviews'), total(before, 'pageviews')) : null,
    busiest: days.reduce<(typeof days)[number] | null>((best, day) => (day.visitors > 0 && (!best || day.visitors > best.visitors) ? day : best), null),
    empty: days.every((day) => day.visitors === 0 && day.pageviews === 0),
  };
}

// ── Top lists ───────────────────────────────────────────────────────────────

/**
 * The biggest rows of a breakdown, each with its share of the whole and its
 * length against the biggest (for its bar), and how many more there are.
 */
export function topRows(rows: readonly { key: string; value: number }[] | null | undefined, limit: number) {
  const positive = (rows ?? []).filter((row) => row.value > 0).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
  const total = positive.reduce((sum, row) => sum + row.value, 0);
  const max = positive[0]?.value ?? 0;
  const shown = positive.slice(0, Math.max(0, limit)).map((row) => ({
    ...row,
    share: total > 0 ? row.value / total : 0,
    ofMax: max > 0 ? row.value / max : 0,
  }));
  return { rows: shown, total, more: positive.length - shown.length };
}
