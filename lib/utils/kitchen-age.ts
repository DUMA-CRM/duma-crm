/* How old a kitchen ticket is, defined once.
 *
 * This lives here because the kitchen and the dashboard have to agree. They used
 * to disagree twice over: KDS turned a card red after 5 minutes in its current
 * stage, while the dashboard called an order late only after 15 minutes since it
 * was created. A ticket could be red on the pass and absent from the manager's
 * "needs you" strip at the same time, which makes the dashboard worth ignoring.
 *
 * The stage clock is the right one: what matters is how long this ticket has sat
 * at this step, not how long ago the customer ordered.
 */

/** Where the ageing bar starts warning — for food, the default. */
export const APPROACH_MINS = 2;

/** The limit a ticket must not pass in one stage. Past this, KDS shows red — for food, the default. */
export const CRASH_MINS = 5;

/**
 * When an order counts as nearly late and late, in minutes in one stage — set
 * per workspace (Settings → Configuration → Orders), because five minutes is
 * late for a flat white and nothing for a parcel. `null`: don't flag lateness.
 */
export interface Lateness {
  nearlyMins: number;
  lateMins: number;
}

export const FOOD_LATENESS: Lateness = { nearlyMins: APPROACH_MINS, lateMins: CRASH_MINS };

/**
 * The workspace's lateness, from ordering's configuration — `{ off: true }`, or
 * `{ nearlyMins, lateMins }` — else the default for what it sells: food and
 * drink 2 / 5 minutes; products, nothing (a parcel isn't late after five minutes).
 */
export function latenessFor(configuration: unknown, vocabulary: 'menu' | 'retail' | 'mixed'): Lateness | null {
  const saved = configuration && typeof configuration === 'object' ? (configuration as Record<string, unknown>).lateness : undefined;
  if (saved && typeof saved === 'object') {
    const value = saved as Record<string, unknown>;
    if (value.off === true) return null;
    const nearly = Number(value.nearlyMins);
    const late = Number(value.lateMins);
    if (Number.isFinite(late) && late > 0) return { nearlyMins: Number.isFinite(nearly) && nearly > 0 && nearly < late ? nearly : late, lateMins: late };
  }
  return vocabulary === 'retail' ? null : FOOD_LATENESS;
}

/** "5 minutes", "2 hours", "1 day" — a lateness threshold read aloud. */
export function durationLabel(mins: number): string {
  const [amount, unit] = mins % 1440 === 0 ? [mins / 1440, 'day'] : mins % 60 === 0 ? [mins / 60, 'hour'] : [mins, 'minute'];
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

export type AgeTone = 'ok' | 'approaching' | 'crashed';
export interface AgeState {
  mins: number;
  /** Progress toward the limit, 0–1, for the ageing bar. */
  ratio: number;
  tone: AgeTone;
}

/**
 * The timestamps lateness needs. `updatedAt` is optional here even though the
 * API type marks it required: optimistic local updates and older payloads can
 * arrive without it, and falling back to `createdAt` is the safe reading.
 */
export interface TicketTimes {
  createdAt: string;
  updatedAt?: string | null;
  /** A scheduled pre-order reaches the kitchen at this time, not when it was placed. */
  kitchenReleaseAt?: string | null;
}

/**
 * When the ticket entered its current stage: its last update, or its kitchen
 * release if that is later — a pre-order placed an hour ago is new the moment
 * it is released, not already an hour late.
 */
export function stageSince(order: TicketTimes) {
  const since = order.updatedAt ?? order.createdAt;
  if (order.kitchenReleaseAt && new Date(order.kitchenReleaseAt).getTime() > new Date(since).getTime()) return order.kitchenReleaseAt;
  return since;
}

/** How old the ticket is in its stage, against `lateness` — never amber or red when lateness is off. */
export function ageState(order: TicketTimes, now: number, lateness: Lateness | null = FOOD_LATENESS): AgeState {
  const mins = Math.max(0, (now - new Date(stageSince(order)).getTime()) / 60_000);
  if (!lateness) return { mins, ratio: 0, tone: 'ok' };
  return {
    mins,
    ratio: Math.min(1, mins / lateness.lateMins),
    tone: mins >= lateness.lateMins ? 'crashed' : mins >= lateness.nearlyMins ? 'approaching' : 'ok',
  };
}

/** True for exactly the tickets KDS paints red — and never when lateness is off. */
export function isLate(order: TicketTimes, now: number, lateness: Lateness | null = FOOD_LATENESS) {
  return ageState(order, now, lateness).tone === 'crashed';
}

export type DurationUnit = 'minutes' | 'hours' | 'days';
const UNIT_MINS: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** A threshold in its largest whole unit — 120 → 2 hours — for an amount-and-unit field. */
export function splitDuration(mins: number): { amount: number; unit: DurationUnit } {
  if (mins > 0 && mins % 1440 === 0) return { amount: mins / 1440, unit: 'days' };
  if (mins > 0 && mins % 60 === 0) return { amount: mins / 60, unit: 'hours' };
  return { amount: mins, unit: 'minutes' };
}

/** Back to minutes; null for anything that isn't a positive number. */
export function joinDuration(amount: string | number, unit: DurationUnit): number | null {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? Math.round(value * UNIT_MINS[unit]) : null;
}
