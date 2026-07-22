import { apiFetch } from './client';

export type LossReason = 'waste' | 'theft' | 'damage' | 'expiry' | 'other';

// Reasons the API accepts when *creating* a loss entry. The movement type is
// hardcoded to "waste" server-side; this `reason` is what the API validates.
export type LossCreateReason = 'expiry' | 'damage' | 'theft' | 'other';

export interface LossRecord {
  id: string;
  stockItemId: string;
  locationId: string;
  type: 'waste';
  reason?: string | null;
  quantity: number;       // negative (e.g. -100)
  quantityBefore: number;
  quantityAfter: number;
  orderId: string | null;
  userId: string | null;
  notes: string | null;
  relatedLocationId: string | null;
  createdAt: string;
  stockItem?: { id: string; name: string; unit: string };
  location?: { id: string; name: string };
}

export interface CreateLossPayload {
  stockItemId: string;
  locationId: string;
  quantity: number;
  reason: LossCreateReason;
  notes?: string;
}

export const getLossLog = (params?: {
  tenantId?: string;
  locationId?: string;
  stockItemId?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.tenantId) query.set('tenantId', params.tenantId);
  if (params?.locationId) query.set('locationId', params.locationId);
  if (params?.stockItemId) query.set('stockItemId', params.stockItemId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.page) query.set('page', String(params.page));
  const qs = query.toString();
  return apiFetch<LossRecord[]>(`/loss-log${qs ? `?${qs}` : ''}`);
};

export const createLossEntry = (data: CreateLossPayload) =>
  apiFetch<LossRecord>('/loss-log', { method: 'POST', body: JSON.stringify(data) });
