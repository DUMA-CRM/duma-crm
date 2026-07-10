import { Banknote, CreditCard, FileText, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { cartItemTotal } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

interface OrderSummaryProps {
  cart: CartItem[];
  notes: string;
  onNotesChange: (v: string) => void;
  onPay: (method: 'cash' | 'card') => void;
  isPaying?: boolean;
}

export function OrderSummary({ cart, notes, onNotesChange, onPay, isPaying = false }: OrderSummaryProps) {
  // Estimate only — the API computes the authoritative total and applies loyalty server-side.
  const subtotal = cart.reduce((sum, c) => sum + cartItemTotal(c), 0);

  return (
    <div className="border-t border-border p-5 shrink-0 space-y-2.5">
      {/* TODO: Replace with a proper rich text editor or Textarea */}
      <Input
        leftIcon={<FileText size="13" />}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Order notes… (e.g. Extra hot)"
      />

      <Separator />

      <div className="flex items-center justify-between">
        <Label>ESTIMATED TOTAL</Label>
        <Label className="text-2xl text-primary tabular-nums">£{(subtotal / 100).toFixed(2)}</Label>
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
