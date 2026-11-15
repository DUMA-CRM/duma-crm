// ---------------------------------------------------------------------------
// The pro rota's working-time check. Given a run of real shifts (ISO instants)
// it says where a person would break a rule: a missing break, too little rest,
// overlapping shifts, too many hours in the week (or the day, for under-18s),
// a position they aren't qualified for, approved leave, or a time they said
// they can't work. Warnings, never a block — UK opt-outs and emergencies exist.
//
// duma-api has an identical copy in `src/lib/rota-rules.ts`, which re-checks
// claims and swaps before a manager approves them. Change both together.
// ---------------------------------------------------------------------------
import type { Availability, WorkingTimeRules } from '../api/rota.service';

export type { WorkingTimeRules };

/** UK Working Time Regulations 1998 — adults, and young workers (under 18). */
export const UK_RULES: WorkingTimeRules = {
  breakAfterMinutes: 6 * 60,
  minBreakMinutes: 20,
  restMinutes: 11 * 60,
  weeklyMinutes: 48 * 60,
  minorDailyMinutes: 8 * 60,
  minorWeeklyMinutes: 40 * 60,
  minorRestMinutes: 12 * 60,
  minorBreakAfterMinutes: 4.5 * 60,
  minorMinBreakMinutes: 30,
};

export const rulesFor = (overrides: Partial<WorkingTimeRules> | undefined): WorkingTimeRules => ({ ...UK_RULES, ...overrides });

export type RuleShift = {
  id: string;
  userId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  positionId: string | null;
};

export type RulePerson = {
  userId: string;
  isMinor: boolean;
  positionIds: string[];
  contractedWeeklyMinutes: number | null;
};

export type RuleWarning =
  | { kind: 'break'; shiftId: string; userId: string; lengthMinutes: number; requiredBreak: number }
  | { kind: 'rest'; shiftId: string; userId: string; restMinutes: number; requiredRest: number }
  | { kind: 'overlap'; shiftId: string; userId: string; otherShiftId: string }
  | { kind: 'weekly'; userId: string; paidMinutes: number; limit: number }
  | { kind: 'daily'; shiftId: string; userId: string; paidMinutes: number; limit: number }
  | { kind: 'unqualified'; shiftId: string; userId: string; positionId: string }
  | { kind: 'leave'; shiftId: string; userId: string }
  | { kind: 'unavailable'; shiftId: string; userId: string }
  | { kind: 'over_contract'; userId: string; paidMinutes: number; contractedMinutes: number };

export type RuleContext = {
  leave?: readonly { userId: string; startDate: string; endDate: string }[];
  availability?: readonly Pick<Availability, 'userId' | 'weekday' | 'startMinute' | 'endMinute' | 'kind'>[];
  timeZone?: string;
};

const MINUTE = 60_000;

export const lengthMinutes = (shift: Pick<RuleShift, 'startsAt' | 'endsAt'>) =>
  Math.max(0, Math.round((Date.parse(shift.endsAt) - Date.parse(shift.startsAt)) / MINUTE));

export const paidMinutes = (shift: Pick<RuleShift, 'startsAt' | 'endsAt' | 'breakMinutes'>) =>
  Math.max(0, lengthMinutes(shift) - (shift.breakMinutes || 0));

