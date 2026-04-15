import type { CartItem, MenuItem, PendingOptions } from '@/types/pos';

export function cartItemTotal(c: CartItem): number {
  return (c.item.price + (c.size?.price ?? 0) + (c.milk?.price ?? 0) + (c.syrup?.price ?? 0)) * c.quantity;
}

export function getDefaultOptions(item: MenuItem): PendingOptions {
  return {
    size: item.sizes?.[1] ?? item.sizes?.[0] ?? null,
    milk: item.milk?.[0] ?? null,
    syrup: item.syrups?.[0] ?? null,
  };
}

export function formatPrice(n: number): string {
  return `₴${n.toFixed(2)}`;
}
