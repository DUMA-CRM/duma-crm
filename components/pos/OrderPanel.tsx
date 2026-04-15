import { ShoppingCart } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomerLoyalty } from './CustomerLoyalty';
import { InlineCustomiser } from './InlineCustomiser';
import { CartRow } from './CartRow';
import { OrderSummary } from './OrderSummary';
import type { CartItem, MenuItem, PendingOptions } from '@/types/pos';

interface OrderPanelProps {
  cart: CartItem[];
  selectedItem: MenuItem | null;
  pending: PendingOptions;
  setPending: React.Dispatch<React.SetStateAction<PendingOptions>>;
  onAddToCart: () => void;
  onCancelItem: () => void;
  onQty: (cartId: string, delta: number) => void;
  onClearCart: () => void;
}

export function OrderPanel({ cart, selectedItem, pending, setPending, onAddToCart, onCancelItem, onQty, onClearCart }: OrderPanelProps) {
  return (
    <div className="w-[400px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      <CustomerLoyalty />

      {/* Order header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <p className="font-semibold text-foreground">Current Order</p>
        {cart.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-xs font-bold text-primary hover:text-primary/70 transition-colors uppercase tracking-wide"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1 min-h-0">
        {/* Pending item customiser */}
        {selectedItem && (
          <InlineCustomiser item={selectedItem} pending={pending} setPending={setPending} onAdd={onAddToCart} onCancel={onCancelItem} />
        )}

        {/* Cart items / empty state */}
        {cart.length === 0 && !selectedItem ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <ShoppingCart size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No items yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Select items from the menu to start an order</p>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {cart.map((cartItem) => (
              <CartRow key={cartItem.cartId} cartItem={cartItem} onQty={onQty} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Summary — only shown when cart has items */}
      {cart.length > 0 && <OrderSummary cart={cart} />}
    </div>
  );
}
