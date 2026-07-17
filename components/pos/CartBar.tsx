import { ShoppingCart } from 'lucide-react';

import { cartItemTotal } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

interface CartBarProps {
  cart: CartItem[];
  onOpen: () => void;
}

/**
 * Floating order summary shown below lg, where the order panel is an overlay
 * drawer. Keeps the running count/total visible while browsing the menu and
 * opens the drawer in one tap — without it the only way in is the small
 * header toggle.
 */
export function CartBar({ cart, onOpen }: CartBarProps) {
  const count = cart.reduce((n, c) => n + c.quantity, 0);
  if (count === 0) return null;
  const subtotal = cart.reduce((sum, c) => sum + cartItemTotal(c), 0);

  return (
    <button
      onClick={onOpen}
      className="lg:hidden fixed bottom-4 inset-x-4 z-10 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-between px-5 active:translate-y-px transition-transform"
    >
      <span className="flex items-center gap-2.5 text-sm font-semibold">
        <span className="relative">
          <ShoppingCart size={20} aria-hidden="true" />
          <span className="absolute -top-2 -right-2.5 min-w-4.5 h-4.5 px-1 rounded-full bg-card text-primary text-[10px] font-bold tabular-nums flex items-center justify-center">
            {count}
          </span>
        </span>
        <p className="ml-2.5">View Order</p>
      </span>
      <span className="text-base font-bold tabular-nums">£{(subtotal / 100).toFixed(2)}</span>
    </button>
  );
}
