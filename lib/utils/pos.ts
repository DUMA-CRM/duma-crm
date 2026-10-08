import type { CartItem, MenuItem, MenuOption } from '@/types/pos';

// Relative, not aliased: `node --experimental-strip-types` erases type-only
// imports but resolves value ones, and the test runner has no path mapping.
import { type ComboRule, toggleOption } from './combo.ts';
import { formatCurrency } from './currencies.ts';

/** Order-independent key for a set of chosen modifiers, used to merge identical cart lines. */
export function selectionKey(selected: MenuOption[]): string {
  return selected
    .map((o) => o.id)
    .sort()
    .join(',');
}

/** Two lines merge only when the item, its options and its note all match — "no foam" is a different drink. */
export const lineKey = (itemId: string, selected: MenuOption[], note = '') => `${itemId}|${selectionKey(selected)}|${note.trim().toLowerCase()}`;

export function cartItemTotal(c: CartItem): number {
  const addOns = c.selected.reduce((sum, opt) => sum + opt.price, 0);
  return (c.item.price + addOns) * c.quantity;
}

export const cartTotal = (cart: CartItem[]) => cart.reduce((sum, c) => sum + cartItemTotal(c), 0);
export const cartCount = (cart: CartItem[]) => cart.reduce((sum, c) => sum + c.quantity, 0);

/** How many of each menu item are already on the ticket — the badge on its tile. */
export function countByItem(cart: CartItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const line of cart) counts[line.item.id] = (counts[line.item.id] ?? 0) + line.quantity;
  return counts;
}

/**
 * Everything that goes into `POST /orders`, as one string. Checkout reuses an
 * order it already created while this still matches — reopening the till after
 * a declined card must not create a second order for the same basket.
 */
export function cartSignature(cart: CartItem[], customerId: string | null | undefined, notes: string): string {
  const lines = cart.map((c) => `${lineKey(c.item.id, c.selected, c.note)}x${c.quantity}`).sort();
  return JSON.stringify([lines, customerId ?? '', notes.trim()]);
}

/**
 * A till price in pence (or kopecks, groszy…), with the currency's own sign —
 * "₴12.50", not "UAH 12.50". The same formatter as every other figure in the app.
 */
export function formatPrice(cents: number, currency = 'GBP'): string {
  return formatCurrency(cents / 100, currency, 2);
}

// ── Finding items ────────────────────────────────────────────────────────────

const fold = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * A search looks across every category — the cashier typing "flat" wants the
 * flat white wherever it lives — and matches the start of any word first.
 */
export function filterMenu(items: MenuItem[], category: string, query: string): MenuItem[] {
  const q = fold(query.trim());
  if (!q) return category === 'all' ? items : items.filter((item) => item.category === category);
  const scored = items
    .map((item) => {
      const name = fold(item.name);
      const words = name.split(/[\s-]+/);
      const score = name.startsWith(q) ? 0 : words.some((word) => word.startsWith(q)) ? 1 : name.includes(q) ? 2 : -1;
      return { item, score };
    })
    .filter((entry) => entry.score >= 0);
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.item);
}

// ── Modifier groups ──────────────────────────────────────────────────────────

export interface OptionGroupRule extends ComboRule {
  id: string;
  name: string;
  options: MenuOption[];
}

/** A group with no configured rule reads as it always did: optional, choose one. Ungrouped extras: optional, any. */
const UNGROUPED: ComboRule = { minSelections: 0, maxSelections: null };

/**
 * The item's options in the groups the API enforces (`POST /orders` rejects a
 * required group left empty, or too many picks). Groups follow the order set on
 * Menu → Categories (the group's `sortOrder`, then name — as that page sorts),
 * and options their own `sortOrder`. Options outside any group are "Extras",
 * any number.
 */
