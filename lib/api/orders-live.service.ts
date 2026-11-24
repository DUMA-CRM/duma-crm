// The live order queue: what the kitchen board and the sidebar badge poll.
// Kept apart from orders.service.ts so the two polling screens' requests live
// together (contracts 3 and 4 of the 2026-11 audit).
import { type ActiveOrderStatus, type OrderStatusCounts, statusCountsQuery } from '@/lib/utils/live-orders';

import { apiFetch } from './client';
import { type OrdersParams, type OrdersResponse, orderFilterQuery } from './orders.service';

/**
 * `GET /orders?include=items` — each row carries `items` in the same shape as
 * `GET /orders/:id`, so a board of 30 tickets is one request, not 31. An API
 * without the include returns rows without `items`; callers fall back to the
 * detail request for those.
 */
export const getOrdersWithItems = (params: OrdersParams = {}) => {
  const qs = orderFilterQuery(params);
  qs.set('include', 'items');
  return apiFetch<OrdersResponse>(`/orders?${qs.toString()}`);
};

/** `GET /orders/status-counts` — counts only, for a badge (`orders:read`, location-scoped like the list). */
export const getOrderStatusCounts = (params: {
  statuses: readonly ActiveOrderStatus[];
  paymentStatus?: OrdersParams['paymentStatus'];
  locationId?: string | null;
}) => apiFetch<OrderStatusCounts>(`/orders/status-counts?${statusCountsQuery(params)}`);
