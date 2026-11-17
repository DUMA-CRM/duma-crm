// The menu editors' value-to-words and validation rules, kept out of the
// components so they can be tested. No arithmetic on money beyond reading a
// sign: margin and cost live in lib/menu/costing.ts, nowhere else.

/** A menu item's draft as the form holds it — every amount a string. */
export interface MenuItemDraft {
  name: string;
  categoryId: string;
  price: string;
  imageUrl: string;
  slug: string;
}

export type MenuItemField = 'name' | 'category' | 'price' | 'image' | 'slug';

const PRICE = /^\d+(\.\d{1,2})?$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// The API takes any string; links, inline data images and our own uploads are what's actually used.
const IMAGE = /^(https?:\/\/\S+|data:image\/|\/v1\/(cms\/delivery|menu-items\/images)\/)/;

/** What stops the item saving, field by field, in the form's row order. */
export function menuItemErrors(draft: MenuItemDraft, groupPlaceholder: string): Partial<Record<MenuItemField, string>> {
  const errors: Partial<Record<MenuItemField, string>> = {};
  if (draft.name.trim().length < 2) errors.name = 'At least two characters.';
  if (!draft.categoryId) errors.category = `${groupPlaceholder}.`;
  if (!PRICE.test(draft.price.trim())) errors.price = 'A price like 3.20.';
  if (draft.imageUrl.trim() && !IMAGE.test(draft.imageUrl.trim())) errors.image = 'A full web address, starting https://';
  if (draft.slug.trim() && !SLUG.test(draft.slug.trim())) errors.slug = 'Lower-case letters, numbers and dashes, like oversized-hoodie.';
  return errors;
}

/** A valid price for display, or null — the string is shown as typed, never re-rounded. */
export function displayPrice(raw: string): string | null {
  const value = raw.trim();
  if (!PRICE.test(value)) return null;
  const [whole, pence = ''] = value.split('.');
  return `${whole}.${pence.padEnd(2, '0')}`;
}

/** A modifier's price change as the till shows it: "+£0.50", "−£0.20", or '' for none. */
export function formatPriceChange(raw: string | null | undefined, symbol: string): string {
  const value = Number.parseFloat(raw ?? '0');
  if (!value) return '';
  return `${value > 0 ? '+' : '−'}${symbol}${Math.abs(value).toFixed(2)}`;
}

/** What a price change does to the item's price, in words. */
export function priceChangeWords(raw: string): 'No charge' | 'Takes money off' | 'Added to the item’s price' {
  const value = Number(raw);
  if (!value) return 'No charge';
  return value < 0 ? 'Takes money off' : 'Added to the item’s price';
}

/** The rule a group's selections follow, as the item editor's select stores it ("1:1", "0:many"). */
export function ruleKey(rule: { minSelections: number; maxSelections: number | null }): string {
  return `${rule.minSelections}:${rule.maxSelections ?? 'many'}`;
}

export const RULE_OPTIONS = [
  { value: '0:1', label: 'Optional · choose one' },
  { value: '1:1', label: 'Required · choose one' },
  { value: '0:many', label: 'Optional · choose many' },
  { value: '1:many', label: 'Required · choose many' },
] as const;

/** A rule's words for a row's value, or null for a rule the select doesn't offer. */
export function ruleWords(rule: { minSelections: number; maxSelections: number | null }): string | null {
  return RULE_OPTIONS.find((option) => option.value === ruleKey(rule))?.label ?? null;
}

/**
 * The options a group offers, named in a row's value: the first few by name,
 * then how many more — "Oat · Soy · Almond +2". The names are shown whole;
 * only the count stands in for the rest.
 */
export function offeredSummary(labels: readonly string[], shown = 3): string {
  if (labels.length === 0) return '';
  const head = labels.slice(0, shown).join(' · ');
  return labels.length > shown ? `${head} +${labels.length - shown}` : head;
}

/** A list of names narrowed by a search, ignoring case and accents; blank keeps everything. */
export function matchesSearch(name: string, query: string): boolean {
  const fold = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const needle = fold(query.trim());
  return !needle || fold(name).includes(needle);
}
