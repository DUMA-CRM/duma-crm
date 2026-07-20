import { apiFetch } from './client';

// Suppliers & purchase orders. Money/quantity fields are decimal strings.

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayload {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
}

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  stockItemId: string;
  quantityOrdered: string;
  unitCost: string;
  quantityReceived: string;
  stockItem?: { id: string; name: string; unit: string };
}

export interface GoodsReceipt {
  id: string;
  purchaseOrderId: string;
  notes?: string | null;
  createdAt: string;
  receivedByUser?: { id: string; name: string };
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  locationId: string;
  status: PurchaseOrderStatus;
  reference: string;
  expectedAt?: string | null;
  invoiceNumber?: string | null;
  invoiceAmount?: string | null;
  invoiceMatched: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: string; name: string };
  location?: { id: string; name: string };
  lines?: PurchaseOrderLine[];
  receipts?: GoodsReceipt[];
}

export interface PurchaseOrdersResponse {
  data: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CreatePurchaseOrderPayload {
  supplierId: string;
  locationId: string;
  expectedAt?: string;
  notes?: string;
  lines: { stockItemId: string; quantityOrdered: number; unitCost: number }[];
}

export interface UpdatePurchaseOrderPayload {
  status?: 'submitted' | 'cancelled';
  expectedAt?: string | null;
  notes?: string;
  invoiceNumber?: string | null;
  invoiceAmount?: number | null;
  invoiceMatched?: boolean;
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

export const getSuppliers = (includeInactive = false) =>
  apiFetch<Supplier[]>(`/suppliers${includeInactive ? '?includeInactive=true' : ''}`);

export const createSupplier = (data: SupplierPayload) =>
  apiFetch<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) });

export const updateSupplier = (id: string, data: Partial<SupplierPayload>) =>
  apiFetch<Supplier>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deactivateSupplier = (id: string) => apiFetch<{ success: boolean }>(`/suppliers/${id}`, { method: 'DELETE' });

// ── Purchase orders ───────────────────────────────────────────────────────────

export const getPurchaseOrders = (
  params: { locationId?: string; supplierId?: string; status?: PurchaseOrderStatus; page?: number; limit?: number } = {},
) => {
  const q = new URLSearchParams();
  if (params.locationId) q.set('locationId', params.locationId);
  if (params.supplierId) q.set('supplierId', params.supplierId);
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<PurchaseOrdersResponse>(`/purchase-orders${qs ? `?${qs}` : ''}`);
};

export const getPurchaseOrder = (id: string) => apiFetch<PurchaseOrder>(`/purchase-orders/${id}`);

export const createPurchaseOrder = (data: CreatePurchaseOrderPayload) =>
  apiFetch<PurchaseOrder>('/purchase-orders', { method: 'POST', body: JSON.stringify(data) });

export const updatePurchaseOrder = (id: string, data: UpdatePurchaseOrderPayload) =>
  apiFetch<PurchaseOrder>(`/purchase-orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const receivePurchaseOrder = (id: string, data: { notes?: string; lines: { purchaseOrderLineId: string; quantity: number }[] }) =>
  apiFetch<{ receiptId: string; status: PurchaseOrderStatus }>(`/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
