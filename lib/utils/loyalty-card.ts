export interface LoyaltyCardProgress {
  rewardCount: number;
  stampsTowardNext: number;
  stampsRemaining: number;
  slots: number;
  filledSlots: number;
}

/** Keeps large programmes readable while preserving their exact progress in copy. */
export function getLoyaltyCardProgress(balance: number, rewardCost: number, maxSlots = 12): LoyaltyCardProgress {
  const safeBalance = Math.max(0, Math.floor(balance));
  const safeCost = Math.max(1, Math.floor(rewardCost));
  const rewardCount = Math.floor(safeBalance / safeCost);
  const stampsTowardNext = safeBalance % safeCost;
  const slots = Math.min(safeCost, Math.max(1, Math.floor(maxSlots)));
  const filledSlots = Math.min(slots, Math.floor((stampsTowardNext / safeCost) * slots));

  return {
    rewardCount,
    stampsTowardNext,
    stampsRemaining: safeCost - stampsTowardNext,
    slots,
    filledSlots,
  };
}

/**
 * How many stamps sit in a row: a short card on one line, a longer one in two
 * even rows — the way a printed punch card is laid out (10 is 5 × 2).
 */
export function stampColumns(slots: number): number {
  const safe = Math.max(1, Math.floor(slots));
  return safe <= 6 ? safe : Math.ceil(safe / 2);
}

export interface RewardScopeRule {
  kind: 'free_item' | 'free_modifier' | 'percentage_off';
  menuItemIds: string[];
  categoryIds: string[];
  modifierGroupIds: string[];
}

/** id → name, for whatever the caller could load. A missing map means "not loaded". */
export interface RewardScopeNames {
  items?: Map<string, string>;
  categories?: Map<string, string>;
  modifierGroups?: Map<string, string>;
}

/**
 * What a reward can be spent on, as lines a person can read. Names where they
 * resolved; a count where they did not, so an unloaded or deleted item never
 * turns "3 items" into "any item".
 */
export function describeRewardScope(rule: RewardScopeRule, names: RewardScopeNames = {}): string[] {
  const resolve = (ids: string[], map: Map<string, string> | undefined, one: string, many: string) => {
    if (ids.length === 0) return [];
    const found = map ? ids.map((id) => map.get(id)).filter((name): name is string => Boolean(name)) : [];
    if (found.length === ids.length) return found;
    return [`${ids.length} ${ids.length === 1 ? one : many}`];
  };

  if (rule.kind === 'free_modifier') {
    const groups = resolve(rule.modifierGroupIds, names.modifierGroups, 'modifier group', 'modifier groups');
    return groups.length > 0 ? groups : ['Any modifier'];
  }

  const lines = [
    ...resolve(rule.menuItemIds, names.items, 'menu item', 'menu items'),
    ...resolve(rule.categoryIds, names.categories, 'category', 'categories'),
  ];
  return lines.length > 0 ? lines : ['Any item on the menu'];
}
