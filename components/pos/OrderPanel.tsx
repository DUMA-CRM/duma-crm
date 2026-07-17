'use client';

import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';

import { CartRow } from '@/components/pos/CartRow';
import { CustomerLoyalty } from '@/components/pos/CustomerLoyalty';
import { ItemCustomiser } from '@/components/pos/ItemCustomiser';
import { OrderSummary } from '@/components/pos/OrderSummary';
import { ScanCustomer } from '@/components/pos/ScanCustomer';
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
  notes: string;
  onNotesChange: (v: string) => void;
  onCharge: () => void;
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
  notes,
  onNotesChange,
  onCharge,
}: OrderPanelProps) {
  // QR scan view — a full-panel takeover like the customiser, so the camera
  // isn't competing with the cart for space.
  const [scanning, setScanning] = useState(false);

  function handleScanned(c: Customer) {
    onCustomerSelect(c);
    setScanning(false);
  }

  return (
    <div className="w-100 max-w-full shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* While an item is being customised, the customiser takes over the whole
          panel — options get full height and the add button needs no scrolling. */}
      {selectedItem ? (
        <ItemCustomiser item={selectedItem} pending={pending} setPending={setPending} onAdd={onAddToCart} onCancel={onCancelItem} />
      ) : scanning ? (
        <div className="flex flex-col h-full min-h-0">
          <div className="px-5 py-4 border-b border-border shrink-0">
            <p className="font-semibold text-foreground">Scan Loyalty Code</p>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-5">
            <ScanCustomer onSelect={handleScanned} onClose={() => setScanning(false)} />
          </div>
        </div>
      ) : (
        <>
          <CustomerLoyalty selectedCustomer={selectedCustomer} onCustomerSelect={onCustomerSelect} onScan={() => setScanning(true)} />

          {/* Order header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <p className="font-semibold text-foreground">Current Order</p>
            {cart.length > 0 && (
              <Button variant="ghost" onClick={onClearCart} className="text-xs text-primary hover:text-primary">
                CLEAR ALL
              </Button>
            )}
          </div>

          {/* Scrollable body */}
          <ScrollArea className="flex-1 min-h-0">
            {cart.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No items yet" description="Select items from the menu to start an order" />
            ) : (
              <div className="p-5 flex flex-col gap-4">
                {cart.map((cartItem) => (
                  <CartRow key={cartItem.cartId} cartItem={cartItem} onQty={onQty} />
                ))}
              </div>
            )}
          </ScrollArea>

          {cart.length > 0 && <OrderSummary cart={cart} notes={notes} onNotesChange={onNotesChange} onCharge={onCharge} />}
        </>
      )}
    </div>
  );
}
