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

export interface OrderDetail {
  id: string;
  tenantId?: string;
  locationId: string;
  customerId?: string;
  status: OrderStatus;
  source: OrderSource;
  totalAmount: string;
  paymentMethod: 'cash' | 'card';
  notes?: string;
  items: OrderItem[];
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

export interface CreateOrderModifier {
  modifierId: string;
  name: string;
  priceAdjust: string;
}

export interface CreateOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  modifiers?: CreateOrderModifier[];
}

export interface CreateOrderPayload {
  locationId: string;
  customerId?: string;
  source: 'pos' | 'mobile';
  totalAmount: string;
  paymentMethod: 'cash' | 'card';
  notes?: string;
  items: CreateOrderItem[];
}

export const getOrder = (id: string) => apiFetch<OrderDetail>(`/orders/${id}`);

export const createOrder = (data: CreateOrderPayload) => apiFetch<Order>('/orders', { method: 'POST', body: JSON.stringify(data) });

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
