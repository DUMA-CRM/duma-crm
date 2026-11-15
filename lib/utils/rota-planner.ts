// ---------------------------------------------------------------------------
// The manager's rota planner: the arithmetic behind the week grid. Labour cost
// (paid hours × rate, plus the employer's on-cost), labour as a share of sales
// and its band against the location's target, hours against each contract,
// what is still unpublished, what a person's day looks like (leave, said they
// can't work), moving a shift to another day at the same wall-clock time, and
// grouping by position. Pure — the planner bundle is passed in — so the money
// and time rules are testable. Money is in pence throughout.
// ---------------------------------------------------------------------------
import type { Availability, LabourTargets, PlannerLeave, PlannerSales, PlannerStaff, Position } from '../api/rota.service';

import { parseAmount } from './margin-calculator.ts';
import { costPence, ratePence } from './rota-builder.ts';
import { type RuleWarning, localParts, paidMinutes } from './rota-rules.ts';
import { zonedToInstant } from './workspace-time.ts';

export type PlannerShift = {
  id: string;
  userId?: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes?: number;
  status: string;
  positionId?: string | null;
  position?: { id: string; name: string; color: string } | null;
  publishedAt?: string | null;
  acknowledgedAt?: string | null;
  createdAt?: string;
};

const pad = (value: number) => String(value).padStart(2, '0');

// ── Dates ───────────────────────────────────────────────────────────────────

