// ---------------------------------------------------------------------------
// Purchase-order arithmetic: when a delivery is due and whether it's late,
// what an order comes to, and how much of it has arrived. Pure and tested.
// ---------------------------------------------------------------------------

import { formatCalendarDate, workspaceDateKey } from './workspace-time.ts';

/**
 * Whole days from the workspace's today to a calendar `YYYY-MM-DD`. The expected
 * date is a calendar day, not an instant — only "today" depends on the zone.
 */
const daysFromToday = (date: string, now: Date) =>
  Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${workspaceDateKey(now)}T00:00:00Z`)) / 86_400_000);

const OPEN = new Set(['submitted', 'partially_received']);

/** Waiting on a delivery whose expected day has passed. */
export function isOverdue(po: { status: string; expectedAt?: string | null }, now: Date): boolean {
  if (!po.expectedAt || !OPEN.has(po.status)) return false;
  return daysFromToday(po.expectedAt, now) < 0;
}

/**
 * When the delivery is due, the way a manager says it: "Due today", "Due
 * tomorrow", "Due Mon 29 Sept", or "2 days late". Null when no date was set
 * or the order isn't waiting on a delivery.
 */
export function dueLabel(po: { status: string; expectedAt?: string | null }, now: Date): string | null {
  if (!po.expectedAt || !OPEN.has(po.status)) return null;
  const days = daysFromToday(po.expectedAt, now);
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} late`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${formatCalendarDate(po.expectedAt, { weekday: 'short', day: 'numeric', month: 'short' })}`;
}

interface LineLike {
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
}

const lineCents = (quantity: string | number, unitCost: string | number) => Math.round((Number(quantity) || 0) * (Number(unitCost) || 0) * 100);

/** One line's value — quantity × unit cost, to the penny. */
export const lineValue = (quantity: string | number, unitCost: string | number): number => lineCents(quantity, unitCost) / 100;

/** The order's value, summed in cents so a long order has no float artefacts. */
export function orderTotal(lines: Pick<LineLike, 'quantityOrdered' | 'unitCost'>[] = []): number {
  return lines.reduce((cents, line) => cents + lineCents(line.quantityOrdered, line.unitCost), 0) / 100;
}

/** A line being typed into the new-order form. */
export interface DraftOrderLine {
  stockItemId: string;
  quantity: string;
  unitCost: string;
}

/**
 * The lines the form would send: an item chosen, a quantity above zero and a
 * cost of zero or more. A blank cost reads as zero, as it always has.
 */
export const sendableLines = <L extends DraftOrderLine>(lines: L[]): L[] =>
  lines.filter((line) => line.stockItemId && Number(line.quantity) > 0 && Number(line.unitCost) >= 0);

/** The new order's total, from the lines it would send. */
export const draftOrderTotal = (lines: DraftOrderLine[]): number =>
  orderTotal(sendableLines(lines).map((line) => ({ quantityOrdered: line.quantity, unitCost: line.unitCost })));

/**
 * What is still to arrive on a line; never negative (an over-delivery is
 * complete, not owed back). In thousandths, so 2.3 ordered less 1.1 received
 * pre-fills the receive box with 1.2, not 1.1999999999999997.
 */
export const outstandingQuantity = (line: Pick<LineLike, 'quantityOrdered' | 'quantityReceived'>): number =>
  Math.max(0, Math.round((Number(line.quantityOrdered) || 0) * 1000) - Math.round((Number(line.quantityReceived) || 0) * 1000)) / 1000;

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

/** `receivedShare` for a list row, from the API's per-order summary (already capped per line). */
export function summaryReceivedShare(summary: { quantityOrdered: string; quantityReceived: string } | undefined): number | null {
  if (!summary) return null;
  const ordered = Number(summary.quantityOrdered) || 0;
  if (ordered <= 0) return null;
  return Math.min(1, Math.max(0, (Number(summary.quantityReceived) || 0) / ordered));
}

/** Whether an invoice amount agrees with the order total, to the penny. */
export function invoiceDifference(invoiceAmount: string | number | null | undefined, total: number): number | null {
  if (invoiceAmount === null || invoiceAmount === undefined || invoiceAmount === '') return null;
  return Math.round((Number(invoiceAmount) - total) * 100) / 100;
}
