'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Popover } from 'radix-ui';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import {
  AlertCircle,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Flame,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  User,
  Wallet,
  X,
  XCircle,
} from '@/components/icons';
import { NewOrderModal } from '@/components/orders/NewOrderModal';
import { OrderDrawer } from '@/components/orders/OrderDrawer';
import { StatusMenu } from '@/components/orders/StatusMenu';
import { LIVE_STATUSES, SOURCE_META, STATUS_META, optionLabel } from '@/components/orders/orderMeta';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { FilterChip } from '@/components/shared/FilterChip';
import { IconTag } from '@/components/shared/IconTag';
import { ListRow } from '@/components/shared/ListRow';
import { LoadMore } from '@/components/shared/LoadMore';
import { MiniBar } from '@/components/shared/MiniBar';
import { Pill } from '@/components/shared/Pill';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { API_PREFIX } from '@/lib/modules/core/client';
import { getCustomer } from '@/lib/modules/customers/client';
import { getStaff } from '@/lib/modules/identity/client';
import { type Order, type OrderSource, type OrderStatus, approveCashOrder, getOrders } from '@/lib/modules/ordering/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { paymentClears } from '@/lib/utils/order-workflow';
import { groupOrdersByDay, itemCount, itemPreview, orderCode, paymentSummary, shiftDay, todayKey } from '@/lib/utils/orders-list';
import { workspaceFormatter } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/*
 * The orders screen, after the lists operators already know (Square's status
 * tabs, Shopify's separate payment pill, Linear's peek): tabs by where an order
 * is up to, a filter bar whose state lives in the URL, orders grouped by day as
 * audit-log rows with an item preview, and the detail in a drawer that ↑/↓ step
 * through. Money is in the workspace's trading currency.
 */

const LIMIT = 50;

type StatusFilter = 'all' | OrderStatus;
type SourceFilter = 'all' | OrderSource;
type PaymentFilter = 'all' | 'cash' | 'card';
type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...(['pending', 'preparing', 'ready', 'done', 'cancelled', 'expired'] as const).map((value) => ({
    value,
    label: STATUS_META[value].label,
  })),
];

const SOURCE_FILTERS: SelectOption[] = [
  { value: 'all', label: 'All channels' },
  ...(['pos', 'qr_code', 'mobile', 'web'] as const).map((value) => ({ value, label: SOURCE_META[value].label })),
];

