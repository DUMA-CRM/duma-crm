// ---------------------------------------------------------------------------
// An item's stock ledger read as sentences: what each movement was, which way
// it went, and the views and day groups the Ledger tab slices it by. Pure.
// ---------------------------------------------------------------------------

import { dayLabel } from './restock-queue.ts';

export type LedgerTone = 'in' | 'out' | 'waste' | 'adjust' | 'transfer';
export type LedgerView = 'all' | 'in' | 'out' | 'receive' | 'consume' | 'waste' | 'adjust' | 'transfer';

export interface MovementLike {
  type: string;
  quantity: number | string;
  reason?: string | null;
  sourceType?: string | null;
  createdAt: string;
}

const WASTE_REASON: Record<string, string> = {
  EXPIRED: 'expired',
  SPILL: 'spilt',
  DAMAGED: 'damaged',
  QUALITY: 'quality',
  OTHER: 'other',
};

const SOURCE: Record<string, string> = {
  POS_ORDER: 'Order',
  PURCHASE_ORDER: 'Purchase order',
  GOODS_RECEIPT: 'Delivery',
  STOCKTAKE: 'Stocktake',
  TRANSFER: 'Transfer',
  MANUAL: 'Manual',
  SYSTEM: 'System',
  CUSTOMER_RETURN: 'Customer return',
};

export const sourceLabel = (sourceType?: string | null) => (sourceType ? (SOURCE[sourceType] ?? null) : null);

/** A movement as a manager says it — "Received", "Used in an order", "Wasted · expired". */
export function movementTitle(m: MovementLike): { title: string; tone: LedgerTone } {
  const q = Number(m.quantity);
  switch (m.type) {
    case 'receive':
      return { title: m.sourceType === 'CUSTOMER_RETURN' ? 'Returned by a customer' : 'Received', tone: 'in' };
    case 'consume':
      return { title: m.sourceType === 'POS_ORDER' ? 'Used in an order' : 'Used', tone: 'out' };
    case 'waste': {
      const why = m.reason ? WASTE_REASON[m.reason] : undefined;
      return { title: why ? `Wasted · ${why}` : 'Wasted', tone: 'waste' };
    }
    case 'adjust':
      return { title: m.sourceType === 'STOCKTAKE' ? 'Stocktake correction' : q >= 0 ? 'Adjusted up' : 'Adjusted down', tone: 'adjust' };
    case 'transfer':
      return { title: q >= 0 ? 'Transferred in' : 'Transferred out', tone: 'transfer' };
    default:
      return { title: m.type ? m.type[0]!.toUpperCase() + m.type.slice(1) : 'Movement', tone: q >= 0 ? 'in' : 'out' };
  }
}

export function inLedgerView(view: LedgerView, m: MovementLike): boolean {
  if (view === 'all') return true;
  if (view === 'in') return Number(m.quantity) > 0;
  if (view === 'out') return Number(m.quantity) < 0;
  return m.type === view;
}

const localKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Movements under day headings, newest first, keeping the order they came in. */
export function groupByDay<T extends { createdAt: string }>(movements: T[], now: Date): { key: string; label: string; items: T[] }[] {
  const days: { key: string; label: string; items: T[] }[] = [];
  for (const m of movements) {
    const key = localKey(new Date(m.createdAt));
    const last = days.at(-1);
    if (last?.key === key) last.items.push(m);
    else days.push({ key, label: dayLabel(m.createdAt, now), items: [m] });
  }
  return days;
}

/** Net change across a set of movements, to the thousandth. */
export const netChange = (movements: MovementLike[]) => movements.reduce((sum, m) => sum + Math.round(Number(m.quantity) * 1000), 0) / 1000;
