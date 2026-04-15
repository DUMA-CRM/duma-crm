'use client';

import { useState, useMemo } from 'react';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { CATEGORIES, MENU } from '@/lib/constants/pos';
import { getDefaultOptions } from '@/lib/utils/pos';
import type { Category, CartItem, MenuItem, PendingOptions } from '@/types/pos';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

export default function POSPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [pending, setPending] = useState<PendingOptions>({
    size: null,
    milk: null,
    syrup: null,
  });

  const filtered = useMemo(() => (activeCategory === 'all' ? MENU : MENU.filter((i) => i.category === activeCategory)), [activeCategory]);

  function handleSelectItem(item: MenuItem) {
    setSelectedItem(item);
    setPending(getDefaultOptions(item));
  }

  function handleAddToCart() {
    if (!selectedItem) return;
    setCart((prev) => [
      ...prev,
      {
        cartId: `${selectedItem.id}-${Date.now()}`,
        item: selectedItem,
        quantity: 1,
        ...pending,
      },
    ]);
    setSelectedItem(null);
  }

  function handleQty(cartId: string, delta: number) {
    setCart((prev) => prev.map((c) => (c.cartId === cartId ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0));
  }

  return (
    <div className="flex -m-8 h-[calc(100vh-var(--header-height))]">
      {/* Menu — Left */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden p-8 pb-0">
        <div className="mb-6">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Service Mode</p>
          <h1 className="text-3xl font-semibold text-foreground">Roastery Menu</h1>
        </div>

        <SegmentedControl options={CATEGORIES} value={activeCategory} onChange={setActiveCategory} className="mb-4" />

        <MenuGrid items={filtered} selectedId={selectedItem?.id ?? null} onSelectItem={handleSelectItem} />
      </div>

      {/* Order — Right */}
      <OrderPanel
        cart={cart}
        selectedItem={selectedItem}
        pending={pending}
        setPending={setPending}
        onAddToCart={handleAddToCart}
        onCancelItem={() => setSelectedItem(null)}
        onQty={handleQty}
        onClearCart={() => setCart([])}
      />
    </div>
  );
}
