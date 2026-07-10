import { Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { cartItemTotal } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

interface CartRowProps {
  cartItem: CartItem;
  onQty: (cartId: string, delta: number) => void;
}

export function CartRow({ cartItem, onQty }: CartRowProps) {
  const total = cartItemTotal(cartItem);
  const isLastQty = cartItem.quantity === 1;

  const chips = cartItem.selected.map((opt) => opt.label);

  return (
    <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-xl bg-card">
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
        {cartItem.item.image ? (
          <Image width={48} height={48} src={cartItem.item.image} alt={cartItem.item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base font-bold text-muted-foreground opacity-30 select-none">
            {cartItem.item.name[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Name + price + chips */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug truncate">{cartItem.item.name}</p>
        <p className="text-sm font-bold text-primary tabular-nums mt-0.5">£{(total / 100).toFixed(2)}</p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {chips.map((chip) => (
              <Badge variant="muted" key={chip}>
                {chip}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          onClick={() => onQty(cartItem.cartId, -1)}
          aria-label={isLastQty ? 'Remove item' : 'Decrease quantity'}
          size="icon"
          variant={isLastQty ? 'default' : 'outline'}
        >
          {isLastQty ? <Trash2 size={13} /> : <Minus size={13} />}
        </Button>
        <span className="w-7 text-center text-sm font-bold tabular-nums select-none text-foreground">{cartItem.quantity}</span>
        <Button onClick={() => onQty(cartItem.cartId, 1)} aria-label="Increase quantity" size="icon" variant="outline">
          <Plus size={13} />
        </Button>
      </div>
    </div>
  );
}
