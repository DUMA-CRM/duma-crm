// Simple, backend-free modifier categories.
//
// The API stores a modifier as a flat record with just a `name` (no group field),
// so we encode an optional category as a prefix on the name: "<Category>: <Label>".
// e.g. "Milk: Oat Milk". These helpers parse/build that convention so the UI can
// group modifiers (in the menu editor and POS) without any backend change.

export const MODIFIER_CATEGORY_SEP = ': ';

// Label shown for modifiers that have no category.
export const UNCATEGORISED_LABEL = 'Add-ons';

export function parseModifierName(raw: string): { category: string | null; label: string } {
  const idx = raw.indexOf(MODIFIER_CATEGORY_SEP);
  if (idx === -1) return { category: null, label: raw.trim() };
  const category = raw.slice(0, idx).trim();
  const label = raw.slice(idx + MODIFIER_CATEGORY_SEP.length).trim();
  // Fall back to treating the whole thing as a label if either side is empty.
  if (!category || !label) return { category: null, label: raw.trim() };
  return { category, label };
}

export function encodeModifierName(category: string, label: string): string {
  const c = category.trim();
  const l = label.trim();
  return c ? `${c}${MODIFIER_CATEGORY_SEP}${l}` : l;
}

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
