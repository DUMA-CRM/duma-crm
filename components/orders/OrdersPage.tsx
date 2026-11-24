'use client';

import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Popover } from 'radix-ui';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import {
  AlertCircle,
  Banknote,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Flame,
  ListChecks,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  User,
  Wallet,
  X,
  XCircle,
} from '@/components/icons';
import { DeleteOrdersModal, useMayDeleteOrder } from '@/components/orders/DeleteOrderModal';
import { NewOrderModal } from '@/components/orders/NewOrderModal';
import { OrderDrawer } from '@/components/orders/OrderDrawer';
import { OrderRowMenu } from '@/components/orders/OrderRowMenu';
import { OrdersSettingsDrawer } from '@/components/orders/OrdersSettings';
import { StatusMenu } from '@/components/orders/StatusMenu';
import { FULFILMENT_LABEL, LIVE_STATUSES, SOURCE_META, STATUS_META, optionLabel } from '@/components/orders/orderMeta';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import type { DrawerEnter } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { FilterChip } from '@/components/shared/FilterChip';
import { IconTag } from '@/components/shared/IconTag';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { LoadMore } from '@/components/shared/LoadMore';
import { MiniBar } from '@/components/shared/MiniBar';
import { Pill } from '@/components/shared/Pill';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL_CLASS } from '@/components/ui/label';
import { Select, type SelectOption } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { API_PREFIX } from '@/lib/modules/core/client';
import { getCustomer } from '@/lib/modules/customers/client';
import { getStaff } from '@/lib/modules/identity/client';
import {
  type Order,
  type OrderSource,
  type OrderStatus,
  type OrdersParams,
  type OrdersSummary,
  approveCashOrder,
  bulkUpdateOrderStatus,
  getOrders,
  getOrdersSummary,
  orderFilterQuery,
} from '@/lib/modules/ordering/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { paymentClears } from '@/lib/utils/order-workflow';
import {
  type BulkAction,
  type MoneyFilter,
  bulkEligible,
  groupOrdersByDay,
  itemCount,
  itemPreview,
  moneyFilterParams,
  orderCode,
  paymentSummary,
  shiftDay,
  todayKey,
} from '@/lib/utils/orders-list';
import { workspaceFormatter } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
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

const MONEY_FILTERS: { value: MoneyFilter; label: string }[] = [
  { value: 'all', label: 'Any payment state' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'awaiting_cash_approval', label: 'Waiting for cash' },
  { value: 'awaiting_payment', label: 'Waiting for online payment' },
  { value: 'partially_refunded', label: 'Part refunded' },
  { value: 'refunded', label: 'Refunded' },
];

