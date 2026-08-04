import type { CartItem, MenuOption } from '@/types/pos';

/** Order-independent key for a set of chosen modifiers, used to merge identical cart lines. */
export function selectionKey(selected: MenuOption[]): string {
  return selected
    .map((o) => o.id)
    .sort()
    .join(',');
}

export function cartItemTotal(c: CartItem): number {
  const addOns = c.selected.reduce((sum, opt) => sum + opt.price, 0);
  return (c.item.price + addOns) * c.quantity;
}

export function formatPrice(cents: number, currency = 'GBP'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}
