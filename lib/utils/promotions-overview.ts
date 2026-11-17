import { toMinor } from './cash-count.ts';
import { type PromotionKind, type PromotionStanding, type PromotionStatus, promotionStanding } from './promotions.ts';

/**
 * The Promotions list's arithmetic: which view a promotion falls in, the list
 * a search and the filters leave, and the four figures above it. Kept out of
 * the component so the rules (used up counts as ended, archived ones are out
 * of the live figures but their money still counts) are pinned by a test.
 */

/** What the list shows: the promotions in use, one standing, or the archive. */
export type PromotionsView = 'current' | 'live' | 'scheduled' | 'paused' | 'ended' | 'archived';

export const PROMOTIONS_VIEW_LABELS: Record<PromotionsView, string> = {
  current: 'Current',
  live: 'Live',
  scheduled: 'Scheduled',
  paused: 'Paused',
  ended: 'Ended',
  archived: 'Archived',
};

/** Past its end date or out of uses: either way it no longer works until someone changes it. */
const VIEW_OF: Record<PromotionStanding, Exclude<PromotionsView, 'current'>> = {
  live: 'live',
  scheduled: 'scheduled',
  paused: 'paused',
  ended: 'ended',
  used_up: 'ended',
  archived: 'archived',
};

export interface PromotionsListRow {
  name: string;
  kind: PromotionKind;
  status: PromotionStatus;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  firstCode: string | null;
  /** Decimal string: what uses that still stand took off. */
  discountTotal: string;
}

export function inPromotionsView(promotion: PromotionsListRow, view: PromotionsView, now: number): boolean {
  if (view === 'current') return promotion.status !== 'archived';
  return VIEW_OF[promotionStanding(promotion, now)] === view;
}

/** The promotions a view, a type and a name-or-code search leave, in the order given. */
export function filterPromotions<T extends PromotionsListRow>(
  promotions: readonly T[],
  { view, kind, search }: { view: PromotionsView; kind: PromotionKind | 'any'; search: string },
  now: number,
): T[] {
  const needle = search.trim().toLowerCase();
  return promotions.filter(
    (promotion) =>
      inPromotionsView(promotion, view, now) &&
      (kind === 'any' || promotion.kind === kind) &&
      (!needle || promotion.name.toLowerCase().includes(needle) || Boolean(promotion.firstCode?.toLowerCase().includes(needle))),
  );
}

/**
 * The figures over the list. Live, paused and ended count the promotions in
 * use; uses and the discount given count every promotion, archived too — that
 * money was still given. The total is added in pence and handed back as a
 * decimal string, so a long list can't drift by a penny.
 */
export function promotionsOverview(promotions: readonly PromotionsListRow[], now: number) {
  let current = 0;
  let live = 0;
  let paused = 0;
  let ended = 0;
  let uses = 0;
  let givenPence = 0;
  for (const promotion of promotions) {
    uses += promotion.redemptionCount;
    givenPence += toMinor(promotion.discountTotal);
    if (promotion.status === 'archived') continue;
    current += 1;
    const view = VIEW_OF[promotionStanding(promotion, now)];
    if (view === 'live') live += 1;
    else if (view === 'paused') paused += 1;
    else if (view === 'ended') ended += 1;
  }
  return { current, live, paused, ended, uses, discountGiven: (givenPence / 100).toFixed(2) };
}
