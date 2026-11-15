// ---------------------------------------------------------------------------
// Ask DUMA's "draft next week's rota": a proposal, never a write. Given the
// week's planner bundle and the hourly coverage the API recommends, it fills
// each day's under-covered hours with sensible shift blocks (3–8h, on the
// hour, with the break the working-time rules ask for) and picks a person for
// each block: not on approved leave, not unavailable, qualified, breaking no
// serious working-time rule — and among those, the most contract headroom,
// then the cheapest rate, then the fewest hours so far.
//
// It also summarises a week (hours against contract, warnings, labour cost and
// labour % against target) for the agent's rota read tool.
//
// Pure and deterministic: the caller passes the time zone and every input.
// Weekdays are 0 = Monday … 6 = Sunday. Money stays in pence while it is
// added up and leaves as a decimal string.
// ---------------------------------------------------------------------------
import type { Availability, LabourTargets, PlannerLeave, PlannerSales, WorkingTimeRules } from '../api/rota.service';

import { type RulePerson, type RuleShift, type RuleWarning, checkRota, describeWarning, isSerious, paidMinutes } from './rota-rules.ts';

export type AutofillMode = 'fill_gaps' | 'from_last_week';

export interface AutofillStaff {
  userId: string;
  name: string;
  contractedWeeklyHours: string | null;
  hourlyRate: string | null;
  isMinor: boolean;
  positionIds: string[];
  availability: Pick<Availability, 'userId' | 'weekday' | 'startMinute' | 'endMinute' | 'kind'>[];
}

export interface AutofillShift {
  id: string;
  userId?: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes?: number;
  positionId?: string | null;
  status?: string;
}

/** One hour's recommended headcount; `weekday` is 0 = Monday. */
export interface CoverageNeed {
  weekday: number;
  hour: number;
  recommendedStaff: number;
}

export interface AutofillInput {
  weekStart: string;
  timeZone: string;
  staff: readonly AutofillStaff[];
  shifts: readonly AutofillShift[];
  leave: readonly Pick<PlannerLeave, 'userId' | 'startDate' | 'endDate' | 'status'>[];
  coverage: readonly CoverageNeed[];
  rules: WorkingTimeRules;
  mode?: AutofillMode;
  /** The week before, for `from_last_week`. */
  previousShifts?: readonly AutofillShift[];
  /** Ask for this position on every new block; only qualified people are picked. */
  positionId?: string | null;
  sales?: readonly PlannerSales[];
  targets?: Pick<LabourTargets, 'targetLabourPct' | 'onCostPct'> | null;
}

export interface ProposedShift {
  id: string;
  userId: string;
  name: string;
  date: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  positionId: string | null;
  /** Where it came from: a copy of last week's shift, or a coverage gap. */
  source: 'last_week' | 'gap';
}

export interface UnfilledGap {
  date: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  reason: string;
}

export interface AutofillResult {
  shifts: ProposedShift[];
  gaps: UnfilledGap[];
  summary: {
    paidMinutesAdded: number;
    /** Null when any rate involved is hidden. */
    costAdded: string | null;
    labourPctBefore: string | null;
    labourPctAfter: string | null;
    targetLabourPct: string | null;
  };
}

export const MIN_BLOCK_HOURS = 3;
export const MAX_BLOCK_HOURS = 8;
const MINUTE = 60_000;
const DAY = 24 * 60;

// ── Time ─────────────────────────────────────────────────────────────────────

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function offsetMs(at: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(at))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** A local date plus minutes from its midnight (may pass 1440) as a UTC instant. */
export function zonedInstant(date: string, minute: number, timeZone: string): string {
  const naive = Date.parse(`${date}T00:00:00Z`) + minute * MINUTE;
  // Twice, so a time just across a clock change lands on the right offset.
  let guess = naive - offsetMs(naive, timeZone);
  guess = naive - offsetMs(guess, timeZone);
  return new Date(guess).toISOString();
}

