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

/** Where the ageing bar starts warning. */
export const APPROACH_MINS = 2;

/** The limit a ticket must not pass in one stage. Past this, KDS shows red. */
export const CRASH_MINS = 5;

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
}

/** When the ticket entered its current stage. */
export function stageSince(order: TicketTimes) {
  return order.updatedAt ?? order.createdAt;
}

export function ageState(order: TicketTimes, now: number): AgeState {
  const mins = Math.max(0, (now - new Date(stageSince(order)).getTime()) / 60_000);
  return {
    mins,
    ratio: Math.min(1, mins / CRASH_MINS),
    tone: mins >= CRASH_MINS ? 'crashed' : mins >= APPROACH_MINS ? 'approaching' : 'ok',
  };
}

/** True for exactly the tickets KDS paints red. */
export function isLate(order: TicketTimes, now: number) {
  return ageState(order, now).tone === 'crashed';
}
