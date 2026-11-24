/**
 * Pay periods, as dates. Weekly and fortnightly run Monday to Sunday;
 * twice-monthly is the 1st–15th and the 16th–end; monthly is the calendar
 * month. Mirrors duma-api `src/lib/payroll-schedule.ts` so a run started here
 * covers the same dates the automatic job would. Local dates, `YYYY-MM-DD`.
 */
import type { PayrollPeriod } from '../api/payroll.service.ts';

import { zonedParts } from './workspace-time.ts';

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

/** The workspace's today as a local calendar Date — the periods are dates, so only "today" needs the zone. */
export function workspaceToday(now = new Date()): Date {
  const { year, month, day } = zonedParts(now);
  return new Date(year, month - 1, day);
}

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
  const start = isFortnightStart(monday) ? monday : addDays(monday, -7);
  const end = addDays(start, 13);
  return { from: iso(start), to: iso(end), label: `${DAY.format(start)} – ${DAY.format(end)} ${end.getFullYear()}` };
}

/**
 * The Monday every fortnight is counted from. It is in an even ISO week, so
 * every 2026 fortnight is unchanged from the old "even ISO week" rule — which
 * broke at a 53-week year: 28 Dec 2026 (week 53) and 4 Jan 2027 (week 1) are
 * both odd, so the two fortnights around new year overlapped by a week.
 * Must match duma-api `src/lib/payroll-schedule.ts`.
 */
export const FORTNIGHT_ANCHOR = { year: 2026, month: 1, day: 5 } as const;

/** Whether this Monday starts a fortnight: an even number of whole weeks from the anchor, either side of it. */
export function isFortnightStart(monday: Date): boolean {
  const days = Math.round(
    (Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) -
      Date.UTC(FORTNIGHT_ANCHOR.year, FORTNIGHT_ANCHOR.month - 1, FORTNIGHT_ANCHOR.day)) /
      86_400_000,
  );
  const weeks = Math.floor(days / 7);
  // A true modulo: -1 % 2 is -1 in JavaScript, and the weeks before the anchor are negative.
  return ((weeks % 2) + 2) % 2 === 0;
}

/** The last `count` periods, most recent first, starting with the one containing `today`. */
export function recentPeriods(period: PayrollPeriod, count: number, today = workspaceToday()): PayPeriodRange[] {
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

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ordinal = (day: number) => {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  return `${day}${teen ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th')}`;
};

/**
 * When the automatic finalisation runs, the way duma-api's `payroll-schedule.ts`
 * decides it: "Every Friday" · "Every other Friday" · "On the 1st and 16th" ·
 * "On the 25th" (a short month runs on its last day).
 */
export function payDayInWords(schedule: { payrollPeriod: PayrollPeriod; payrollPayDayOfMonth: number; payrollPayWeekday: number }): string {
  if (schedule.payrollPeriod === 'monthly') return `On the ${ordinal(Math.min(Math.max(1, schedule.payrollPayDayOfMonth), 31))}`;
  if (schedule.payrollPeriod === 'semi_monthly') return 'On the 1st and 16th';
  const weekday = WEEKDAYS[Math.min(Math.max(1, schedule.payrollPayWeekday), 7) - 1];
  return schedule.payrollPeriod === 'fortnightly' ? `Every other ${weekday}` : `Every ${weekday}`;
}
