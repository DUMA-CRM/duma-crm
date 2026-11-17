import type { DayBaseline } from '@/lib/modules/analytics/client';

import { percentageChange } from './dashboard.ts';
import { zonedToInstant } from './workspace-time.ts';

/* The arithmetic behind the dashboard's figures: what a figure is compared
   with, how the change reads, and how a bar is scaled. Kept out of the
   components so each rule is written down once and tested. */

/** Below this much taken, labour as a share of sales is noise: two coffees and one person on shift is not a 400% problem. */
export const LABOUR_SHARE_FLOOR = 50;

/** Labour over this share of sales is flagged. */
export const LABOUR_SHARE_WARNING = 35;

/** Baseline order count by this minute of the day, interpolated inside the current hour. */
export function baselineOrdersByMinute(baseline: DayBaseline | undefined | null, minutes: number): number {
  if (!baseline?.byHour?.length) return 0;
  const hour = Math.min(23, Math.max(0, Math.floor(minutes / 60)));
  const completed = hour > 0 ? (baseline.byHour[hour - 1]?.cumulativeOrders ?? 0) : 0;
  return completed + (baseline.byHour[hour]?.orderCount ?? 0) * ((minutes % 60) / 60);
}

export interface FigureChange {
  /** Whole percent, signed; null when there is nothing to compare with. */
  percent: number | null;
  direction: 'up' | 'down' | 'flat' | 'none';
}

/** A figure against what it is measured by, as a whole-percent change. Rounds to 0 → flat. */
export function figureChange(current: number, reference: number | null | undefined): FigureChange {
  if (reference === null || reference === undefined || !Number.isFinite(reference) || reference <= 0) {
    return { percent: null, direction: 'none' };
  }
  const change = percentageChange(current, reference);
  if (change === null) return { percent: null, direction: 'none' };
  const percent = Math.round(change);
  return { percent, direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat' };
}

/** Labour as a whole-number share of what has been taken, or null below the floor. */
export function labourShare(cost: number, revenue: number): number | null {
  if (!Number.isFinite(cost) || !Number.isFinite(revenue) || revenue < LABOUR_SHARE_FLOOR) return null;
  return (cost / revenue) * 100;
}

/** The calendar date seven days before `date` (YYYY-MM-DD), by the calendar — not 168 hours. */
export function dateWeekBefore(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) - 7)).toISOString().slice(0, 10);
}

/**
 * The same weekday last week, from its local midnight to the same wall-clock
 * time — so a Thursday at 14:05 is held against last Thursday up to 14:05,
 * whatever the clocks did in between.
 */
export function sameTimeLastWeek(date: string, time: string, timeZone: string): { from: string; to: string } | null {
  const lastWeek = dateWeekBefore(date);
  if (!lastWeek) return null;
  const from = zonedToInstant(lastWeek, '00:00', timeZone);
  const to = zonedToInstant(lastWeek, time, timeZone);
  if (!from || !to || to.getTime() < from.getTime()) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * A bar's height as a percentage of the tallest, with a floor so a small
 * non-zero value is still visible; zero stays a hairline.
 */
export function barPercent(value: number, max: number, floor = 4): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(floor, (value / max) * 100));
}

const WEEKDAY_NAMES: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** `thu` → `Thursday`, for "vs a typical Thursday"; anything unknown is returned as it came. */
export const weekdayName = (key: string) => WEEKDAY_NAMES[key] ?? key;
