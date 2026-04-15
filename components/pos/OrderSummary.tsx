import { Separator } from '@/components/ui/separator';
import { Banknote, CreditCard } from 'lucide-react';
import { LOYALTY_DISCOUNT } from '@/lib/constants/pos';
import type { CartItem } from '@/types/pos';
import { cartItemTotal } from '@/lib/utils/pos';

interface OrderSummaryProps {
  cart: CartItem[];
}

export function OrderSummary({ cart }: OrderSummaryProps) {
  const subtotal = cart.reduce((sum, c) => sum + cartItemTotal(c), 0);
  const discount = subtotal * LOYALTY_DISCOUNT;
  const total = subtotal - discount;

  return (
    <div className="border-t border-border p-5 shrink-0 space-y-2.5">
      <div className="flex justify-between text-xs">
        <span className="font-bold text-muted-foreground uppercase tracking-widest">Subtotal</span>
        <span className="font-semibold tabular-nums">₴{subtotal.toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-xs">
        <span className="font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <span className="text-primary text-base leading-none">⊕</span>
          Loyalty Discount (-5%)
        </span>
        <span className="font-semibold text-green-600 tabular-nums">-₴{discount.toFixed(2)}</span>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Amount</span>
        <span className="text-2xl font-bold text-primary tabular-nums">₴{total.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button className="flex items-center justify-center gap-2 text-xs font-semibold border border-border rounded-lg h-11 text-foreground hover:bg-muted transition-colors">
          <Banknote size={18} /> Cash
        </button>
        <button className="flex items-center justify-center gap-2 text-xs font-semibold rounded-lg h-11 bg-primary hover:bg-primary/90 text-white transition-colors">
          <CreditCard size={18} /> Pay Card
        </button>
      </div>
    </div>
  );
}
