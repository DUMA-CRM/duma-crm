/**
 * The live order queue as numbers: the sidebar badge's count request and the
 * sum it shows. Pure, so the query building and the tolerant sum are tested.
 */

export const ACTIVE_ORDER_STATUSES = ['pending', 'preparing', 'ready'] as const;
export type ActiveOrderStatus = (typeof ACTIVE_ORDER_STATUSES)[number];

export type OrderStatusCounts = Partial<Record<string, number>>;

/** `GET /orders/status-counts` query: `statuses=pending,preparing,ready&paymentStatus=paid&locationId=…`. */
export function statusCountsQuery(params: { statuses: readonly string[]; paymentStatus?: string; locationId?: string | null }): string {
  const qs = new URLSearchParams();
  const statuses = [...new Set(params.statuses.map((status) => status.trim()).filter(Boolean))];
  if (statuses.length) qs.set('statuses', statuses.join(','));
  if (params.paymentStatus) qs.set('paymentStatus', params.paymentStatus);
  if (params.locationId) qs.set('locationId', params.locationId);
  return qs.toString();
}

/** The badge: every active status summed. A missing or malformed count adds nothing rather than NaN. */
export function activeOrderCount(counts: OrderStatusCounts | null | undefined, statuses: readonly string[] = ACTIVE_ORDER_STATUSES): number {
  if (!counts) return 0;
  return statuses.reduce((total, status) => {
    const value = counts[status];
    return total + (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
  }, 0);
}
