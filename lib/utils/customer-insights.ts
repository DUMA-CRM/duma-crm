// ---------------------------------------------------------------------------
// What a guest's orders say about them, for their record: what they usually
// order (Toast's "top items"). Pure and tested; the record page only draws it.
// ---------------------------------------------------------------------------

export interface InsightOrder {
  status: string;
  items?: { name: string; quantity: number }[];
}

export interface Favourite {
  name: string;
  /** Units bought across the orders read. */
  quantity: number;
  /** How many of those orders had it — "in 12 of 30 orders". */
  orders: number;
}

/**
 * Their most-bought items, by units then by how many orders had them. A
 * cancelled order was never theirs to drink, so it doesn't count.
 */
export function favouriteItems(orders: InsightOrder[], limit = 5): Favourite[] {
  const tally = new Map<string, Favourite>();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const seen = new Set<string>();
    for (const item of order.items ?? []) {
      const name = item.name.trim();
      if (!name) continue;
      const entry = tally.get(name) ?? { name, quantity: 0, orders: 0 };
      entry.quantity += item.quantity;
      if (!seen.has(name)) entry.orders += 1;
      seen.add(name);
      tally.set(name, entry);
    }
  }
  return [...tally.values()].sort((a, b) => b.quantity - a.quantity || b.orders - a.orders || a.name.localeCompare(b.name)).slice(0, limit);
}
