/**
 * Pay periods, as dates. Weekly and fortnightly run Monday to Sunday;
 * twice-monthly is the 1st–15th and the 16th–end; monthly is the calendar
 * month. Mirrors duma-api `src/lib/payroll-schedule.ts` so a run started here
 * covers the same dates the automatic job would. Local dates, `YYYY-MM-DD`.
 */
import type { PayrollPeriod } from '../api/payroll.service.ts';

export const PERIODS_PER_YEAR: Record<PayrollPeriod, number> = { weekly: 52, fortnightly: 26, semi_monthly: 24, monthly: 12 };

export const PERIOD_LABEL: Record<PayrollPeriod, { name: string; noun: string }> = {
  weekly: { name: 'Weekly', noun: 'week' },
  fortnightly: { name: 'Every two weeks', noun: 'fortnight' },
  semi_monthly: { name: 'Twice a month', noun: 'half-month' },
  monthly: { name: 'Monthly', noun: 'month' },
};

export interface PayPeriodRange {
  from: string;
  to: string;
  label: string;
}

const pad = (value: number) => String(value).padStart(2, '0');
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

/** The period of this kind that contains `date`. */
export function periodContaining(period: PayrollPeriod, date: Date): PayPeriodRange {
  if (period === 'monthly') {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: iso(first), to: iso(last), label: MONTH.format(first) };
  }
  if (period === 'semi_monthly') {
    const firstHalf = date.getDate() <= 15;
    const from = new Date(date.getFullYear(), date.getMonth(), firstHalf ? 1 : 16);
    const to = firstHalf ? new Date(date.getFullYear(), date.getMonth(), 15) : new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: iso(from), to: iso(to), label: `${DAY.format(from)} – ${DAY.format(to)} ${to.getFullYear()}` };
  }
  const monday = mondayOf(date);
  if (period === 'weekly') {
    const sunday = addDays(monday, 6);
    return { from: iso(monday), to: iso(sunday), label: `${DAY.format(monday)} – ${DAY.format(sunday)} ${sunday.getFullYear()}` };
  }
  // A fortnight starts on an even ISO week — the same fortnights the API's job
  // takes (on an even week's pay day it covers the two weeks just ended).
  const start = isoWeekNumber(monday) % 2 === 0 ? monday : addDays(monday, -7);
  const end = addDays(start, 13);
  return { from: iso(start), to: iso(end), label: `${DAY.format(start)} – ${DAY.format(end)} ${end.getFullYear()}` };
}

/** The last `count` periods, most recent first, starting with the one containing `today`. */
export function recentPeriods(period: PayrollPeriod, count: number, today = new Date()): PayPeriodRange[] {
  const out: PayPeriodRange[] = [];
  let cursor = today;
  for (let index = 0; index < count; index += 1) {
    const range = periodContaining(period, cursor);
    out.push(range);
    const [year, month, date] = range.from.split('-').map(Number);
    cursor = new Date(year, month - 1, date - 1);
  }
  return out;
}

/** ISO 8601 week number. */
export function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** "1 Oct – 31 Oct 2026" for any stored range. */
export function rangeLabel(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  if (fd === 1 && end.getDate() === new Date(ty, tm, 0).getDate() && fm === tm && fy === ty) return MONTH.format(start);
  return `${DAY.format(start)} – ${DAY.format(end)} ${ty}`;
}
