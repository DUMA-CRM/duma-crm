// ---------------------------------------------------------------------------
// The stock list's arithmetic: where each item stands against its par, what
// the shelf is worth, what to order, and the views that slice it. Pure, so the
// rules a manager orders by can be tested without a browser.
// ---------------------------------------------------------------------------

export type StockHealth = 'ok' | 'low' | 'critical' | 'out' | 'unavailable';

export interface StockLine {
  stockItemId: string;
  name: string;
  unit: string;
  category: string | null;
  qty: number;
  /** Par / reorder level; 0 means none is set. */
  threshold: number;
  isAvailable: boolean;
  /** Last known cost per unit, if any receipt has set one. */
  unitCost: number | null;
  /** Days until it runs out at recent usage; null when there's no usage to go on. */
  coverDays: number | null;
  earliestExpiry: string | null;
  /** What the forecast suggests ordering, if anything. */
  recommendedQty: number;
  /** The per-location reorder quantity, if one is set. */
  reorderQty: number | null;
  needsReorder: boolean;
}

/** Same rule the rest of the app uses: out at zero, critical at half par, low at par. */
export function stockHealth(line: Pick<StockLine, 'qty' | 'threshold' | 'isAvailable'>): StockHealth {
  if (!line.isAvailable) return 'unavailable';
  if (line.qty <= 0) return 'out';
  if (line.threshold <= 0) return 'ok';
  if (line.qty <= line.threshold * 0.5) return 'critical';
  if (line.qty <= line.threshold) return 'low';
  return 'ok';
}

const below = (health: StockHealth) => health === 'low' || health === 'critical' || health === 'out';

const dayMs = 86_400_000;
export const expiresWithin = (date: string | null, now: Date, days: number) =>
  !!date && new Date(date).getTime() <= now.getTime() + days * dayMs;
export const isExpired = (date: string | null, now: Date) => !!date && new Date(date).getTime() < now.getTime();

/** What the shelf is worth at last known cost, and how many items have no cost to count. */
export function stockValue(lines: StockLine[]): { value: number; unpriced: number } {
  let cents = 0;
  let unpriced = 0;
  for (const line of lines) {
    if (line.unitCost === null) {
      if (line.qty > 0) unpriced += 1;
      continue;
    }
    cents += Math.round(Math.max(0, line.qty) * line.unitCost * 100);
  }
  return { value: cents / 100, unpriced };
}

/**
 * How much to order for one item: the forecast's recommendation when there is
 * usage to base it on, else the location's reorder quantity, else enough to
 * get back to twice par. Rounded up — nobody orders 2.3 bags of flour.
 */
export function orderQuantity(line: StockLine): number {
  if (line.recommendedQty > 0) return Math.ceil(line.recommendedQty);
  if (line.reorderQty && line.reorderQty > 0) return Math.ceil(line.reorderQty);
  if (line.threshold > 0) return Math.max(1, Math.ceil(line.threshold * 2 - Math.max(0, line.qty)));
  return 0;
}

/** Whether an item belongs on the order: below par, flagged by the API, or running out within a week. */
export function needsOrdering(line: StockLine): boolean {
  if (!line.isAvailable) return false;
  return below(stockHealth(line)) || line.needsReorder || (line.coverDays !== null && line.coverDays <= 7);
}

/** The suggested order — one line per item that needs it, largest shortfall first. */
export function suggestedOrder(lines: StockLine[]) {
  return lines
    .filter(needsOrdering)
    .map((line) => ({ line, quantity: orderQuantity(line) }))
    .filter((entry) => entry.quantity > 0)
    .sort((a, b) => (a.line.coverDays ?? Infinity) - (b.line.coverDays ?? Infinity) || a.line.name.localeCompare(b.line.name));
}

export type StockView = 'all' | 'reorder' | 'low' | 'expiring' | 'unavailable';
export type StockSort = 'name' | 'cover' | 'expiry' | 'value';

export function filterStock(lines: StockLine[], opts: { view: StockView; category: string; search: string; now: Date }): StockLine[] {
  const q = opts.search.trim().toLowerCase();
  return lines.filter((line) => {
    if (q && !line.name.toLowerCase().includes(q)) return false;
    if (opts.category !== 'all' && line.category !== opts.category) return false;
    const health = stockHealth(line);
    switch (opts.view) {
      case 'reorder':
        return needsOrdering(line);
      case 'low':
        return below(health);
      case 'expiring':
        return expiresWithin(line.earliestExpiry, opts.now, 7);
      case 'unavailable':
        return health === 'unavailable';
      default:
        return true;
    }
  });
}

export function sortStock(lines: StockLine[], sort: StockSort): StockLine[] {
  const byName = (a: StockLine, b: StockLine) => a.name.localeCompare(b.name);
  const copy = [...lines];
  switch (sort) {
    case 'cover':
      return copy.sort((a, b) => (a.coverDays ?? Infinity) - (b.coverDays ?? Infinity) || byName(a, b));
    case 'expiry':
      return copy.sort(
        (a, b) =>
          (a.earliestExpiry ? new Date(a.earliestExpiry).getTime() : Infinity) - (b.earliestExpiry ? new Date(b.earliestExpiry).getTime() : Infinity) ||
          byName(a, b),
      );
    case 'value':
      return copy.sort((a, b) => Math.max(0, b.qty) * (b.unitCost ?? 0) - Math.max(0, a.qty) * (a.unitCost ?? 0) || byName(a, b));
    default:
      return copy.sort(byName);
  }
}

/** Lines under a heading per category, in a fixed shelf order, keeping each group's sort. */
export function groupByCategory(lines: StockLine[]): { category: string | null; lines: StockLine[] }[] {
  const ORDER = ['FOOD', 'BEVERAGE', 'SUPPLY', 'MERCH'];
  const groups = new Map<string | null, StockLine[]>();
  for (const line of lines) {
    const list = groups.get(line.category) ?? [];
    list.push(line);
    groups.set(line.category, list);
  }
  const rank = (category: string | null) => (category === null ? ORDER.length + 1 : ORDER.indexOf(category) === -1 ? ORDER.length : ORDER.indexOf(category));
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([category, grouped]) => ({ category, lines: grouped }));
}

/** Counts for the view selector and the summary tiles. */
export function stockCounts(lines: StockLine[], now: Date) {
  let low = 0;
  let out = 0;
  let expiring = 0;
  let expired = 0;
  let runningOut = 0;
  let unavailable = 0;
  for (const line of lines) {
    const health = stockHealth(line);
    if (health === 'unavailable') unavailable += 1;
    if (health === 'out') out += 1;
    if (below(health)) low += 1;
    if (isExpired(line.earliestExpiry, now)) expired += 1;
    else if (expiresWithin(line.earliestExpiry, now, 7)) expiring += 1;
    if (line.isAvailable && line.coverDays !== null && line.coverDays <= 7) runningOut += 1;
  }
  return { total: lines.length, low, out, expiring, expired, runningOut, unavailable, reorder: lines.filter(needsOrdering).length };
}
