import { apiFetch } from './client';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'done' | 'cancelled';
export type OrderSource = 'pos' | 'mobile';

export interface OrderItemModifier {
  id: string;
  modifierId: string;
  name: string;
  priceAdjust: string;
  refundStatus?: RefundStatus;
}

export type RefundStatus = 'none' | 'partially_refunded' | 'refunded';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  notes?: string;
  refundStatus?: RefundStatus;
  modifiers?: OrderItemModifier[];
}

export interface StatusHistoryEntry {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedBy: string;
  createdAt: string;
}

export type VoidReason = 'customer_request' | 'duplicate' | 'payment_failed' | 'item_unavailable' | 'staff_error' | 'other';
export type RefundReason = 'customer_request' | 'item_issue' | 'service_issue' | 'duplicate_charge' | 'pricing_error' | 'other';

export interface OrderRefund {
  id: string;
  orderId: string;
  amount: string;
  kind: 'full' | 'partial';
  reason: RefundReason;
  notes?: string | null;
  status: 'recorded';
  processingMode: 'internal_placeholder';
  paymentMethod?: string | null;
  createdBy: string;
  createdAt: string;
  lines?: OrderRefundLine[];
}

export interface OrderRefundLine {
  id: string;
  orderItemId: string;
  orderItemModifierId?: string | null;
  componentType: 'item' | 'modifier';
  name: string;
  quantity: number;
  amount: string;
}

export interface RefundOptions {
  orderId: string;
  orderTotal: string;
  refundStatus: RefundStatus;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    refundStatus: RefundStatus;
    base: { remainingQuantity: number; remainingAmount: string; unitAmounts: string[] };
    modifiers: Array<{ id: string; name: string; refundStatus: RefundStatus; remainingQuantity: number; remainingAmount: string; unitAmounts: string[] }>;
  }>;
}

export interface OrderDetail {
  id: string;
  tenantId?: string;
  locationId: string;
  customerId?: string;
  createdBy: string;
  status: OrderStatus;
  refundStatus?: RefundStatus;
  source: OrderSource;
  totalAmount: string;
  paymentMethod: 'cash' | 'card';
  notes?: string;
  items: OrderItem[];
  discountAmount?: string;
  voidReason?: VoidReason | null;
  voidNotes?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  refunds?: OrderRefund[];
  statusHistory?: StatusHistoryEntry[];
  createdAt: string;
  updatedAt?: string;
  inventoryWarnings?: InventoryWarning[];
}

export interface InventoryWarning {
  stockItemId: string;
  name: string;
  unit: string;
  requiredQuantity: number;
  consumedQuantity: number;
  shortfallQuantity: number;
}

export interface Order {
  id: string;
  tenantId: string;
  locationId: string;
  customerId?: string;
  status: OrderStatus;
  source: OrderSource;
  totalAmount: number;
  notes?: string;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
  inventoryWarnings?: InventoryWarning[];
}

export interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface OrdersParams {
  page?: number;
  limit?: number;
  customerId?: string;
  customerPhone?: string;
  locationId?: string;
  status?: OrderStatus;
  source?: OrderSource;
  createdBy?: string;
  paymentMethod?: 'cash' | 'card';
  from?: string;
  to?: string;
}

// Order creation sends IDs only. Item names, unit prices and the order total are
// computed server-side from the catalogue; loyalty is applied server-side too.
export interface CreateOrderModifier {
  modifierId: string;
}

export interface CreateOrderItem {
  menuItemId: string;
  quantity: number;
  notes?: string;
  modifiers?: CreateOrderModifier[];
}

export interface CreateOrderPayload {
  locationId: string;
  customerId?: string;
  source: 'pos' | 'mobile';
  paymentMethod?: string;
  notes?: string;
  items: CreateOrderItem[];
}

export const getOrder = (id: string) => apiFetch<OrderDetail>(`/orders/${id}`);

// 10s timeout: with a dead café connection the proxied request would otherwise
// hang for minutes — the POS treats the abort as "offline" and queues the order.
export const createOrder = (data: CreateOrderPayload, idempotencyKey?: string) =>
  apiFetch<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
    timeoutMs: 10_000,
    ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
  });

export const updateOrderStatus = (id: string, status: OrderStatus, voidDetails?: { voidReason: VoidReason; voidNotes?: string }) =>
  apiFetch<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...voidDetails }) });

export const getRefundOptions = (id: string) => apiFetch<RefundOptions>(`/orders/${id}/refund-options`);

export const createRefund = (id: string, data: { lines: Array<{ orderItemId: string; orderItemModifierId?: string; quantity: number }>; reason: RefundReason; notes?: string }) =>
  apiFetch<OrderRefund>(`/orders/${id}/refunds`, { method: 'POST', body: JSON.stringify(data) });

export const getOrders = (params: OrdersParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.customerId) qs.set('customerId', params.customerId);
  if (params.customerPhone) qs.set('customerPhone', params.customerPhone);
  if (params.locationId) qs.set('locationId', params.locationId);
  if (params.status) qs.set('status', params.status);
  if (params.source) qs.set('source', params.source);
  if (params.createdBy) qs.set('createdBy', params.createdBy);
  if (params.paymentMethod) qs.set('paymentMethod', params.paymentMethod);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const q = qs.toString();
  return apiFetch<OrdersResponse>(`/orders${q ? `?${q}` : ''}`);
};
