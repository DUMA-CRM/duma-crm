import { Minus, Plus, Trash2 } from '@/components/icons';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { cartItemTotal, formatPrice } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

interface CartRowProps {
  cartItem: CartItem;
  onQty: (cartId: string, delta: number) => void;
  currency?: string;
}

export function CartRow({ cartItem, onQty, currency }: CartRowProps) {
  const total = cartItemTotal(cartItem);
  const isLastQty = cartItem.quantity === 1;

  const chips = cartItem.selected.map((opt) => opt.label);

  return (
    <div className="flex items-center gap-2.5 p-2.5 border border-rule rounded-sm bg-card">
      {/* Thumbnail. The name sits immediately beside it, so the image is
          decorative and an empty alt is correct rather than lazy. */}
      <div className="w-12 h-12 rounded-sm overflow-hidden bg-band shrink-0">
        {cartItem.item.image ? (
          <Image width={48} height={48} src={cartItem.item.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base font-semibold text-muted-foreground select-none">
            {cartItem.item.name[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Name + price + chips */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug truncate">{cartItem.item.name}</p>
        <p data-figure className="text-sm font-semibold text-foreground mt-0.5">
          {formatPrice(total, currency)}
        </p>
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

      {/* Qty controls. `icon-touch` is the 44px floor for touch-first surfaces —
          the size now carries the intent instead of a one-off className. */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          onClick={() => onQty(cartItem.cartId, -1)}
          aria-label={isLastQty ? 'Remove item' : 'Decrease quantity'}
          size="icon-touch"
          variant={isLastQty ? 'destructive' : 'outline'}
        >
          {isLastQty ? <Trash2 size={16} /> : <Minus size={16} />}
        </Button>
        <span data-figure className="w-8 text-center text-sm font-semibold select-none text-foreground">
          {cartItem.quantity}
        </span>
        <Button onClick={() => onQty(cartItem.cartId, 1)} aria-label="Increase quantity" size="icon-touch" variant="outline">
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