const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** The local calendar date, weekday (0 = Monday) and minute of day of an instant. */
export function localParts(iso: string | number, timeZone = 'UTC'): { date: string; weekday: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY[parts.weekday] ?? 0,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function unavailableFor(shift: RuleShift, rules: RuleContext['availability'], timeZone: string): boolean {
  if (!rules?.length || !shift.userId) return false;
  const start = localParts(shift.startsAt, timeZone);
  const end = start.minute + lengthMinutes(shift);
  return rules.some((rule) => {
    if (rule.userId !== shift.userId || rule.kind !== 'unavailable' || rule.weekday !== start.weekday) return false;
    if (rule.startMinute == null || rule.endMinute == null) return true;
    return start.minute < rule.endMinute && end > rule.startMinute;
  });
}

/**
 * Every rule the passed shifts break. Pass the whole week (plus the evening
 * before it, if you have it) so rest is checked across the gap between days.
 * Shifts without a person are skipped.
 */
export function checkRota(
  shifts: readonly RuleShift[],
  people: readonly RulePerson[],
  rules: WorkingTimeRules = UK_RULES,
  context: RuleContext = {},
): RuleWarning[] {
  const warnings: RuleWarning[] = [];
  const timeZone = context.timeZone ?? 'UTC';
  const byPerson = new Map<string, RuleShift[]>();
  for (const shift of shifts) {
    if (!shift.userId) continue;
    const list = byPerson.get(shift.userId) ?? [];
    list.push(shift);
    byPerson.set(shift.userId, list);
  }

  for (const [userId, list] of byPerson) {
    const person = people.find((p) => p.userId === userId);
    const minor = person?.isMinor ?? false;
    const breakAfter = minor ? rules.minorBreakAfterMinutes : rules.breakAfterMinutes;
    const minBreak = minor ? rules.minorMinBreakMinutes : rules.minBreakMinutes;
    const rest = minor ? rules.minorRestMinutes : rules.restMinutes;
    const weekly = minor ? rules.minorWeeklyMinutes : rules.weeklyMinutes;
    const sorted = [...list].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const perDay = new Map<string, { minutes: number; shiftId: string }>();
    let total = 0;

    let latest: RuleShift | undefined;
    sorted.forEach((shift) => {
      const length = lengthMinutes(shift);
      const paid = paidMinutes(shift);
      total += paid;

      if (breakAfter !== null && length > breakAfter && (shift.breakMinutes || 0) < minBreak)
        warnings.push({ kind: 'break', shiftId: shift.id, userId, lengthMinutes: length, requiredBreak: minBreak });

      // Compare with whichever earlier shift ends last, so a short shift
      // inside a long one is still caught.
      const before = latest;
      if (before) {
        const gap = Math.round((Date.parse(shift.startsAt) - Date.parse(before.endsAt)) / MINUTE);
        if (gap < 0) warnings.push({ kind: 'overlap', shiftId: shift.id, userId, otherShiftId: before.id });
        else if (rest !== null && gap < rest) warnings.push({ kind: 'rest', shiftId: shift.id, userId, restMinutes: gap, requiredRest: rest });
      }
      if (!latest || Date.parse(shift.endsAt) > Date.parse(latest.endsAt)) latest = shift;

      if (shift.positionId && person && !person.positionIds.includes(shift.positionId))
        warnings.push({ kind: 'unqualified', shiftId: shift.id, userId, positionId: shift.positionId });

      const day = localParts(shift.startsAt, timeZone).date;
      if (context.leave?.some((l) => l.userId === userId && l.startDate <= day && day <= l.endDate))
        warnings.push({ kind: 'leave', shiftId: shift.id, userId });
      if (unavailableFor(shift, context.availability, timeZone)) warnings.push({ kind: 'unavailable', shiftId: shift.id, userId });

      const sum = perDay.get(day);
      perDay.set(day, { minutes: (sum?.minutes ?? 0) + paid, shiftId: shift.id });
    });

    if (minor && rules.minorDailyMinutes !== null)
      for (const { minutes, shiftId } of perDay.values())
        if (minutes > rules.minorDailyMinutes) warnings.push({ kind: 'daily', shiftId, userId, paidMinutes: minutes, limit: rules.minorDailyMinutes });

    if (weekly !== null && total > weekly) warnings.push({ kind: 'weekly', userId, paidMinutes: total, limit: weekly });
    else if (person?.contractedWeeklyMinutes != null && total > person.contractedWeeklyMinutes)
      warnings.push({ kind: 'over_contract', userId, paidMinutes: total, contractedMinutes: person.contractedWeeklyMinutes });
  }
  return warnings;
}

const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10}h`;

/** One short sentence per warning, for a tooltip or a list. */
export function describeWarning(warning: RuleWarning): string {
  switch (warning.kind) {
    case 'break':
      return `${hours(warning.lengthMinutes)} shift needs a ${warning.requiredBreak}-minute break`;
    case 'rest':
      return `Only ${hours(warning.restMinutes)} rest since the last shift (needs ${hours(warning.requiredRest)})`;
    case 'overlap':
      return 'Overlaps another shift';
    case 'weekly':
      return `${hours(warning.paidMinutes)} this week — over the ${hours(warning.limit)} limit`;
    case 'daily':
      return `${hours(warning.paidMinutes)} in one day — under-18s are limited to ${hours(warning.limit)}`;
    case 'unqualified':
      return 'Not trained for this position';
    case 'leave':
      return 'On leave that day';
    case 'unavailable':
      return 'Said they can’t work then';
    case 'over_contract':
      return `${hours(warning.paidMinutes)} — over their ${hours(warning.contractedMinutes)} contract`;
  }
}

/** Legal problems are serious; contract overrun is a nudge. */
export const isSerious = (warning: RuleWarning) => warning.kind !== 'over_contract';
