'use client';

import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomerLoyalty } from './CustomerLoyalty';
import { InlineCustomiser } from './InlineCustomiser';
import { CartRow } from './CartRow';
import { OrderSummary } from './OrderSummary';
import { EmptyState } from '@/components/shared/EmptyState';
import type { CartItem, MenuItem, PendingOptions } from '@/types/pos';
import type { Customer } from '@/lib/api/customers.service';

interface OrderPanelProps {
  cart: CartItem[];
  selectedItem: MenuItem | null;
  pending: PendingOptions;
  setPending: React.Dispatch<React.SetStateAction<PendingOptions>>;
  onAddToCart: () => void;
  onCancelItem: () => void;
  onQty: (cartId: string, delta: number) => void;
  onClearCart: () => void;
  selectedCustomer: Customer | null;
  onCustomerSelect: (c: Customer | null) => void;
  onPay: (method: 'cash' | 'card', notes: string) => void;
  isPaying?: boolean;
}

export function OrderPanel({
  cart,
  selectedItem,
  pending,
  setPending,
  onAddToCart,
  onCancelItem,
  onQty,
  onClearCart,
  selectedCustomer,
  onCustomerSelect,
  onPay,
  isPaying,
}: OrderPanelProps) {
  const [notes, setNotes] = useState('');

  function handlePay(method: 'cash' | 'card') {
    onPay(method, notes);
  }

  function handleClearCart() {
    setNotes('');
    onClearCart();
  }

  return (
    <div className="w-100 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      <CustomerLoyalty selectedCustomer={selectedCustomer} onCustomerSelect={onCustomerSelect} />

      {/* Order header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <p className="font-semibold text-foreground">Current Order</p>
        {cart.length > 0 && (
          <button
            onClick={handleClearCart}
            className="text-xs font-bold text-primary hover:text-primary/70 transition-colors uppercase tracking-wide"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1 min-h-0">
        {selectedItem && (
          <InlineCustomiser item={selectedItem} pending={pending} setPending={setPending} onAdd={onAddToCart} onCancel={onCancelItem} />
        )}

        {cart.length === 0 && !selectedItem ? (
          <EmptyState icon={ShoppingCart} title="No items yet" description="Select items from the menu to start an order" />
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {cart.map((cartItem) => (
              <CartRow key={cartItem.cartId} cartItem={cartItem} onQty={onQty} />
            ))}
          </div>
        )}
      </ScrollArea>

      {cart.length > 0 && (
        <OrderSummary
          cart={cart}
          notes={notes}
          onNotesChange={setNotes}
          onPay={handlePay}
          isPaying={isPaying}
          hasCustomer={!!selectedCustomer}
        />
      )}
    </div>
  );
}
