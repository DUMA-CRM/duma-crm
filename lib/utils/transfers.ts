// ---------------------------------------------------------------------------
// Transfers as one item at one location sees them: which way the stock goes,
// how much of this item, and whether a typed quantity can be sent. Pure.
// ---------------------------------------------------------------------------

export interface TransferLike {
  fromLocationId: string;
  toLocationId: string;
  status: 'pending' | 'completed' | 'cancelled';
  lines: { stockItemId: string; quantity: string; stockItem?: { name: string; unit: string } }[];
  fromLocation?: { name: string };
  toLocation?: { name: string };
}

/** Out of this location, or into it. */
export const direction = (t: TransferLike, locationId: string): 'out' | 'in' => (t.fromLocationId === locationId ? 'out' : 'in');

/** The other end of the transfer, by name. */
export const otherSide = (t: TransferLike, locationId: string) =>
  direction(t, locationId) === 'out' ? (t.toLocation?.name ?? 'another location') : (t.fromLocation?.name ?? 'another location');

/** This item's line, and how many other items travel with it. */
export function itemLine(t: TransferLike, stockItemId: string) {
  const line = t.lines.find((l) => l.stockItemId === stockItemId) ?? null;
  return { quantity: line ? Number(line.quantity) : null, others: t.lines.length - (line ? 1 : 0) };
}

/** The signed change a transfer makes (or would make) to this location's stock. */
export function signedChange(t: TransferLike, stockItemId: string, locationId: string): number | null {
  const { quantity } = itemLine(t, stockItemId);
  if (quantity === null) return null;
  return direction(t, locationId) === 'out' ? -quantity : quantity;
}

/**
 * Why a typed quantity can't be sent, or null when it can. The API stores two
 * decimals and refuses more than the sender holds.
 */
export function quantityError(value: string, available: number): string | null {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return 'Enter how much to send.';
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'A number with up to two decimals.';
  const n = Number(trimmed);
  if (n <= 0) return 'More than 0.';
  if (n > available) return `Only ${Math.round(available * 100) / 100} available.`;
  return null;
}
