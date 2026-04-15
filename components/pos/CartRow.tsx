import { Minus, Plus, Trash2 } from 'lucide-react';
import { cartItemTotal } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';
import { cn } from '@/lib/utils/cn';

interface CartRowProps {
  cartItem: CartItem;
  onQty: (cartId: string, delta: number) => void;
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
      {label}
    </span>
  );
}

export function CartRow({ cartItem, onQty }: CartRowProps) {
  const total = cartItemTotal(cartItem);
  const isLastQty = cartItem.quantity === 1;

  const chips = [
    cartItem.size?.label,
    cartItem.milk?.label !== 'Standard' ? cartItem.milk?.label : null,
    cartItem.syrup?.label !== 'None' ? cartItem.syrup?.label : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex items-center gap-3 py-3 px-1">
      {/* Thumbnail */}
      <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted shrink-0">
        <img src={cartItem.item.image} alt={cartItem.item.name} className="w-full h-full object-cover" />
      </div>

      {/* Name + price + chips */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-snug truncate">{cartItem.item.name}</p>
        <p className="text-sm font-semibold text-primary tabular-nums mt-0.5">₴{total.toFixed(2)}</p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {chips.map((chip) => (
              <Chip key={chip} label={chip} />
            ))}
          </div>
        )}
      </div>

      {/* Qty pill — right aligned */}
      <div className="flex items-center gap-0 rounded-xl bg-muted shrink-0 p-1">
        <button
          onClick={() => onQty(cartItem.cartId, -1)}
          aria-label={isLastQty ? 'Remove item' : 'Decrease quantity'}
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors active:scale-95',
            isLastQty ? 'text-destructive active:bg-destructive/15' : 'text-foreground active:bg-background',
          )}
        >
          {isLastQty ? <Trash2 size={14} /> : <Minus size={14} />}
        </button>

        <span className="w-7 text-center text-sm font-bold tabular-nums select-none text-foreground">{cartItem.quantity}</span>

        <button
          onClick={() => onQty(cartItem.cartId, 1)}
          aria-label="Increase quantity"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground transition-colors active:scale-95 active:bg-background"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
