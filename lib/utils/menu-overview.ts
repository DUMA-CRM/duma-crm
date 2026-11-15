// ---------------------------------------------------------------------------
// The Menu overview: what needs fixing before the menu is fully set up, and
// where it makes the least money. Pure and tested; the page only draws it.
// ---------------------------------------------------------------------------

export interface OverviewItem {
  id: string;
  name: string;
  isAvailable: boolean;
  imageUrl?: string | null;
}

/** An item's cost as `useMenuItemCosts` reports it, reduced to what the overview reads. */
export interface OverviewCost {
  loading: boolean;
  hasRecipe: boolean;
  costComplete: boolean;
  /** Null unless every ingredient carries a cost. */
  marginPct: number | null;
}

export type AttentionKind = 'loss' | 'no-recipe' | 'costs-missing' | 'no-photo' | 'empty-section' | 'empty-group';

export interface AttentionEntry {
  key: string;
  kind: AttentionKind;
  /** The worst first: a loss, then what stops stock and allergens working, then tidying. */
  tone: 'exception' | 'measured' | 'info';
  /** What it's about — an item, a section or a group. */
  id: string;
  name: string;
}

const RANK: Record<AttentionEntry['tone'], number> = { exception: 0, measured: 1, info: 2 };

/**
 * Everything on the menu that needs someone. A kitchen is judged on recipes
 * and margins; a shop (no recipes) on photos. Items still costing are left out
 * rather than flagged — "no recipe" must mean there is none, not "loading".
 */
export function menuAttention({
  items,
  costs,
  sections,
  groups,
  kitchen,
}: {
  items: OverviewItem[];
  costs: Map<string, OverviewCost>;
  sections: { id: string; name: string; isActive: boolean; itemCount: number }[];
  groups: { id: string; name: string; optionCount: number }[];
  kitchen: boolean;
}): AttentionEntry[] {
  const out: AttentionEntry[] = [];
  const add = (kind: AttentionKind, tone: AttentionEntry['tone'], id: string, name: string) =>
    out.push({ key: `${kind}:${id}`, kind, tone, id, name });

  for (const item of items) {
    if (kitchen) {
      const cost = costs.get(item.id);
      if (!cost || cost.loading) continue;
      if (!cost.hasRecipe) add('no-recipe', 'measured', item.id, item.name);
      else if (!cost.costComplete) add('costs-missing', 'measured', item.id, item.name);
      else if (cost.marginPct != null && cost.marginPct < 0) add('loss', 'exception', item.id, item.name);
    } else if (!item.imageUrl) add('no-photo', 'measured', item.id, item.name);
  }
  // A hidden empty section is parked on purpose; only a shown one reads as a gap.
  for (const section of sections) if (section.isActive && section.itemCount === 0) add('empty-section', 'info', section.id, section.name);
  if (kitchen) for (const group of groups) if (group.optionCount === 0) add('empty-group', 'info', group.id, group.name);

  return out.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}

/** The costed items on the menu, lowest margin first. */
export function lowestMargins<T extends OverviewItem>(items: T[], costs: Map<string, OverviewCost>, limit = 5) {
  return items
    .flatMap((item) => {
      const marginPct = costs.get(item.id)?.marginPct;
      return item.isAvailable && marginPct != null ? [{ item, marginPct }] : [];
    })
    .sort((a, b) => a.marginPct - b.marginPct || a.item.name.localeCompare(b.item.name))
    .slice(0, limit);
}

/** The mean margin of the costed items on the menu, or null when none is costed — never a flattering 100%. */
export function averageMargin(items: OverviewItem[], costs: Map<string, OverviewCost>): { pct: number; costed: number } | null {
  const pcts = items.flatMap((item) => {
    const marginPct = costs.get(item.id)?.marginPct;
    return item.isAvailable && marginPct != null ? [marginPct] : [];
  });
  if (pcts.length === 0) return null;
  return { pct: pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length, costed: pcts.length };
}
