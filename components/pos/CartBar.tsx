import { ShoppingCart } from '@/components/icons';

import { cartCount, cartTotal, formatPrice } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

/**
 * Below lg the ticket is a drawer, so this bar keeps the running count and
 * total in view while browsing, and opens the ticket in one tap.
 */
export function CartBar({ cart, onOpen, currency }: { cart: CartItem[]; onOpen: () => void; currency?: string }) {
  const count = cartCount(cart);
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed inset-x-4 bottom-4 z-10 flex h-16 touch-manipulation items-center justify-between rounded-xl bg-primary px-5 text-primary-foreground shadow-lg transition-transform active:scale-[0.99] lg:hidden"
    >
      <span className="flex items-center gap-3 text-base font-semibold">
        <ShoppingCart size={20} aria-hidden="true" />
        View ticket
        <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-sm tabular-nums">{count}</span>
      </span>
      <span data-figure className="text-lg font-semibold tabular-nums">{formatPrice(cartTotal(cart), currency)}</span>
    </button>
  );
}
