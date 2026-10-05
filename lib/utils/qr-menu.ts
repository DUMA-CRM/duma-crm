/**
 * The QR menu as guests will get it, for the settings screen. Mirrors the
 * public menu in duma-api `src/routes/qr-ordering.ts`: categories follow
 * `categoryOrder` then their own sort order, only active categories and
 * available items reach guests, and featured items lead their category.
 */

export const MAX_FEATURED = 12;

export interface QrMenuCategory {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface QrMenuItem {
  id: string;
  categoryId: string;
  name: string;
  isAvailable: boolean;
}

export interface QrMenuGroup<I extends QrMenuItem> {
  id: string;
  name: string;
  /** False when the category is switched off in Products, so guests see none of it. */
  reachesGuests: boolean;
  items: I[];
}

export function groupQrMenu<I extends QrMenuItem>(
  items: I[],
  categories: QrMenuCategory[],
  content: { categoryOrder: string[]; featuredItemIds: string[] },
): QrMenuGroup<I>[] {
  const order = new Map(content.categoryOrder.map((id, index) => [id, index]));
  const featured = new Set(content.featuredItemIds);
  const rank = (category: QrMenuCategory) => order.get(category.id) ?? 10_000 + category.sortOrder;
  const known = new Set(categories.map((category) => category.id));

  const groups: QrMenuGroup<I>[] = [...categories]
    .sort((a, b) => rank(a) - rank(b))
    .map((category) => ({
      id: category.id,
      name: category.name,
      reachesGuests: category.isActive,
      items: items.filter((item) => item.categoryId === category.id),
    }));
  const orphans = items.filter((item) => !known.has(item.categoryId));
  if (orphans.length) groups.push({ id: 'uncategorised', name: 'Other', reachesGuests: false, items: orphans });

  return groups
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => Number(featured.has(b.id)) - Number(featured.has(a.id)) || a.name.localeCompare(b.name)),
    }));
}

/** Toggles an item's featured flag; refuses (returns the same list) past the API's cap. */
export function toggleFeatured(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((existing) => existing !== id);
  return ids.length >= MAX_FEATURED ? ids : [...ids, id];
}
