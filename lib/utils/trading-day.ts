// Where a location is in its own trading day. The dashboard reads today, so
// "today" has to mean the shop floor's day — the location's timezone and its
// configured hours — not the viewer's laptop clock.
//
// zonedNow/isWithinHours already exist as pure, unit-tested helpers in the agent
// module; they are imported rather than reimplemented so both surfaces agree on
// what "open" means, including the late shift that closes after midnight.
// Relative, not aliased: `node --experimental-strip-types` erases type-only
// imports but has to resolve value imports for real, and it does not know `@/`.
import type { DayHours, OpeningHours, Weekday } from '@/lib/modules/organization/client';

import { isWithinHours, zonedNow } from '../ai/agent-format.ts';

export type DayState =
  /** No hours configured for this location — we can't say when the day starts or ends. */
  | 'no-hours'
  /** Closed all day today. */
  | 'closed-today'
  /** Configured to open later today. */
  | 'before-open'
  /** Open now. */
  | 'trading'
  /** Opened and closed already today. */
  | 'after-close';

export interface TradingDay {
  state: DayState;
  timeZone: string;
  /** Weekday key in the location's zone, matching `openingHours`. */
  weekday: Weekday;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local wall clock, HH:MM. */
  time: string;
  /** Minutes since local midnight. */
  nowMinutes: number;
  hours: DayHours;
  openMinutes: number | null;
  /** Minutes since local midnight; a shift closing after midnight runs past 1440. */
  closeMinutes: number | null;
  /** How far through the trading day we are, 0–1. Null outside trading hours. */
  progress: number | null;
  /** Inclusive hour range the day's chart axis should cover. */
  axis: { firstHour: number; lastHour: number };
}

/** Minutes since midnight for a zero-padded "HH:MM". Null when unparseable. */
export function minutesOf(time: string | undefined | null): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** Fallback axis for a location with no hours set: a generous café day. */
const DEFAULT_AXIS = { firstHour: 7, lastHour: 22 };

export function resolveTradingDay(
  location: { timezone?: string | null; openingHours?: OpeningHours | null } | null | undefined,
  now = new Date(),
): TradingDay {
  const timeZone = location?.timezone || 'Europe/London';
  const { weekday, date, time } = zonedNow(timeZone, now);
  const nowMinutes = minutesOf(time) ?? 0;
  const hours = location?.openingHours?.[weekday] ?? null;

  const base = { timeZone, weekday, date, time, nowMinutes, hours };

  if (!location?.openingHours) {
    return { ...base, state: 'no-hours', openMinutes: null, closeMinutes: null, progress: null, axis: DEFAULT_AXIS };
  }
  if (!hours) {
    return { ...base, state: 'closed-today', openMinutes: null, closeMinutes: null, progress: null, axis: DEFAULT_AXIS };
  }

  const openMinutes = minutesOf(hours.open) ?? 0;
  const rawClose = minutesOf(hours.close) ?? 0;
  // A close at or before the open is the late shift: it belongs to tomorrow's clock.
  const closeMinutes = rawClose <= openMinutes ? rawClose + 24 * 60 : rawClose;

  const open = isWithinHours(time, hours.open, hours.close);
  const state: DayState = open ? 'trading' : nowMinutes < openMinutes ? 'before-open' : 'after-close';

  const span = closeMinutes - openMinutes;
  // Past midnight the wall clock has wrapped, so measure from the shifted clock.
  const elapsed = nowMinutes >= openMinutes ? nowMinutes - openMinutes : nowMinutes + 24 * 60 - openMinutes;

  return {
    ...base,
    state,
    openMinutes,
    closeMinutes,
    progress: state === 'trading' && span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : null,
    axis: {
      firstHour: Math.floor(openMinutes / 60),
      // Include the hour the close falls in, so a 17:30 close still shows 17:00–18:00.
      lastHour: Math.min(23, Math.ceil(closeMinutes / 60) - 1),
    },
  };
}

/**
 * The absolute minute span a chart of this day should cover.
 *
 * Minutes, not clock hours: a site open 18:00–02:00 runs to minute 1560, and an
 * axis built from clock hours would fold that back to the left-hand edge.
 */
export function axisRange(day: TradingDay) {
  if (day.openMinutes !== null && day.closeMinutes !== null && day.closeMinutes > day.openMinutes) {
    return { start: day.openMinutes, end: day.closeMinutes };
  }
  return { start: day.axis.firstHour * 60, end: (day.axis.lastHour + 1) * 60 };
}

/** Whether the trading day crosses midnight. */
export function isOvernight(day: TradingDay) {
  return day.closeMinutes !== null && day.closeMinutes > 24 * 60;
}

/**
 * Each hour bucket the chart covers, as { clock hour 0–23, its position in
 * axis-minute space }. The two differ once the day passes midnight.
 */
export function axisHours(day: TradingDay) {
  const { start, end } = axisRange(day);
  const buckets: Array<{ hour: number; startMinutes: number }> = [];
  for (let minutes = Math.floor(start / 60) * 60; minutes < end; minutes += 60) {
    buckets.push({ hour: Math.floor(minutes / 60) % 24, startMinutes: minutes });
  }
  return buckets;
}

/** "Now" expressed in the same axis-minute space, so 01:00 on a late shift sits at the right-hand end. */
export function axisNowMinutes(day: TradingDay) {
  const { start } = axisRange(day);
  if (isOvernight(day) && day.nowMinutes < start) return day.nowMinutes + 24 * 60;
  return day.nowMinutes;
}

/** Human label for the day's state, in the product's plain operator voice. */
export function tradingDayLabel(day: TradingDay): string {
  switch (day.state) {
    case 'trading':
      return day.hours ? `Open until ${day.hours.close}` : 'Open';
    case 'before-open':
      return day.hours ? `Opens at ${day.hours.open}` : 'Not open yet';
    case 'after-close':
      return day.hours ? `Closed at ${day.hours.close}` : 'Closed';
    case 'closed-today':
      return 'Closed today';
    case 'no-hours':
      return 'Trading hours not set';
  }
}
