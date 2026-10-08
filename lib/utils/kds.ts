/**
 * The kitchen display's rules, pure so they're tested: which tickets are on
 * the screen, where a bump may take them, how their clocks read, and the
 * all-day tally of what's still to make.
 */
import type { OrderStatus } from '../api/orders.service.ts';
import { paymentClears } from './order-workflow.ts';

export type KdsLane = 'pending' | 'preparing' | 'ready';
export const KDS_LANES: KdsLane[] = ['pending', 'preparing', 'ready'];

/** A bump only ever moves a ticket forward, one step. */
export const NEXT_STATUS: Record<KdsLane, OrderStatus> = { pending: 'preparing', preparing: 'ready', ready: 'done' };

/** Undo steps back one lane. `done` can't be undone — the API refuses to change a completed order. */
export const PREVIOUS_STATUS: Partial<Record<OrderStatus, KdsLane>> = { preparing: 'pending', ready: 'preparing' };

/** On the screen: paid (or taken by hand, to be paid later), and released to the kitchen (a scheduled pre-order waits for its release). */
export function isOnScreen(order: { kitchenReleaseAt?: string | null; paymentStatus?: string; source?: string }, now: number) {
  if (!paymentClears(order)) return false;
  return !order.kitchenReleaseAt || new Date(order.kitchenReleaseAt).getTime() <= now;
}

/** "<1m", "7m", "1h 05m" — short enough to read across a kitchen. */
export function elapsedLabel(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1_000));
  if (seconds < 60) return '<1m';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

/** Tickets that weren't on the previous poll — the ones worth a chime. Nothing on the first read. */
export function arrivals(previous: Set<string> | null, current: string[]): string[] {
  if (!previous) return [];
  return current.filter((id) => !previous.has(id));
}

/** What the guest is called at the pass: their name if the order has one, else a short order number. */
export function ticketName(order: { id: string; customerName?: string | null }) {
  const name = order.customerName?.trim();
  return name || `#${order.id.slice(0, 6).toUpperCase()}`;
}

export interface AllDayLine {
  name: string;
  quantity: number;
}

/**
 * The all-day count: every item still to make across the given tickets,
 * totalled by name and largest first — "6 flat white" at a glance, so a batch
 * can be started before the tickets are read one by one.
 */
export function allDay(tickets: Array<{ items?: Array<{ name: string; quantity: number }> }>): AllDayLine[] {
  const totals = new Map<string, number>();
  for (const ticket of tickets) {
    for (const item of ticket.items ?? []) totals.set(item.name, (totals.get(item.name) ?? 0) + item.quantity);
  }
  return [...totals].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}
