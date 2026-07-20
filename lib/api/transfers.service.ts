import { apiFetch } from './client';

// Inter-location stock transfers. Stock moves only when a transfer completes.

export type StockTransferStatus = 'pending' | 'completed' | 'cancelled';

export interface StockTransferLine {
  id: string;
  transferId: string;
  stockItemId: string;
  quantity: string;
  stockItem?: { id: string; name: string; unit: string };
}

export interface StockTransfer {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  status: StockTransferStatus;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  fromLocation?: { id: string; name: string };
  toLocation?: { id: string; name: string };
  createdByUser?: { id: string; name: string };
  lines: StockTransferLine[];
}

export interface StockTransfersResponse {
  data: StockTransfer[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const getStockTransfers = (params: { locationId?: string; status?: StockTransferStatus; page?: number; limit?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.locationId) q.set('locationId', params.locationId);
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<StockTransfersResponse>(`/stock-transfers${qs ? `?${qs}` : ''}`);
};

export const getStockTransfer = (id: string) => apiFetch<StockTransfer>(`/stock-transfers/${id}`);

export const createStockTransfer = (data: {
  fromLocationId: string;
  toLocationId: string;
  notes?: string;
  lines: { stockItemId: string; quantity: number }[];
}) => apiFetch<StockTransfer>('/stock-transfers', { method: 'POST', body: JSON.stringify(data) });

export const completeStockTransfer = (id: string) => apiFetch<StockTransfer>(`/stock-transfers/${id}/complete`, { method: 'POST' });

export const cancelStockTransfer = (id: string) => apiFetch<{ success: boolean }>(`/stock-transfers/${id}/cancel`, { method: 'POST' });
