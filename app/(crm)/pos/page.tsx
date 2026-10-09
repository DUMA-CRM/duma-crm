'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { CashUpButton, CashUpDrawer, CashUpNudge, useCashUpDay } from '@/components/cash-up/TillCashUp';
import { AlertTriangle, Building2, Clock, CloudUpload, MapPin, Monitor, WifiOff } from '@/components/icons';
import { PageSidebar } from '@/components/layout/PageSidebar';
import { CartBar } from '@/components/pos/CartBar';
import { CheckoutFlow, type CheckoutStep } from '@/components/pos/CheckoutFlow';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { TillMenu } from '@/components/pos/TillMenu';
import { MENU_STALE_MS, pence, useTillMenuData } from '@/components/pos/useTillMenuData';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { StatusDot } from '@/components/shared/StatusDot';
import { SlideToClockIn } from '@/components/shifts/SlideToClockIn';
import { Button } from '@/components/ui/button';

import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { getMenuItemModifierGroups, getMenuItemModifiers } from '@/lib/modules/catalog/client';
import { API_PREFIX } from '@/lib/modules/core/client';
import { getCustomer, getCustomerLoyaltyWallet } from '@/lib/modules/customers/client';
import { type CreateOrderPayload, createOrder, updateOrderStatus } from '@/lib/modules/ordering/client';
import { getLocationsByTenant, getTradingSettings } from '@/lib/modules/organization/client';
import { type PaymentAttempt, type PaymentMethod, confirmPayment, getPaymentMethods, startPayment } from '@/lib/modules/payments/client';
import { checkPromotionCode } from '@/lib/modules/promotions/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { clockIn, getMyShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import {
  type OptionGroupRule,
  buildOptionGroups,
  cartSignature,
  cartTotal,
  changeDue,
  countByItem,
  isUnreachable,
  lineKey,
  promoCheckLines,
} from '@/lib/utils/pos';
import { validLoyaltyRewards } from '@/lib/utils/pos-loyalty';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { MAX_HELD, useHeldTicketsStore } from '@/stores/heldTicketsStore';
import { useOfflineOrdersStore } from '@/stores/offlineOrdersStore';
import { usePageSidebarStore } from '@/stores/pageSidebarStore';
import { usePosSettingsStore } from '@/stores/posSettingsStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Customer } from '@/types/customers';
import type { AttachedModifier } from '@/types/menu';
import type { AppliedLoyaltyReward, CartItem, MenuItem, MenuOption } from '@/types/pos';

// ── API → POS type mapping ────────────────────────────────────────────────────

const subscribeToClientReady = () => () => undefined;

const toOption = (m: AttachedModifier): MenuOption & { groupId?: string | null; sortOrder?: number } => ({
  id: m.id,
  label: m.label,
  price: m.priceAdjust ? pence(m.priceAdjust) : 0,
  category: m.category ?? undefined,
  isDefault: m.isDefault,
  groupId: m.groupId ?? null,
  sortOrder: m.sortOrder,
});

/**
 * One charge attempt at one basket. The order is created once per basket and
 * reused by every retry while the basket is unchanged — `POST /orders` does
 * not honour its Idempotency-Key (API TD-069), so the key alone can't stop a
 * second order after a declined card.
 */
interface ChargeSession {
  signature: string;
  key: string;
  orderId: string | null;
  /** A cash attempt started but not yet confirmed — confirm it rather than starting another. */
  cashAttempt: PaymentAttempt | null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function POSPage() {
  const qc = useQueryClient();
  // Workspace and offline-order preferences are persisted in localStorage.
  // Hold the till behind one neutral frame until React has attached so a hard
  // refresh cannot compare the server defaults with already-restored browser
  // state and discard the server-rendered POS tree during hydration.
  const clientReady = useSyncExternalStore(
    subscribeToClientReady,
    () => true,
    () => false,
  );
  const { tenantId, locationId } = useWorkspaceStore();
  const userId = useAuthStore((state) => state.user?.id);

  const layout = usePosSettingsStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const promotionsOn = useModuleEnabled('promotions');
  const [customising, setCustomising] = useState<{ item: MenuItem; groups: OptionGroupRule[] | null } | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [chosenRewards, setChosenRewards] = useState<AppliedLoyaltyReward[]>([]);
  const [notes, setNotes] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ line: CartItem; index: number } | null>(null);

