// ---------------------------------------------------------------------------
// The arithmetic behind the dashboard's module cards — one card per module, so
// any combination of modules makes a dashboard. Pure, so the counts a manager
// acts on are tested without a browser.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** One row of `/inventory/overview`, as much of it as the card reads. */
export interface StockOverviewLike {
  totalOnHand: string;
  needsReorder: boolean;
  reorderLevel: string;
  earliestExpiryDate: string | null;
  stockValue?: string;
  unvaluedQuantity?: string;
}

export interface StockHealth {
  /** Items stocked here. */
  items: number;
  /** Nothing usable left. */
  out: number;
  /** At or under par, but not out. */
  low: number;
  /** Something expires within the week. */
  expiring: number;
  /** Shelf value, each container at its own cost. */
  value: number;
  /** Items whose stock has no cost at all, left out of `value`. */
  unvalued: number;
}

export function stockHealthSummary(rows: readonly StockOverviewLike[], now: Date): StockHealth {
  const weekAhead = now.getTime() + 7 * DAY_MS;
  let out = 0;
  let low = 0;
  let expiring = 0;
  let value = 0;
  let unvalued = 0;
  for (const row of rows) {
    const onHand = Number(row.totalOnHand) || 0;
    if (onHand <= 0) out += 1;
    // needsReorder is "at or under par" from the API — but a par of 0 is "none set", not "low".
    else if (row.needsReorder && Number(row.reorderLevel) > 0) low += 1;
    if (row.earliestExpiryDate && new Date(row.earliestExpiryDate).getTime() <= weekAhead) expiring += 1;
    value += Number(row.stockValue ?? 0) || 0;
    if (onHand > 0 && Number(row.unvaluedQuantity ?? 0) > 0) unvalued += 1;
  }
  return { items: rows.length, out, low, expiring, value: Math.round(value * 100) / 100, unvalued };
}

export interface TeamToday {
  /** Clocked in now. */
  onShift: number;
  /** Rostered at any point today. */
  rostered: number;
  /** Rostered to have started (past a grace window) but not clocked in. */
  missing: number;
  /** Hours worked so far today by those clocked in now. */
  hoursSoFar: number;
}

/**
 * Who's in today, from the rota and the clock. "Missing" is a rostered shift
 * that started more than `graceMinutes` ago with nobody clocked in against it
 * — the same reading as the attendance rule, kept deliberately simple here.
 */
export function teamTodaySummary(input: {
  rota: ReadonlyArray<{ id: string; userId?: string | null; startsAt: string; endsAt: string }>;
  active: ReadonlyArray<{ userId: string; clockedIn: string; scheduledShiftId?: string | null }>;
  now: Date;
  graceMinutes?: number;
}): TeamToday {
  const grace = (input.graceMinutes ?? 10) * 60_000;
  const now = input.now.getTime();
  const onShiftUsers = new Set(input.active.map((shift) => shift.userId));
  const coveredShifts = new Set(input.active.map((shift) => shift.scheduledShiftId).filter(Boolean));
  // An open shift nobody was given isn't someone missing — it's unfilled, and the rota shows it.
  const assigned = input.rota.filter((shift) => !!shift.userId);
  const missing = assigned.filter(
    (shift) =>
      new Date(shift.startsAt).getTime() + grace <= now &&
      new Date(shift.endsAt).getTime() > now &&
      !coveredShifts.has(shift.id) &&
      !onShiftUsers.has(shift.userId!),
  ).length;
  const minutes = input.active.reduce((sum, shift) => sum + Math.max(0, now - new Date(shift.clockedIn).getTime()) / 60_000, 0);
  return {
    onShift: onShiftUsers.size,
    rostered: new Set(assigned.map((shift) => shift.userId)).size,
    missing,
    hoursSoFar: Math.round((minutes / 60) * 10) / 10,
  };
}

/** Payment methods ranked by takings, with each one's share — for a "how people paid" list. */
export function tenderShares<T extends { method: string; revenue: number }>(rows: readonly T[]): Array<T & { share: number }> {
  const positive = rows.filter((row) => row.revenue > 0);
  const total = positive.reduce((sum, row) => sum + row.revenue, 0);
  return [...positive].sort((a, b) => b.revenue - a.revenue).map((row) => ({ ...row, share: total > 0 ? row.revenue / total : 0 }));
}

/** "card" → "Card", "bank_transfer" → "Bank transfer": a tender as a person reads it. */
export const tenderLabel = (method: string) => {
  const words = method.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : 'Other';
};

/**
 * Tenders as the segments of one bar: the biggest few by name, the rest as
 * "Other", so a card shows four colours at most and every one is labelled.
 */
export function tenderSegments<T extends { method: string; revenue: number }>(
  rows: readonly T[],
  named = 3,
): Array<{ key: string; label: string; revenue: number; share: number; orders: number }> {
  const shares = tenderShares(rows);
  const head = shares.slice(0, shares.length > named + 1 ? named : named + 1);
  const rest = shares.slice(head.length);
  const orders = (row: T) => Number((row as { orders?: number }).orders ?? 0);
  const segments = head.map((row) => ({
    key: row.method,
    label: tenderLabel(row.method),
    revenue: row.revenue,
    share: row.share,
    orders: orders(row),
  }));
  if (rest.length > 0) {
    segments.push({
      key: 'other',
      label: 'Other',
      revenue: rest.reduce((sum, row) => sum + row.revenue, 0),
      share: rest.reduce((sum, row) => sum + row.share, 0),
      orders: rest.reduce((sum, row) => sum + orders(row), 0),
    });
  }
  return segments;
}
