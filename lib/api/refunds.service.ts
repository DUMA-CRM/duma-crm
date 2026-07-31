import { API_PREFIX, apiFetch } from './client';
import type { OrderRefund } from './orders.service';

export interface RefundReportRow extends OrderRefund {
  order: { id: string; createdAt: string; locationId: string; location?: { name: string } | null };
}

export interface RefundReport {
  data: RefundReportRow[];
  totalAmount: string;
  basis: 'sale' | 'refund';
}

export interface RefundReportParams {
  from: string;
  to: string;
  basis: 'sale' | 'refund';
  reason?: string;
  locationId?: string;
}

function query(params: RefundReportParams) {
  const qs = new URLSearchParams({ from: params.from, to: params.to, basis: params.basis });
  if (params.reason) qs.set('reason', params.reason);
  if (params.locationId) qs.set('locationId', params.locationId);
  return qs;
}

export const getRefundReport = (params: RefundReportParams) => apiFetch<RefundReport>(`/refunds?${query(params)}`);
export const refundReportCsvUrl = (params: RefundReportParams) => {
  const qs = query(params);
  qs.set('format', 'csv');
  return `${API_PREFIX}/v1/refunds?${qs}`;
};