  // Checkout. The ticket is snapshotted when it opens — the live cart clears as soon as the sale is recorded.
  const [checkout, setCheckout] = useState<CheckoutStep | 'closed'>('closed');
  const [snapshot, setSnapshot] = useState<{
    lines: CartItem[];
    total: number;
    customerName?: string;
    loyaltyReward?: { label: string; discountCents: number };
  }>({ lines: [], total: 0 });
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentAttempt, setPaymentAttempt] = useState<PaymentAttempt | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [offlinePayment, setOfflinePayment] = useState<PaymentMethod | null>(null);
  const [done, setDone] = useState<{ orderId: string | null; queued: boolean; change: number }>({
    orderId: null,
    queued: false,
    change: 0,
  });
  const session = useRef<ChargeSession | null>(null);

  // Deep link: /pos?customer=<id> (e.g. from a customer's profile) opens the
  // POS with that customer already attached to the order.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('customer');
    if (!id) return;
    getCustomer(id)
      .then((c) => {
        setSelectedCustomer(c);
        toast('success', `${c.firstName} ${c.lastName} added to this ticket.`);
      })
      .catch(() => toast('error', 'The linked customer couldn’t load. Search for them again.'));
  }, []);

  // A till needs its width for the menu: fold the app navigation to its icon rail
  // while selling, and put it back as it was on the way out.
  useEffect(() => {
    const wasCollapsed = useSidebarStore.getState().collapsed;
    if (!wasCollapsed) useSidebarStore.setState({ collapsed: true });
    return () => {
      if (!wasCollapsed) useSidebarStore.setState({ collapsed: false });
    };
  }, []);

  // A shared counter tablet: the next person to sign in starts with an empty ticket, not the last cashier's.
  const [ticketOwner, setTicketOwner] = useState(userId);
  if (ticketOwner !== userId) {
    setTicketOwner(userId);
    setCart([]);
    setSelectedCustomer(null);
    setChosenRewards([]);
    setNotes('');
    setCustomising(null);
  }

  // The removed-line Undo lasts five seconds.
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 5000);
    return () => window.clearTimeout(timer);
  }, [removed]);
  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), 700);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  // ── Shift gate ──
  const shifts = useQuery({
    queryKey: moduleQueryKeys.workforce.key('shifts-my'),
    queryFn: getMyShifts,
    enabled: !!tenantId && !!locationId,
  });
  const onShift = (shifts.data ?? []).some((s) => !s.clockedOut);

  const { mutateAsync: doClockIn, isPending: clockingIn } = useMutation({
    mutationFn: () => clockIn({ locationId: locationId! }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-my') });
      toast('success', 'Clocked in — the till is unlocked.');
    },
    onError: (err) => toast('error', (err as Error).message || 'You weren’t clocked in. Try again before taking orders.'),
  });

  // ── Menu ──
  const {
    menu,
    items: posItems,
    categories,
    favourites,
    favouritesLabel,
    stockStatus,
  } = useTillMenuData({
    tenantId,
    locationId,
    layout,
    pinned: tenantId ? layout.pinned[tenantId] : undefined,
  });
  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const location = locations.find((entry) => entry.id === locationId);
  const locationName = location?.name;
  // Opening and closing the trading day lives here, at the drawer it counts.
  // `/cash-up` lands with `?cashup` to open it straight away.
  const cashUpDay = useCashUpDay(locationId, location?.timezone ?? 'Europe/London');
  const [cashUpOpen, setCashUpOpen] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('cashup'),
  );
  const closeCashUp = () => {
    setCashUpOpen(false);
    if (window.location.search.includes('cashup')) window.history.replaceState(null, '', window.location.pathname);
  };
  const loyaltyWallet = useQuery({
    queryKey: moduleQueryKeys.customers.key('loyalty-wallet', selectedCustomer?.id, locationId),
    queryFn: () => getCustomerLoyaltyWallet(selectedCustomer!.id, locationId ?? undefined),
    enabled: Boolean(selectedCustomer && locationId),
  });
  // What the cashier picked, trimmed to what the cart and wallet still allow —
  // derived, so the discount shown and the discount sent are the same render.
  const loyaltyRewards = useMemo(
    () => validLoyaltyRewards(chosenRewards, cart, loyaltyWallet.data?.programmes),
    [chosenRewards, cart, loyaltyWallet.data],
  );
  const counts = useMemo(() => countByItem(cart), [cart]);

  const { data: configuredPaymentMethods = [] } = useQuery({
    queryKey: moduleQueryKeys.payments.key('payment-methods', locationId),
    queryFn: () => getPaymentMethods(locationId!),
    enabled: !!locationId,
  });
  const { data: tradingSettings } = useQuery({
    queryKey: moduleQueryKeys.organization.key('trading', tenantId),
    queryFn: () => getTradingSettings(tenantId!),
    enabled: !!tenantId,
  });
  const currency = tradingSettings?.currency ?? 'GBP';
  const checkoutMethods: PaymentMethod[] = [
    { id: 'cash', provider: 'cash', displayName: 'Cash' },
    ...configuredPaymentMethods,
    { id: 'manual', provider: 'manual_terminal', displayName: 'Card machine' },
  ];

  // ── Ticket ──
  function addLine(item: MenuItem, selected: MenuOption[], quantity = 1, note = '') {
    const key = lineKey(item.id, selected, note);
    const existing = cart.find((c) => lineKey(c.item.id, c.selected, c.note) === key);
    if (existing) {
      setCart((prev) => prev.map((c) => (c.cartId === existing.cartId ? { ...c, quantity: c.quantity + quantity } : c)));
      setFlashId(existing.cartId);
      return;
    }
    const cartId = `${item.id}-${crypto.randomUUID()}`;
    setCart((prev) => [...prev, { cartId, item, quantity, selected, note: note || undefined }]);
    setFlashId(cartId);
  }

  const selectionRequest = useRef(0);

  async function handleSelectItem(item: MenuItem) {
    const request = ++selectionRequest.current;
    if (customising?.item.id === item.id) {
      handleCancelItem();
      return;
    }
    const modifiersKey = moduleQueryKeys.catalog.key('menu-item-modifiers', item.id);
    // Already known to have no options: add in one tap and stay on the menu.
    const cached = qc.getQueryData<AttachedModifier[]>(modifiersKey);
    if (cached && cached.filter((m) => m.isAvailable).length === 0) {
      addLine(item, []);
      setCustomising(null);
      return;
    }

    setCustomising({ item, groups: null });
    usePageSidebarStore.getState().setOpen(true);
    try {
      const [modifiers, rules] = await Promise.all([
        qc.fetchQuery({ queryKey: modifiersKey, queryFn: () => getMenuItemModifiers(item.id), staleTime: MENU_STALE_MS }),
        // The rules are what the API enforces. If they can't load, fall back to the
        // legacy one-per-category behaviour rather than blocking the sale.
        qc
          .fetchQuery({
            queryKey: moduleQueryKeys.catalog.key('menu-item-modifier-groups', item.id),
            queryFn: () => getMenuItemModifierGroups(item.id),
            staleTime: MENU_STALE_MS,
          })
          .catch(() => []),
      ]);
      if (selectionRequest.current !== request) return;
      const options = modifiers.filter((m) => m.isAvailable).map(toOption);
      if (options.length === 0) {
        addLine(item, []);
        setCustomising(null);
        usePageSidebarStore.getState().setOpen(false);
        return;
      }
      setCustomising({ item, groups: buildOptionGroups(options, rules) });
    } catch {
      if (selectionRequest.current !== request) return;
      setCustomising(null);
      usePageSidebarStore.getState().setOpen(false);
      toast('error', `${item.name}’s options couldn’t load. Try again.`);
    }
  }

  function handleCancelItem() {
    selectionRequest.current += 1;
    setCustomising(null);
    usePageSidebarStore.getState().setOpen(false);
  }

  function handleAddToCart(selected: MenuOption[], quantity: number, note: string) {
    if (!customising) return;
    addLine(customising.item, selected, quantity, note);
    setCustomising(null);
    // On small screens the drawer covered the menu — close it so the next item is one tap away.
    usePageSidebarStore.getState().setOpen(false);
  }

  function handleRemove(cartId: string) {
    const index = cart.findIndex((c) => c.cartId === cartId);
    if (index < 0) return;
    setRemoved({ line: cart[index], index });
    setCart((prev) => prev.filter((c) => c.cartId !== cartId));
  }

  function handleUndoRemove() {
    if (!removed) return;
    setCart((prev) => [...prev.slice(0, removed.index), removed.line, ...prev.slice(removed.index)]);
    setRemoved(null);
  }

  function resetTicket() {
    setCart([]);
    setSelectedCustomer(null);
    setNotes('');
    setChosenRewards([]);
    setPromoCode(null);
    setRemoved(null);
    handleCancelItem();
  }

  // ── Held tickets ──
  const allHeld = useHeldTicketsStore((state) => state.tickets);
  const held = useMemo(
    () => allHeld.filter((t) => t.tenantId === tenantId && t.locationId === locationId),
    [allHeld, locationId, tenantId],
  );

  function handleHold() {
    if (!tenantId || !locationId || cart.length === 0) return;
    if (held.length >= MAX_HELD) {
      toast('error', `There are already ${MAX_HELD} tickets on hold. Charge or discard one first.`);
      return;
    }
    const time = formatInstant(new Date(), { hour: '2-digit', minute: '2-digit' });
    const name = selectedCustomer
      ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim()
      : notes.trim().slice(0, 40) || `Ticket · ${time}`;
    useHeldTicketsStore.getState().hold({ name, cart, customer: selectedCustomer, notes, heldBy: userId ?? null, tenantId, locationId });
    resetTicket();
    toast('success', `Held as “${name}”. Pick it up from Held.`);
  }

  function handleResume(id: string) {
    if (cart.length > 0) return;
    const ticket = useHeldTicketsStore.getState().take(id);
    if (!ticket) return;
    setCart(ticket.cart);
    setSelectedCustomer(ticket.customer);
    setNotes(ticket.notes);
  }

  // ── Checkout ──
  const buildOrderPayload = (provider: string, orderNotes: string): CreateOrderPayload => ({
    locationId: locationId!,
    ...(selectedCustomer ? { customerId: selectedCustomer.id } : {}),
    source: 'pos',
    paymentMethod: provider,
    notes: orderNotes || undefined,
    ...(promoCode ? { promoCode } : {}),
    ...(loyaltyRewards.length > 0
      ? {
          loyaltyRedemptions: loyaltyRewards.map((reward) => ({
            programId: reward.programId,
            itemIndex: cart.findIndex((line) => line.cartId === reward.cartId),
            ...(reward.modifierId ? { modifierId: reward.modifierId } : {}),
            quantity: reward.quantity,
          })),
        }
      : {}),
    items: cart.map((c) => ({
      menuItemId: c.item.id,
      quantity: c.quantity,
      ...(c.note ? { notes: c.note } : {}),
      ...(c.selected.length > 0 ? { modifiers: c.selected.map((o) => ({ modifierId: o.id })) } : {}),
    })),
  });

  function handleCharge() {
    const signature = `${cartSignature(cart, selectedCustomer?.id, notes)}|${JSON.stringify(loyaltyRewards.map(({ programId, cartId, modifierId, quantity }) => ({ programId, cartId, modifierId, quantity })))}|${promoCode ?? ''}`;
    const previous = session.current;
    if (!previous || previous.signature !== signature) {
      // The basket changed since an order was created for it: that order will never be paid, so void it.
      // Best effort — it needs `orders:status`, and an unpaid order left behind is visible on /orders.
      if (previous?.orderId)
        void updateOrderStatus(previous.orderId, 'cancelled', {
          voidReason: 'staff_error',
          voidNotes: 'Basket changed at the till before payment',
        }).catch(() => undefined);
      session.current = { signature, key: crypto.randomUUID(), orderId: null, cashAttempt: null };
    }
    setSnapshot({
      lines: cart,
      // An estimate until the order comes back with the server's own total.
      total: Math.max(0, cartTotal(cart) - loyaltyRewards.reduce((sum, reward) => sum + reward.discountCents, 0) - promoDiscountCents),
      customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : undefined,
      ...(loyaltyRewards.length > 0
        ? {
            loyaltyReward: {
              label: `${loyaltyRewards.reduce((sum, reward) => sum + reward.quantity, 0)} loyalty reward${loyaltyRewards.reduce((sum, reward) => sum + reward.quantity, 0) === 1 ? '' : 's'}`,
              discountCents: loyaltyRewards.reduce((sum, reward) => sum + reward.discountCents, 0),
            },
          }
        : {}),
    });
    setCheckoutError(null);
    setOfflinePayment(null);
    setPaymentAttempt(null);
    setCheckout('method');
  }

  const online = useOnline();

  // ── Promo code ──
  // Checked against the basket as it stands (lines after loyalty rewards), the
  // customer and whether a reward is used — re-asked whenever any of them
  // changes. The order checks it again under lock and prices it for real.
  const promoLines = useMemo(() => promoCheckLines(cart, loyaltyRewards), [cart, loyaltyRewards]);
  const promoCheck = useQuery({
    queryKey: moduleQueryKeys.promotions.key(
      'check',
      promoCode,
      locationId,
      selectedCustomer?.id ?? null,
      loyaltyRewards.length > 0,
      promoLines,
    ),
    queryFn: () =>
      checkPromotionCode({
        code: promoCode!,
        locationId: locationId!,
        source: 'pos',
        customerId: selectedCustomer?.id ?? null,
        usesLoyalty: loyaltyRewards.length > 0,
        lines: promoLines,
      }),
    enabled: Boolean(promotionsOn && promoCode && locationId && cart.length > 0 && online),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const promoDiscountCents =
    promoCode && promoCheck.data?.valid && promoCheck.data.estimatedDiscount
      ? Math.round(Number(promoCheck.data.estimatedDiscount) * 100)
      : 0;

  const { mutate: submitOrder, isPending: isStarting } = useMutation({
    // CRITICAL: React Query's default networkMode 'online' PAUSES mutations
    // while offline — mutationFn never runs, isPending spins forever, and our
    // queueing logic below is unreachable. 'always' hands control to us.
    networkMode: 'always',
    mutationFn: async (method: PaymentMethod) => {
      const current = session.current!;
      if (!navigator.onLine) throw new Error('offline');
      if (method.provider === 'cash' && current.cashAttempt?.status === 'pending') {
        return { orderId: current.orderId!, total: null, payment: current.cashAttempt, method };
      }
      let total: number | null = null;
      if (!current.orderId) {
        const order = await createOrder(buildOrderPayload(method.provider, notes), current.key);
        // Recorded before the payment starts, so a failure from here on retries against this order.
        current.orderId = order.id;
        total = Math.round(Number(order.totalAmount) * 100);
      }
      const payment = await startPayment(current.orderId, {
        ...(method.id === 'cash'
          ? { provider: 'cash' as const }
          : method.id === 'manual'
            ? { provider: 'manual_terminal' as const }
            : { connectionId: method.id }),
        // Per attempt: reusing a key would hand back the attempt that was just declined.
        idempotencyKey: `pay-${crypto.randomUUID()}`,
      });
      if (method.provider === 'cash') current.cashAttempt = payment;
      return { orderId: current.orderId, total, payment, method };
    },
    onSuccess: ({ total, payment, method }) => {
      // The server's total is the real one — VAT, discounts and current prices.
      if (total !== null && Number.isFinite(total)) setSnapshot((s) => ({ ...s, total }));
      if (payment.status === 'failed') {
        setCheckoutError(payment.failureMessage ?? `${method.displayName} didn’t start. Try again or choose another method.`);
        return;
      }
      setPaymentAttempt(payment);
      setPaymentMethod(method);
      setCheckout(method.provider === 'cash' ? 'cash' : 'verify');
      invalidateAfterSale();
    },
    onError: (err, method) => {
      const unreachable = isUnreachable(err);
      const orderExists = !!session.current?.orderId;
      // A code can't be checked or its use reserved offline, and a queued sale
      // that later fails its code would leave a discount nobody can account for.
      if (unreachable && !orderExists && promoCode) {
        setCheckoutError('Promo codes need a connection. Remove the code to take this sale offline, or try again when you’re back online.');
        return;
      }
      if (unreachable && !orderExists && (method.provider === 'cash' || method.provider === 'manual_terminal')) {
        setOfflinePayment(method);
        setPaymentMethod(method);
        setPaymentAttempt(null);
        setCheckout(method.provider === 'cash' ? 'cash' : 'verify');
        return;
      }
      setCheckoutError(
        unreachable && orderExists
          ? 'The order reached the server but the payment didn’t start. Try again — it won’t create a second order.'
          : err.message || 'The order wasn’t placed. Check the ticket and try again.',
      );
    },
  });

  const { mutate: recordOutcome, isPending: isConfirming } = useMutation({
    mutationFn: ({ outcome }: { outcome: 'succeeded' | 'failed' | 'cancelled'; tendered?: number }) =>
      confirmPayment(paymentAttempt!.id, outcome),
    onSuccess: (payment, { outcome, tendered }) => {
      if (payment.status === 'succeeded') {
        finishSale(false, tendered);
        return;
      }
      if (session.current) session.current.cashAttempt = null;
      setPaymentAttempt(null);
      setCheckout('method');
      setCheckoutError(outcome === 'cancelled' ? null : 'The payment was declined. Try again or choose another method.');
    },
    onError: (error) => setCheckoutError(error.message || 'The payment result wasn’t recorded. Keep this screen open and try again.'),
  });

  function invalidateAfterSale() {
    for (const queryKey of [
      moduleQueryKeys.ordering.key('orders'),
      moduleQueryKeys.ordering.key('orders-all'),
      moduleQueryKeys.inventory.key('location-stock'),
      moduleQueryKeys.inventory.key('inventory-forecast'),
      moduleQueryKeys.inventory.key('low-stock-alerts'),
      moduleQueryKeys.customers.key('customers'),
      moduleQueryKeys.customers.key('loyalty-wallet'),
    ])
      void qc.invalidateQueries({ queryKey });
    if (selectedCustomer) void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-visits', selectedCustomer.id) });
  }

  function finishSale(queued: boolean, tendered?: number) {
    setDone({
      orderId: queued ? null : (session.current?.orderId ?? null),
      queued,
      change: tendered !== undefined ? changeDue(tendered, snapshot.total).change : 0,
    });
    session.current = null;
    setPaymentAttempt(null);
    setOfflinePayment(null);
    setCheckoutError(null);
    setCheckout('done');
    resetTicket();
    usePageSidebarStore.getState().setOpen(false);
  }

  function saveOffline(method: PaymentMethod, tendered?: number) {
    if (!userId || !tenantId || !session.current) {
      setCheckoutError('The sale couldn’t be saved on this till because the account or workspace is missing.');
      return;
    }
    const takenAt = formatInstant(new Date(), { hour: '2-digit', minute: '2-digit' });
    const offlineNote = `Taken offline at ${takenAt}`;
    useOfflineOrdersStore.getState().enqueue(buildOrderPayload(method.provider, notes ? `${notes} · ${offlineNote}` : offlineNote), {
      idempotencyKey: session.current.key,
      ownerUserId: userId,
      tenantId,
      paymentProvider: method.provider as 'cash' | 'manual_terminal',
    });
    finishSale(true, tendered);
  }

  function handleTender(tendered: number) {
    if (offlinePayment) saveOffline(offlinePayment, tendered);
    else recordOutcome({ outcome: 'succeeded', tendered });
  }

  function handlePaymentOutcome(outcome: 'succeeded' | 'failed' | 'cancelled') {
    if (offlinePayment) {
      if (outcome === 'succeeded') saveOffline(offlinePayment);
      else {
        setOfflinePayment(null);
        setCheckout('method');
      }
      return;
    }
    recordOutcome({ outcome });
  }

  // Leaving the cash or card screen abandons that attempt — tell the API, so it isn't left pending.
  function handleCheckoutBack() {
    if (paymentAttempt && !offlinePayment) recordOutcome({ outcome: 'cancelled' });
    else {
      setOfflinePayment(null);
      setCheckout('method');
    }
  }

  function handlePrint() {
    if (!done.orderId) return;
    const receiptWindow = window.open('about:blank', '_blank');
    if (!receiptWindow) {
      toast('error', 'Allow pop-ups to open the printable receipt.');
      return;
    }
    receiptWindow.opener = null;
    receiptWindow.location.href = `${API_PREFIX}/v1/receipts/${encodeURIComponent(done.orderId)}/receipt`;
  }

  // ── Offline awareness ──
  const offlineQueue = useOfflineOrdersStore((state) => state.queue);
  const offlineHistory = useOfflineOrdersStore((state) => state.history);
  const queuedOrders = useMemo(
    () => offlineQueue.filter((order) => order.ownerUserId === userId && order.tenantId === tenantId),
    [offlineQueue, tenantId, userId],
  );
  const needsAttention = queuedOrders.filter((order) => order.status === 'needs-attention');
  const recentSyncs = useMemo(
    () => offlineHistory.filter((record) => record.ownerUserId === userId && record.tenantId === tenantId).slice(0, 5),
    [offlineHistory, tenantId, userId],
  );

  if (!clientReady) {
    return (
      <EditorShell title="Till" icon={<Monitor size={20} aria-hidden="true" />} flush>
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16" aria-live="polite">
          <p className="text-sm font-medium text-muted-foreground">Preparing the till…</p>
        </div>
      </EditorShell>
    );
  }

  const ready = !!tenantId && !!locationId && onShift;
  let body: React.ReactNode;
  if (!tenantId) {
    body = (
      <EmptyState
        icon={Building2}
        title="No workspace selected"
        description="Select a workspace before taking orders."
        className="flex-1"
      />
    );
  } else if (!locationId) {
    body = (
      <EmptyState
        icon={MapPin}
        title="No location selected"
        description="Use the location picker to choose where you’re taking orders."
        className="flex-1"
      />
    );
  } else if (shifts.isLoading) {
    body = <MenuGrid items={[]} counts={{}} selectedId={null} onSelectItem={() => undefined} isLoading />;
  } else if (shifts.isError && !shifts.data) {
    body = (
      <Gate icon={AlertTriangle} title="Your shift couldn’t be checked" description="The till unlocks once it can see you’re clocked in.">
        <Button size="lg" onClick={() => void shifts.refetch()} className="mt-6 h-14 px-6 text-base">
          Try again
        </Button>
      </Gate>
    );
  } else if (!onShift) {
    body = (
      <Gate icon={Clock} title="Clock in to start selling" description="The till unlocks while you’re on shift.">
        <SlideToClockIn onClockIn={doClockIn} pending={clockingIn} className="mt-6 max-w-80" />
      </Gate>
    );
  }

  const banners = (
    <>
      <CashUpNudge status={cashUpDay.status} open={cashUpDay.open} onOpen={() => setCashUpOpen(true)} />
      {(!online || queuedOrders.length > 0) && (
        <div
          role="status"
          className={cn(
            'mb-4 rounded-xl border px-4 py-3 text-sm',
            needsAttention.length > 0
              ? 'border-exception/35 bg-destructive/6'
              : online
                ? 'border-primary/25 bg-primary/5'
                : 'border-warning/35 bg-warning/8',
          )}
        >
          <p className="flex items-center gap-2.5 font-medium text-foreground">
            {online ? (
              <CloudUpload size={17} aria-hidden="true" className="shrink-0 text-primary" />
            ) : (
              <WifiOff size={17} aria-hidden="true" className="shrink-0 text-warning" />
            )}
            {needsAttention.length > 0
              ? `${needsAttention.length} saved ${needsAttention.length === 1 ? 'sale was' : 'sales were'} refused by the server and need${needsAttention.length === 1 ? 's' : ''} a manager.`
              : !online
                ? `Offline — cash and card-machine sales save on this till${queuedOrders.length ? ` (${queuedOrders.length} waiting)` : ''} and send when the connection returns.`
                : `Sending ${queuedOrders.length} saved ${queuedOrders.length === 1 ? 'sale' : 'sales'}…`}
          </p>
          {needsAttention.length > 0 && (
            <ul className="mt-3 divide-y divide-rule/40 border-t border-rule/40">
              {needsAttention.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2.5 text-muted-foreground">
                    <StatusDot tone="exception" label="Refused" />
                    <span className="min-w-0">
                      Taken <RelativeTime iso={order.queuedAt} /> · {order.lastError ?? 'Refused by the server'}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => useOfflineOrdersStore.getState().retry(order.id)}
                    className="h-11 shrink-0 px-4"
                  >
                    Retry
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ready && recentSyncs.length > 0 && online && queuedOrders.length === 0 && (
        <details className="mb-4 rounded-xl border border-rule/60 bg-card px-4 py-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Recently sent from this till · {recentSyncs.length}</summary>
          <ul className="mt-2 space-y-1 border-t border-rule/50 pt-2">
            {recentSyncs.map((record) => (
              <li key={record.queueId} className="flex items-center gap-2.5">
                <StatusDot tone="success" label="Sent" />
                <span className="min-w-0">
                  Order {record.orderId.slice(0, 8)} · taken <RelativeTime iso={record.queuedAt} /> · sent{' '}
                  <RelativeTime iso={record.syncedAt} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );

  return (
    <>
      <EditorShell
        title="Till"
        icon={<Monitor size={20} aria-hidden="true" />}
        actions={<CashUpButton status={cashUpDay.status} onOpen={() => setCashUpOpen(true)} />}
        flush
      >
        <div className="flex min-h-0 flex-1">
          {ready ? (
            <>
              <TillMenu
                items={posItems}
                categories={categories}
                favourites={favourites}
                favouritesLabel={favouritesLabel}
                layout={layout}
                counts={counts}
                stock={stockStatus}
                selectedId={customising?.item.id ?? null}
                onSelectItem={handleSelectItem}
                isLoading={menu.isLoading}
                isError={menu.isError && !menu.data}
                onRetry={() => void menu.refetch()}
                currency={currency}
                banner={banners}
              />
              <CartBar cart={cart} onOpen={() => usePageSidebarStore.getState().setOpen(true)} currency={currency} />
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background px-4 py-4 md:px-6">
              {banners}
              <div className="flex flex-1 flex-col">{body}</div>
            </div>
          )}

          {ready && (
            <PageSidebar>
              <OrderPanel
                cart={cart}
                selectedItem={customising?.item ?? null}
                groups={customising?.groups ?? null}
                onAddToCart={handleAddToCart}
                onCancelItem={handleCancelItem}
                onQty={(cartId, delta) =>
                  setCart((prev) => prev.map((c) => (c.cartId === cartId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)))
                }
                onLineNote={(cartId, note) =>
                  setCart((prev) => prev.map((c) => (c.cartId === cartId ? { ...c, note: note || undefined } : c)))
                }
                onRemove={handleRemove}
                removed={removed?.line ?? null}
                onUndoRemove={handleUndoRemove}
                flashId={flashId}
                onClearCart={resetTicket}
                selectedCustomer={selectedCustomer}
                onCustomerSelect={(customer) => {
                  setSelectedCustomer(customer);
                  setChosenRewards([]);
                }}
                loyaltyProgrammes={loyaltyWallet.data?.programmes ?? []}
                loyaltyLoading={loyaltyWallet.isLoading}
                loyaltyRewards={loyaltyRewards}
                onLoyaltyRewards={setChosenRewards}
                notes={notes}
                onNotesChange={setNotes}
                held={held}
                onHold={handleHold}
                onResume={handleResume}
                onDiscardHeld={(id) => useHeldTicketsStore.getState().discard(id)}
                onCharge={handleCharge}
                currency={currency}
                promo={
                  promotionsOn
                    ? {
                        code: promoCode,
                        check: promoCheck.data,
                        checking: promoCheck.isFetching,
                        failed: promoCheck.isError,
                        discountCents: promoDiscountCents,
                        offline: !online,
                        onApply: setPromoCode,
                        onRemove: () => setPromoCode(null),
                      }
                    : undefined
                }
              />
            </PageSidebar>
          )}
        </div>
      </EditorShell>

      {checkout !== 'closed' && (
        <CheckoutFlow
          step={checkout}
          total={snapshot.total}
          currency={currency}
          lines={snapshot.lines}
          customerName={snapshot.customerName}
          loyaltyReward={snapshot.loyaltyReward}
          methods={checkoutMethods}
          busy={isStarting || isConfirming}
          error={checkoutError}
          paymentLabel={paymentMethod?.displayName}
          paymentProvider={paymentAttempt?.provider ?? offlinePayment?.provider}
          queued={checkout === 'done' ? done.queued : !!offlinePayment}
          offline={!online}
          change={done.change}
          canPrint={!!done.orderId}
          onSelectMethod={(method) => {
            setCheckoutError(null);
            submitOrder(method);
          }}
          onTender={handleTender}
          onBack={handleCheckoutBack}
          onPaymentOutcome={handlePaymentOutcome}
          onPrint={handlePrint}
          onNewSale={() => setCheckout('closed')}
          onCancel={() => setCheckout('closed')}
        />
      )}

      {cashUpOpen && locationId && cashUpDay.status !== 'hidden' && (
        <CashUpDrawer
          locationId={locationId}
          locationName={locationName ?? 'This location'}
          timezone={location?.timezone ?? 'Europe/London'}
          currency={currency}
          heldCount={held.length}
          queuedCount={queuedOrders.length}
          onClose={closeCashUp}
        />
      )}
    </>
  );
}

function Gate({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Clock;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-band text-muted-foreground" aria-hidden="true">
        <Icon size={28} />
      </span>
      <p className="mt-5 text-xl font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-sm text-base text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};

function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
