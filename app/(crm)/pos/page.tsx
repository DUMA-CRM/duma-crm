'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Clock, LogIn, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Toast, type ToastMessage } from '@/components/shared/Toast';

import { getCustomer } from '@/lib/api/customers.service';
import { getMenuItemModifiers, getMenuItems } from '@/lib/api/menu.service';
import { createOrder } from '@/lib/api/orders.service';
import { clockIn, getMyShifts } from '@/lib/api/shifts.service';
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
  const qc = useQueryClient();
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

  // Deep link: /pos?customer=<id> (e.g. from a customer's profile) opens the
  // POS with that customer already attached to the order.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('customer');
    if (!id) return;
    getCustomer(id)
      .then((c) => {
        setSelectedCustomer(c);
        addToast('success', `${c.firstName} ${c.lastName} attached to this order.`);
      })
      .catch(() => addToast('error', 'Could not load the linked customer.'));
  }, []);

  // The POS is locked until the signed-in staff member is clocked in.
  const { data: myShifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts-my'],
    queryFn: getMyShifts,
    enabled: !!tenantId && !!locationId,
  });
  const onShift = myShifts.some((s) => !s.clockedOut);

  const { mutate: doClockIn, isPending: clockingIn } = useMutation({
    mutationFn: () => clockIn({ locationId: locationId! }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shifts-my'] });
      addToast('success', 'Clocked in — the POS is unlocked.');
    },
    onError: (err) => addToast('error', (err as Error).message || 'Could not clock in.'),
  });

  // The menu changes rarely — keep it fresh for 5 minutes to avoid refetch storms.
  const MENU_STALE_MS = 5 * 60_000;
  const { data: apiItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: getMenuItems,
    enabled: !!tenantId,
    staleTime: MENU_STALE_MS,
  });

  // Each item's attached modifiers (flat add-ons). One query per item — a
  // known N+1; a batch endpoint is the real fix. Until then the grid renders
  // as soon as items arrive and modifiers stream in behind it.
  const modifierQueries = useQueries({
    queries: apiItems.map((item) => ({
      queryKey: ['menu-item-modifiers', item.id],
      queryFn: () => getMenuItemModifiers(item.id),
      enabled: apiItems.length > 0,
      staleTime: MENU_STALE_MS,
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
      // Refresh exactly what an order touches — invalidating the whole cache
      // refetched every list in the app after every sale.
      for (const key of ['orders', 'orders-all', 'location-stock', 'inventory-forecast', 'low-stock-alerts', 'customers']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      if (selectedCustomer) void qc.invalidateQueries({ queryKey: ['customer-visits', selectedCustomer.id] });
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to place order. Please try again.');
    },
  });

  // Only the item list gates the grid — waiting on all N modifier queries
  // blocked the whole POS behind the slowest one.
  const isLoading = itemsLoading;

  return (
    <>
      <PageLayout
        eyebrow="Service Mode"
        title="Roastery Menu"
        headerSlot={<SegmentedControl options={CATEGORIES} value={activeCategory} onChange={setActiveCategory} />}
        headerBorder={false}
        sidebar={
          !(tenantId && locationId && onShift) ? undefined : (
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
          )
        }
      >
        {tenantId && locationId && onShift && (
          <MenuGrid items={filtered} selectedId={selectedItem?.id ?? null} onSelectItem={handleSelectItem} isLoading={isLoading} />
        )}
        {/* Locked: staff must clock in before taking orders */}
        {tenantId && locationId && !onShift && !shiftsLoading && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
              <Clock size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">{"You're not clocked in"}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Clock in to unlock the POS and start taking orders.</p>
            <button
              onClick={() => doClockIn()}
              disabled={clockingIn}
              className="mt-5 h-10 px-6 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-60"
            >
              <LogIn size={16} aria-hidden="true" />
              {clockingIn ? 'Clocking in…' : 'Clock In'}
            </button>
          </div>
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
