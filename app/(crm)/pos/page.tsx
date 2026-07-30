'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Clock, CloudUpload, LogIn, MapPin, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { CartBar } from '@/components/pos/CartBar';
import { CheckoutFlow, type CheckoutStep } from '@/components/pos/CheckoutFlow';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Toast, type ToastMessage } from '@/components/shared/Toast';

import { API_PREFIX, ApiError } from '@/lib/api/client';
import { getCustomer } from '@/lib/api/customers.service';
import { getMenuItemModifiers, getMenuItems } from '@/lib/api/menu.service';
import { type CreateOrderPayload, createOrder } from '@/lib/api/orders.service';
import { clockIn, getMyShifts } from '@/lib/api/shifts.service';
import { CATEGORIES } from '@/lib/constants/pos';
import { cn } from '@/lib/utils/cn';
import { parseModifierName } from '@/lib/utils/modifiers';
import { cartItemTotal, selectionKey } from '@/lib/utils/pos';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineOrdersStore } from '@/stores/offlineOrdersStore';
import { usePageSidebarStore } from '@/stores/pageSidebarStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Customer } from '@/types/customers';
import type { MenuItem as ApiMenuItem, AttachedModifier } from '@/types/menu';
import type { CartItem, Category, MenuItem, MenuOption } from '@/types/pos';

// ── API → POS type mapping ────────────────────────────────────────────────────

function pence(decimal: string): number {
  return Math.round(Number.parseFloat(decimal) * 100);
}

