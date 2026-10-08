// ---------------------------------------------------------------------------
// Stock cost arithmetic. A container carries its own cost per unit of measure
// (per ml, per g, per piece); the item's cost is the default for a container
// without one. Every movement records the cost it was made at, so a report for
// a past period values stock at what it actually cost — not today's price.
//
// People think in "what I paid for this bottle", not "per ml", so the forms
// take a container price and these convert between the two.
// ---------------------------------------------------------------------------

const toCost = (value: string | number | null | undefined): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** The container's own cost, else the item's; null when neither is known. */
export function effectiveUnitCost(unitCost: string | null | undefined, itemCost: string | null | undefined): number | null {
  return toCost(unitCost) ?? toCost(itemCost);
}

/**
 * Cost per unit of measure from what a whole container cost: £3.00 for a
 * 1000 ml bottle is 0.003 per ml. Four decimals, as the database stores it.
 * Null for a blank or invalid price, or a container with nothing in it.
 */
export function unitCostFromPrice(price: string, quantity: number): number | null {
  const paid = toCost(price.trim().replace(',', '.'));
  if (paid === null || !(quantity > 0)) return null;
  return Math.round((paid / quantity) * 10_000) / 10_000;
}

/** What a container of `quantity` costs at `unitCost` — the reverse, for showing a price back. */
export function containerPrice(unitCost: string | number | null | undefined, quantity: number): number | null {
  const cost = toCost(unitCost);
  return cost === null ? null : cost * quantity;
}

/**
 * What a movement was worth: its size at the cost recorded with it, or — for
 * one made before costs were recorded — at the item's cost. Always positive;
 * the movement's sign says which way stock went.
 */
export function movementValue(movement: { quantity: number; unitCost?: string | null }, itemCost: string | number | null | undefined): number | null {
  const cost = toCost(movement.unitCost) ?? toCost(itemCost);
  return cost === null ? null : Math.abs(movement.quantity) * cost;
}
