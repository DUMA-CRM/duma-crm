import { FileText } from 'lucide-react';

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
  /** Opens the full-screen checkout flow (method → confirm → receipt). */
  onCharge: () => void;
}

export function OrderSummary({ cart, notes, onNotesChange, onCharge }: OrderSummaryProps) {
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

      <Button size="lg" onClick={onCharge} className="w-full h-16 text-base mt-1">
        Charge £{(subtotal / 100).toFixed(2)}
      </Button>
    </div>
  );
}