function toPosItem(api: ApiMenuItem, modifiers: AttachedModifier[], modifiersLoaded: boolean): MenuItem {
  return {
    id: api.id,
    name: api.name,
    category: api.category,
    price: pence(api.price),
    image: api.imageUrl ?? '',
    modifiersLoaded,
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
  const userId = useAuthStore((state) => state.user?.id);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [pending, setPending] = useState<MenuOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Full-screen checkout flow. Total and customer email are snapshotted when it
  // opens — the cart and customer are cleared as soon as the order succeeds.
  const [checkout, setCheckout] = useState<CheckoutStep | 'closed'>('closed');
  const [checkoutTotal, setCheckoutTotal] = useState(0);
  const [checkoutEmail, setCheckoutEmail] = useState<string | undefined>();
  const [checkoutQueued, setCheckoutQueued] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);

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
    queryKey: ['menu-items', tenantId],
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
    staleTime: MENU_STALE_MS,
  });

  // Load modifiers on demand instead of firing one request for every menu item
  // at POS startup. Results remain cached, so repeat taps are immediate.
  const modifierQueries = useQueries({
    queries: apiItems.map((item) => ({
      queryKey: ['menu-item-modifiers', item.id],
      queryFn: () => getMenuItemModifiers(item.id),
      enabled: selectedItem?.id === item.id,
      staleTime: MENU_STALE_MS,
    })),
  });

  // Pair each item with its query BEFORE filtering — modifierQueries is
  // positional against the unfiltered apiItems, so filtering first would shift
  // every item after an unavailable one onto the wrong modifier set.
  const posItems = useMemo<MenuItem[]>(
    () =>
      apiItems
        .map((item, i) => ({ item, query: modifierQueries[i] }))
        .filter(({ item }) => item.isAvailable)
        .map(({ item, query }) => toPosItem(item, query?.data ?? [], query?.isSuccess ?? false)),
    [apiItems, modifierQueries],
  );

  const filtered = useMemo(
    () => (activeCategory === 'all' ? posItems : posItems.filter((i) => i.category === activeCategory)),
    [posItems, activeCategory],
  );

  // selectedItem is a snapshot from tap time — resolve it against the latest
  // posItems so modifiers that stream in after the customiser opened still appear.
  const liveSelectedItem = useMemo(
    () => (selectedItem ? (posItems.find((i) => i.id === selectedItem.id) ?? selectedItem) : null),
    [selectedItem, posItems],
  );

  const addLine = useCallback((item: MenuItem, selected: MenuOption[]) => {
    const key = selectionKey(selected);
    setCart((prev) => {
      // Merge into an existing line with the same item + same modifiers.
      const existing = prev.find((c) => c.item.id === item.id && selectionKey(c.selected) === key);
      if (existing) {
        return prev.map((c) => (c.cartId === existing.cartId ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { cartId: `${item.id}-${Date.now()}`, item, quantity: 1, selected }];
    });
  }, []);

  const selectionRequest = useRef(0);

  async function handleSelectItem(item: MenuItem) {
    const request = ++selectionRequest.current;
    // Nothing to customise — add in one tap and stay on the menu. Only trust an
    // empty modifier list once it has actually loaded. Any customisation in
    // progress for another item is abandoned, mirroring the tap-to-switch below.
    if (item.modifiersLoaded && item.modifiers.length === 0) {
      addLine(item, []);
      setSelectedItem(null);
      setPending([]);
      return;
    }
    // Tapping the already-selected item again toggles its customiser off.
    if (selectedItem?.id === item.id) {
      handleCancelItem();
      return;
    }

    setSelectedItem(item);
    // On small screens the order panel is a drawer — open it so the customiser is visible.
    usePageSidebarStore.getState().setOpen(true);
    setPending([]);

    const apiItem = apiItems.find((candidate) => candidate.id === item.id);
    if (!apiItem) {
      setSelectedItem(null);
      usePageSidebarStore.getState().setOpen(false);
      return;
    }

    try {
      const modifiers = await qc.fetchQuery({
        queryKey: ['menu-item-modifiers', item.id],
        queryFn: () => getMenuItemModifiers(item.id),
        staleTime: MENU_STALE_MS,
      });
      if (selectionRequest.current !== request) return;

      const hydratedItem = toPosItem(apiItem, modifiers, true);
      if (hydratedItem.modifiers.length === 0) {
        addLine(hydratedItem, []);
        setSelectedItem(null);
        usePageSidebarStore.getState().setOpen(false);
        return;
      }

      setSelectedItem(hydratedItem);
      // Pre-select the item's default variants (one per category is enforced by
      // the single-select rule in the customiser, so this respects that too).
      setPending(hydratedItem.modifiers.filter((option) => option.isDefault));
    } catch {
      if (selectionRequest.current !== request) return;
      setSelectedItem(null);
      usePageSidebarStore.getState().setOpen(false);
      addToast('error', 'Could not load this item’s options. Please try again.');
    }
  }

  function handleAddToCart() {
    if (!liveSelectedItem) return;
    addLine(liveSelectedItem, pending);
    setSelectedItem(null);
    setPending([]);
    // On small screens the drawer covered the menu — close it so the next item
    // is one tap away. No-op on lg+ where the panel is inline.
    usePageSidebarStore.getState().setOpen(false);
  }

  function handleCancelItem() {
    selectionRequest.current += 1;
    setSelectedItem(null);
    setPending([]);
    usePageSidebarStore.getState().setOpen(false);
  }

  function handleClearCart() {
    setCart([]);
    setNotes('');
    // Also discard any customisation in progress — "Clear All" means start over.
    handleCancelItem();
  }

  function handleQty(cartId: string, delta: number) {
    setCart((prev) => prev.map((c) => (c.cartId === cartId ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0));
  }

  // Prices, item names and the order total are computed server-side. We send IDs only.
  const buildOrderPayload = (method: 'cash' | 'card', notes: string): CreateOrderPayload => ({
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
  });

  // Shared post-order cleanup: clear the order and advance the checkout flow
  // to the confirmation screen (which then flows into the receipt question).
  function finishOrder(queued: boolean) {
    setCart([]);
    setSelectedCustomer(null);
    setNotes('');
    setCheckoutQueued(queued);
    setCheckout('confirm');
    usePageSidebarStore.getState().setOpen(false);
  }

  const { mutate: submitOrder, isPending: isPaying } = useMutation({
    // CRITICAL: React Query's default networkMode 'online' PAUSES mutations
    // while offline — mutationFn never runs, isPending spins forever, and our
    // queueing logic below is unreachable. 'always' hands control to us.
    networkMode: 'always',
    mutationFn: ({ method, idempotencyKey }: { method: 'cash' | 'card'; idempotencyKey: string }) => {
      // Known-offline: don't even attempt the request — fail straight into the
      // offline-queue path instead of waiting out a timeout.
      if (!navigator.onLine) return Promise.reject(new Error('offline'));
      return createOrder(buildOrderPayload(method, notes), idempotencyKey);
    },
    onSuccess: (order) => {
      setCheckoutOrderId(order.id);
      finishOrder(false);
      // Refresh exactly what an order touches — invalidating the whole cache
      // refetched every list in the app after every sale.
      for (const key of ['orders', 'orders-all', 'location-stock', 'inventory-forecast', 'low-stock-alerts', 'customers']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      if (selectedCustomer) void qc.invalidateQueries({ queryKey: ['customer-visits', selectedCustomer.id] });
    },
    onError: (err, { method, idempotencyKey }) => {
      // Queue when the API never really answered: fetch/abort failures, and
      // 502/503/504 which are the proxy saying the API is unreachable.
      const unreachable = !(err instanceof ApiError) || err.status === 502 || err.status === 503 || err.status === 504;
      if (unreachable) {
        // Stamp the order so it's still traceable after it syncs — the synced
        // order's createdAt is the sync time, not when it was actually taken.
        const takenAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const offlineNote = `Taken offline at ${takenAt}`;
        if (!userId || !tenantId) {
          addToast('error', 'The order could not be saved offline because the account or workspace is missing.');
          return;
        }
        useOfflineOrdersStore.getState().enqueue(buildOrderPayload(method, notes ? `${notes} · ${offlineNote}` : offlineNote), {
          idempotencyKey,
          ownerUserId: userId,
          tenantId,
        });
        setCheckoutOrderId(null);
        finishOrder(true);
        return;
      }
      // Real API rejection — stay on the method screen so the cashier can retry.
      addToast('error', err.message || 'Failed to place order. Please try again.');
    },
  });

  function handleCharge() {
    setCheckoutTotal(cart.reduce((sum, c) => sum + cartItemTotal(c), 0));
    setCheckoutEmail(selectedCustomer?.email);
    setCheckoutQueued(false);
    setCheckoutOrderId(null);
    setCheckout('method');
  }

  function handleReceipt(choice: 'email' | 'print' | 'none') {
    if (choice === 'email') {
      addToast('error', 'Email receipts are not available until the API provides a receipt-delivery endpoint.');
      return;
    }
    if (choice === 'print') {
      if (!checkoutOrderId) {
        addToast('error', 'The receipt will be available after the offline order has synced.');
        return;
      }
      const receiptWindow = window.open('about:blank', '_blank');
      if (!receiptWindow) {
        addToast('error', 'Allow pop-ups to open the printable receipt.');
        return;
      }
      receiptWindow.opener = null;
      receiptWindow.location.href = `${API_PREFIX}/v1/receipts/${encodeURIComponent(checkoutOrderId)}/receipt`;
      addToast('info', 'Receipt opened. Use the browser print command to print it.');
    }
    setCheckout('closed');
  }

  // Only the item list gates the grid — waiting on all N modifier queries
  // blocked the whole POS behind the slowest one.
  const isLoading = itemsLoading;

  // Offline awareness: banner while disconnected, queued-order count until synced.
  const offlineQueue = useOfflineOrdersStore((state) => state.queue);
  const queuedOrders = useMemo(
    () => offlineQueue.filter((order) => order.ownerUserId === userId && order.tenantId === tenantId),
    [offlineQueue, tenantId, userId],
  );
  const queuedCount = queuedOrders.length;
  const needsAttentionCount = queuedOrders.filter((order) => order.status === 'needs-attention').length;
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return (
    <>
      <PageLayout
        eyebrow="Service Mode"
        title="Roastery Menu"
        headerSlot={<SegmentedControl options={CATEGORIES} value={activeCategory} onChange={setActiveCategory} size="lg" />}
        headerBorder={false}
        sidebar={
          !(tenantId && locationId && onShift) ? undefined : (
            <OrderPanel
              cart={cart}
              selectedItem={liveSelectedItem}
              pending={pending}
              setPending={setPending}
              onAddToCart={handleAddToCart}
              onCancelItem={handleCancelItem}
              onQty={handleQty}
              onClearCart={handleClearCart}
              selectedCustomer={selectedCustomer}
              onCustomerSelect={setSelectedCustomer}
              notes={notes}
              onNotesChange={setNotes}
              onCharge={handleCharge}
            />
          )
        }
      >
        {/* Offline / sync status */}
        {(!online || queuedCount > 0) && (
          <div
            className={cn(
              'mb-4 rounded-xl border px-3.5 py-2.5 text-sm font-medium',
              online ? 'border-primary/30 bg-primary/5 text-primary' : 'border-warning/40 bg-warning/10 text-warning',
            )}
          >
            <div className="flex items-center gap-2.5">
              {online ? (
                <CloudUpload size={16} className="shrink-0" aria-hidden="true" />
              ) : (
                <WifiOff size={16} className="shrink-0" aria-hidden="true" />
              )}
              {needsAttentionCount > 0
                ? `${needsAttentionCount} queued ${needsAttentionCount === 1 ? 'order needs' : 'orders need'} manager attention.`
                : !online
                  ? `You're offline — orders are saved locally${queuedCount > 0 ? ` (${queuedCount} waiting)` : ''} and will send when the connection returns.`
                  : `${queuedCount} ${queuedCount === 1 ? 'order' : 'orders'} waiting to sync…`}
            </div>
            {needsAttentionCount > 0 && (
              <div className="mt-2 space-y-2 border-t border-current/15 pt-2">
                {queuedOrders
                  .filter((order) => order.status === 'needs-attention')
                  .map((order) => (
                    <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>
                        {new Date(order.queuedAt).toLocaleString('en-GB')} · {order.lastError ?? 'Rejected by the API'}
                      </span>
                      <button
                        type="button"
                        className="rounded-md border border-current/30 px-2 py-1 font-semibold hover:bg-current/10"
                        onClick={() => useOfflineOrdersStore.getState().retry(order.id)}
                      >
                        Retry
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {tenantId && locationId && onShift && (
          <>
            <MenuGrid items={filtered} selectedId={selectedItem?.id ?? null} onSelectItem={handleSelectItem} isLoading={isLoading} />
            <CartBar cart={cart} onOpen={() => usePageSidebarStore.getState().setOpen(true)} />
          </>
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
      {checkout !== 'closed' && (
        <CheckoutFlow
          step={checkout}
          total={checkoutTotal}
          isPaying={isPaying}
          queued={checkoutQueued}
          customerEmail={checkoutEmail}
          onSelectMethod={(method) => submitOrder({ method, idempotencyKey: crypto.randomUUID() })}
          onConfirmDone={() => setCheckout('receipt')}
          onReceipt={handleReceipt}
          onCancel={() => setCheckout('closed')}
        />
      )}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
