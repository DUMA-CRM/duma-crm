// ---------------------------------------------------------------------------
// The restock queue's ordering and the context a decision needs. Pure, so the
// rule "urgent first, then whoever has waited longest" is tested, not assumed.
// ---------------------------------------------------------------------------
import { formatInstant, zonedParts } from './workspace-time.ts';

export type RestockPriority = 'standard' | 'urgent';

/**
 * The review order for pending requests: urgent before standard, then the
 * longest-waiting first — a queue, not a feed. Other statuses read newest
 * first, as history does.
 */
export function orderRequests<T extends { createdAt: string; status: string }>(requests: T[], priorityOf: (request: T) => RestockPriority): T[] {
  return [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status === 'pending') {
      const urgency = Number(priorityOf(b) === 'urgent') - Number(priorityOf(a) === 'urgent');
      return urgency || a.createdAt.localeCompare(b.createdAt);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export interface StockContext {
  qty: number;
  threshold: number;
  unit: string;
  coverDays: number | null;
}

/**
 * One line of context for approving a request: what's on the shelf, against
 * par, and how long it lasts — and whether the request would take it past
 * twice par, which is usually a typo rather than a plan.
 */
export function requestContext(requestedQty: number, stock: StockContext | undefined): { text: string; tone: 'low' | 'ok' | 'over' } | null {
  if (!stock) return null;
  const qty = Number.isInteger(stock.qty) ? String(stock.qty) : stock.qty.toFixed(1);
  const parts = [`${qty} ${stock.unit} on hand`];
  if (stock.threshold > 0) parts.push(`par ${stock.threshold}`);
  if (stock.coverDays !== null) parts.push(stock.coverDays < 1 ? 'runs out today' : `${Math.round(stock.coverDays)} ${Math.round(stock.coverDays) === 1 ? 'day' : 'days'} left`);
  const low = stock.qty <= stock.threshold || (stock.coverDays !== null && stock.coverDays <= 3);
  const over = stock.threshold > 0 && stock.qty + requestedQty > stock.threshold * 4;
  if (over) parts.push('would leave over 4× par');
  return { text: parts.join(' · '), tone: over ? 'over' : low ? 'low' : 'ok' };
}

/** The calendar day before a `YYYY-MM-DD` key. */
const dayBefore = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

/** "Today", "Yesterday", or the date — for grouping any dated list by workspace day. */
export function dayLabel(iso: string, now: Date): string {
  const at = zonedParts(iso);
  const today = zonedParts(now);
  if (at.date === today.date) return 'Today';
  if (at.date === dayBefore(today.date)) return 'Yesterday';
  return formatInstant(iso, { weekday: 'long', day: 'numeric', month: 'long', ...(at.year !== today.year ? { year: 'numeric' } : {}) });
}