const clock = (minute: number) => `${String(Math.floor((minute % DAY) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export const formatBlock = (startMinute: number, endMinute: number) => `${clock(startMinute)}–${clock(endMinute)}`;

// ── Money ────────────────────────────────────────────────────────────────────

export function toPence(amount: string | null | undefined): number | null {
  if (amount == null || amount.trim() === '') return null;
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

export const fromPence = (pence: number) => (pence / 100).toFixed(2);

const costPence = (minutes: number, ratePence: number) => Math.round((minutes * ratePence) / 60);

/** Wages plus on-cost, as a percentage of sales, to two places — or null. */
function labourPct(wagesPence: number | null, salesPence: number, onCostPct: string | undefined): string | null {
  if (wagesPence == null || salesPence <= 0) return null;
  const uplift = 1 + (Number(onCostPct ?? '0') || 0) / 100;
  return ((wagesPence * uplift * 100) / salesPence).toFixed(2);
}

/** The week's sales to judge labour against: actual where the day has happened, forecast otherwise. */
export function weekSalesPence(sales: readonly PlannerSales[] | undefined): number {
  return (sales ?? []).reduce((sum, day) => sum + (toPence(day.actual ?? day.forecast) ?? 0), 0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const toRuleShift = (shift: AutofillShift): RuleShift => ({
  id: shift.id,
  userId: shift.userId ?? null,
  startsAt: shift.startsAt,
  endsAt: shift.endsAt,
  breakMinutes: shift.breakMinutes ?? 0,
  positionId: shift.positionId ?? null,
});

export const toRulePerson = (person: AutofillStaff): RulePerson => ({
  userId: person.userId,
  isMinor: person.isMinor,
  positionIds: person.positionIds,
  contractedWeeklyMinutes: person.contractedWeeklyHours == null ? null : Math.round(Number(person.contractedWeeklyHours) * 60) || null,
});

/** The unpaid break a block of this length needs under the rules. */
export function breakFor(lengthMinutes: number, isMinor: boolean, rules: WorkingTimeRules): number {
  const after = isMinor ? rules.minorBreakAfterMinutes : rules.breakAfterMinutes;
  const minimum = isMinor ? rules.minorMinBreakMinutes : rules.minBreakMinutes;
  return after !== null && lengthMinutes > after ? minimum : 0;
}

/**
 * Split a run of under-covered hours into blocks of 3–8 hours. A run shorter
 * than three is stretched (later first, earlier when the day runs out); a
 * longer run is cut into near-equal parts.
 */
export function splitRun(startHour: number, endHour: number): Array<[number, number]> {
  const length = endHour - startHour;
  if (length <= 0) return [];
  if (length < MIN_BLOCK_HOURS) {
    let end = Math.min(24, startHour + MIN_BLOCK_HOURS);
    const start = Math.max(0, end - MIN_BLOCK_HOURS);
    end = start + MIN_BLOCK_HOURS;
    return [[start, end]];
  }
  const parts = Math.ceil(length / MAX_BLOCK_HOURS);
  const base = Math.floor(length / parts);
  const extra = length % parts;
  const blocks: Array<[number, number]> = [];
  let at = startHour;
  for (let i = 0; i < parts; i++) {
    const size = base + (i < extra ? 1 : 0);
    blocks.push([at, at + size]);
    at += size;
  }
  return blocks;
}

// ── Autofill ─────────────────────────────────────────────────────────────────

type Rejection = 'leave' | 'unavailable' | 'unqualified' | 'rules';

export function autofillRota(input: AutofillInput): AutofillResult {
  const { weekStart, timeZone, staff, rules } = input;
  const people = staff.map(toRulePerson);
  const live = input.shifts.filter((shift) => shift.status !== 'cancelled');
  const context = {
    leave: input.leave.filter((l) => l.status === 'approved'),
    availability: staff.flatMap((person) => person.availability.map((rule) => ({ ...rule, userId: person.userId }))),
    timeZone,
  };
  // Every assigned shift, existing and proposed, so later picks see earlier ones.
  const assigned: RuleShift[] = live.filter((shift) => shift.userId).map(toRuleShift);
  const proposals: ProposedShift[] = [];
  const gaps: UnfilledGap[] = [];
  let sequence = 0;

  const paidSoFar = (userId: string) => assigned.filter((s) => s.userId === userId).reduce((sum, s) => sum + paidMinutes(s), 0);
  const seriousKeys = (list: RuleWarning[], userId: string) =>
    new Set(list.filter((w) => w.userId === userId && isSerious(w)).map((w) => `${w.kind}:${'shiftId' in w ? w.shiftId : ''}`));

  /** Why this person can't take the block, or null when they can. */
  function reject(person: AutofillStaff, candidate: RuleShift, date: string): Rejection | null {
    if (context.leave.some((l) => l.userId === person.userId && l.startDate <= date && date <= l.endDate)) return 'leave';
    if (candidate.positionId && !person.positionIds.includes(candidate.positionId)) return 'unqualified';
    const mine = assigned.filter((s) => s.userId === person.userId);
    const before = seriousKeys(checkRota(mine, people, rules, context), person.userId);
    const after = checkRota([...mine, candidate], people, rules, context).filter((w) => w.userId === person.userId && isSerious(w));
    const fresh = after.filter((w) => !before.has(`${w.kind}:${'shiftId' in w ? w.shiftId : ''}`));
    if (fresh.some((w) => w.kind === 'unavailable')) return 'unavailable';
    if (fresh.length > 0) return 'rules';
    return null;
  }

  function rank(a: AutofillStaff, b: AutofillStaff, weekday: number): number {
    const headroom = (p: AutofillStaff) => {
      const contract = toRulePerson(p).contractedWeeklyMinutes;
      return contract == null ? 0 : contract - paidSoFar(p.userId);
    };
    const rate = (p: AutofillStaff) => toPence(p.hourlyRate) ?? Number.MAX_SAFE_INTEGER;
    const prefers = (p: AutofillStaff) => (p.availability.some((r) => r.kind === 'preferred' && r.weekday === weekday) ? 0 : 1);
    return (
      headroom(b) - headroom(a) ||
      rate(a) - rate(b) ||
      paidSoFar(a.userId) - paidSoFar(b.userId) ||
      prefers(a) - prefers(b) ||
      a.name.localeCompare(b.name) ||
      a.userId.localeCompare(b.userId)
    );
  }

  function place(
    date: string,
    weekday: number,
    startMinute: number,
    endMinute: number,
    positionId: string | null,
    source: ProposedShift['source'],
    preferUserId?: string | null,
  ): ProposedShift | Record<Rejection, number> {
    const id = `proposal-${++sequence}`;
    const startsAt = zonedInstant(date, startMinute, timeZone);
    const endsAt = zonedInstant(date, endMinute, timeZone);
    const tally: Record<Rejection, number> = { leave: 0, unavailable: 0, unqualified: 0, rules: 0 };
    const ordered = [...staff].sort((a, b) =>
      preferUserId ? Number(b.userId === preferUserId) - Number(a.userId === preferUserId) || rank(a, b, weekday) : rank(a, b, weekday),
    );
    for (const person of ordered) {
      const breakMinutes = breakFor(endMinute - startMinute, person.isMinor, rules);
      const candidate: RuleShift = { id, userId: person.userId, startsAt, endsAt, breakMinutes, positionId };
      const why = reject(person, candidate, date);
      if (why) {
        tally[why]++;
        continue;
      }
      assigned.push(candidate);
      const proposal: ProposedShift = {
        id,
        userId: person.userId,
        name: person.name,
        date,
        weekday,
        startMinute,
        endMinute,
        startsAt,
        endsAt,
        breakMinutes,
        positionId,
        source,
      };
      proposals.push(proposal);
      return proposal;
    }
    return tally;
  }

  const describeTally = (tally: Record<Rejection, number>) => {
    if (staff.length === 0) return 'Nobody can work at this location';
    const parts = [
      tally.leave && `${tally.leave} on leave`,
      tally.unavailable && `${tally.unavailable} unavailable`,
      tally.unqualified && `${tally.unqualified} not trained for the position`,
      tally.rules && `${tally.rules} would break a working-time rule`,
    ].filter(Boolean);
    return parts.join(', ') || 'Nobody free';
  };

  // ── 1. Last week's shifts, a week on, where they still fit ────────────────
  if (input.mode === 'from_last_week') {
    for (const shift of input.previousShifts ?? []) {
      if (shift.status === 'cancelled') continue;
      const startsAt = Date.parse(shift.startsAt) + 7 * DAY * MINUTE;
      const endsAt = Date.parse(shift.endsAt) + 7 * DAY * MINUTE;
      const local = localOf(new Date(startsAt).toISOString(), timeZone);
      const weekday = dayIndex(weekStart, local.date);
      if (weekday < 0 || weekday > 6) continue;
      const startMinute = local.minute;
      const endMinute = startMinute + Math.round((endsAt - startsAt) / MINUTE);
      const outcome = place(local.date, weekday, startMinute, endMinute, shift.positionId ?? null, 'last_week', shift.userId);
      if (!('id' in outcome))
        gaps.push({ date: local.date, weekday, startMinute, endMinute, reason: `Last week’s shift: ${describeTally(outcome)}` });
    }
  }

  // ── 2. Fill whatever coverage is still short ──────────────────────────────
  const need = new Map<string, number>();
  for (const row of input.coverage) need.set(`${row.weekday}:${row.hour}`, row.recommendedStaff);

  for (let weekday = 0; weekday < 7; weekday++) {
    const date = addDaysIso(weekStart, weekday);
    const deficit = Array.from({ length: 24 }, (_, hour) => {
      const wanted = need.get(`${weekday}:${hour}`) ?? 0;
      if (wanted <= 0) return 0;
      const mid = Date.parse(zonedInstant(date, hour * 60 + 30, timeZone));
      const planned =
        live.filter((s) => Date.parse(s.startsAt) <= mid && mid < Date.parse(s.endsAt)).length +
        proposals.filter((p) => Date.parse(p.startsAt) <= mid && mid < Date.parse(p.endsAt)).length;
      return Math.max(0, wanted - planned);
    });

    // Peel one layer of headcount at a time until the day is covered or stuck.
    for (let guard = 0; guard < 50 && deficit.some((d) => d > 0); guard++) {
      const first = deficit.findIndex((d) => d > 0);
      let last = first;
      while (last + 1 < 24 && deficit[last + 1] > 0) last++;
      for (const [start, end] of splitRun(first, last + 1)) {
        const outcome = place(date, weekday, start * 60, end * 60, input.positionId ?? null, 'gap');
        if (!('id' in outcome)) gaps.push({ date, weekday, startMinute: start * 60, endMinute: end * 60, reason: describeTally(outcome) });
        // Filled or not, this layer is dealt with — an unfillable gap is reported once.
        for (let h = start; h < end; h++) deficit[h] = Math.max(0, deficit[h] - 1);
      }
    }
  }

  // ── 3. What it adds up to ─────────────────────────────────────────────────
  const rateOf = new Map(staff.map((p) => [p.userId, toPence(p.hourlyRate)]));
  const paidAdded = proposals.reduce((sum, p) => sum + paidMinutes(p), 0);
  const wages = (list: readonly { userId?: string | null; startsAt: string; endsAt: string; breakMinutes?: number }[]) => {
    let total = 0;
    for (const shift of list) {
      if (!shift.userId) continue;
      const rate = rateOf.get(shift.userId);
      if (rate == null) return null;
      total += costPence(paidMinutes({ ...shift, breakMinutes: shift.breakMinutes ?? 0 }), rate);
    }
    return total;
  };
  const before = wages(live);
  const added = wages(proposals);
  const sales = weekSalesPence(input.sales);
  return {
    shifts: proposals,
    gaps,
    summary: {
      paidMinutesAdded: paidAdded,
      costAdded: added == null ? null : fromPence(added),
      labourPctBefore: labourPct(before, sales, input.targets?.onCostPct),
      labourPctAfter: labourPct(before == null || added == null ? null : before + added, sales, input.targets?.onCostPct),
      targetLabourPct: input.targets?.targetLabourPct ?? null,
    },
  };
}

function localOf(iso: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

const dayIndex = (weekStart: string, date: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / (DAY * MINUTE));

/** The API's coverage weekday is Postgres DOW (0 = Sunday); this feature's is 0 = Monday. */
export const mondayWeekday = (dow: number) => (dow + 6) % 7;

// ── The week, summarised for the agent ───────────────────────────────────────

export interface WeekPersonSummary {
  userId: string;
  name: string;
  shifts: number;
  paidHours: number;
  contractedHours: number | null;
  /** Positive = hours left on the contract, negative = over it. Null with no contract. */
  contractHeadroomHours: number | null;
  /** Null when pay is hidden. */
  cost: string | null;
  warnings: string[];
}

export interface WeekSummary {
  people: WeekPersonSummary[];
  totals: {
    paidHours: number;
    /** Wages plus on-cost; null when any rate is hidden. */
    labourCost: string | null;
    sales: string;
    labourPct: string | null;
    targetLabourPct: string | null;
    weeklyBudget: string | null;
  };
  openShifts: Array<{ id: string; date: string; time: string; positionId: string | null; status: string }>;
}

export function summariseWeek(input: {
  timeZone: string;
  staff: readonly AutofillStaff[];
  shifts: readonly AutofillShift[];
  leave: readonly Pick<PlannerLeave, 'userId' | 'startDate' | 'endDate' | 'status'>[];
  rules: WorkingTimeRules;
  sales?: readonly PlannerSales[];
  targets?: Pick<LabourTargets, 'targetLabourPct' | 'onCostPct' | 'weeklyBudget'> | null;
}): WeekSummary {
  const live = input.shifts.filter((shift) => shift.status !== 'cancelled');
  const ruleShifts = live.map(toRuleShift);
  const warnings = checkRota(ruleShifts, input.staff.map(toRulePerson), input.rules, {
    leave: input.leave.filter((l) => l.status === 'approved'),
    availability: input.staff.flatMap((p) => p.availability.map((rule) => ({ ...rule, userId: p.userId }))),
    timeZone: input.timeZone,
  });
  const round1 = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
  let wagesPence: number | null = 0;
  const people = input.staff.map((person) => {
    const mine = ruleShifts.filter((s) => s.userId === person.userId);
    const paid = mine.reduce((sum, s) => sum + paidMinutes(s), 0);
    const rate = toPence(person.hourlyRate);
    const cost = rate == null ? null : mine.reduce((sum, s) => sum + costPence(paidMinutes(s), rate), 0);
    if (mine.length > 0) wagesPence = cost == null || wagesPence == null ? null : wagesPence + cost;
    const contract = toRulePerson(person).contractedWeeklyMinutes;
    return {
      userId: person.userId,
      name: person.name,
      shifts: mine.length,
      paidHours: round1(paid),
      contractedHours: contract == null ? null : round1(contract),
      contractHeadroomHours: contract == null ? null : round1(contract - paid),
      cost: cost == null ? null : fromPence(cost),
      warnings: [...new Set(warnings.filter((w) => w.userId === person.userId).map(describeWarning))],
    };
  });
  const uplift = 1 + (Number(input.targets?.onCostPct ?? '0') || 0) / 100;
  const sales = weekSalesPence(input.sales);
  const finalWages = wagesPence as number | null;
  return {
    people: people.filter((p) => p.shifts > 0 || p.contractedHours != null),
    totals: {
      paidHours: round1(ruleShifts.filter((s) => s.userId).reduce((sum, s) => sum + paidMinutes(s), 0)),
      labourCost: finalWages == null ? null : fromPence(Math.round(finalWages * uplift)),
      sales: fromPence(sales),
      labourPct: labourPct(finalWages, sales, input.targets?.onCostPct),
      targetLabourPct: input.targets?.targetLabourPct ?? null,
      weeklyBudget: input.targets?.weeklyBudget ?? null,
    },
    openShifts: live
      .filter((s) => !s.userId)
      .map((s) => {
        const start = localOf(s.startsAt, input.timeZone);
        const end = localOf(s.endsAt, input.timeZone);
        return {
          id: s.id,
          date: start.date,
          time: `${clock(start.minute)}–${clock(end.minute)}`,
          positionId: s.positionId ?? null,
          status: s.status ?? 'draft',
        };
      }),
  };
}
