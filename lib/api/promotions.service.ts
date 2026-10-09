// ─── Promotions ───────────────────────────────────────────────────────────────
//
// Promo codes the order honours (the promotions module, /v1/promotions).
// Amounts are decimal strings, as everywhere money is. The API is the one place
// a discount is worked out — the till's check returns its estimate, and the
// order prices it for real. Design: Platform/Promotions and Referrals.

import type { PromotionChannel, PromotionFields, PromotionStatus } from '@/lib/utils/promotions';

import { apiFetch } from './client';

export type { PromotionChannel, PromotionKind, PromotionScope, PromotionStatus } from '@/lib/utils/promotions';
export type PromotionRuleFields = PromotionFields;

export interface Promotion extends PromotionRuleFields {
  id: string;
  tenantId: string;
  redemptionCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** "10% off (up to £5.00)" — the API's own wording. */
  summary: string;
}

export interface PromotionListItem extends Promotion {
  codeCount: number;
  firstCode: string | null;
  /** Total taken off by uses that still stand. */
  discountTotal: string;
}

export interface PromotionCode {
  id: string;
  promotionId: string;
  code: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  ownerCustomerId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PromotionDetail extends Promotion {
  codes: PromotionCode[];
  /** Total taken off by uses that still stand. */
  discountTotal: string;
}

export interface PromotionRedemption {
  id: string;
  orderId: string;
  code: string;
  customerId: string | null;
  customerName: string | null;
  locationId: string;
  source: PromotionChannel;
  amount: string;
  status: 'applied' | 'reversed';
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
}

export interface PromotionCheck {
  valid: boolean;
  reason?: string;
  code?: string;
  promotionId?: string;
  name?: string;
  summary?: string;
  needsCustomer?: boolean;
  estimatedDiscount?: string | null;
}

const qs = (tenantId?: string, extra: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', tenantId);
  for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
};

export const getPromotions = (tenantId?: string, status?: PromotionStatus) =>
  apiFetch<{ data: PromotionListItem[] }>(`/promotions?${qs(tenantId, { status })}`).then((res) => res.data);

export const getPromotion = (id: string, tenantId?: string) =>
  apiFetch<{ data: PromotionDetail }>(`/promotions/${id}?${qs(tenantId)}`).then((res) => res.data);

export const createPromotion = (data: PromotionRuleFields & { code?: string }, tenantId?: string) =>
  apiFetch<{ data: Promotion }>(`/promotions`, { method: 'POST', body: JSON.stringify({ ...data, tenantId }) }).then((res) => res.data);

export const updatePromotion = (id: string, data: Partial<PromotionRuleFields>, tenantId?: string) =>
  apiFetch<{ data: Promotion }>(`/promotions/${id}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data) }).then(
    (res) => res.data,
  );

export const addPromotionCode = (id: string, data: { code: string; maxRedemptions?: number | null }, tenantId?: string) =>
  apiFetch<{ data: PromotionCode[] }>(`/promotions/${id}/codes?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) }).then(
    (res) => res.data,
  );

export const generatePromotionCodes = (
  id: string,
  data: { generate: number; prefix?: string; maxRedemptions?: number | null },
  tenantId?: string,
) =>
  apiFetch<{ data: PromotionCode[] }>(`/promotions/${id}/codes?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) }).then(
    (res) => res.data,
  );

export const setPromotionCodeActive = (id: string, codeId: string, isActive: boolean, tenantId?: string) =>
  apiFetch<{ data: PromotionCode }>(`/promotions/${id}/codes/${codeId}?${qs(tenantId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  }).then((res) => res.data);

export const getPromotionRedemptions = (id: string, page = 1, tenantId?: string) =>
  apiFetch<{ data: PromotionRedemption[]; pagination: { page: number; limit: number; total: number } }>(
    `/promotions/${id}/redemptions?${qs(tenantId, { page })}`,
  );

/** The till's check: can this code be used on this basket, and roughly what does it take off. Changes nothing. */
export const checkPromotionCode = (data: {
  code: string;
  locationId: string;
  source?: PromotionChannel;
  customerId?: string | null;
  usesLoyalty?: boolean;
  lines: { menuItemId: string; quantity: number; lineTotal: string }[];
}) => apiFetch<PromotionCheck>(`/promotions/check`, { method: 'POST', body: JSON.stringify(data) });
