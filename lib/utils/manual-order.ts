// ---------------------------------------------------------------------------
// The basket behind the Orders page's "New order" — an order staff take by hand
// (phone, email, wholesale). Pure, so what gets sent is tested. Prices here are
// pence for display only: the API resolves every price, tax and discount itself.
// ---------------------------------------------------------------------------

import type { CreateOrderPayload, RecordedPaymentMethod } from '../api/orders.service.ts';

export interface BasketLine {
  /** The line's identity, fixed when it is first added — editing its note doesn't make it a new line. */
  key: string;
  menuItemId: string;
  variantId?: string;
  name: string;
  /** "Black / L · Oat milk, Extra shot" — what was chosen, for reading back. */
  detail?: string;
  /** One unit with its options, in pence. */
  unitPence: number;
  quantity: number;
  modifierIds: string[];
  note?: string;
}

export const basketKey = (line: Pick<BasketLine, 'menuItemId' | 'variantId' | 'modifierIds' | 'note'>) =>
  [line.menuItemId, line.variantId ?? '', [...line.modifierIds].sort().join('+'), line.note?.trim() ?? ''].join('|');

/** Add a line, merging into one with the same item, variant, options and note rather than listing it twice. */
export function addToBasket(lines: readonly BasketLine[], line: Omit<BasketLine, 'key'>): BasketLine[] {
  const same = basketKey(line);
  const existing = lines.find((entry) => basketKey(entry) === same);
  if (existing) return lines.map((entry) => (entry === existing ? { ...entry, quantity: entry.quantity + line.quantity } : entry));
  // Unique even if an identical line was added, removed and added again.
  const taken = new Set(lines.map((entry) => entry.key));
  let key = same;
  for (let n = 2; taken.has(key); n += 1) key = `${same}#${n}`;
  return [...lines, { ...line, key }];
}

/** Change one line's note — the kitchen's or the packer's — keeping the line where it is. */
export function setLineNote(lines: readonly BasketLine[], key: string, note: string): BasketLine[] {
  return lines.map((entry) => (entry.key === key ? { ...entry, note: note || undefined } : entry));
}

/** Set a line's quantity; 0 or less takes it off. */
export function setLineQuantity(lines: readonly BasketLine[], key: string, quantity: number): BasketLine[] {
  if (quantity <= 0) return lines.filter((entry) => entry.key !== key);
  return lines.map((entry) => (entry.key === key ? { ...entry, quantity: Math.min(999, Math.floor(quantity)) } : entry));
}

export const basketTotalPence = (lines: readonly BasketLine[]) => lines.reduce((sum, line) => sum + line.unitPence * line.quantity, 0);
export const basketCount = (lines: readonly BasketLine[]) => lines.reduce((sum, line) => sum + line.quantity, 0);

export type ManualPayment = { paid: true; method: RecordedPaymentMethod } | { paid: false };

/** What POST /orders receives for an order taken by hand. */
export function manualOrderPayload(input: {
  locationId: string;
  customerId?: string | null;
  lines: readonly BasketLine[];
  notes?: string;
  payment: ManualPayment;
}): CreateOrderPayload {
  const notes = input.notes?.trim();
  return {
    locationId: input.locationId,
    ...(input.customerId ? { customerId: input.customerId } : {}),
    source: 'manual',
    ...(input.payment.paid ? { paid: true, paymentMethod: input.payment.method } : {}),
    ...(notes ? { notes } : {}),
    items: input.lines.map((line) => ({
      menuItemId: line.menuItemId,
      ...(line.variantId ? { variantId: line.variantId } : {}),
      quantity: line.quantity,
      ...(line.note ? { notes: line.note } : {}),
      ...(line.modifierIds.length ? { modifiers: line.modifierIds.map((modifierId) => ({ modifierId })) } : {}),
    })),
  };
}

export const RECORDED_PAYMENT_LABEL: Record<RecordedPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  custom: 'Other',
};
