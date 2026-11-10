import { parseAmount } from './margin-calculator.ts';

/**
 * The public rota builder (/tools/rota-builder): a week of shifts for a small
 * team, its hours and staff cost, and the working-time rules it breaks.
 * Pure — the week, the rules and every shift are passed in — so each rule is
 * testable. Money is in minor units (pence, cents) throughout, so a week of
 * hours × rates never drifts.
 */

export const DAYS_IN_WEEK = 7;
const DAY = 24 * 60;

/** A shift as typed: 24-hour "HH:MM" times, and an unpaid break in minutes. */
export type RotaShift = { start: string; end: string; breakMinutes: number };

export type RotaPerson = {
  id: number;
  name: string;
  role: string;
  /** £ per hour, as typed. Blank means "don't cost this person". */
  rate: string;
  /** Monday first. */
  shifts: (RotaShift | null)[];
};

/** Common shift shapes for a café or restaurant, offered as one-tap presets. */
export const SHIFT_PRESETS: readonly { label: string; shift: RotaShift }[] = [
  { label: 'Open', shift: { start: '07:00', end: '15:00', breakMinutes: 30 } },
  { label: 'Middle', shift: { start: '10:00', end: '18:00', breakMinutes: 30 } },
  { label: 'Close', shift: { start: '14:00', end: '22:00', breakMinutes: 30 } },
  { label: 'Lunch', shift: { start: '11:00', end: '15:00', breakMinutes: 0 } },
];

/**
 * A clock time as typed — "07:30", "7:30", "0730", "7" — as minutes after
 * midnight. Unreadable input is `null`. "24:00" is accepted as the end of the day.
 */