export function buildOptionGroups(
  options: Array<MenuOption & { groupId?: string | null; sortOrder?: number }>,
  rules: Array<{ id: string; name: string; minSelections: number; maxSelections: number | null; sortOrder?: number; itemSortOrder?: number }>,
): OptionGroupRule[] {
  const ordered = [...rules].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  const byOptionOrder = (a: { sortOrder?: number }, b: { sortOrder?: number }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  const groups: OptionGroupRule[] = ordered.map((rule) => ({
    id: rule.id,
    name: rule.name,
    minSelections: rule.minSelections,
    maxSelections: rule.maxSelections,
    options: options.filter((option) => option.groupId === rule.id).sort(byOptionOrder),
  }));
  // Grouped by the legacy category label when the group has no rule row.
  const known = new Set(ordered.map((rule) => rule.id));
  const loose = options.filter((option) => !option.groupId || !known.has(option.groupId));
  const byCategory = new Map<string, MenuOption[]>();
  for (const option of loose) {
    const label = option.category?.trim() || 'Extras';
    byCategory.set(label, [...(byCategory.get(label) ?? []), option]);
  }
  for (const [name, list] of byCategory) {
    groups.push({ id: `category:${name}`, name, ...(name === 'Extras' ? UNGROUPED : { minSelections: 0, maxSelections: 1 }), options: list });
  }
  return groups.filter((group) => group.options.length > 0);
}

/** The defaults, capped to each group's maximum so a pre-selection can never be one the API rejects. */
export function defaultSelection(groups: OptionGroupRule[]): string[] {
  const picked: string[] = [];
  for (const group of groups) {
    const defaults = group.options.filter((option) => option.isDefault).map((option) => option.id);
    picked.push(...(group.maxSelections == null ? defaults : defaults.slice(0, group.maxSelections)));
  }
  return picked;
}

/** Tap an option under its group's rule (see `lib/utils/combo.ts`). */
export function toggleInGroup(selected: string[], optionId: string, group: OptionGroupRule): string[] {
  const ids = group.options.map((option) => option.id);
  const next = toggleOption(selected, optionId, ids, group);
  // A required group can be emptied by tapping its only pick — that's how a
  // cashier changes their mind; `missingGroups` then holds the Add button.
  if (next === selected && selected.includes(optionId)) return selected.filter((id) => id !== optionId);
  return next;
}

/** Groups still short of their minimum. */
export const missingGroups = (groups: OptionGroupRule[], selected: string[]) =>
  groups.filter((group) => group.options.filter((option) => selected.includes(option.id)).length < group.minSelections);

export function ruleHint(group: ComboRule): string {
  if (group.maxSelections === 1) return group.minSelections > 0 ? 'Choose one' : 'Optional';
  if (group.maxSelections == null) return group.minSelections > 0 ? `Choose at least ${group.minSelections}` : 'Optional · any';
  return group.minSelections > 0 ? `Choose ${group.minSelections}–${group.maxSelections}` : `Optional · up to ${group.maxSelections}`;
}

// ── Cash ─────────────────────────────────────────────────────────────────────

/** Note values, in minor units, for the currencies the till commonly sees. Anything else uses 5/10/20/50/100. */
const NOTES: Record<string, number[]> = {
  GBP: [500, 1000, 2000, 5000],
  EUR: [500, 1000, 2000, 5000, 10000],
  USD: [100, 500, 1000, 2000, 5000, 10000],
  PLN: [1000, 2000, 5000, 10000, 20000],
  UAH: [5000, 10000, 20000, 50000, 100000],
};

/**
 * One-tap tender suggestions: the exact amount, the next whole unit, then the
 * next few notes that cover it. Four at most — more is a second keypad.
 */
export function quickCash(due: number, currency = 'GBP'): number[] {
  if (due <= 0) return [];
  const notes = NOTES[currency] ?? [500, 1000, 2000, 5000, 10000];
  const out = [due];
  const nextWhole = Math.ceil(due / 100) * 100;
  if (nextWhole > due) out.push(nextWhole);
  for (const note of notes) {
    // Smallest multiple of this note that covers the bill: £23.40 → £25 (5s), £30 (10s), £40 (20s), £50.
    const cover = Math.ceil(due / note) * note;
    if (!out.includes(cover)) out.push(cover);
  }
  return [...new Set(out)].sort((a, b) => a - b).slice(0, 4);
}

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'back' | 'clear';

/**
 * A till keypad: digits shift in from the right, as on a card terminal —
 * 2, 0, 0, 0 reads £20.00. Stored as a digit string so leading zeros and
 * "00" behave. Capped at 8 digits (£999,999.99).
 */
export function applyKey(entry: string, key: KeypadKey): string {
  if (key === 'clear') return '';
  if (key === 'back') return entry.slice(0, -1);
  const next = (entry + key).replace(/^0+/, '');
  return next.length > 8 ? entry : next;
}

export const entryToMinor = (entry: string) => (entry ? Number.parseInt(entry, 10) : 0);
export const minorToEntry = (minor: number) => (minor > 0 ? String(Math.round(minor)) : '');

export function changeDue(tendered: number, due: number): { change: number; short: number } {
  return { change: Math.max(0, tendered - due), short: Math.max(0, due - tendered) };
}

// ── Offline ──────────────────────────────────────────────────────────────────

/**
 * Whether a failed request never reached the API — the only case where a sale
 * may be saved on the till and replayed later. A browser network failure, a
 * timeout, the till knowing it's offline, or the proxy's 502/503/504. Anything
 * else (a 4xx, or a bug in our own code) is shown, never queued: queueing a
 * sale the server already created makes the replay a second order.
 */
export function isUnreachable(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return [502, 503, 504].includes((err as { status: number }).status);
  }
  if (!(err instanceof Error)) return false;
  if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.message === 'offline') return true;
  return err.name === 'TypeError' && /fetch|network|load failed/i.test(err.message);
}

