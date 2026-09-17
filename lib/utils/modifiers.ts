// Label shown for modifiers that have no category.
export const UNCATEGORISED_LABEL = 'Add-ons';

// Group items by their category, preserving first-seen order; uncategorised last.
export function groupByCategory<T>(items: T[], categoryOf: (item: T) => string | null): { category: string; items: T[] }[] {
  const groups: { category: string; items: T[] }[] = [];
  const index = new Map<string, T[]>();
  for (const item of items) {
    const key = categoryOf(item) ?? UNCATEGORISED_LABEL;
    let bucket = index.get(key);
    if (!bucket) {
      bucket = [];
      index.set(key, bucket);
      groups.push({ category: key, items: bucket });
    }
    bucket.push(item);
  }
  // Keep uncategorised group at the end.
  return groups.sort((a, b) => {
    if (a.category === UNCATEGORISED_LABEL) return 1;
    if (b.category === UNCATEGORISED_LABEL) return -1;
    return 0;
  });
}

interface ModifierLike {
  label: string;
  category: string | null;
  isSize: boolean;
}

export function modifierLabel(modifier: ModifierLike): string {
  return modifier.label.trim();
}

export function modifierCategory(modifier: ModifierLike): string | null {
  return modifier.category?.trim() || null;
}

/**
 * Whether this modifier is a size variant, which makes it a per-size column in
 * the recipe editors.
 *
 * The fallback is the old rule — category equal to the literal 'size' — which
 * is exactly the fragility the column was added to remove: typing "Sizes" used
 * to silently disable size costing with nothing on screen to explain it.
 */
export function isSizeModifier(modifier: ModifierLike): boolean {
  return modifier.isSize;
}