export function parseClock(input: string): number | null {
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(input.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

/** "07:30" for 450 minutes; a shift past midnight wraps to the next day's clock. */
export function formatClock(minutes: number): string {
  const wrapped = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** "07–15" for a shift on the hour, "07:30–15" otherwise — the short form the rota grid shows. */
export function shortShift(shift: RotaShift): string {
  const short = (input: string) => {
    const minutes = parseClock(input);
    if (minutes === null) return input;
    const clock = formatClock(minutes);
    return clock.endsWith(':00') ? clock.slice(0, 2) : clock;
  };
  return `${short(shift.start)}–${short(shift.end)}`;
}

export type ShiftSpan = {
  /** Minutes after the shift's own midnight. */
  start: number;
  /** After `start`; past 1440 for a shift that ends after midnight. */
  end: number;
  /** End to start, breaks included. */
  lengthMinutes: number;
  /** What is paid: the length less the unpaid break, never below zero. */
  paidMinutes: number;
};

/**
 * Where a shift sits in its day. An end at or before the start is read as
 * past midnight (22:00–02:00 is four hours). A start equal to the end is not
 * a shift — a 24-hour shift is not something to plan in a café — so `null`,
 * as is any unreadable time.
 */
export function shiftSpan(shift: RotaShift): ShiftSpan | null {
  const start = parseClock(shift.start);
  const rawEnd = parseClock(shift.end);
  if (start === null || rawEnd === null || start === rawEnd || start >= DAY) return null;
  const end = rawEnd > start ? rawEnd : rawEnd + DAY;
  const lengthMinutes = end - start;
  const breakMinutes = Math.max(0, Math.round(shift.breakMinutes) || 0);
  return { start, end, lengthMinutes, paidMinutes: Math.max(0, lengthMinutes - breakMinutes) };
}

/** An hourly rate in minor units (pence, cents), or `null` when it is blank or unreadable. */
export function ratePence(rate: string): number | null {
  const value = parseAmount(rate);
  return value === null ? null : Math.round(value * 100);
}

/** Paid minutes at an hourly rate, in pence, rounded to the penny. */
export function costPence(paidMinutes: number, hourlyPence: number): number {
  return Math.round((paidMinutes * hourlyPence) / 60);
}

export type PersonTotals = { id: number; paidMinutes: number; shifts: number; costPence: number | null };
export type DayTotals = { paidMinutes: number; people: number; costPence: number };

export type RotaSummary = {
  people: PersonTotals[];
  /** Monday first. */
  days: DayTotals[];
  paidMinutes: number;
  /** Only people with a rate; see `unpricedMinutes`. */
  costPence: number;
  /** Hours worked by people with no rate, left out of the cost. */
  unpricedMinutes: number;
  /** Staff cost as a share of the expected sales, or `null` without sales. */
  labourPct: number | null;
};

/**
 * The week's hours and cost, by person and by day, and labour as a
 * percentage of the sales the manager expects. Sales are compared as typed;
 * the page asks for them before VAT, the way labour % is usually measured.
 */
export function rotaSummary(people: readonly RotaPerson[], expectedSales = ''): RotaSummary {
  const days: DayTotals[] = Array.from({ length: DAYS_IN_WEEK }, () => ({ paidMinutes: 0, people: 0, costPence: 0 }));
  let unpricedMinutes = 0;

  const totals = people.map((person) => {
    const rate = ratePence(person.rate);
    let paidMinutes = 0;
    let shifts = 0;
    let cost = 0;
    person.shifts.slice(0, DAYS_IN_WEEK).forEach((shift, index) => {
      const span = shift && shiftSpan(shift);
      if (!span) return;
      shifts += 1;
      paidMinutes += span.paidMinutes;
      days[index].paidMinutes += span.paidMinutes;
      days[index].people += 1;
      if (rate === null) return;
      const shiftCost = costPence(span.paidMinutes, rate);
      cost += shiftCost;
      days[index].costPence += shiftCost;
    });
    if (rate === null) unpricedMinutes += paidMinutes;
    return { id: person.id, paidMinutes, shifts, costPence: rate === null ? null : cost };
  });

  const costTotal = totals.reduce((sum, person) => sum + (person.costPence ?? 0), 0);
  const sales = parseAmount(expectedSales);
  return {
    people: totals,
    days,
    paidMinutes: totals.reduce((sum, person) => sum + person.paidMinutes, 0),
    costPence: costTotal,
    unpricedMinutes,
    labourPct: sales && sales > 0 ? (costTotal / Math.round(sales * 100)) * 100 : null,
  };
}

/**
 * The working-time limits a rota is checked against. Each is `null` when the
 * visitor's country has no such rule, or they turn it off. Rules differ by
 * country, so these are settings, not law.
 */
export type WorkingTimeRules = {
  /** A shift longer than this needs a break of at least `minBreakMinutes`. */
  breakAfterMinutes: number | null;
  minBreakMinutes: number;
  /** The least rest between one shift's end and the next one's start. */
  restMinutes: number | null;
  /** The most paid time in the week. */
  weeklyMinutes: number | null;
};

/**
 * The defaults: the EU Working Time Directive and the UK's Working Time
 * Regulations 1998, for adult workers — a 20-minute break on a shift over six
 * hours, 11 hours' rest between working days, and 48 hours a week (an average,
 * which a UK worker can opt out of).
 */
export const DEFAULT_RULES: WorkingTimeRules = {
  breakAfterMinutes: 6 * 60,
  minBreakMinutes: 20,
  restMinutes: 11 * 60,
  weeklyMinutes: 48 * 60,
};

export type RotaWarning =
  | { kind: 'break'; personId: number; day: number; lengthMinutes: number }
  | { kind: 'rest'; personId: number; day: number; restMinutes: number }
  | { kind: 'weekly'; personId: number; paidMinutes: number };

/**
 * Where the week breaks the working-time rules. `day` is the day of the shift
 * at fault — for rest, the day that starts too soon after the one before.
 * Rest is checked inside the week only: the tool plans one week. A warning,
 * not a verdict: young workers have stricter limits, and the rules differ by
 * country.
 */
export function rotaWarnings(people: readonly RotaPerson[], rules: WorkingTimeRules = DEFAULT_RULES): RotaWarning[] {
  const warnings: RotaWarning[] = [];
  for (const person of people) {
    let paidMinutes = 0;
    let previousEnd: number | null = null;
    for (let day = 0; day < DAYS_IN_WEEK; day += 1) {
      const shift = person.shifts[day];
      const span = shift && shiftSpan(shift);
      if (!span || !shift) {
        previousEnd = null;
        continue;
      }
      paidMinutes += span.paidMinutes;
      if (rules.breakAfterMinutes !== null && span.lengthMinutes > rules.breakAfterMinutes && shift.breakMinutes < rules.minBreakMinutes) {
        warnings.push({ kind: 'break', personId: person.id, day, lengthMinutes: span.lengthMinutes });
      }
      const start = day * DAY + span.start;
      if (rules.restMinutes !== null && previousEnd !== null && start - previousEnd < rules.restMinutes) {
        warnings.push({ kind: 'rest', personId: person.id, day, restMinutes: start - previousEnd });
      }
      previousEnd = day * DAY + span.end;
    }
    if (rules.weeklyMinutes !== null && paidMinutes > rules.weeklyMinutes)
      warnings.push({ kind: 'weekly', personId: person.id, paidMinutes });
  }
  return warnings;
}

/** "37.5h", "8h", "0h" — hours to one decimal place, the way a rota totals them. */
export function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

/** 1 for a week that starts on Monday, 0 for Sunday — as Date.getDay() numbers them. */
export type FirstDay = 0 | 1;

/**
 * The first day of the week on or before a date, as YYYY-MM-DD. The date is
 * read in UTC, so pass the visitor's local date.
 */
export function weekStartOf(date: string, firstDay: FirstDay = 1): string | null {
  const at = parseDate(date);
  if (at === null) return null;
  const back = (new Date(at).getUTCDay() - firstDay + 7) % 7;
  return new Date(at - back * 86_400_000).toISOString().slice(0, 10);
}

/** A week start moved by whole weeks: -1 for the week before. */
export function shiftWeek(start: string, weeks: number): string {
  const at = parseDate(start) ?? Date.UTC(2026, 10, 9);
  return new Date(at + weeks * 7 * 86_400_000).toISOString().slice(0, 10);
}

/** The seven days from the week's first: "Mon", "10 Nov", and whether it is a Saturday or Sunday. */
export function weekDays(start: string): { short: string; date: string; long: string; weekend: boolean }[] {
  const first = parseDate(start) ?? Date.UTC(2026, 10, 9);
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const at = new Date(first + index * 86_400_000);
    return {
      weekend: at.getUTCDay() === 0 || at.getUTCDay() === 6,
      short: at.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      date: at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      long: at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
    };
  });
}

function parseDate(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const at = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(at) ? at : null;
}

/**
 * A minor-unit amount in the rota's currency, with that currency's own
 * decimals: "£1,938.15", "€12.50", "¥1,200". Hourly rates are held ×100
 * whatever the currency, so a yen rate of 1,200 is 120,000 here.
 */
export function formatRotaMoney(minor: number, currency: string): string {
  let digits = 2;
  try {
    digits = new Intl.NumberFormat('en-GB', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    // An unknown code still prints, with two decimals.
  }
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(digits)} ${currency}`;
  }
}