// ── Stock on the menu ────────────────────────────────────────────────────────

export type StockLevel = 'low' | 'out';

interface StockRow {
  stockItemId: string;
  quantity: string;
  lowThreshold: string;
  isAvailable?: boolean;
  stockItem?: { name?: string } | null;
}

interface RecipeRow {
  stockItemId: string;
  sizeModifierId?: string | null;
  stockItem?: { name?: string } | null;
}

/**
 * How each menu item stands at this location, from its recipe and the
 * location's stock: out if an ingredient has none left (or is switched off
 * here), low if one is at or under its threshold. The default recipe lines
 * decide; size overrides use the same ingredients. An ingredient this
 * location doesn't stock is ignored rather than read as "out" — it's untracked,
 * not missing. Items without a problem are absent from the result.
 */
export function menuStockStatus(
  recipes: Record<string, RecipeRow[]>,
  stock: StockRow[],
): Record<string, { level: StockLevel; ingredient: string }> {
  const byItem = new Map(stock.map((row) => [row.stockItemId, row]));
  const out: Record<string, { level: StockLevel; ingredient: string }> = {};
  for (const [menuItemId, lines] of Object.entries(recipes)) {
    const base = lines.filter((line) => !line.sizeModifierId);
    const relevant = base.length > 0 ? base : lines;
    for (const line of relevant) {
      const row = byItem.get(line.stockItemId);
      if (!row) continue;
      const qty = Number(row.quantity);
      const threshold = Number(row.lowThreshold);
      const name = line.stockItem?.name ?? row.stockItem?.name ?? 'An ingredient';
      const level: StockLevel | null = row.isAvailable === false || qty <= 0 ? 'out' : Number.isFinite(threshold) && qty <= threshold ? 'low' : null;
      if (!level) continue;
      if (level === 'out' || !out[menuItemId]) out[menuItemId] = { level, ingredient: name };
      if (level === 'out') break;
    }
  }
  return out;
}

// ── Favourites and categories ────────────────────────────────────────────────

/** Pinned items in pin order, or best sellers in rank order — only ones on sale now. */
export function resolveFavourites(
  mode: 'off' | 'pinned' | 'top',
  items: MenuItem[],
  pinnedIds: string[],
  topIds: string[],
  limit = 12,
): MenuItem[] {
  if (mode === 'off') return [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const ids = mode === 'pinned' ? pinnedIds : topIds;
  return [...new Set(ids)].map((id) => byId.get(id)).filter((item): item is MenuItem => !!item).slice(0, limit);
}

/** Pin or unpin, keeping the order the cashier chose. */
export const togglePinned = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]);

/** Move a pinned item one place up (-1) or down (+1). */
export function movePinned(ids: string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Category tiles for the categories-first layout: only categories with something on sale, with a count and a cover image. */
export function categoryTiles(items: MenuItem[], categories: Array<{ id: string; name: string }>) {
  return categories
    .map((category) => {
      const inCategory = items.filter((item) => item.category === category.id);
      return { id: category.id, name: category.name, count: inCategory.length, image: inCategory.find((item) => item.image)?.image ?? '' };
    })
    .filter((tile) => tile.count > 0);
}

// ── Customers ────────────────────────────────────────────────────────────────

/**
 * Pre-fill "New customer" from what was searched: a number becomes the phone,
 * an address the email, words the name ("Jane van Dijk" → Jane / van Dijk).
 */
export function guessNewCustomer(query: string): { firstName: string; lastName: string; phone: string; email: string } {
  const q = query.trim();
  const empty = { firstName: '', lastName: '', phone: '', email: '' };
  if (!q) return empty;
  if (q.includes('@')) return { ...empty, email: q };
  if (/^\+?[\d\s()-]{3,}$/.test(q)) return { ...empty, phone: q };
  const [firstName, ...rest] = q.split(/\s+/);
  return { ...empty, firstName, lastName: rest.join(' ') };
}

/** Problems with a new customer, as the API would reject them (7–30 character phone, a real email). */
export function newCustomerErrors(input: { firstName: string; lastName: string; phone: string; email: string }) {
  const errors: Partial<Record<'firstName' | 'lastName' | 'phone' | 'email', string>> = {};
  if (!input.firstName.trim()) errors.firstName = 'Add a first name.';
  if (!input.lastName.trim()) errors.lastName = 'Add a last name.';
  const phone = input.phone.trim();
  if (phone.replace(/\D/g, '').length < 7 || phone.length > 30) errors.phone = 'Add a phone number with at least 7 digits.';
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'That email doesn’t look right.';
  return errors;
}
