import { apiFetch } from './client';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'done' | 'cancelled';
export type OrderSource = 'pos' | 'mobile';

export interface OrderItemModifier {
  modifierId: string;
  name: string;
  priceAdjust: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  modifiers?: OrderItemModifier[];
}

export interface StatusHistoryEntry {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedBy: string;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  tenantId?: string;
  locationId: string;
  customerId?: string;
  createdBy: string;
  status: OrderStatus;
  source: OrderSource;
  totalAmount: string;
  paymentMethod: 'cash' | 'card';
  notes?: string;
  items: OrderItem[];
  discountAmount?: string;
  statusHistory?: StatusHistoryEntry[];
  createdAt: string;
  updatedAt?: string;
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
  locationId?: string;
  status?: OrderStatus;
  source?: OrderSource;
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

// Explicit stock to deduct from the location for this order (optional). There is
// no recipe model — only what you list here is deducted.
export interface CreateOrderStockDeduction {
  stockItemId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  locationId: string;
  customerId?: string;
  source: 'pos' | 'mobile';
  paymentMethod?: string;
  notes?: string;
  items: CreateOrderItem[];
  stockDeductions?: CreateOrderStockDeduction[];
}

export const getOrder = (id: string) => apiFetch<OrderDetail>(`/orders/${id}`);

// 10s timeout: with a dead café connection the proxied request would otherwise
// hang for minutes — the POS treats the abort as "offline" and queues the order.
export const createOrder = (data: CreateOrderPayload) =>
  apiFetch<Order>('/orders', { method: 'POST', body: JSON.stringify(data), timeoutMs: 10_000 });

export const updateOrderStatus = (id: string, status: OrderStatus) =>
  apiFetch<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const getOrders = (params: OrdersParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.customerId) qs.set('customerId', params.customerId);
  if (params.locationId) qs.set('locationId', params.locationId);
  if (params.status) qs.set('status', params.status);
  if (params.source) qs.set('source', params.source);
  const q = qs.toString();
  return apiFetch<OrdersResponse>(`/orders${q ? `?${q}` : ''}`);
};
