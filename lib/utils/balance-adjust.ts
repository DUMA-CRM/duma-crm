/**
 * The arithmetic behind a manual loyalty adjustment — points or stamps alike.
 * Staff choose a direction and an amount rather than typing a signed number:
 * a minus sign is the easiest thing in a form to miss, and it decides which way
 * the money goes.
 */

export type AdjustDirection = 'add' | 'remove';

export interface AdjustmentPlan {
  /** Signed change sent to the API. */
  delta: number;
  /** Balance once applied; never below zero. */
  after: number;
  /** The removal asked for is larger than the balance. */
  belowZero: boolean;
  /** Something to submit: a whole, non-zero amount that keeps the balance at or above zero. */
  valid: boolean;
}

export function planAdjustment(balance: number, direction: AdjustDirection, amount: number): AdjustmentPlan {
  const safeBalance = Math.max(0, Math.floor(Number.isFinite(balance) ? balance : 0));
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const delta = direction === 'add' ? safeAmount : -safeAmount;
  const belowZero = safeBalance + delta < 0;
  return {
    delta,
    after: Math.max(0, safeBalance + delta),
    belowZero,
    valid: safeAmount > 0 && !belowZero,
  };
}

/** How many rewards a stamp change completes (positive) or takes back (negative). */
export function rewardsCompleted(before: number, after: number, cost: number): number {
  const safeCost = Math.max(1, Math.floor(cost));
  return Math.floor(Math.max(0, after) / safeCost) - Math.floor(Math.max(0, before) / safeCost);
}
