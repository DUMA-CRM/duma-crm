import { apiFetch } from './client';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'done' | 'cancelled' | 'expired';
/**
 * `web`: placed by the business's own website through a storefront API key.
 * `manual`: taken by staff in the CRM (phone, email, wholesale) — may be paid later.
 */
export type OrderSource = 'pos' | 'mobile' | 'qr_code' | 'web' | 'manual';

/** How a payment taken outside DUMA was made, for an order taken by hand. */
export type RecordedPaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'custom';

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
  variantId?: string | null;
  variantName?: string | null;
  variantSku?: string | null;
  name: string;
  quantity: number;
  unitPrice: string;
  listPrice?: string | null;
  subtotal: string;
  notes?: string;
  refundStatus?: RefundStatus;
  allergens?: string[];
  allergenCoverage?: 'complete' | 'missing_recipe';
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
  status: 'recorded' | 'succeeded' | 'failed';
  processingMode: 'internal_placeholder' | 'internal' | 'stripe' | 'cash_manual';
  providerRefundId?: string | null;
  paymentMethod?: string | null;
  createdBy: string | null;
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
  restockedQuantity?: number;
  restockedStockUnitId?: string | null;
  restockedAt?: string | null;
}

export interface RefundOptions {
  orderId: string;
  orderTotal: string;
  refundStatus: RefundStatus;
  items: Array<{
    id: string;
    name: string;
    variantName?: string | null;
    variantSku?: string | null;
    canRestock?: boolean;
    quantity: number;
    refundStatus: RefundStatus;
    base: { remainingQuantity: number; remainingAmount: string; unitAmounts: string[] };
    modifiers: Array<{
      id: string;
      name: string;
      refundStatus: RefundStatus;
      remainingQuantity: number;
      remainingAmount: string;
      unitAmounts: string[];
    }>;
  }>;
}

export interface OrderDetail extends StorefrontOrderFields {
  id: string;
  tenantId?: string;
  locationId: string;
  customerId?: string;
  createdBy: string | null;
  status: OrderStatus;
  refundStatus?: RefundStatus;
  source: OrderSource;
  totalAmount: string;
  paymentMethod: string | null;
  paymentStatus?:
    | 'unpaid'
    | 'processing'
    | 'awaiting_payment'
    | 'awaiting_cash_approval'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'expired'
    | 'refunded';
  customerName?: string | null;
  collectionTime?: string | null;
  kitchenReleaseAt?: string | null;
  expiresAt?: string | null;
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

export interface Order extends StorefrontOrderFields {
  id: string;
  tenantId: string;
  locationId: string;
  customerId?: string;
  status: OrderStatus;
  /** `orders.refund_status` — the list returns whole rows, so this is present there too. */
  refundStatus?: RefundStatus;
  paymentStatus?:
    | 'unpaid'
    | 'processing'
    | 'awaiting_payment'
    | 'awaiting_cash_approval'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'expired'
    | 'refunded';
  paymentMethod?: string | null;
  customerName?: string | null;
  collectionTime?: string | null;
  kitchenReleaseAt?: string | null;
  expiresAt?: string | null;
  source: OrderSource;
  totalAmount: number;
  notes?: string;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
  inventoryWarnings?: InventoryWarning[];
}

/** What an order placed by the business's own website (source `web`) also carries. */
export interface StorefrontOrderFields {
  fulfilmentType?: 'collection' | 'delivery' | 'shipping' | null;
  shippingAddress?: OrderShippingAddress | null;
  deliveryMethod?: string | null;
  deliveryFee?: string | null;
  /** The website's own order number. */
  externalReference?: string | null;
  /** Who took the payment on the website, and their reference for it. */
  paymentProvider?: string | null;
  paymentReference?: string | null;
  customerEmail?: string | null;
}

/** The address a storefront order was sent to, as it was at the time. */
export interface OrderShippingAddress {
  recipientName: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postcode: string;
  country: string;
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
  paymentStatus?:
    | 'unpaid'
    | 'processing'
    | 'awaiting_payment'
    | 'awaiting_cash_approval'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'expired'
    | 'refunded';
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
  variantId?: string;
  discountCode?: string;
  quantity: number;
  notes?: string;
  modifiers?: CreateOrderModifier[];
}

export interface CreateOrderPayload {
  locationId: string;
  customerId?: string;
  source: 'pos' | 'mobile' | 'manual';
  paymentMethod?: string;
  /** manual only: already paid outside DUMA by `paymentMethod`. Omit for "pay later". */
  paid?: boolean;
  notes?: string;
  loyaltyRedemptions?: Array<{
    programId: string;
    itemIndex: number;
    modifierId?: string;
    quantity: number;
  }>;
  /** A promotions-module code for the whole order. The API checks it again, under lock, and prices it. */
  promoCode?: string;
  items: CreateOrderItem[];
}

export const getOrder = (id: string) => apiFetch<OrderDetail>(`/orders/${id}`);

// 10s timeout: with a dead café connection the proxied request would otherwise
// hang for minutes — the POS treats the abort as "offline" and queues the order.
export const createOrder = (data: CreateOrderPayload, idempotencyKey?: string) =>
  apiFetch<{ order: Order }>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
    timeoutMs: 10_000,
    ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
  }).then((response) => response.order);

export const updateOrderStatus = (id: string, status: OrderStatus, voidDetails?: { voidReason: VoidReason; voidNotes?: string }) =>
  apiFetch<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...voidDetails }) });

export const getRefundOptions = (id: string) => apiFetch<RefundOptions>(`/orders/${id}/refund-options`);

export const createRefund = (
  id: string,
  data: {
    lines: Array<{ orderItemId: string; orderItemModifierId?: string; quantity: number; restock?: boolean }>;
    reason: RefundReason;
    notes?: string;
  },
) => apiFetch<OrderRefund>(`/orders/${id}/refunds`, { method: 'POST', body: JSON.stringify(data) });

export const approveCashOrder = (id: string) => apiFetch<Order>(`/orders/${id}/approve-cash`, { method: 'POST' });

/**
 * Who an order taken by hand is for, and how it reaches them. `customerId: null`
 * takes the customer off; a delivery address is also saved to the customer.
 */
export const updateOrderDetails = (
  id: string,
  data: { customerId?: string | null; fulfilment?: { type: 'collection' | 'delivery'; address?: OrderShippingAddress | null } },
) => apiFetch<Order>(`/orders/${id}/details`, { method: 'POST', body: JSON.stringify(data) });

/** Add, change or clear an order's note — any order, any status. An empty note clears it. */
export const updateOrderNotes = (id: string, notes: string) =>
  apiFetch<Order>(`/orders/${id}/notes`, { method: 'POST', body: JSON.stringify({ notes }) });

/** Record that an unpaid order taken by hand has now been paid, and how. Nothing is charged. */
export const markOrderPaid = (id: string, paymentMethod: RecordedPaymentMethod) =>
  apiFetch<Order>(`/orders/${id}/mark-paid`, { method: 'POST', body: JSON.stringify({ paymentMethod }) });

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
  if (params.paymentStatus) qs.set('paymentStatus', params.paymentStatus);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const q = qs.toString();
  return apiFetch<OrdersResponse>(`/orders${q ? `?${q}` : ''}`);
};
