/**
 * Where a points balance sits on the tier ladder.
 *
 * Derived from the points, not from the customer's assigned tier: the API
 * assigns the tier on its own basis, so a balance can sit outside its band (a
 * gold member who has spent their points down), and plotting it against that
 * band would peg the bar at 0% or 100%.
 */

export interface TierRung {
  id: string;
  label: string;
  /** Points at which this rung starts. Rungs are passed lowest first. */
  from: number;
}

export interface LadderStep {
  id: string;
  label: string;
  from: number;
  /** Where the next rung starts; null for the top one. */
  to: number | null;
  /** How much of this step the balance has covered, 0–1. */
  fill: number;
  state: 'passed' | 'current' | 'ahead';
}

export interface TierLadder {
  points: number;
  steps: LadderStep[];
  /** The rung the balance is on. */
  current: LadderStep;
  /** The next rung and the points still needed; null at the top. */
  next: { label: string; needed: number } | null;
}

export function tierLadder(balance: number, rungs: TierRung[]): TierLadder {
  const points = Math.max(0, Math.floor(Number.isFinite(balance) ? balance : 0));
  const index = Math.max(
    0,
    rungs.findLastIndex((rung) => points >= rung.from),
  );

  const steps: LadderStep[] = rungs.map((rung, position) => {
    const to = rungs[position + 1]?.from ?? null;
    const state = position < index ? 'passed' : position === index ? 'current' : 'ahead';
    const fill =
      state === 'passed' ? 1 : state === 'ahead' ? 0 : to === null ? 1 : Math.min(1, Math.max(0, (points - rung.from) / (to - rung.from)));
    return { id: rung.id, label: rung.label, from: rung.from, to, fill, state };
  });

  const current = steps[index];
  const following = steps[index + 1];
  return {
    points,
    steps,
    current,
    next: following ? { label: following.label, needed: following.from - points } : null,
  };
}
