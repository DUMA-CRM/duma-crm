import { Separator } from '@/components/ui/separator';
import { Banknote, CreditCard, Tag, Loader2, FileText } from 'lucide-react';
import { LOYALTY_DISCOUNT } from '@/lib/constants/pos';
import type { CartItem } from '@/types/pos';
import { cartItemTotal } from '@/lib/utils/pos';
import { cn } from '@/lib/utils/cn';

interface OrderSummaryProps {
  cart: CartItem[];
  notes: string;
  onNotesChange: (v: string) => void;
  onPay: (method: 'cash' | 'card') => void;
  isPaying?: boolean;
  hasCustomer?: boolean;
}

export function OrderSummary({ cart, notes, onNotesChange, onPay, isPaying = false, hasCustomer = false }: OrderSummaryProps) {
  const subtotal = cart.reduce((sum, c) => sum + cartItemTotal(c), 0);
  const discount = hasCustomer ? subtotal * LOYALTY_DISCOUNT : 0;
  const total = subtotal - discount;

  return (
    <div className="border-t border-border p-5 shrink-0 space-y-2.5">
      {/* Notes */}
      <div className="relative">
        <FileText size={12} className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Order notes… (e.g. Extra hot)"
          rows={2}
          className="w-full bg-background border border-border rounded-lg pl-8 pr-3 pt-2 pb-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150 resize-none"
        />
      </div>

      <div className="flex justify-between text-xs">
        <span className="font-bold text-muted-foreground uppercase tracking-widest">Subtotal</span>
        <span className="font-semibold tabular-nums">£{(subtotal / 100).toFixed(2)}</span>
      </div>

      {hasCustomer && (
        <div className="flex justify-between text-xs">
          <span className="font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
            <Tag size={12} className="text-primary" />
            Loyalty Discount (-5%)
          </span>
          <span className="font-semibold text-success tabular-nums">-£{(discount / 100).toFixed(2)}</span>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Amount</span>
        <span className="text-2xl font-bold text-primary tabular-nums">£{(total / 100).toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => onPay('cash')}
          disabled={isPaying}
          className={cn(
            'flex items-center justify-center gap-2 text-xs font-semibold border border-border rounded-lg h-11 text-foreground hover:bg-muted transition-colors disabled:opacity-60',
          )}
        >
          {isPaying ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={18} />}
          Cash
        </button>
        <button
          onClick={() => onPay('card')}
          disabled={isPaying}
          className="flex items-center justify-center gap-2 text-xs font-semibold rounded-lg h-11 bg-primary hover:bg-primary-hover active:translate-y-px text-white transition-colors disabled:opacity-60"
        >
          {isPaying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={18} />}
          Pay Card
        </button>
      </div>
    </div>
  );
}