/** A calendar date `days` later (or earlier), as YYYY-MM-DD. Never touched by a zone. */
export function addDays(date: string, days: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** Monday to Sunday of the week starting `weekStart`. */
export const weekDates = (weekStart: string) => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

/** "09:30" for a minute of the day; 1440 reads "24:00". */
export const formatMinute = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

/** The local day a shift belongs to — the day it starts on at the location. */
export const shiftDate = (shift: Pick<PlannerShift, 'startsAt'>, timeZone: string) => localParts(shift.startsAt, timeZone).date;

const paidOf = (shift: PlannerShift) =>
  paidMinutes({ startsAt: shift.startsAt, endsAt: shift.endsAt, breakMinutes: shift.breakMinutes ?? 0 });
const counts = (shift: PlannerShift) => shift.status !== 'cancelled';

// ── Money ───────────────────────────────────────────────────────────────────

/** 1 + on-cost / 100. An unreadable on-cost adds nothing rather than guessing. */
export function onCostFactor(onCostPct: string | null | undefined): number {
  const pct = parseAmount(onCostPct ?? '');
  return pct === null ? 1 : 1 + pct / 100;
}

/** Paid minutes at a rate with the on-cost on top, in pence — null without a readable rate. */
export function labourCostPence(paid: number, hourlyRate: string | null | undefined, onCostPct: string | null | undefined): number | null {
  const rate = hourlyRate == null ? null : ratePence(hourlyRate);
  if (rate === null) return null;
  return Math.round(costPence(paid, rate) * onCostFactor(onCostPct));
}

/** A money string in pence, or null when blank or unreadable. */
export const toPence = (amount: string | null | undefined) => {
  const value = parseAmount(amount ?? '');
  return value === null ? null : Math.round(value * 100);
};

/** Labour as a percentage of sales, to one decimal — null with no sales to divide by. */
export function labourPct(costInPence: number | null, salesInPence: number | null): number | null {
  if (costInPence === null || salesInPence === null || salesInPence <= 0) return null;
  return Math.round((costInPence / salesInPence) * 1000) / 10;
}

export type LabourBand = 'within' | 'near' | 'over';

/** Within target, up to three points over, or further over. No target, no band. */
export function labourBand(pct: number | null, target: string | null | undefined): LabourBand | null {
  const limit = target == null ? null : parseAmount(target);
  if (pct === null || limit === null) return null;
  if (pct <= limit) return 'within';
  return pct <= limit + 3 ? 'near' : 'over';
}

export const LABOUR_BAND_TONE: Record<LabourBand, string> = {
  within: 'text-momentum',
  near: 'text-warning',
  over: 'text-exception',
};

export type SalesKind = 'actual' | 'forecast' | 'mixed';

/** A day's sales: what was taken if there is a figure, else the forecast. Zero or none is no figure. */
export function daySales(row: PlannerSales | undefined): { pence: number; kind: 'actual' | 'forecast' } | null {
  if (!row) return null;
  const actual = toPence(row.actual);
  if (row.actual != null && actual !== null) return { pence: actual, kind: 'actual' };
  const forecast = toPence(row.forecast);
  return forecast !== null && forecast > 0 ? { pence: forecast, kind: 'forecast' } : null;
}

export interface PeriodTotals {
  paidMinutes: number;
  /** Null when the caller can't see pay. */
  costPence: number | null;
  sales: { pence: number; kind: SalesKind } | null;
  pct: number | null;
  band: LabourBand | null;
}

export interface PlannerTotals {
  /** Someone's rate is visible — otherwise the caller sees hours only. */
  costVisible: boolean;
  days: (PeriodTotals & { date: string })[];
  week: PeriodTotals & { budgetPence: number | null; overBudget: boolean | null };
  /** People with shifts this week whose rate isn't on file — left out of every cost. */
  unratedPeople: number;
  /** Open shifts have nobody to cost yet. */
  openShifts: number;
}

/**
 * Hours, labour cost, sales and labour % for each day of the week and the week
 * as a whole. A shift counts on the day it starts at the location. Cost is
 * shown only when the caller can see at least one rate; people without one are
 * counted, never silently left out.
 */
export function plannerTotals(input: {
  weekStart: string;
  timeZone: string;
  shifts: readonly PlannerShift[];
  staff: readonly Pick<PlannerStaff, 'userId' | 'hourlyRate'>[];
  sales: readonly PlannerSales[];
  targets: Pick<LabourTargets, 'targetLabourPct' | 'weeklyBudget' | 'onCostPct'>;
}): PlannerTotals {
  const { timeZone, targets } = input;
  const costVisible = input.staff.some((member) => member.hourlyRate != null);
  const rateOf = new Map(input.staff.map((member) => [member.userId, member.hourlyRate]));
  const dates = weekDates(input.weekStart);
  const perDay = new Map(dates.map((date) => [date, { paid: 0, cost: 0 }]));
  const unrated = new Set<string>();
  let openShifts = 0;

  for (const shift of input.shifts) {
    if (!counts(shift)) continue;
    const day = perDay.get(shiftDate(shift, timeZone));
    if (!day) continue;
    const paid = paidOf(shift);
    day.paid += paid;
    if (!shift.userId) {
      openShifts += 1;
      continue;
    }
    const cost = labourCostPence(paid, rateOf.get(shift.userId), targets.onCostPct);
    if (cost === null) unrated.add(shift.userId);
    else day.cost += cost;
  }

  const band = (cost: number | null, sales: number | null) => {
    const pct = costVisible ? labourPct(cost, sales) : null;
    return { pct, band: labourBand(pct, targets.targetLabourPct) };
  };

  const days = dates.map((date) => {
    const { paid, cost } = perDay.get(date)!;
    const sales = daySales(input.sales.find((row) => row.date === date));
    const costPence = costVisible ? cost : null;
    return { date, paidMinutes: paid, costPence, sales, ...band(costPence, sales?.pence ?? null) };
  });

  const withSales = days.filter((day) => day.sales);
  const salesPence = withSales.reduce((sum, day) => sum + day.sales!.pence, 0);
  const kinds = new Set(withSales.map((day) => day.sales!.kind));
  const weekSales = withSales.length ? { pence: salesPence, kind: (kinds.size === 1 ? [...kinds][0] : 'mixed') as SalesKind } : null;
  const weekCost = costVisible ? days.reduce((sum, day) => sum + (day.costPence ?? 0), 0) : null;
  const budgetPence = toPence(targets.weeklyBudget);

  return {
    costVisible,
    days,
    week: {
      paidMinutes: days.reduce((sum, day) => sum + day.paidMinutes, 0),
      costPence: weekCost,
      sales: weekSales,
      ...band(weekCost, weekSales?.pence ?? null),
      budgetPence,
      overBudget: budgetPence === null || weekCost === null ? null : weekCost > budgetPence,
    },
    unratedPeople: costVisible ? unrated.size : 0,
    openShifts,
  };
}

/** "excl. 2 without a rate · 3 open shifts" — what a cost total leaves out, or null when nothing. */
export function costExclusions(unratedPeople: number, openShifts: number): string | null {
  const parts = [
    unratedPeople > 0 ? `${unratedPeople} without a rate` : null,
    openShifts > 0 ? `${openShifts} open ${openShifts === 1 ? 'shift' : 'shifts'}` : null,
  ].filter(Boolean);
  return parts.length ? `excl. ${parts.join(' · ')}` : null;
}

// ── People ──────────────────────────────────────────────────────────────────

export const contractedMinutesOf = (hours: string | null | undefined) => {
  const value = parseAmount(hours ?? '');
  return value === null || value <= 0 ? null : Math.round(value * 60);
};

export interface PersonWeek {
  paidMinutes: number;
  contractedMinutes: number | null;
  overContract: boolean;
  costPence: number | null;
}

/** One person's planned week against their contract, and its cost when their rate is visible. */
export function personWeek(
  member: Pick<PlannerStaff, 'userId' | 'hourlyRate' | 'contractedWeeklyHours'>,
  shifts: readonly PlannerShift[],
  onCostPct: string | null | undefined,
): PersonWeek {
  const paid = shifts.filter((shift) => counts(shift) && shift.userId === member.userId).reduce((sum, shift) => sum + paidOf(shift), 0);
  const contracted = contractedMinutesOf(member.contractedWeeklyHours);
  return {
    paidMinutes: paid,
    contractedMinutes: contracted,
    overContract: contracted !== null && paid > contracted,
    costPence: labourCostPence(paid, member.hourlyRate, onCostPct),
  };
}

// ── Publishing ──────────────────────────────────────────────────────────────

/**
 * Drafts nobody has seen yet, and published shifts the person hasn't
 * confirmed since they were (re)published after being created — a change, or
 * a first publish still waiting for its tick.
 */
export function publishState(shifts: readonly PlannerShift[]): { drafts: number; changed: number } {
  let drafts = 0;
  let changed = 0;
  for (const shift of shifts) {
    if (shift.status === 'draft') drafts += 1;
    else if (
      shift.status === 'published' &&
      shift.userId &&
      shift.acknowledgedAt == null &&
      shift.publishedAt &&
      shift.createdAt &&
      Date.parse(shift.publishedAt) > Date.parse(shift.createdAt)
    )
      changed += 1;
  }
  return { drafts, changed };
}

/** Seen (ticked), waiting, or not applicable for a shift chip. */
export function seenState(shift: PlannerShift): 'seen' | 'unseen' | null {
  if (shift.status !== 'published' || !shift.userId) return null;
  return shift.acknowledgedAt ? 'seen' : 'unseen';
}

// ── A person's day ──────────────────────────────────────────────────────────

export interface CellState {
  leave: { status: 'approved' | 'pending'; typeName: string | null } | null;
  /** Said they can't work at all that weekday. */
  unavailable: boolean;
  /** Part-day windows: "Can’t 09:00–12:00", "Prefers 17:00–22:00". */
  windows: { kind: Availability['kind']; label: string; note: string | null }[];
  /** A preferred rule that day — a hint, never a rule. */
  preferred: boolean;
}

/** What the grid draws under a person's day: leave, can't-work, and preferences. Weekday is 0 = Monday. */
export function cellState(
  userId: string,
  date: string,
  leave: readonly Pick<PlannerLeave, 'userId' | 'startDate' | 'endDate' | 'status' | 'typeName'>[],
  availability: readonly Pick<Availability, 'userId' | 'weekday' | 'startMinute' | 'endMinute' | 'kind' | 'note'>[],
): CellState {
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const onLeave = leave.filter((row) => row.userId === userId && row.startDate <= date && date <= row.endDate);
  const leaveRow = onLeave.find((row) => row.status === 'approved') ?? onLeave[0];
  const rules = availability.filter((rule) => rule.userId === userId && rule.weekday === weekday);
  const allDay = (rule: (typeof rules)[number]) => rule.startMinute == null || rule.endMinute == null;
  return {
    leave: leaveRow ? { status: leaveRow.status, typeName: leaveRow.typeName } : null,
    unavailable: rules.some((rule) => rule.kind === 'unavailable' && allDay(rule)),
    windows: rules
      .filter((rule) => !allDay(rule))
      .sort((a, b) => a.startMinute! - b.startMinute!)
      .map((rule) => ({
        kind: rule.kind,
        label: `${rule.kind === 'unavailable' ? 'Can’t' : 'Prefers'} ${formatMinute(rule.startMinute!)}–${formatMinute(rule.endMinute!)}`,
        note: rule.note,
      })),
    preferred: rules.some((rule) => rule.kind === 'preferred'),
  };
}

// ── Moving ──────────────────────────────────────────────────────────────────

/**
 * The same shift on another day: it starts at the same wall-clock time at the
 * location and keeps its length, so a 09:00–17:00 dragged across the clocks
 * changing is still 09:00–17:00.
 */
export function moveShiftTo(
  shift: Pick<PlannerShift, 'startsAt' | 'endsAt'>,
  date: string,
  timeZone: string,
): { startsAt: string; endsAt: string } {
  const { minute } = localParts(shift.startsAt, timeZone);
  const start = zonedToInstant(date, formatMinute(minute), timeZone);
  if (!start) throw new Error(`Not a date: ${date}`);
  const length = Date.parse(shift.endsAt) - Date.parse(shift.startsAt);
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + length).toISOString() };
}

