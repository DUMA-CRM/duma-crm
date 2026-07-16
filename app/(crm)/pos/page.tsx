'use client';

import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { Building2, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Toast, type ToastMessage } from '@/components/shared/Toast';

import { getMenuItemModifiers, getMenuItems } from '@/lib/api/menu.service';
import { createOrder } from '@/lib/api/orders.service';
import { CATEGORIES } from '@/lib/constants/pos';
import { parseModifierName } from '@/lib/utils/modifiers';
import { selectionKey } from '@/lib/utils/pos';
import { usePageSidebarStore } from '@/stores/pageSidebarStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Customer } from '@/types/customers';
import type { MenuItem as ApiMenuItem, AttachedModifier } from '@/types/menu';
import type { CartItem, Category, MenuItem, MenuOption } from '@/types/pos';

// ── API → POS type mapping ────────────────────────────────────────────────────

function pence(decimal: string): number {
  return Math.round(Number.parseFloat(decimal) * 100);
}

function toPosItem(api: ApiMenuItem, modifiers: AttachedModifier[]): MenuItem {
  return {
    id: api.id,
    name: api.name,
    category: api.category,
    price: pence(api.price),
    image: api.imageUrl ?? '',
    modifiers: modifiers
      .filter((m) => m.isAvailable)
      .map((m): MenuOption => {
        const { category, label } = parseModifierName(m.name);
        return {
          id: m.id,
          label,
          price: m.priceAdjust ? pence(m.priceAdjust) : 0,
          category: category ?? undefined,
          isDefault: m.isDefault,
        };
      }),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function POSPage() {
  const { tenantId, locationId } = useWorkspaceStore();
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [pending, setPending] = useState<MenuOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function addToast(type: ToastMessage['type'], message: string) {
    setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  }
  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const { data: apiItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: getMenuItems,
    enabled: !!tenantId,
  });

  // Each item's attached modifiers (flat add-ons). One query per item.
  const modifierQueries = useQueries({
    queries: apiItems.map((item) => ({
      queryKey: ['menu-item-modifiers', item.id],
      queryFn: () => getMenuItemModifiers(item.id),
      enabled: apiItems.length > 0,
    })),
  });

  const posItems = useMemo<MenuItem[]>(
    () => apiItems.filter((item) => item.isAvailable).map((item, i) => toPosItem(item, modifierQueries[i]?.data ?? [])),
    [apiItems, modifierQueries],
  );

  const filtered = useMemo(
    () => (activeCategory === 'all' ? posItems : posItems.filter((i) => i.category === activeCategory)),
    [posItems, activeCategory],
  );

  function handleSelectItem(item: MenuItem) {
    setSelectedItem(item);
    // On small screens the order panel is a drawer — open it so the customiser is visible.
    usePageSidebarStore.getState().setOpen(true);
    // Pre-select the item's default variants (one per category is enforced by the
    // single-select rule in the customiser, so this respects that too).
    setPending(item.modifiers.filter((o) => o.isDefault));
  }

  function handleAddToCart() {
    if (!selectedItem) return;
    const key = selectionKey(pending);
    setCart((prev) => {
      // Merge into an existing line with the same item + same modifiers.
      const existing = prev.find((c) => c.item.id === selectedItem.id && selectionKey(c.selected) === key);
      if (existing) {
        return prev.map((c) => (c.cartId === existing.cartId ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { cartId: `${selectedItem.id}-${Date.now()}`, item: selectedItem, quantity: 1, selected: pending }];
    });
    setSelectedItem(null);
    setPending([]);
  }

  function handleQty(cartId: string, delta: number) {
    setCart((prev) => prev.map((c) => (c.cartId === cartId ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0));
  }

  // Prices, item names and the order total are computed server-side. We send IDs only.
  const { mutate: submitOrder, isPending: isPaying } = useMutation({
    mutationFn: ({ method, notes }: { method: 'cash' | 'card'; notes: string }) =>
      createOrder({
        locationId: locationId!,
        ...(selectedCustomer ? { customerId: selectedCustomer.id } : {}),
        source: 'pos',
        paymentMethod: method,
        notes: notes || undefined,
        items: cart.map((c) => ({
          menuItemId: c.item.id,
          quantity: c.quantity,
          ...(c.selected.length > 0 ? { modifiers: c.selected.map((o) => ({ modifierId: o.id })) } : {}),
        })),
      }),
    onSuccess: () => {
      setCart([]);
      setSelectedCustomer(null);
      addToast('success', 'Order placed successfully.');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to place order. Please try again.');
    },
  });

  const isLoading = itemsLoading || modifierQueries.some((q) => q.isLoading);

  return (
    <>
      <PageLayout
        eyebrow="Service Mode"
        title="Roastery Menu"
        headerSlot={<SegmentedControl options={CATEGORIES} value={activeCategory} onChange={setActiveCategory} />}
        headerBorder={false}
        sidebar={
          <OrderPanel
            cart={cart}
            selectedItem={selectedItem}
            pending={pending}
            setPending={setPending}
            onAddToCart={handleAddToCart}
            onCancelItem={() => setSelectedItem(null)}
            onQty={handleQty}
            onClearCart={() => setCart([])}
            selectedCustomer={selectedCustomer}
            onCustomerSelect={setSelectedCustomer}
            onPay={(method, notes) => submitOrder({ method, notes })}
            isPaying={isPaying}
          />
        }
      >
        {tenantId && locationId && (
          <MenuGrid items={filtered} selectedId={selectedItem?.id ?? null} onSelectItem={handleSelectItem} isLoading={isLoading} />
        )}
        {!tenantId && (
          <EmptyState icon={Building2} title="No workspace selected" description="Go to Workspaces and select a workspace first." />
        )}
        {tenantId && !locationId && (
          <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to start taking orders." />
        )}
      </PageLayout>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
