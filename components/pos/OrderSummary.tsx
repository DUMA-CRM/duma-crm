import { Banknote, CreditCard, FileText, Loader2, Tag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { LOYALTY_DISCOUNT } from '@/lib/constants/pos';
import { cartItemTotal } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

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
      {/* TODO: Replace with a proper rich text editor or Textarea */}
      <Input
        leftIcon={<FileText size="13" />}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Order notes… (e.g. Extra hot)"
      />

      <div className="flex justify-between">
        <Label>SUBTOTAL</Label>
        <Label className="tabular-nums text-black">£{(subtotal / 100).toFixed(2)}</Label>
      </div>

      {hasCustomer && (
        <div className="flex justify-between">
          <Label className="flex gap-1 item-center uppercase">
            <Tag size={13} className="text-primary" /> Loyalty Discount (-5%)
          </Label>
          <Label className="text-success tabular-nums">£{(discount / 100).toFixed(2)}</Label>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <Label>TOTAL AMOUNT</Label>
        <Label className="text-2xl text-primary tabular-nums">£{(total / 100).toFixed(2)}</Label>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button size="lg" variant="outline" onClick={() => onPay('cash')} disabled={isPaying} className="flex-1 h-20">
          {isPaying ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={18} />}
          Cash
        </Button>
        <Button size="lg" onClick={() => onPay('card')} disabled={isPaying} className="flex-1 h-20">
          {isPaying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={18} />}
          Pay Card
        </Button>
      </div>
    </div>
  );
}
