/**
 * The till's key layouts: each menu page (Favourites, All, a category) as an
 * ordered list of keys and their sizes, arranged on the till itself.
 *
 * A layout is an order, not coordinates. The till's columns change with the
 * device and its rotation — five across on a 10" tablet, six on a 12.9", two
 * on a phone — so the keys are laid out densely in reading order by the grid,
 * and a layout saved in landscape still reads right in portrait. Items added
 * to the menu after a page was arranged join its end; removed ones drop out.
 */

export interface KeySize {
  /** Columns: 1, or 2 for a wide key. */
  w: 1 | 2;
  /** Rows: 1, or 2 for a big key. */
  h: 1 | 2;
}

export interface KeyEntry extends KeySize {
  id: string;
}

/** The sizes a key steps through, smallest first: a key, a wide key, a big key. */
export const KEY_SIZES: readonly KeySize[] = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 2, h: 2 },
];

const isKeySize = (entry: { w: unknown; h: unknown }) => KEY_SIZES.some((size) => size.w === entry.w && size.h === entry.h);

/**
 * A page's items in its arranged order with their sizes: the saved order for
 * the items still on the page, then any others in menu order as plain keys.
 */
export function arrangeKeys<T extends { id: string }>(
  items: readonly T[],
  saved: readonly KeyEntry[] | undefined,
): Array<{ item: T } & KeySize> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const placed = new Set<string>();
  const arranged: Array<{ item: T } & KeySize> = [];
  for (const entry of saved ?? []) {
    const item = byId.get(entry.id);
    if (!item || placed.has(entry.id)) continue;
    placed.add(entry.id);
    // A size this version doesn't know (an older or hand-edited store) falls back to a plain key.
    arranged.push(isKeySize(entry) ? { item, w: entry.w, h: entry.h } : { item, w: 1, h: 1 });
  }
  for (const item of items) if (!placed.has(item.id)) arranged.push({ item, w: 1, h: 1 });
  return arranged;
}

/** What to save for a page: its keys in order with their sizes. */
export const keyLayout = (arranged: ReadonlyArray<{ item: { id: string } } & KeySize>): KeyEntry[] =>
  arranged.map(({ item, w, h }) => ({ id: item.id, w, h }));

/** `from` moved to where `to` is, the keys between shifting along — a drag dropped on another key. */
export function moveKey(layout: readonly KeyEntry[], from: string, to: string): KeyEntry[] {
  const fromIndex = layout.findIndex((entry) => entry.id === from);
  const toIndex = layout.findIndex((entry) => entry.id === to);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return [...layout];
  const next = [...layout];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

/** The next size up, wrapping from the big key back to a plain one. */
export function nextKeySize(size: KeySize): KeySize {
  const index = KEY_SIZES.findIndex((option) => option.w === size.w && option.h === size.h);
  return KEY_SIZES[(index + 1) % KEY_SIZES.length]!;
}

/** "Key", "Wide key", "Big key" — for the size button and what a screen reader hears. */
export function keySizeName(size: KeySize): string {
  if (size.w === 2 && size.h === 2) return 'Big key';
  if (size.w === 2) return 'Wide key';
  return 'Key';
}
