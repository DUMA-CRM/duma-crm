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
