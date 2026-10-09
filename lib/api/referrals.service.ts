import { apiFetch } from './client';

// ─── Referrals ────────────────────────────────────────────────────────────────
//
// The refer-a-friend programme (the referrals module, /v1/referrals). A
// referral is recorded and settled by the order itself; nothing here grants a
// reward. Design: Platform/Promotions and Referrals (phase 3).

export type ReferralStatus = 'pending' | 'rewarded' | 'declined' | 'cancelled';
export type ReferralRewardKind = 'loyalty_reward' | 'promo_code';

export interface ReferralProgramFields {
  status: 'active' | 'paused';
  friendPromotionId: string;
  referrerRewardKind: ReferralRewardKind;
  referrerLoyaltyProgramId: string | null;
  referrerPromotionId: string | null;
  maxRewardsPerReferrer: number | null;
  codePrefix: string | null;
}

export interface ReferralProgram extends ReferralProgramFields {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  counts: { pending: number; rewarded: number; declined: number; cancelled: number; referrers: number; codesIssued: number };
}

export interface Referral {
  id: string;
  status: ReferralStatus;
  orderId: string;
  referrerCustomerId: string;
  referrerName: string;
  referredCustomerId: string;
  referredName: string;
  code: string;
  rewardCode: string | null;
  declinedReason: string | null;
  createdAt: string;
  settledAt: string | null;
}

export interface CustomerReferralSummary {
  code: string | null;
  pending: number;
  rewarded: number;
  declined: number;
}

const qs = (tenantId?: string, extra: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', tenantId);
  for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
};

export const getReferralProgram = (tenantId?: string) =>
  apiFetch<{ data: ReferralProgram | null }>(`/referrals/program?${qs(tenantId)}`).then((res) => res.data);

export const saveReferralProgram = (data: ReferralProgramFields, tenantId?: string) =>
  apiFetch<{ data: ReferralProgram }>(`/referrals/program`, { method: 'PUT', body: JSON.stringify({ ...data, tenantId }) }).then(
    (res) => res.data,
  );

export const getReferrals = (page = 1, status?: ReferralStatus, tenantId?: string) =>
  apiFetch<{ data: Referral[]; pagination: { page: number; limit: number; total: number } }>(
    `/referrals?${qs(tenantId, { page, status })}`,
  );

export const getCustomerReferrals = (customerId: string) =>
  apiFetch<{ data: CustomerReferralSummary | null }>(`/referrals/customers/${customerId}`).then((res) => res.data);

export const issueCustomerReferralCode = (customerId: string) =>
  apiFetch<{ data: { code: string } }>(`/referrals/customers/${customerId}/code`, { method: 'POST' }).then((res) => res.data);
