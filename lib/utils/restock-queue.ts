// ---------------------------------------------------------------------------
// The restock queue's ordering and the context a decision needs. Pure, so the
// rule "urgent first, then whoever has waited longest" is tested, not assumed.
// ---------------------------------------------------------------------------

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

const localKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** "Today", "Yesterday", or the date — for grouping any dated list by local day. */
export function dayLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  const key = localKey(at);
  if (key === localKey(now)) return 'Today';
  if (key === localKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Yesterday';
  return at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
