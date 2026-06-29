import { apiFetch } from './client';
import type { StockItem } from './inventory.service';

export type RestockStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected';
export type RestockPriority = 'standard' | 'urgent';

export interface RestockRequest {
  id: string;
  stockItemId: string;
  locationId: string;
  requestedQty: number;
  notes?: string;
  status: RestockStatus;
  createdAt: string;
  updatedAt: string;
  stockItem?: StockItem;
}

export interface RestockRequestsResponse {
  data: RestockRequest[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CreateRestockRequestPayload {
  stockItemId: string;
  locationId: string;
  requestedQty: number;
  notes?: string;
}

// Priority is stored in the notes field as JSON since the API has no priority field.
export function encodeNotes(priority: RestockPriority, notes: string): string | undefined {
  const text = notes.trim();
  if (priority === 'standard' && !text) return undefined;
  return JSON.stringify({ priority, notes: text });
}

export function decodeNotes(raw?: string): { priority: RestockPriority; notes: string } {
  if (!raw) return { priority: 'standard', notes: '' };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && ('priority' in parsed || 'notes' in parsed)) {
      return {
        priority: (parsed.priority as RestockPriority) ?? 'standard',
        notes: (parsed.notes as string) ?? '',
      };
    }
  } catch {
    // plain string — treat as notes with standard priority
  }
  return { priority: 'standard', notes: raw };
}

export const getRestockRequests = (params?: {
  locationId?: string;
  stockItemId?: string;
  status?: RestockStatus;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.locationId) query.set('locationId', params.locationId);
  if (params?.stockItemId) query.set('stockItemId', params.stockItemId);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<RestockRequestsResponse>(`/restock-requests${qs ? `?${qs}` : ''}`);
};

export const createRestockRequest = (data: CreateRestockRequestPayload) =>
  apiFetch<RestockRequest>('/restock-requests', { method: 'POST', body: JSON.stringify(data) });

export const updateRestockRequest = (
  id: string,
  data: { status?: RestockStatus; requestedQty?: number; notes?: string },
) => apiFetch<RestockRequest>(`/restock-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteRestockRequest = (id: string) => apiFetch<void>(`/restock-requests/${id}`, { method: 'DELETE' });