type FulfilmentFilter = 'all' | 'eat_in' | 'takeaway' | 'collection' | 'delivery' | 'shipping';
const FULFILMENT_FILTERS: { value: FulfilmentFilter; label: string }[] = [
  { value: 'all', label: 'Any order type' },
  ...(['eat_in', 'takeaway', 'collection', 'delivery', 'shipping'] as const).map((value) => ({ value, label: FULFILMENT_LABEL[value] })),
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
  picking = false,
  picked = false,
  onPick,
  onStartSelect,
}: {
  order: Order;
  selected: boolean;
  onOpen: () => void;
  money: (n: number) => string;
  /** Select mode: a tap picks the order for a bulk action instead of opening it. */
  picking?: boolean;
  picked?: boolean;
  onPick?: () => void;
  /** Right-click → Select: starts select mode with this order picked. */
  onStartSelect?: () => void;
}) {
  const source = SOURCE_META[order.source];
  const payment = paymentSummary(order);
  const muted = order.status === 'cancelled' || order.status === 'expired';
  // Money went back: the whole row says so, not only a pill — full refunds
  // strike the total through, part refunds colour it.
  // A cancelled order that was paid is refunded automatically. It reads as
  // cancelled (muted, struck through) — the refund is a quiet note in the
  // payment column, not the row's headline, as Square shows it.
  const refundedFull = !muted && (order.refundStatus === 'refunded' || order.paymentStatus === 'refunded');
  const refundedPart = !muted && !refundedFull && order.refundStatus === 'partially_refunded';
  const refunded = refundedFull || refundedPart;
  const refundedOnCancel = muted && (order.refundStatus === 'refunded' || order.paymentStatus === 'refunded');
  const preview = itemPreview(order.items);
  const count = itemCount(order.items);
  // Paid is the ordinary case, so it is a mark; anything else is worth reading.
  const paidBy = payment.state === null && (order.paymentMethod === 'card' || order.paymentMethod === 'cash') ? order.paymentMethod : null;

  const row = (
    <li
      id={`order-row-${order.id}`}
      className={cn('border-b border-border last:border-b-0', refundedFull && !selected && 'bg-exception/4')}
    >
      <ListRow
        as="div"
        className="border-b-0"
        icon={source.icon}
        iconLabel={source.label}
        leading={
          picking ? (
            <span
              role="checkbox"
              aria-checked={picked}
              aria-label={`Select ${orderCode(order.id)}`}
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors',
                picked ? 'border-primary bg-primary text-primary-foreground' : 'border-edge bg-card text-transparent',
              )}
            >
              <Check size={16} strokeWidth={3} aria-hidden="true" />
            </span>
          ) : undefined
        }
        tone={refunded ? 'exception' : STATUS_META[order.status].tone}
        muted={muted && !refunded}
        selected={picking ? picked : selected}
        onClick={picking ? onPick : onOpen}
        title={
          <span className={cn(muted && 'line-through decoration-muted-foreground', refundedFull && 'text-exception')}>
            {orderCode(order.id)}
          </span>
        }
        titleExtra={order.customerName && <span className="truncate text-sm text-foreground">{order.customerName}</span>}
        meta={
          <>
            {TIME().format(new Date(order.createdAt))}
            {order.fulfilmentType && FULFILMENT_LABEL[order.fulfilmentType] && ` · ${FULFILMENT_LABEL[order.fulfilmentType]}`}
            {preview && ` · ${preview}`}
          </>
        }
        control={
          picking ? undefined : (
            <span className="hidden md:block">
              <StatusMenu order={order} />
            </span>
          )
        }
        trailing={
          <>
            {refunded ? (
              <Pill tone="exception" icon={RotateCcw} className="hidden sm:inline-flex">
                {refundedFull ? 'Refunded' : 'Part refunded'}
              </Pill>
            ) : refundedOnCancel ? (
              <Pill tone="muted" icon={RotateCcw} className="hidden sm:inline-flex">
                Refunded
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
            <span className="relative w-20 text-right">
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
  // Select mode owns the tap and the row; the menu would only compete with it.
  return picking ? (
    row
  ) : (
    <OrderRowMenu order={order} onOpen={onOpen} onSelect={onStartSelect}>
      {row}
    </OrderRowMenu>
  );
}

/** A floating bar while orders are picked: the two bulk steps, each saying how many it will take. */
function BulkBar({
  count,
  ready,
  complete,
  busy,
  onAction,
  onDelete,
  onClear,
}: {
  count: number;
  ready: number;
  complete: number;
  busy: boolean;
  onAction: (action: BulkAction) => void;
  /** Present only when every picked order is cancelled and the workspace allows deleting. */
  onDelete?: () => void;
  onClear: () => void;
}) {
  const skipped = count - Math.max(ready, complete);
  const none = ready === 0 && complete === 0 && !onDelete;
  return (
    <div role="region" aria-label="Bulk actions" className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card py-2 pr-2 pl-4 shadow-lg">
        <span className="text-sm font-semibold text-heading tabular-nums">{count} selected</span>
        {/* Only steps that would take something are offered — finished orders get a sentence, not two dead buttons. */}
        {none ? (
          <span className="pr-1 text-xs text-muted-foreground">
            {count === 1 ? 'This order is' : 'These orders are'} finished or unpaid — nothing to move on
          </span>
        ) : (
          skipped > 0 && !onDelete && <span className="text-xs text-muted-foreground">Unpaid or finished ones are left out</span>
        )}
        {ready > 0 && (
          <Button variant="outline" disabled={busy} onClick={() => onAction('ready')}>
            {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Bell data-icon="inline-start" />}
            Mark ready{ready !== count ? ` (${ready})` : ''}
          </Button>
        )}
        {complete > 0 && (
          <Button disabled={busy} onClick={() => onAction('done')}>
            {busy && ready === 0 ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <CheckCircle2 data-icon="inline-start" />
            )}
            Complete{complete !== count ? ` (${complete})` : ''}
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" disabled={busy} onClick={onDelete}>
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear the selection">
          <X />
        </Button>
      </div>
    </div>
  );
}

/**
 * What the orders on screen add up to, for any filter — "what did card take
 * last week?" — not only today. Sales are paid orders that weren't cancelled;
 * refunds are what went back on them; net is the difference.
 */
function OrdersTotals({ summary, money, total }: { summary: OrdersSummary; money: (n: number) => string; total: number }) {
  const methods = summary.byPaymentMethod.slice(0, 3);
  return (
    <dl
      aria-label="Totals for these orders"
      className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm"
    >
      <Total label={`${total.toLocaleString()} ${total === 1 ? 'order' : 'orders'}`} value={money(Number(summary.sales))} strong />
      {Number(summary.refunded) > 0 && <Total label="Refunds" value={`−${money(Number(summary.refunded))}`} tone="exception" />}
      {Number(summary.refunded) > 0 && <Total label="Net" value={money(Number(summary.net))} strong />}
      {summary.paidCount > 0 && <Total label="Average sale" value={money(Number(summary.average))} />}
      {methods.length > 1 && (
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-muted-foreground sm:ml-auto">
          {methods.map((row) => (
            <span key={row.method} className="tabular-nums">
              {PAYMENT_METHOD_LABEL[row.method] ?? 'Other'} <span className="font-medium text-foreground">{money(Number(row.total))}</span>
            </span>
          ))}
        </span>
      )}
    </dl>
  );
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  card: 'Card',
  cash: 'Cash',
  manual_terminal: 'Card machine',
  bank_transfer: 'Bank transfer',
  custom: 'Other',
};

function Total({ label, value, strong = false, tone }: { label: string; value: string; strong?: boolean; tone?: 'exception' }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        data-figure
        className={cn(
          'tabular-nums',
          strong ? 'text-base font-semibold text-heading' : 'font-medium text-foreground',
          tone === 'exception' && 'text-exception',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function OrdersPageContent() {
  const qc = useQueryClient();
  const money = useWorkspaceMoney();
  const words = useCatalogWords();
  const searchParams = useSearchParams();
  const { locationId: headerLocationId, tenantId } = useWorkspaceStore();
  // The workspace's order rules, opened by "Edit orders" in the avatar menu (`?edit=1`). Closing drops only
  // that parameter, so the list keeps its filters.
  const editingSettings = searchParams.get('edit') === '1';
  const closeSettings = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('edit');
    const query = next.toString();
    router.replace(query ? `/orders?${query}` : '/orders', { scroll: false });
  };
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
  // One box for an order code, an exact total or a customer (older links used customer/customerPhone).
  const [customerSearch, setCustomerSearch] = useState(
    searchParams.get('q') ?? searchParams.get('customer') ?? searchParams.get('customerId') ?? searchParams.get('customerPhone') ?? '',
  );
  const [moneyFilter, setMoneyFilter] = useState<MoneyFilter>(
    pick(
      searchParams.get('money'),
      MONEY_FILTERS.map((option) => option.value),
      'all',
    ),
  );
  const [fulfilmentFilter, setFulfilmentFilter] = useState<FulfilmentFilter>(
    pick(
      searchParams.get('type'),
      FULFILMENT_FILTERS.map((option) => option.value),
      'all',
    ),
  );
  // Bulk: a select mode, and the orders picked in it.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
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
    moneyFilter !== 'all' ||
    fulfilmentFilter !== 'all' ||
    createdBy !== 'all' ||
    !!debouncedSearch ||
    datePreset !== 'all' ||
    !!from ||
    !!to ||
    reportScope !== null;
  const moreCount =
    Number(createdBy !== 'all') +
    Number(moneyFilter !== 'all') +
    Number(fulfilmentFilter !== 'all') +
    Number(datePreset === 'custom' && (!!from || !!to));

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
  // Each figure comes from a query that answers it exactly. They used to be
  // worked out from one `getOrders({ limit: 200 })`, which the API caps at 100 —
  // so on a busy day the totals were short and older cash orders fell off.
  const today = todayKey(now);
  const yesterday = shiftDay(today, -1);
  const dayParams = (day: string): OrdersParams => ({
    locationId: locationId ?? undefined,
    from: startOfLocalDay(day),
    to: endOfLocalDay(day),
  });
  // Under the 'orders' key, so every order mutation refreshes these with the list.
  const todaySummary = useQuery({
    queryKey: moduleQueryKeys.ordering.key('orders', 'summary', 'day', locationId, today),
    queryFn: () => getOrdersSummary(dayParams(today)),
    refetchInterval: 30_000,
  });
  const yesterdaySummary = useQuery({
    queryKey: moduleQueryKeys.ordering.key('orders', 'summary', 'day', locationId, yesterday),
    queryFn: () => getOrdersSummary(dayParams(yesterday)),
    staleTime: 5 * 60_000,
  });
  const cancelledSummary = useQuery({
    queryKey: moduleQueryKeys.ordering.key('orders', 'summary', 'day-cancelled', locationId, today),
    queryFn: () => getOrdersSummary({ ...dayParams(today), status: 'cancelled' }),
    refetchInterval: 30_000,
  });
  // The kitchen, one status at a time — a full page each (the API's 100 cap), which no queue reaches.
  const liveQueries = useQueries({
    queries: LIVE_STATUSES.map((status) => ({
      queryKey: moduleQueryKeys.ordering.key('orders-all', locationId, 'status', status),
      queryFn: () => getOrders({ status, locationId: locationId ?? undefined, limit: 100 }),
      refetchInterval: 30_000,
    })),
  });
  // No useMemo: cheap, and the React Compiler memoises what it can prove safe.
  const live = Object.fromEntries(
    LIVE_STATUSES.map((status, index) => [status, (liveQueries[index]?.data?.data ?? []).filter(paymentClears).length]),
  ) as Record<string, number>;
  const day = todaySummary.data;
  const summary = {
    count: day?.count ?? 0,
    countYesterday: yesterdaySummary.data?.count ?? 0,
    // Paid sales, from the API's decimal sums — not the face value of unpaid orders.
    takings: Number(day?.sales ?? 0),
    takingsYesterday: Number(yesterdaySummary.data?.sales ?? 0),
    average: Number(day?.average ?? 0),
    paidCount: day?.paidCount ?? 0,
    kitchen: Object.values(live).reduce((sum, count) => sum + count, 0),
    live,
    cancelled: cancelledSummary.data?.count ?? 0,
  };
  // Its own query, so a cash order is never pushed off the end by newer ones.
  const cashQuery = useQuery({
    queryKey: moduleQueryKeys.ordering.key('orders-all', locationId, 'awaiting-cash'),
    queryFn: () => getOrders({ paymentStatus: 'awaiting_cash_approval', locationId: locationId ?? undefined, limit: 100 }),
    refetchInterval: 30_000,
  });
  const cashWaiting = useMemo(
    () => [...(cashQuery.data?.data ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [cashQuery.data],
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
  // One filter, three readers: the list, its totals and the CSV — the API reads all three
  // with the same builder, so a total or a file always describes the orders on screen.
  const filterParams = useMemo<OrdersParams>(
    () => ({
      locationId: locationId ?? undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
      paymentMethod: paymentFilter === 'all' ? undefined : paymentFilter,
      createdBy: createdBy === 'all' ? undefined : createdBy,
      ...moneyFilterParams(moneyFilter),
      fulfilmentType: fulfilmentFilter === 'all' ? undefined : fulfilmentFilter,
      customerId: debouncedSearch && isUuid(debouncedSearch) ? debouncedSearch : undefined,
      q: debouncedSearch && !isUuid(debouncedSearch) ? debouncedSearch : undefined,
      from: from ? startOfLocalDay(from) : undefined,
      to: to ? endOfLocalDay(to) : undefined,
    }),
    [createdBy, debouncedSearch, from, fulfilmentFilter, locationId, moneyFilter, paymentFilter, sourceFilter, statusFilter, to],
  );
  const list = useInfiniteQuery({
    queryKey: moduleQueryKeys.ordering.key('orders', filterParams),
    queryFn: ({ pageParam }) => getOrders({ ...filterParams, page: pageParam, limit: LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: !invalidDateRange,
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
  const { isPending, isFetching, isError, refetch } = list;
  // What the filtered orders add up to. Under the 'orders' key, so every mutation
  // that refreshes the list (status, refund, payment) refreshes the totals too.
  const totals = useQuery({
    queryKey: moduleQueryKeys.ordering.key('orders', 'summary', filterParams),
    queryFn: () => getOrdersSummary(filterParams),
    enabled: !invalidDateRange,
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
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

  // Bulk: only orders the action can take are sent — the API refuses a batch with a completed one in it.
  const pickedOrders = useMemo(() => orders.filter((order) => picked.has(order.id)), [orders, picked]);
  // Delete is offered only when every picked order is cancelled — a mixed pick shows the usual steps instead.
  const mayDeleteCancelled = useMayDeleteOrder('cancelled');
  const allCancelled = pickedOrders.length > 0 && pickedOrders.length === picked.size && pickedOrders.every((order) => order.status === 'cancelled');
  const [deletingPicked, setDeletingPicked] = useState(false);
  const bulk = useMutation({
    mutationFn: ({ action }: { action: BulkAction }) =>
      bulkUpdateOrderStatus(
        bulkEligible(pickedOrders, action).map((order) => order.id),
        action,
      ),
    onSuccess: (result, { action }) => {
      toast(
        'success',
        `${result.updated} ${result.updated === 1 ? 'order' : 'orders'} ${action === 'ready' ? 'marked ready' : 'completed'}.`,
      );
      setPicked(new Set());
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The orders didn’t change. Try again.'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders-all') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('kds-orders') });
    },
  });

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
      'q',
      'money',
      'type',
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
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (moneyFilter !== 'all') params.set('money', moneyFilter);
    if (fulfilmentFilter !== 'all') params.set('type', fulfilmentFilter);
    if (datePreset !== 'all') params.set('range', datePreset);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (selectedId) params.set('order', selectedId);
    if (reportScope !== null) params.set('location', reportScope);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, '', next);
  }, [
    createdBy,
    datePreset,
    debouncedSearch,
    from,
    fulfilmentFilter,
    moneyFilter,
    paymentFilter,
    reportScope,
    selectedId,
    sourceFilter,
    statusFilter,
    to,
  ]);

  const selectedIndex = selectedId ? orders.findIndex((order) => order.id === selectedId) : -1;
  // How the drawer arrives: from the side when a row is opened, at once when ↑/↓ steps to the next order.
  const [drawerEnter, setDrawerEnter] = useState<DrawerEnter>('side');
  const open = useCallback((id: string, enter: DrawerEnter = 'side') => {
    setDrawerEnter(enter);
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
    setMoneyFilter('all');
    setFulfilmentFilter('all');
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
      // Every filter on screen, not only dates and status — the file is the list you are looking at.
      const params = orderFilterQuery(filterParams);
      params.set('format', 'csv');
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
            className="overflow-hidden rounded-lg border border-measured/40 bg-card shadow-sm"
          >
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-measured/10 text-measured">
                <Banknote size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="cash-waiting" className="text-sm font-semibold text-heading">
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
              summary.paidCount > 0 ? `${money(summary.average)} an order` : `${money(summary.takingsYesterday)} yesterday`
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
                aria-label="Find orders by order code, total, or customer name, phone or email"
                placeholder="Order code, total or customer"
                leftIcon={<Search size={14} />}
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
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-heading px-1 text-micro font-semibold tabular-nums text-background">
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
                  className="z-90 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg outline-none"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-heading">More filters</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Who took it, whether it’s paid, or exact dates.</p>
                    </div>
                    <Popover.Close asChild>
                      <Button variant="ghost" size="icon" aria-label="Close filters">
                        <X />
                      </Button>
                    </Popover.Close>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Taken by</p>
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
                      <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Order type</p>
                      <Select
                        value={fulfilmentFilter}
                        onValueChange={(value) => setFulfilmentFilter(value as FulfilmentFilter)}
                        options={FULFILMENT_FILTERS}
                        ariaLabel="Order type"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Payment state</p>
                      <Select
                        value={moneyFilter}
                        onValueChange={(value) => setMoneyFilter(value as MoneyFilter)}
                        options={MONEY_FILTERS}
                        ariaLabel="Payment state"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Dates</p>
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
                            className="px-2"
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
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              {isFetching && !isPending && <Loader2 size={12} className="animate-spin" aria-label="Updating" />}
              {canExport && orders.length > 0 && (
                <Button
                  variant={selecting ? 'secondary' : 'outline'}
                  aria-pressed={selecting}
                  onClick={() => {
                    setSelecting((on) => !on);
                    setPicked(new Set());
                  }}
                >
                  <ListChecks data-icon="inline-start" />
                  {selecting ? 'Done selecting' : 'Select'}
                </Button>
              )}
            </span>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
              {reportScope !== null && (
                <FilterChip
                  variant="tag"
                  label={reportScope === 'all' ? 'Every location' : (locationName(reportScope) ?? 'One location')}
                  onRemove={() => setReportScope(null)}
                />
              )}
              {datePreset !== 'all' && (
                <FilterChip
                  variant="tag"
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
                  variant="tag"
                  label={STATUS_TABS.find((tab) => tab.value === statusFilter)?.label ?? statusFilter}
                  onRemove={() => setStatusFilter('all')}
                />
              )}
              {sourceFilter !== 'all' && (
                <FilterChip variant="tag" label={optionLabel(SOURCE_FILTERS, sourceFilter)} onRemove={() => setSourceFilter('all')} />
              )}
              {paymentFilter !== 'all' && (
                <FilterChip variant="tag" label={optionLabel(PAYMENT_FILTERS, paymentFilter)} onRemove={() => setPaymentFilter('all')} />
              )}
              {createdBy !== 'all' && (
                <FilterChip variant="tag" label={`Taken by ${optionLabel(staffOptions, createdBy)}`} onRemove={() => setCreatedBy('all')} />
              )}
              {fulfilmentFilter !== 'all' && (
                <FilterChip
                  variant="tag"
                  label={optionLabel(FULFILMENT_FILTERS, fulfilmentFilter)}
                  onRemove={() => setFulfilmentFilter('all')}
                />
              )}
              {moneyFilter !== 'all' && (
                <FilterChip variant="tag" label={optionLabel(MONEY_FILTERS, moneyFilter)} onRemove={() => setMoneyFilter('all')} />
              )}
              {debouncedSearch && (
                <FilterChip
                  variant="tag"
                  label={isUuid(debouncedSearch) ? 'One customer' : `“${debouncedSearch}”`}
                  onRemove={() => {
                    setCustomerSearch('');
                    setDebouncedSearch('');
                  }}
                />
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                Clear all
              </button>
            </div>
          )}

          {/* What the orders on screen add up to — the same filters as the list. */}
          {!invalidDateRange && !isError && totals.data && totals.data.count > 0 && (
            <OrdersTotals summary={totals.data} money={money} total={total} />
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
                    <h2 id={`day-${day.key}`} className="text-sm font-semibold text-heading">
                      {day.label}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {day.count} {day.count === 1 ? 'order' : 'orders'} · {money(day.total)}
                    </p>
                  </div>
                  <ListRowGroup>
                    {day.orders.map((order) => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        selected={order.id === selectedId}
                        onOpen={() => open(order.id)}
                        money={money}
                        picking={selecting}
                        picked={picked.has(order.id)}
                        onStartSelect={
                          canExport
                            ? () => {
                                setSelecting(true);
                                setPicked(new Set([order.id]));
                              }
                            : undefined
                        }
                        onPick={() =>
                          setPicked((current) => {
                            const next = new Set(current);
                            if (next.has(order.id)) next.delete(order.id);
                            else next.add(order.id);
                            return next;
                          })
                        }
                      />
                    ))}
                  </ListRowGroup>
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

      {/* The bulk bar: what the picked orders can have done to them, all at once. */}
      {selecting && picked.size > 0 && (
        <BulkBar
          count={picked.size}
          ready={bulkEligible(pickedOrders, 'ready').length}
          complete={bulkEligible(pickedOrders, 'done').length}
          busy={bulk.isPending}
          onAction={(action) => bulk.mutate({ action })}
          onDelete={mayDeleteCancelled && allCancelled ? () => setDeletingPicked(true) : undefined}
          onClear={() => setPicked(new Set())}
        />
      )}
      {deletingPicked && (
        <DeleteOrdersModal
          ids={[...picked]}
          onClose={() => setDeletingPicked(false)}
          onDeleted={() => {
            if (selectedId && picked.has(selectedId)) setSelectedId(null);
            setPicked(new Set());
          }}
        />
      )}

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
          enter={drawerEnter}
          onPrev={selectedIndex > 0 ? () => open(orders[selectedIndex - 1].id, 'instant') : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < orders.length - 1 ? () => open(orders[selectedIndex + 1].id, 'instant') : undefined}
        />
      )}
      {editingSettings && <OrdersSettingsDrawer onClose={closeSettings} />}
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
