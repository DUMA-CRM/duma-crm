import { addDays } from '../utils/reservations.ts';
import { type FigureChange, figureChange } from '../utils/today-figures.ts';
import { zonedParts, zonedToInstant } from '../utils/workspace-time.ts';

/* The "This week" widget's arithmetic: the trading week so far — Monday to now
   at the business — against the same stretch of last week, and the week as a
   bar a day. Every day is the business's calendar day, so a week across a
   clock change still has seven days and Monday starts at midnight there. */

export interface WeekWindows {
  /** Today at the business, `YYYY-MM-DD`. */
  today: string;
  /** Monday to Sunday of this week. */
  days: string[];
  /** The same seven days a week earlier. */
  lastDays: string[];
  /** Today's place in the week, Monday = 0. */
  todayIndex: number;
  /** Monday's midnight to the last instant of today — stable all day, so it makes a stable query key. */
  thisWeek: { from: string; to: string };
  /** Last Monday's midnight to the same wall-clock minute a week ago: a fair "by now". */
  lastWeek: { from: string; to: string };
}

const instant = (date: string, time: string, timeZone?: string) => {
  const at = zonedToInstant(date, time, timeZone);
  if (!at) throw new Error(`Not a calendar date: ${date}`);
  return at;
};

/** This week so far and last week to the same point, in the zone. Weeks start on Monday. */
export function weekWindows(now: Date, timeZone?: string): WeekWindows {
  const parts = zonedParts(now, timeZone);
  const todayIndex = (parts.weekday + 6) % 7;
  const monday = addDays(parts.date, -todayIndex);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const lastDays = days.map((day) => addDays(day, -7));
  // The API's `to` is inclusive, so a window ends a millisecond before the next midnight.
  const endOfToday = instant(addDays(parts.date, 1), '00:00', timeZone).getTime() - 1;
  // The same clock time a week ago, not now minus 7×24h — across a clock change those differ by an hour.
  const sameTimeLastWeek = instant(addDays(parts.date, -7), parts.time, timeZone);
  return {
    today: parts.date,
    days,
    lastDays,
    todayIndex,
    thisWeek: { from: instant(monday, '00:00', timeZone).toISOString(), to: new Date(endOfToday).toISOString() },
    lastWeek: {
      from: instant(lastDays[0]!, '00:00', timeZone).toISOString(),
      to: new Date(sameTimeLastWeek.getTime() + 59_999).toISOString(),
    },
  };
}

const amount = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Net sales per day of `days`, from the API's `daily[]`. The API dates a sale
 * by its UTC day, so a sale in the window's first hours can come back dated
 * the day before the first day (and the last hours the day after the last):
 * those fold into the end they belong to, so the bars always add up to the
 * window's total.
 */
export function salesByDay(rows: readonly { date: string; revenue: string | number | null }[], days: readonly string[]): number[] {
  const out = days.map(() => 0);
  if (days.length === 0) return out;
  const first = days[0]!;
  const last = days[days.length - 1]!;
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const index = date < first ? 0 : date > last ? days.length - 1 : days.indexOf(date);
    if (index >= 0) out[index] += amount(row.revenue);
  }
  return out;
}

export interface WeekSales {
  /** Net sales this week so far. */
  net: number;
  /** Net sales last week to the same point; null while it isn't known. */
  lastWeek: number | null;
  change: FigureChange;
  orders: number;
  /** Mon–Sun this week; days to come are 0. */
  bars: number[];
  /** Mon–Sun last week, up to the same point; days after it are 0. */
  lastBars: number[];
  /** The best day so far this week (index), or -1 before anything is taken. */
  best: number;
}

/** The week's reading from the two order-analytics answers. Totals come from the summaries, which the API cuts exactly at the window. */
export function weekSales(
  windows: Pick<WeekWindows, 'days' | 'lastDays' | 'todayIndex'>,
  current: { summary: { totalRevenue: string | null; totalOrders: number }; daily: { date: string; revenue: string | null }[] },
  previous?: { summary: { totalRevenue: string | null }; daily: { date: string; revenue: string | null }[] } | null,
): WeekSales {
  const net = amount(current.summary.totalRevenue);
  const lastWeek = previous ? amount(previous.summary.totalRevenue) : null;
  // Only days that have started can have taken anything; fold anything later into today.
  const elapsed = windows.days.slice(0, windows.todayIndex + 1);
  const bars = [...salesByDay(current.daily, elapsed), ...windows.days.slice(windows.todayIndex + 1).map(() => 0)];
  const lastElapsed = windows.lastDays.slice(0, windows.todayIndex + 1);
  const lastBars = previous
    ? [...salesByDay(previous.daily, lastElapsed), ...windows.lastDays.slice(windows.todayIndex + 1).map(() => 0)]
    : windows.days.map(() => 0);
  let best = -1;
  bars.forEach((value, index) => {
    if (value > 0 && (best < 0 || value > bars[best]!)) best = index;
  });
  return { net, lastWeek, change: figureChange(net, lastWeek), orders: current.summary.totalOrders, bars, lastBars, best };
}
