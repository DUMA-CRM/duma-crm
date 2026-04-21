import type { CartItem, MenuItem, PendingOptions } from '@/types/pos';

export function cartItemTotal(c: CartItem): number {
  const optionsPrice = Object.values(c.selections).reduce((sum, opt) => sum + (opt?.price ?? 0), 0);
  return (c.item.price + optionsPrice) * c.quantity;
}

export function getDefaultOptions(item: MenuItem): PendingOptions {
  return Object.fromEntries(
    item.modifierGroups.map((group) => {
      const defaultOpt = group.options.find((o) => (o as any).isDefault);
      const selected = defaultOpt ?? (group.required ? (group.options[0] ?? null) : null);
      return [group.groupId, selected];
    }),
  );
}

export function formatPrice(n: number): string {
  return `£${n.toFixed(2)}`;
}
