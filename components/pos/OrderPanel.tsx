'use client';

import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';

import { CartRow } from '@/components/pos/CartRow';
import { CustomerLoyalty } from '@/components/pos/CustomerLoyalty';
import { InlineCustomiser } from '@/components/pos/InlineCustomiser';
import { OrderSummary } from '@/components/pos/OrderSummary';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Customer } from '@/types/customers';
import type { CartItem, MenuItem, MenuOption } from '@/types/pos';

interface OrderPanelProps {
  cart: CartItem[];
  selectedItem: MenuItem | null;
  pending: MenuOption[];
  setPending: React.Dispatch<React.SetStateAction<MenuOption[]>>;
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
          <Button variant="ghost" onClick={handleClearCart} className="text-xs text-primary hover:text-primary">
            CLEAR ALL
          </Button>
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
        <OrderSummary cart={cart} notes={notes} onNotesChange={setNotes} onPay={handlePay} isPaying={isPaying} />
      )}
    </div>
  );
}
