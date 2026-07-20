import { apiFetch } from './client';

// End-of-shift stock deduction reconciliation. Sales record theoretical
// ingredient usage from recipes; at clock-out staff review the suggested
// totals, adjust for the human factor, and apply or decline them as a batch.

export interface PendingDeductionLine {
  stockItemId: string;
  name: string;
  unit: string;
  suggestedQty: number;
  currentQuantity: number;
  orderCount: number;
  oldestAt: string;
}

export interface DeductionLine {
  id: string;
  batchId: string;
  stockItemId: string;
  suggestedQty: string;
  deductedQty: string;
  stockItem?: { id: string; name: string; unit: string };
}

export interface DeductionBatch {
  id: string;
  locationId: string;
  shiftId?: string | null;
  status: 'applied' | 'declined';
  notes?: string | null;
  createdAt: string;
  location?: { id: string; name: string };
  createdByUser?: { id: string; name: string };
  lines: DeductionLine[];
}

export interface DeductionBatchesResponse {
  data: DeductionBatch[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CreateDeductionPayload {
  locationId: string;
  shiftId?: string;
  status: 'applied' | 'declined';
  notes?: string;
  lines?: { stockItemId: string; deductedQty: number }[];
}

export const getPendingDeductions = (locationId: string) =>
  apiFetch<{ lines: PendingDeductionLine[] }>(`/stock-deductions/pending?locationId=${locationId}`);

export const createDeductionBatch = (data: CreateDeductionPayload) =>
  apiFetch<DeductionBatch>('/stock-deductions', { method: 'POST', body: JSON.stringify(data) });

export const getDeductionBatches = (params: { locationId?: string; page?: number; limit?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.locationId) q.set('locationId', params.locationId);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<DeductionBatchesResponse>(`/stock-deductions${qs ? `?${qs}` : ''}`);
};
