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
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

export function CartRow({ cartItem, onQty }: CartRowProps) {
  const total = cartItemTotal(cartItem);
  const isLastQty = cartItem.quantity === 1;

  const chips = Object.values(cartItem.selections)
    .filter((opt): opt is NonNullable<typeof opt> => !!opt)
    .map((opt) => opt.label);

  return (
    <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-xl bg-card">
      {/* Thumbnail */}
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted shrink-0">
        {cartItem.item.image ? (
          <img src={cartItem.item.image} alt={cartItem.item.name} className="w-full h-full object-cover" />
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
              <Chip key={chip} label={chip} />
            ))}
          </div>
        )}
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => onQty(cartItem.cartId, -1)}
          aria-label={isLastQty ? 'Remove item' : 'Decrease quantity'}
          className={cn(
            'w-7 h-7 rounded-md border flex items-center justify-center transition-colors active:scale-95',
            isLastQty ? 'border-destructive/40 text-destructive hover:bg-destructive/10' : 'border-border text-foreground hover:bg-muted',
          )}
        >
          {isLastQty ? <Trash2 size={13} /> : <Minus size={13} />}
        </button>
        <span className="w-7 text-center text-sm font-bold tabular-nums select-none text-foreground">{cartItem.quantity}</span>
        <button
          onClick={() => onQty(cartItem.cartId, 1)}
          aria-label="Increase quantity"
          className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors active:scale-95"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
