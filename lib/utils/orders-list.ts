// ---------------------------------------------------------------------------
// The orders list's arithmetic, kept out of the page so it can be tested.
//
// Grouping by day, the one-line item preview, the next step an order can
// take, and how its payment reads — the four things every row and the drawer
// decide the same way.
// ---------------------------------------------------------------------------
import type { Order, OrderItem, OrderStatus } from '@/lib/modules/ordering/client';
import { paymentClears } from './order-workflow.ts';
import { formatInstant, workspaceDateKey, zonedParts } from './workspace-time.ts';

/** "#AB12CD34" — the short code staff read out, from the id's first eight characters. */
export const orderCode = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

const localKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export interface OrderDay<T> {
  /** YYYY-MM-DD, in the workspace zone. */
  key: string;
  label: string;
  orders: T[];
  count: number;
  /** Takings for the day's orders on this page, excluding cancelled and expired ones. */
  total: number;
}

/**
 * Orders under a heading per workspace day, newest day first, in the order given
 * within a day. "Today" and "Yesterday" by name; older days by date.
 */
export function groupOrdersByDay<T extends Pick<Order, 'createdAt' | 'status' | 'totalAmount'>>(orders: T[], now: Date): OrderDay<T>[] {
  const current = zonedParts(now);
  const today = current.date;
  const yesterday = shiftDay(today, -1);
  const days = new Map<string, OrderDay<T>>();
  for (const order of orders) {
    const at = zonedParts(order.createdAt);
    const key = at.date;
    let day = days.get(key);
    if (!day) {
      const label =
        key === today
          ? 'Today'
          : key === yesterday
            ? 'Yesterday'
            : formatInstant(order.createdAt, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                ...(at.year !== current.year ? { year: 'numeric' } : {}),
              });
      day = { key, label, orders: [], count: 0, total: 0 };
      days.set(key, day);
    }
    day.orders.push(order);
    day.count += 1;
    if (order.status !== 'cancelled' && order.status !== 'expired')
      day.total = Math.round((day.total + Number(order.totalAmount || 0)) * 100) / 100;
  }
  return [...days.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * "2× Flat white, Croissant +3 more" — enough to recognise an order without
 * opening it. `null` when the items aren't known: `GET /orders` returns orders
 * without their lines (only `GET /orders/:id` has them), and "No items" or
 * "0 items" would be a false statement about every order in the list.
 */
export function itemPreview(items: Pick<OrderItem, 'name' | 'quantity'>[] | undefined, max = 2): string | null {
  if (!items) return null;
  if (items.length === 0) return 'No items';
  const shown = items.slice(0, max).map((item) => (item.quantity > 1 ? `${item.quantity}× ${item.name}` : item.name));
  const rest = items.length - max;
  return rest > 0 ? `${shown.join(', ')} +${rest} more` : shown.join(', ');
}

/** Units ordered, or `null` when the list didn't carry the items — see `itemPreview`. */
export const itemCount = (items: Pick<OrderItem, 'quantity'>[] | undefined): number | null =>
  items ? items.reduce((sum, item) => sum + item.quantity, 0) : null;

/**
 * The one step forward an order can take, as the drawer's primary button.
 * Nothing moves until it's paid — an unpaid order can only be cancelled, and
 * that is not a "next step". Except an order taken by hand, which is paid later.
 */
export function nextStep(order: Pick<Order, 'status' | 'paymentStatus'> & { source?: Order['source'] }): { status: OrderStatus; label: string } | null {
  if (!paymentClears(order)) return null;
  if (order.status === 'pending') return { status: 'preparing', label: 'Start preparing' };
  if (order.status === 'preparing') return { status: 'ready', label: 'Mark ready' };
  if (order.status === 'ready') return { status: 'done', label: 'Complete' };
  return null;
}

export type PaymentTone = 'success' | 'warning' | 'exception' | 'muted';

/** How an order's payment reads in a row: the method, and a state only when it isn't simply paid. */
export function paymentSummary(order: Pick<Order, 'paymentMethod' | 'paymentStatus'>): {
  method: string;
  state: string | null;
  tone: PaymentTone;
} {
  const method =
    order.paymentMethod === 'cash'
      ? 'Cash'
      : order.paymentMethod === 'card'
        ? 'Card'
        : order.paymentMethod === 'bank_transfer'
          ? 'Bank transfer'
          : order.paymentMethod === 'custom'
            ? 'Other'
            : order.paymentMethod
              ? order.paymentMethod
              : 'No payment';
  switch (order.paymentStatus) {
    case undefined:
    case 'paid':
      return { method, state: null, tone: 'success' };
    case 'refunded':
      return { method, state: 'Refunded', tone: 'muted' };
    case 'awaiting_cash_approval':
      return { method, state: 'Cash at counter', tone: 'warning' };
    case 'awaiting_payment':
    case 'processing':
      return { method, state: 'Unpaid', tone: 'warning' };
    case 'unpaid':
      // No method yet means nothing has been taken: one phrase, not "No payment · Unpaid".
      return order.paymentMethod ? { method, state: 'Unpaid', tone: 'warning' } : { method: 'Not paid yet', state: null, tone: 'warning' };
    case 'failed':
      return { method, state: 'Payment failed', tone: 'exception' };
    default:
      return { method, state: order.paymentStatus.replaceAll('_', ' '), tone: 'muted' };
  }
}

/** The local date `delta` days from a YYYY-MM-DD date — the day stepper's arrows. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localKey(new Date(y, m - 1, d + delta));
}

export const todayKey = (now: Date) => workspaceDateKey(now);

// ── Refund selection ─────────────────────────────────────────────────────────

/** The part of `GET /orders/:id/refund-options` the selection needs. */
export interface RefundableItem {
  id: string;
  base: { remainingQuantity: number; unitAmounts: string[] };
  modifiers: { id: string; remainingQuantity: number; unitAmounts: string[] }[];
}

/** Quantities chosen, keyed `item:<id>` or `modifier:<id>`. */
export type RefundSelection = Record<string, number>;

const sumFirst = (amounts: string[], n: number) => amounts.slice(0, n).reduce((sum, value) => sum + Math.round(Number(value) * 100), 0);

/**
 * What the selection refunds, from the exact per-unit amounts the API says are
 * still refundable — never recomputed from list prices, so a discounted order
 * refunds what was actually paid. In cents, returned as a decimal.
 */
export function refundAmount(items: RefundableItem[], selection: RefundSelection): number {
  let cents = 0;
  for (const item of items) {
    cents += sumFirst(item.base.unitAmounts, selection[`item:${item.id}`] ?? 0);
    for (const modifier of item.modifiers) cents += sumFirst(modifier.unitAmounts, selection[`modifier:${modifier.id}`] ?? 0);
  }
  return cents / 100;
}

/**
 * The request body's lines for the selection. `restock` names the items going
 * back on the shelf — products only; the API refuses a restocked modifier.
 */
export function refundLines(items: RefundableItem[], selection: RefundSelection, restock: ReadonlySet<string> = new Set()) {
  return items.flatMap((item) => [
    ...((selection[`item:${item.id}`] ?? 0) > 0
      ? [{ orderItemId: item.id, quantity: selection[`item:${item.id}`], ...(restock.has(item.id) ? { restock: true } : {}) }]
      : []),
    ...item.modifiers.flatMap((modifier) =>
      (selection[`modifier:${modifier.id}`] ?? 0) > 0
        ? [{ orderItemId: item.id, orderItemModifierId: modifier.id, quantity: selection[`modifier:${modifier.id}`] }]
        : [],
    ),
  ]);
}

/** Everything still refundable — the default a refund starts from. */
export function selectEverything(items: RefundableItem[]): RefundSelection {
  const selection: RefundSelection = {};
  for (const item of items) {
    if (item.base.remainingQuantity > 0) selection[`item:${item.id}`] = item.base.remainingQuantity;
    for (const modifier of item.modifiers)
      if (modifier.remainingQuantity > 0) selection[`modifier:${modifier.id}`] = modifier.remainingQuantity;
  }
  return selection;
}

// ── Activity ─────────────────────────────────────────────────────────────────

/** "45 s", "3 min", "1 h 5 min" — how long a step took, as a kitchen says it. */
export function formatGap(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** What each status change is called in the activity feed. */
export const STATUS_EVENT: Record<OrderStatus, string> = {
  pending: 'Order placed',
  preparing: 'Started preparing',
  ready: 'Marked ready',
  done: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired unpaid',
};

export type ActivityEvent<S, R> =
  | { kind: 'status'; at: string; gapMs: number | null; entry: S }
  | { kind: 'refund'; at: string; gapMs: number | null; refund: R };

/**
 * Status changes and refunds as one feed, oldest first, each carrying how long
 * after the previous event it happened — the gap is what shows how fast the
 * kitchen turned an order round.
 */
export function orderActivity<S extends { createdAt: string }, R extends { createdAt: string }>(
  history: S[] = [],
  refunds: R[] = [],
): ActivityEvent<S, R>[] {
  const events = [
    ...history.map((entry) => ({ kind: 'status' as const, at: entry.createdAt, entry })),
    ...refunds.map((refund) => ({ kind: 'refund' as const, at: refund.createdAt, refund })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return events.map((event, index) => ({
    ...event,
    gapMs: index === 0 ? null : new Date(event.at).getTime() - new Date(events[index - 1].at).getTime(),
  })) as ActivityEvent<S, R>[];
}

/**
 * The one line that sums the order up: how long until it was ready (or
 * completed, or cancelled) from when it was placed. Null while it is still
 * waiting to be picked up by the kitchen.
 */
export function turnaround(history: { status: OrderStatus; createdAt: string }[] = []): string | null {
  const placed = history.find((entry) => entry.status === 'pending');
  if (!placed) return null;
  const from = new Date(placed.createdAt).getTime();
  const at = (status: OrderStatus) => history.find((entry) => entry.status === status);
  const ready = at('ready');
  if (ready) return `Ready in ${formatGap(new Date(ready.createdAt).getTime() - from)}`;
  const done = at('done');
  if (done) return `Completed in ${formatGap(new Date(done.createdAt).getTime() - from)}`;
  const cancelled = at('cancelled');
  if (cancelled) return `Cancelled after ${formatGap(new Date(cancelled.createdAt).getTime() - from)}`;
  return null;
}

// ─── Storefront orders ───────────────────────────────────────────────────────

/** A delivery address as lines to print on a packing slip, blanks dropped. */
export function shippingAddressLines(address: {
  recipientName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postcode: string;
  country: string;
}): string[] {
  const town = [address.city, address.region].filter(Boolean).join(', ');
  return [address.recipientName, address.line1, address.line2, town, address.postcode.toUpperCase(), address.country.toUpperCase()]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

/** "Stripe · pi_3Nf…" — who took a website order's payment, and their reference, shortened. */
export function paymentSourceLabel(provider: string | null | undefined, reference: string | null | undefined): string | null {
  if (!provider) return null;
  const name = provider.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (!reference) return name;
  return `${name} · ${reference.length > 18 ? `${reference.slice(0, 16)}…` : reference}`;
}