const PAYMENT_FILTERS: SelectOption[] = [
  { value: 'all', label: 'All payments' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
];

const DATE_FILTERS: SelectOption[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom dates' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const startOfLocalDay = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const endOfLocalDay = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();

function datesForPreset(preset: Exclude<DatePreset, 'all' | 'custom'>, now: Date) {
  const today = todayKey(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'yesterday') return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
  return { from: shiftDay(today, preset === '7d' ? -6 : -29), to: today };
}

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const TIME = () => workspaceFormatter({ hour: '2-digit', minute: '2-digit' });

// ── Row ──────────────────────────────────────────────────────────────────────

/**
 * One order as a list row: the channel in a status-tinted tile, the code and
 * who it's for, what was ordered underneath, then the status (changeable in
 * place), how it was paid, and the total.
 */
function OrderRow({
  order,
  selected,
  onOpen,
  money,
}: {
  order: Order;
  selected: boolean;
  onOpen: () => void;
  money: (n: number) => string;
}) {
  const source = SOURCE_META[order.source];
  const payment = paymentSummary(order);
  const muted = order.status === 'cancelled' || order.status === 'expired';
  // Money went back: the whole row says so, not only a pill — full refunds
  // strike the total through, part refunds colour it.
  const refundedFull = order.refundStatus === 'refunded' || order.paymentStatus === 'refunded';
  const refundedPart = !refundedFull && order.refundStatus === 'partially_refunded';
  const refunded = refundedFull || refundedPart;
  const preview = itemPreview(order.items);
  const count = itemCount(order.items);
  // Paid is the ordinary case, so it is a mark; anything else is worth reading.
  const paidBy = payment.state === null && (order.paymentMethod === 'card' || order.paymentMethod === 'cash') ? order.paymentMethod : null;

  return (
    <li
      id={`order-row-${order.id}`}
      className={cn('border-b border-rule/45 last:border-b-0', refundedFull && !selected && 'bg-exception/4')}
    >
      <ListRow
        as="div"
        className="border-b-0"
        icon={source.icon}
        iconLabel={source.label}
        tone={refunded ? 'exception' : STATUS_META[order.status].tone}
        muted={muted && !refunded}
        selected={selected}
        onClick={onOpen}
        title={<span className={cn(muted && 'line-through decoration-rule', refundedFull && 'text-exception')}>{orderCode(order.id)}</span>}
        titleExtra={order.customerName && <span className="truncate text-sm text-foreground">{order.customerName}</span>}
        meta={
          <>
            {TIME().format(new Date(order.createdAt))}
            {preview && ` · ${preview}`}
          </>
        }
        control={
          <span className="hidden md:block">
            <StatusMenu order={order} />
          </span>
        }
        trailing={
          <>
            {refunded ? (
              <Pill tone="exception" icon={RotateCcw} className="hidden sm:inline-flex">
                {refundedFull ? 'Refunded' : 'Part refunded'}
              </Pill>
            ) : paidBy ? (
              <IconTag
                icon={paidBy === 'cash' ? Banknote : CreditCard}
                label={paidBy === 'cash' ? 'Paid in cash' : 'Paid by card'}
                tone="success"
                tile
                className="hidden sm:inline-flex"
              />
            ) : (
              <Pill tone={payment.tone} icon={order.paymentMethod === 'cash' ? Banknote : CreditCard} className="hidden sm:inline-flex">
                {payment.state ?? payment.method}
              </Pill>
            )}
            <span className="w-20 text-right">
              <span
                className={cn(
                  'block text-sm font-semibold',
                  muted
                    ? 'text-muted-foreground'
                    : refundedFull
                      ? 'text-exception line-through decoration-exception/50'
                      : refundedPart
                        ? 'text-exception'
                        : 'text-foreground',
                )}
              >
                {money(Number(order.totalAmount))}
              </span>
              {count !== null && (
                <span className="block text-xs text-muted-foreground tabular-nums" title={`${count} ${count === 1 ? 'item' : 'items'}`}>
                  {count}×<span className="sr-only"> {count === 1 ? 'item' : 'items'}</span>
                </span>
              )}
            </span>
          </>
        }
      />
    </li>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function OrdersPageContent() {
  const qc = useQueryClient();
  const money = useWorkspaceMoney();
  const words = useCatalogWords();
  const searchParams = useSearchParams();
  const { locationId: headerLocationId, tenantId } = useWorkspaceStore();
  // A report's drill-down names its own scope — a site id, or `all` — which
  // overrides the header's location until cleared, so the orders shown add up
  // to the figure that was clicked.
  const [reportScope, setReportScope] = useState<string | null>(searchParams.get('location'));
  const locationId = reportScope === null ? headerLocationId : reportScope === 'all' ? null : reportScope;
  const capabilities = useAuthStore((state) => state.capabilities);
  const canExport = hasCapability(capabilities, 'orders:bulk');
  // Taking an order by hand (phone, email, wholesale) — any workspace with Orders, alongside a Till or not.
  const canCreate = hasCapability(capabilities, 'orders:create');
  const [creating, setCreating] = useState(false);
  // `?newOrder=<customer id>`: "Start an order" from a customer's record when there is no Till —
  // New order opens with them already picked, once they've loaded (or without them if they can't be).
  const router = useRouter();
  const pathname = usePathname();
  const newOrderFor = canCreate ? searchParams.get('newOrder') : null;
  const startingCustomer = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer', newOrderFor),
    queryFn: () => getCustomer(newOrderFor!),
    enabled: !!newOrderFor,
  });
  const showCreate = creating || (!!newOrderFor && !startingCustomer.isPending);
  const closeCreate = () => {
    setCreating(false);
    if (newOrderFor) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('newOrder');
      router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, { scroll: false });
    }
  };

  const pick = <T extends string>(value: string | null, allowed: readonly string[], fallback: T) =>
    value && allowed.includes(value) ? (value as T) : fallback;
  const initialFrom = searchParams.get('from') ?? '';
  const initialTo = searchParams.get('to') ?? '';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    pick(
      searchParams.get('status'),
      STATUS_TABS.map((t) => t.value),
      'all',
    ),
  );
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(
    pick(
      searchParams.get('source'),
      SOURCE_FILTERS.map((o) => o.value),
      'all',
    ),
  );
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(
    pick(
      searchParams.get('paymentMethod'),
      PAYMENT_FILTERS.map((o) => o.value),
      'all',
    ),
  );
  const [createdBy, setCreatedBy] = useState(searchParams.get('createdBy') ?? 'all');
  const [customerSearch, setCustomerSearch] = useState(
    searchParams.get('customer') ?? searchParams.get('customerId') ?? searchParams.get('customerPhone') ?? '',
  );
  const [debouncedSearch, setDebouncedSearch] = useState(customerSearch);
  const [datePreset, setDatePreset] = useState<DatePreset>(
    pick(
      searchParams.get('range'),
      DATE_FILTERS.map((o) => o.value),
      initialFrom || initialTo ? 'custom' : 'all',
    ),
  );
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('order'));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(customerSearch.trim()), customerSearch ? 400 : 0);
    return () => window.clearTimeout(timeout);
  }, [customerSearch]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const invalidDateRange = Boolean(from && to && from > to);
  const singleDay = !!from && from === to;
  const hasFilters =
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    paymentFilter !== 'all' ||
    createdBy !== 'all' ||
    !!debouncedSearch ||
    datePreset !== 'all' ||
    !!from ||
    !!to ||
    reportScope !== null;
  const moreCount = Number(createdBy !== 'all') + Number(datePreset === 'custom' && (!!from || !!to));

  // ── Reference data ──
  const { data: staff = [] } = useQuery({
    queryKey: moduleQueryKeys.identity.key('staff', tenantId),
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const staffName = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return null;
      const member = staff.find((entry) => entry.userId === userId);
      return member ? member.name || member.email || null : null;
    },
    [staff],
  );
  const locationName = useCallback((id: string) => locations.find((location) => location.id === id)?.name ?? null, [locations]);
  const staffOptions = useMemo<SelectOption[]>(() => {
    const options = staff
      .map((member) => ({ value: member.userId, label: member.name || member.email || member.userId }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (createdBy !== 'all' && !options.some((option) => option.value === createdBy))
      options.unshift({ value: createdBy, label: createdBy });
    return [{ value: 'all', label: 'Anyone' }, ...options];
  }, [createdBy, staff]);

  // ── The live picture: today's figures, the kitchen, cash waiting at the counter ──
  const { data: recentData } = useQuery({
    queryKey: moduleQueryKeys.ordering.key('orders-all', locationId),
    queryFn: () => getOrders({ limit: 200, locationId: locationId ?? undefined }),
    refetchInterval: 30_000,
  });
  const recent = useMemo(() => recentData?.data ?? [], [recentData?.data]);
  const today = todayKey(now);
  const yesterday = shiftDay(today, -1);
  const summary = useMemo(() => {
    const onDay = (day: string) => recent.filter((order) => todayKey(new Date(order.createdAt)) === day);
    const takings = (orders: Order[]) =>
      orders.filter((o) => o.status !== 'cancelled' && o.status !== 'expired').reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const todays = onDay(today);
    const yesterdays = onDay(yesterday);
    const kitchen = recent.filter((o) => LIVE_STATUSES.includes(o.status) && paymentClears(o));
    const live = Object.fromEntries(LIVE_STATUSES.map((status) => [status, kitchen.filter((o) => o.status === status).length])) as Record<
      string,
      number
    >;
    return {
      count: todays.length,
      countYesterday: yesterdays.length,
      takings: takings(todays),
      takingsYesterday: takings(yesterdays),
      kitchen: kitchen.length,
      live,
      cancelled: todays.filter((o) => o.status === 'cancelled').length,
    };
  }, [recent, today, yesterday]);
  const cashWaiting = useMemo(
    () => recent.filter((order) => order.paymentStatus === 'awaiting_cash_approval').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [recent],
  );
  const approveCash = useMutation({
    mutationFn: (orderId: string) => approveCashOrder(orderId),
    onSuccess: (order) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders-all') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('kds-orders') });
      toast('success', `Cash received. Order ${orderCode(order.id)} is in ${words.queue}.`);
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The cash order couldn’t be approved.'),
  });

  // ── The list ──
  // Pages load as the end of the list comes into view, as on the audit log,
  // and the whole list refreshes on the same beat as the live picture above.
  const list = useInfiniteQuery({
    queryKey: moduleQueryKeys.ordering.key(
      'orders',
      statusFilter,
      sourceFilter,
      paymentFilter,
      createdBy,
      debouncedSearch,
      from,
      to,
      locationId,
    ),
    queryFn: ({ pageParam }) =>
      getOrders({
        page: pageParam,
        limit: LIMIT,
        locationId: locationId ?? undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        paymentMethod: paymentFilter === 'all' ? undefined : paymentFilter,
        createdBy: createdBy === 'all' ? undefined : createdBy,
        customerId: debouncedSearch && isUuid(debouncedSearch) ? debouncedSearch : undefined,
        customerPhone: debouncedSearch && !isUuid(debouncedSearch) ? debouncedSearch : undefined,
        from: from ? startOfLocalDay(from) : undefined,
        to: to ? endOfLocalDay(to) : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: !invalidDateRange,
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
  const { isPending, isFetching, isError, refetch } = list;
  const total = list.data?.pages[0]?.total ?? 0;
  // A new order arriving while the list refreshes shifts every later page by
  // one, so the same order can appear on two pages — keep its first sighting.
  const orders = useMemo(() => {
    const seen = new Set<string>();
    return (list.data?.pages ?? [])
      .flatMap((pageData) => pageData.data)
      .filter((order) => (seen.has(order.id) ? false : (seen.add(order.id), true)));
  }, [list.data?.pages]);
  const days = useMemo(() => groupOrdersByDay(orders, now), [orders, now]);

  // Filters, page and the open order all live in the URL, so a view can be
  // bookmarked or sent to someone.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    [
      'page',
      'status',
      'source',
      'paymentMethod',
      'createdBy',
      'customer',
      'customerId',
      'customerPhone',
      'range',
      'from',
      'to',
      'order',
      'location',
    ].forEach((key) => params.delete(key));
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (paymentFilter !== 'all') params.set('paymentMethod', paymentFilter);
    if (createdBy !== 'all') params.set('createdBy', createdBy);
    if (debouncedSearch) params.set('customer', debouncedSearch);
    if (datePreset !== 'all') params.set('range', datePreset);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (selectedId) params.set('order', selectedId);
    if (reportScope !== null) params.set('location', reportScope);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, '', next);
  }, [createdBy, datePreset, debouncedSearch, from, paymentFilter, reportScope, selectedId, sourceFilter, statusFilter, to]);

  const selectedIndex = selectedId ? orders.findIndex((order) => order.id === selectedId) : -1;
  const open = useCallback((id: string) => {
    setSelectedId(id);
    window.requestAnimationFrame(() =>
      document.getElementById(`order-row-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  }, []);

  function changeDatePreset(value: string) {
    const next = value as DatePreset;
    setDatePreset(next);
    if (next === 'all') {
      setFrom('');
      setTo('');
    } else if (next === 'custom') {
      window.setTimeout(() => setMoreOpen(true), 0);
    } else {
      const dates = datesForPreset(next, new Date());
      setFrom(dates.from);
      setTo(dates.to);
    }
  }
  function stepDay(delta: number) {
    const base = singleDay ? from : today;
    const next = shiftDay(base, delta);
    setFrom(next);
    setTo(next);
    setDatePreset(next === today ? 'today' : next === yesterday ? 'yesterday' : 'custom');
  }
  function clearFilters() {
    setStatusFilter('all');
    setSourceFilter('all');
    setPaymentFilter('all');
    setCreatedBy('all');
    setCustomerSearch('');
    setDebouncedSearch('');
    setDatePreset('all');
    setFrom('');
    setTo('');
    setReportScope(null);
  }

  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: 'csv' });
      if (from) params.set('from', startOfLocalDay(from));
      if (to) params.set('to', endOfLocalDay(to));
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (locationId) params.set('locationId', locationId);
      const res = await fetch(`${API_PREFIX}/v1/orders/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`The export didn’t work (${res.status}).`);
      const url = URL.createObjectURL(await res.blob());
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `orders-${from || 'all'}${to && to !== from ? `-to-${to}` : ''}.csv`,
      });
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast('error', (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const diff = (a: number, b: number) => (a === b ? 'Same as yesterday' : `${a > b ? '+' : '−'}${Math.abs(a - b)} on yesterday`);

  return (
    <EditorShell
      eyebrow="Operations"
      title="Orders"
      icon={<ShoppingBag size={20} aria-hidden="true" />}
      actions={
        (canExport || canCreate) && (
          <>
            {canExport && (
              <Button variant="outline" className="h-9" onClick={() => void exportCsv()} disabled={exporting} aria-label="Export CSV">
                {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                <span className="hidden md:inline">Export CSV</span>
              </Button>
            )}
            {canCreate && (
              <Button className="h-9 gap-1.5" onClick={() => setCreating(true)} aria-label="New order">
                <Plus size={15} aria-hidden="true" />
                <span className="hidden md:inline">New order</span>
              </Button>
            )}
          </>
        )
      }
    >
      <motion.div
        className="flex flex-1 flex-col space-y-5"
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
      >
        {/* Cash orders waiting at the counter — the one thing on this page that blocks a customer. */}
        {cashWaiting.length > 0 && (
          <motion.section
            variants={SECTION_RISE}
            aria-labelledby="cash-waiting"
            className="overflow-hidden rounded-lg border border-measured/40 bg-field"
          >
            <header className="flex items-center gap-3 border-b border-rule/45 px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-measured/10 text-measured">
                <Banknote size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="cash-waiting" className="text-sm font-semibold text-foreground">
                  {cashWaiting.length} cash {cashWaiting.length === 1 ? 'order' : 'orders'} waiting at the counter
                </h2>
                <p className="text-xs text-muted-foreground">
                  Approve once the customer has paid — until then they stay out of {words.queue}.
                </p>
              </div>
            </header>
            <ul>
              {cashWaiting.map((order) => {
                const expiresAt = order.expiresAt ? new Date(order.expiresAt).getTime() : null;
                const minutes = expiresAt !== null ? Math.max(0, Math.ceil((expiresAt - now.getTime()) / 60_000)) : null;
                // The bar is the time left of the window the order was given.
                const windowMins =
                  expiresAt !== null ? Math.max(1, Math.ceil((expiresAt - new Date(order.createdAt).getTime()) / 60_000)) : null;
                const expiryLabel = minutes === null ? 'No expiry' : `Expires in about ${minutes} min`;
                const preview = itemPreview(order.items);
                return (
                  <ListRow
                    key={order.id}
                    leading={order.customerName ? <Avatar name={order.customerName} /> : undefined}
                    icon={Banknote}
                    tone="warning"
                    title={`${order.customerName || orderCode(order.id)} · ${money(Number(order.totalAmount))}`}
                    meta={
                      <span className="flex min-w-0 items-center gap-2">
                        {minutes !== null && windowMins !== null ? (
                          <MiniBar
                            value={minutes}
                            max={windowMins}
                            tone={minutes <= 2 ? 'exception' : 'warning'}
                            label={expiryLabel}
                            className="w-14 shrink-0"
                          />
                        ) : (
                          <Clock size={12} className="shrink-0" aria-hidden="true" />
                        )}
                        <span className="truncate">
                          <span className="text-measured">{minutes === null ? expiryLabel : `${minutes} min left`}</span>
                          {preview && ` · ${preview}`}
                        </span>
                      </span>
                    }
                    trailing={
                      <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => open(order.id)}>
                          Review
                        </Button>
                        <Button type="button" size="sm" disabled={approveCash.isPending} onClick={() => approveCash.mutate(order.id)}>
                          <Banknote data-icon="inline-start" />
                          Cash received
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </ul>
          </motion.section>
        )}

        {/* Today at a glance. */}
        <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact
            surface="page"
            icon={ShoppingBag}
            label="Orders today"
            value={summary.count}
            hint={diff(summary.count, summary.countYesterday)}
          />
          <Fact
            surface="page"
            icon={Wallet}
            label="Takings today"
            value={money(summary.takings)}
            hint={
              summary.count > 0
                ? `${money(summary.takings / Math.max(1, summary.count - summary.cancelled))} an order`
                : `${money(summary.takingsYesterday)} yesterday`
            }
          />
          <Fact
            surface="page"
            icon={words.tools.kitchen ? Flame : Package}
            label={words.inQueue}
            value={summary.kitchen}
            hint={summary.live.ready > 0 ? `${summary.live.ready} ready to collect` : 'Nothing waiting to collect'}
            onSelect={() => {
              setStatusFilter(summary.live.ready > 0 ? 'ready' : 'preparing');
            }}
          />
          <Fact
            surface="page"
            icon={XCircle}
            label="Cancelled today"
            value={summary.cancelled}
            tone={summary.cancelled > 0 ? 'warning' : 'default'}
            hint={summary.count > 0 ? `${Math.round((summary.cancelled / summary.count) * 100)}% of orders` : 'None'}
          />
        </motion.dl>

        {/* Flex down to the list, so an empty one centres in what is left of the page. */}
        <motion.section variants={SECTION_RISE} className="flex flex-1 flex-col space-y-3" aria-label="Orders">
          {/* Filters. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1 lg:max-w-xs">
              <Input
                type="search"
                value={customerSearch}
                onChange={(event) => {
                  setCustomerSearch(event.target.value);
                }}
                aria-label="Find orders by customer phone or ID"
                placeholder="Customer phone or ID"
                leftIcon={<Search size={14} />}
                className="border-rule"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => stepDay(-1)} aria-label="Previous day">
                <ChevronLeft />
              </Button>
              <Select
                value={datePreset}
                onValueChange={changeDatePreset}
                options={DATE_FILTERS.map((option) =>
                  option.value === 'custom' && singleDay && datePreset === 'custom'
                    ? { ...option, label: DAY_LABEL.format(new Date(`${from}T12:00:00`)) }
                    : option,
                )}
                ariaLabel="Date"
                icon={<CalendarDays />}
                className="w-44"
              />
              <Button variant="outline" size="icon" onClick={() => stepDay(1)} disabled={singleDay && from >= today} aria-label="Next day">
                <ChevronRight />
              </Button>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              // Live counts stay here: nothing else on the page splits the
              // kitchen's queue into new, preparing and ready.
              options={STATUS_TABS.map((tab) => {
                const count = tab.value === 'pending' || tab.value === 'preparing' || tab.value === 'ready' ? summary.live[tab.value] : 0;
                return count > 0 ? { ...tab, label: `${tab.label} · ${count}` } : tab;
              })}
              ariaLabel="Status"
              className="w-40"
            />
            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                setSourceFilter(value as SourceFilter);
              }}
              options={SOURCE_FILTERS}
              ariaLabel="Channel"
              className="w-36"
            />
            <Select
              value={paymentFilter}
              onValueChange={(value) => {
                setPaymentFilter(value as PaymentFilter);
              }}
              options={PAYMENT_FILTERS}
              ariaLabel="Payment"
              className="w-36"
            />
            <Popover.Root open={moreOpen} onOpenChange={setMoreOpen}>
              <Popover.Trigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal data-icon="inline-start" />
                  More
                  {moreCount > 0 && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-micro font-semibold text-primary-foreground">
                      {moreCount}
                    </span>
                  )}
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  align="end"
                  sideOffset={8}
                  collisionPadding={16}
                  className="z-90 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-rule/60 bg-card p-4 shadow-lg outline-none"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">More filters</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Who took the order, or exact dates.</p>
                    </div>
                    <Popover.Close asChild>
                      <Button variant="ghost" size="icon" aria-label="Close filters">
                        <X />
                      </Button>
                    </Popover.Close>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1.5 text-label uppercase text-muted-foreground">Taken by</p>
                      <Select
                        value={createdBy}
                        onValueChange={(value) => {
                          setCreatedBy(value);
                        }}
                        options={staffOptions}
                        ariaLabel="Taken by"
                        icon={<User />}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <p className="mb-1.5 text-label uppercase text-muted-foreground">Dates</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'From', value: from, set: setFrom },
                          { label: 'To', value: to, set: setTo },
                        ].map((field) => (
                          <Input
                            key={field.label}
                            type="date"
                            value={field.value}
                            max={today}
                            onChange={(event) => {
                              field.set(event.target.value);
                              setDatePreset('custom');
                            }}
                            aria-label={`${field.label} date`}
                            className="border-rule px-2"
                          />
                        ))}
                      </div>
                      {invalidDateRange && (
                        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-exception">
                          <AlertCircle size={12} aria-hidden="true" /> The end date must be on or after the start date.
                        </p>
                      )}
                    </div>
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              {isFetching && !isPending && <Loader2 size={12} className="animate-spin" aria-label="Updating" />}
              {list.data ? `${total.toLocaleString()} ${total === 1 ? 'order' : 'orders'}` : ''}
            </span>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
              {reportScope !== null && (
                <FilterChip
                  label={reportScope === 'all' ? 'Every location' : (locationName(reportScope) ?? 'One location')}
                  onRemove={() => setReportScope(null)}
                />
              )}
              {datePreset !== 'all' && (
                <FilterChip
                  label={
                    singleDay
                      ? DAY_LABEL.format(new Date(`${from}T12:00:00`))
                      : datePreset === 'custom'
                        ? `${from || 'Any'} – ${to || 'Any'}`
                        : optionLabel(DATE_FILTERS, datePreset)
                  }
                  onRemove={() => changeDatePreset('all')}
                />
              )}
              {statusFilter !== 'all' && (
                <FilterChip
                  label={STATUS_TABS.find((tab) => tab.value === statusFilter)?.label ?? statusFilter}
                  onRemove={() => setStatusFilter('all')}
                />
              )}
              {sourceFilter !== 'all' && (
                <FilterChip label={optionLabel(SOURCE_FILTERS, sourceFilter)} onRemove={() => setSourceFilter('all')} />
              )}
              {paymentFilter !== 'all' && (
                <FilterChip label={optionLabel(PAYMENT_FILTERS, paymentFilter)} onRemove={() => setPaymentFilter('all')} />
              )}
              {createdBy !== 'all' && (
                <FilterChip label={`Taken by ${optionLabel(staffOptions, createdBy)}`} onRemove={() => setCreatedBy('all')} />
              )}
              {debouncedSearch && (
                <FilterChip
                  label={`${isUuid(debouncedSearch) ? 'Customer' : 'Phone'}: ${debouncedSearch}`}
                  onRemove={() => {
                    setCustomerSearch('');
                    setDebouncedSearch('');
                  }}
                />
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          )}

          {/* The list, a day at a time. */}
          {invalidDateRange ? (
            <EmptyState
              icon={CalendarDays}
              title="Check the dates"
              description="The end date must be on or after the start date."
              kind="search"
              className="flex-1"
              action={{
                label: 'Clear dates',
                onClick: () => {
                  setDatePreset('all');
                  setFrom('');
                  setTo('');
                },
              }}
            />
          ) : isError ? (
            <ErrorState
              title="Orders couldn’t be loaded"
              description="Nothing was read, so this isn’t an empty list."
              onRetry={() => void refetch()}
            />
          ) : isPending ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <Bone className="h-4 w-28" />
                <Bone className="h-3 w-24" />
              </div>
              <ListSkeleton rows={8} label="Loading orders" />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={statusFilter === 'all' ? ShoppingBag : STATUS_META[statusFilter].icon}
              title={hasFilters ? 'No orders match' : 'No orders yet'}
              description={
                hasFilters ? 'Try another status, or clear the filters.' : 'Orders from the counter, QR tables and mobile appear here.'
              }
              kind={hasFilters ? 'search' : 'start'}
              action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
              className="flex-1"
            />
          ) : (
            <div className="space-y-5">
              {days.map((day) => (
                <section key={day.key} aria-labelledby={`day-${day.key}`}>
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <h2 id={`day-${day.key}`} className="text-sm font-semibold text-foreground">
                      {day.label}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {day.count} {day.count === 1 ? 'order' : 'orders'} · {money(day.total)}
                    </p>
                  </div>
                  <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                    {day.orders.map((order) => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        selected={order.id === selectedId}
                        onOpen={() => open(order.id)}
                        money={money}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {!isError && orders.length > 0 && (
            <>
              <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoadMore={() => void list.fetchNextPage()} />
              {!list.hasNextPage && <p className="pb-2 text-center text-xs text-muted-foreground">That’s everything</p>}
            </>
          )}
        </motion.section>
      </motion.div>

      {showCreate && (
        <NewOrderModal
          initialCustomer={creating ? null : (startingCustomer.data ?? null)}
          onClose={closeCreate}
          onCreated={(order) => {
            closeCreate();
            void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders') });
            void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders-all') });
            void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('kds-orders') });
            toast(
              'success',
              `Order ${orderCode(order.id)} created${order.paymentStatus === 'paid' ? '' : ' — unpaid, mark it paid when the money comes in'}.`,
            );
            open(order.id);
          }}
        />
      )}

      {selectedId && (
        <OrderDrawer
          key={selectedId}
          orderId={selectedId}
          staffName={staffName}
          locationName={locationName}
          onClose={() => setSelectedId(null)}
          onPrev={selectedIndex > 0 ? () => open(orders[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < orders.length - 1 ? () => open(orders[selectedIndex + 1].id) : undefined}
        />
      )}
    </EditorShell>
  );
}

function OrdersPageFallback() {
  return (
    <EditorShell eyebrow="Operations" title="Orders" icon={<ShoppingBag size={20} aria-hidden="true" />}>
      <div className="space-y-5">
        <FactsSkeleton count={4} label="Loading today at a glance" className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4" />
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-9 min-w-56 flex-1 lg:max-w-xs" />
          <Bone className="h-9 w-56" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={8} label="Loading orders" />
      </div>
    </EditorShell>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersPageFallback />}>
      <OrdersPageContent />
    </Suspense>
  );
}
