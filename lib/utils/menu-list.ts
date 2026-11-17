// ---------------------------------------------------------------------------
// The Products list: search, grouping by category in the menu's own order, and
// what still needs doing to an item before it's fully set up. Pure and tested.
// ---------------------------------------------------------------------------

export interface MenuItemLike {
  id: string;
  name: string;
  description?: string | null;
  categoryId: string;
  isAvailable: boolean;
  imageUrl?: string | null;
}

export interface CategoryLike {
  id: string;
  name: string;
  sortOrder?: number | null;
}

/** Items matching the search (name or description) and category, A to Z. */
export function filterMenuItems<T extends MenuItemLike>(items: T[], search: string, categoryId: string | 'all'): T[] {
  const q = search.trim().toLowerCase();
  return items
    .filter((item) => (categoryId === 'all' || item.categoryId === categoryId) && (!q || item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Items under their category, categories in menu order; unknown categories last. */
export function groupByCategory<T extends MenuItemLike>(items: T[], categories: CategoryLike[]) {
  const order = new Map(categories.map((c, index) => [c.id, c.sortOrder ?? index]));
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.categoryId, [...(groups.get(item.categoryId) ?? []), item]);
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER))
    .map(([id, groupItems]) => ({ id, name: names.get(id) ?? 'Uncategorised', items: groupItems, available: groupItems.filter((i) => i.isAvailable).length }));
}

/** What still needs doing before an item is fully set up. */
export function setupGaps(item: MenuItemLike, cost: { hasRecipe: boolean; costComplete: boolean } | undefined): string[] {
  const gaps: string[] = [];
  if (!cost?.hasRecipe) gaps.push('No recipe');
  else if (!cost.costComplete) gaps.push('Ingredient costs missing');
  if (!item.imageUrl) gaps.push('No image');
  return gaps;
}

// ---------------------------------------------------------------------------
// The Show filter on the Products list, and the Overview's figures that open
// it — one rule, so a figure always matches the rows its link shows.
// ---------------------------------------------------------------------------

export type MenuShow = 'all' | 'on' | 'off' | 'not-costed' | 'loss' | 'no-photo';

const KITCHEN_SHOWS: readonly MenuShow[] = ['all', 'on', 'off', 'not-costed', 'loss'];
const SHOP_SHOWS: readonly MenuShow[] = ['all', 'on', 'off', 'no-photo'];

/** The Show choices a workspace has: recipes and margins for a kitchen, photos for a shop. */
export function menuShows(kitchen: boolean): readonly MenuShow[] {
  return kitchen ? KITCHEN_SHOWS : SHOP_SHOWS;
}

/** A `?show=` value, or every item when it's missing or not one this workspace has. */
export function parseMenuShow(value: string | null | undefined, kitchen: boolean): MenuShow {
  return menuShows(kitchen).find((show) => show === value) ?? 'all';
}

/** An item's cost reduced to what the filter reads; `marginPct` is null unless every ingredient carries a cost. */
export interface ShowCost {
  loading: boolean;
  hasRecipe: boolean;
  costComplete: boolean;
  marginPct: number | null;
}

/**
 * Whether an item belongs under a Show choice. An item still costing is in
 * neither "Not costed" nor "At a loss" — those must mean what they say, not
 * "loading".
 */
export function inMenuShow(item: MenuItemLike, cost: ShowCost | undefined, show: MenuShow): boolean {
  switch (show) {
    case 'all':
      return true;
    case 'on':
      return item.isAvailable;
    case 'off':
      return !item.isAvailable;
    case 'no-photo':
      return !item.imageUrl;
    case 'not-costed':
      return Boolean(cost && !cost.loading && !cost.costComplete);
    case 'loss':
      return Boolean(cost && !cost.loading && cost.costComplete && cost.marginPct != null && cost.marginPct < 0);
  }
}

/** How many items fall under a Show choice. */
export function countMenuShow(items: MenuItemLike[], costs: Map<string, ShowCost>, show: MenuShow): number {
  return items.filter((item) => inMenuShow(item, costs.get(item.id), show)).length;
}