// ── Positions ───────────────────────────────────────────────────────────────

export const POSITION_COLORS = [
  { value: 'slate', label: 'Slate' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'amber', label: 'Amber' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
  { value: 'purple', label: 'Purple' },
] as const;

/** Token classes for a position colour name; anything unknown is slate. Literal strings so Tailwind sees them. */
export function positionSwatch(color: string | null | undefined): { dot: string; edge: string } {
  switch (color) {
    case 'blue':
      return { dot: 'bg-series-1', edge: 'border-l-series-1' };
    case 'green':
    case 'teal':
      return { dot: 'bg-series-3', edge: 'border-l-series-3' };
    case 'amber':
    case 'yellow':
      return { dot: 'bg-series-4', edge: 'border-l-series-4' };
    case 'orange':
      return { dot: 'bg-series-2', edge: 'border-l-series-2' };
    case 'red':
    case 'rose':
    case 'pink':
      return { dot: 'bg-exception', edge: 'border-l-exception' };
    case 'purple':
    case 'indigo':
    case 'violet':
      return { dot: 'bg-reference', edge: 'border-l-reference' };
    default:
      return { dot: 'bg-chart-5', edge: 'border-l-chart-5' };
  }
}

export interface PositionGroup<T> {
  key: string;
  position: Pick<Position, 'id' | 'name' | 'color'> | null;
  shifts: T[];
}

/**
 * Shifts under their positions, in the location's order (then by name), every
 * active position present even when empty so it can be planned into; shifts
 * with no position (or one that has since gone) come last.
 */
export function groupByPosition<T extends PlannerShift>(shifts: readonly T[], positions: readonly Position[]): PositionGroup<T>[] {
  const ordered = [...positions].filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const groups = new Map<string, PositionGroup<T>>(ordered.map((p) => [p.id, { key: p.id, position: p, shifts: [] }]));
  const loose: T[] = [];
  for (const shift of shifts) {
    const group = shift.positionId ? groups.get(shift.positionId) : undefined;
    if (group) group.shifts.push(shift);
    else if (shift.positionId && shift.position) {
      groups.set(shift.positionId, { key: shift.positionId, position: shift.position, shifts: [shift] });
    } else loose.push(shift);
  }
  return [...groups.values(), { key: 'none', position: null, shifts: loose }];
}

// ── Warnings ────────────────────────────────────────────────────────────────

/** Each shift's warnings and each person's (including week-wide ones), for chips and name badges. */
export function indexWarnings(warnings: readonly RuleWarning[]) {
  const byShift = new Map<string, RuleWarning[]>();
  const byUser = new Map<string, RuleWarning[]>();
  for (const warning of warnings) {
    if ('shiftId' in warning) byShift.set(warning.shiftId, [...(byShift.get(warning.shiftId) ?? []), warning]);
    byUser.set(warning.userId, [...(byUser.get(warning.userId) ?? []), warning]);
  }
  return { byShift, byUser };
}

// ── Jumpstart ───────────────────────────────────────────────────────────────

/** "12 shifts copied · 2 skipped · 1 sent to open shifts". */
export function fillSummary(result: { created: number; skipped: number; opened: number }, verb: string): string {
  const added = result.created;
  const parts = [`${added} ${added === 1 ? 'shift' : 'shifts'} ${verb}`];
  if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
  if (result.opened > 0) parts.push(`${result.opened} sent to open shifts`);
  return parts.join(' · ');
}

// ── Day view ────────────────────────────────────────────────────────────────

/**
 * The hours the day view spans: the location's opening hours (or 06:00–24:00),
 * widened to take in every shift that day.
 */
export function dayWindow(
  hours: { open: string; close: string } | null | undefined,
  shifts: readonly PlannerShift[],
  date: string,
  timeZone: string,
): { from: number; to: number } {
  const hourOf = (clock: string) => {
    const [h, m] = clock.split(':').map(Number);
    return Number.isFinite(h) ? h + (m > 0 ? 1 : 0) : null;
  };
  let from = 6;
  let to = 24;
  if (hours) {
    const open = Number(hours.open.split(':')[0]);
    const close = hourOf(hours.close);
    if (Number.isFinite(open)) from = open;
    to = close === null || close === 0 || close <= from ? 24 : close;
  }
  const midnight = zonedToInstant(date, '00:00', timeZone)?.getTime();
  if (midnight !== undefined)
    for (const shift of shifts) {
      if (!counts(shift) || shiftDate(shift, timeZone) !== date) continue;
      const start = (Date.parse(shift.startsAt) - midnight) / 3_600_000;
      const end = (Date.parse(shift.endsAt) - midnight) / 3_600_000;
      from = Math.min(from, Math.max(0, Math.floor(start)));
      to = Math.max(to, Math.min(24, Math.ceil(end)));
    }
  return { from, to: Math.max(to, from + 1) };
}

/** Where a shift sits on the day view, as percentages of the window — null when it falls outside. */
export function timelineSpan(
  shift: Pick<PlannerShift, 'startsAt' | 'endsAt'>,
  date: string,
  timeZone: string,
  window: { from: number; to: number },
): { left: number; width: number } | null {
  const midnight = zonedToInstant(date, '00:00', timeZone)?.getTime();
  if (midnight === undefined) return null;
  const span = (window.to - window.from) * 60;
  const start = Math.max(window.from * 60, (Date.parse(shift.startsAt) - midnight) / 60_000);
  const end = Math.min(window.to * 60, (Date.parse(shift.endsAt) - midnight) / 60_000);
  if (end <= start) return null;
  return { left: ((start - window.from * 60) / span) * 100, width: ((end - start) / span) * 100 };
}
