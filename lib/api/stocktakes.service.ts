import { apiFetch } from './client';

// Guided stocktake: snapshot expected quantities → count → apply variance.

export type StocktakeStatus = 'in_progress' | 'completed' | 'cancelled';

export interface StocktakeLine {
  id: string;
  stocktakeId: string;
  stockItemId: string;
  expectedQty: string;
  countedQty?: string | null;
  stockItem?: { id: string; name: string; unit: string };
}

export interface Stocktake {
  id: string;
  locationId: string;
  status: StocktakeStatus;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  location?: { id: string; name: string };
  startedByUser?: { id: string; name: string };
  lines?: StocktakeLine[];
  /** Present on the complete response: how many variance adjustments were applied. */
  adjustments?: number;
}

export interface StocktakesResponse {
  data: Stocktake[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const getStocktakes = (params: { locationId?: string; status?: StocktakeStatus; page?: number; limit?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.locationId) q.set('locationId', params.locationId);
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<StocktakesResponse>(`/stocktakes${qs ? `?${qs}` : ''}`);
};

export const getStocktake = (id: string) => apiFetch<Stocktake>(`/stocktakes/${id}`);

export const startStocktake = (data: { locationId: string; notes?: string }) =>
  apiFetch<Stocktake>('/stocktakes', { method: 'POST', body: JSON.stringify(data) });

export const saveStocktakeCounts = (id: string, lines: { stockItemId: string; countedQty: number | null }[]) =>
  apiFetch<Stocktake>(`/stocktakes/${id}/lines`, { method: 'PATCH', body: JSON.stringify({ lines }) });

export const completeStocktake = (id: string) => apiFetch<Stocktake>(`/stocktakes/${id}/complete`, { method: 'POST' });

export const cancelStocktake = (id: string) => apiFetch<{ success: boolean }>(`/stocktakes/${id}/cancel`, { method: 'POST' });
