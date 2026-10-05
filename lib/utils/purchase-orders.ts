// ---------------------------------------------------------------------------
// Purchase-order arithmetic: when a delivery is due and whether it's late,
// what an order comes to, and how much of it has arrived. Pure and tested.
// ---------------------------------------------------------------------------

const localKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const OPEN = new Set(['submitted', 'partially_received']);

/** Waiting on a delivery whose expected day has passed. */
export function isOverdue(po: { status: string; expectedAt?: string | null }, now: Date): boolean {
  if (!po.expectedAt || !OPEN.has(po.status)) return false;
  return new Date(`${po.expectedAt.slice(0, 10)}T00:00:00`) < startOfDay(now);
}

/**
 * When the delivery is due, the way a manager says it: "Due today", "Due
 * tomorrow", "Due Mon 29 Sept", or "2 days late". Null when no date was set
 * or the order isn't waiting on a delivery.
 */
export function dueLabel(po: { status: string; expectedAt?: string | null }, now: Date): string | null {
  if (!po.expectedAt || !OPEN.has(po.status)) return null;
  const due = new Date(`${po.expectedAt.slice(0, 10)}T00:00:00`);
  const days = Math.round((due.getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} late`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${due.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
}

interface LineLike {
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
}

/** The order's value, summed in cents so a long order has no float artefacts. */
export function orderTotal(lines: LineLike[] = []): number {
  return lines.reduce((cents, line) => cents + Math.round((Number(line.quantityOrdered) || 0) * (Number(line.unitCost) || 0) * 100), 0) / 100;
}

/** How much of the order has arrived, 0–1, by quantity across lines (capped per line). */
export function receivedShare(lines: LineLike[] = []): number {
  let ordered = 0;
  let received = 0;
  for (const line of lines) {
    const o = Number(line.quantityOrdered) || 0;
    ordered += o;
    received += Math.min(o, Number(line.quantityReceived) || 0);
  }
  return ordered > 0 ? received / ordered : 0;
}

/** Whether an invoice amount agrees with the order total, to the penny. */
export function invoiceDifference(invoiceAmount: string | number | null | undefined, total: number): number | null {
  if (invoiceAmount === null || invoiceAmount === undefined || invoiceAmount === '') return null;
  return Math.round((Number(invoiceAmount) - total) * 100) / 100;
}

export const dayKey = (iso: string) => localKey(new Date(iso));
