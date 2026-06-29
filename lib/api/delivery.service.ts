import { apiFetch } from './client';

export type DeliveryStatus = 'pending' | 'received' | 'partial' | 'cancelled';

export interface DeliveryItem {
  id: string;
  deliveryId: string;
  stockItemId: string;
  quantity: number;
  unitCost?: number | null;
  stockItem?: { id: string; name: string; unit: string };
}

export interface DeliveryRecord {
  id: string;
  tenantId: string;
  locationId: string;
  supplierId?: string | null;
  status: DeliveryStatus;
  notes?: string | null;
  deliveredAt?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  location?: { id: string; name: string };
  supplier?: { id: string; name: string } | null;
  items?: DeliveryItem[];
}

export interface CreateDeliveryPayload {
  tenantId: string;
  locationId: string;
  supplierId?: string;
  status?: DeliveryStatus;
  notes?: string;
  items: { stockItemId: string; quantity: number }[];
}

export interface UpdateDeliveryPayload {
  status?: DeliveryStatus;
  notes?: string;
  deliveredAt?: string;
}

export const getDeliveryLog = (params?: {
  tenantId?: string;
  locationId?: string;
  supplierId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.tenantId) query.set('tenantId', params.tenantId);
  if (params?.locationId) query.set('locationId', params.locationId);
  if (params?.supplierId) query.set('supplierId', params.supplierId);
  if (params?.status) query.set('status', params.status);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.page) query.set('page', String(params.page));
  const qs = query.toString();
  return apiFetch<DeliveryRecord[]>(`/delivery-log${qs ? `?${qs}` : ''}`);
};

export const getDelivery = (id: string) => apiFetch<DeliveryRecord>(`/delivery-log/${id}`);

export const createDelivery = (data: CreateDeliveryPayload) =>
  apiFetch<DeliveryRecord>('/delivery-log', { method: 'POST', body: JSON.stringify(data) });

export const updateDelivery = (id: string, data: UpdateDeliveryPayload) =>
  apiFetch<DeliveryRecord>(`/delivery-log/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteDelivery = (id: string) => apiFetch<void>(`/delivery-log/${id}`, { method: 'DELETE' });
