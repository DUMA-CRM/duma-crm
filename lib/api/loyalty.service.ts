import { apiFetch } from './client';

export type LoyaltyProgramStatus = 'draft' | 'active' | 'paused';
export type LoyaltyEarnRule = {
  scope: 'all_items' | 'menu_items' | 'categories';
  menuItemIds: string[];
  categoryIds: string[];
  unitsPerItem: number;
  trigger?: 'purchase' | 'birthday';
  benefitMode?: 'rewards' | 'points' | 'both';
};
export type LoyaltyRewardValidity = {
  type: 'never' | 'days' | 'end_of_year' | 'date';
  days?: number | null;
  date?: string | null;
};
export type LoyaltyRewardRule = {
  kind: 'free_item' | 'free_modifier' | 'percentage_off';
  cost: number;
  menuItemIds: string[];
  categoryIds: string[];
  modifierGroupIds: string[];
  discountPercent?: number | null;
  maxDiscountCents: number | null;
  validity?: LoyaltyRewardValidity;
};

export interface LoyaltyProgram {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: LoyaltyProgramStatus;
  unitSingular: string;
  unitPlural: string;
  earnRule: LoyaltyEarnRule;
  rewardRule: LoyaltyRewardRule;
  locationIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export type LoyaltyProgramInput = Omit<LoyaltyProgram, 'id' | 'createdAt' | 'updatedAt'>;
export type CustomerLoyaltyProgram = LoyaltyProgram & {
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  canRedeem: boolean;
  rewards: Array<{ id: string; expiresAt: string | null }>;
  nextRewardExpiresAt: string | null;
};

export const getLoyaltyPrograms = (tenantId?: string) =>
  apiFetch<{ data: LoyaltyProgram[] }>(`/loyalty-programs${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`);

export const createLoyaltyProgram = (input: LoyaltyProgramInput) =>
  apiFetch<LoyaltyProgram>('/loyalty-programs', { method: 'POST', body: JSON.stringify(input) });

export const updateLoyaltyProgram = (id: string, input: Partial<Omit<LoyaltyProgramInput, 'tenantId'>>) =>
  apiFetch<LoyaltyProgram>(`/loyalty-programs/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export const getCustomerLoyaltyWallet = (customerId: string, locationId?: string) =>
  apiFetch<{ customerId: string; programmes: CustomerLoyaltyProgram[] }>(
    `/loyalty-programs/customers/${customerId}${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`,
  );

export const adjustCustomerLoyaltyBalance = (customerId: string, input: { programId: string; delta: number; reason: string }) =>
  apiFetch<{ customerId: string; programId: string; balance: number; canRedeem: boolean }>(
    `/loyalty-programs/customers/${customerId}/adjustments`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const grantCustomerLoyaltyReward = (customerId: string, input: { programId: string; quantity: number; reason: string }) =>
  apiFetch<{ customerId: string; programId: string; balance: number; rewardsAvailable: number; rewards: Array<{ id: string; expiresAt: string | null }> }>(
    `/loyalty-programs/customers/${customerId}/rewards`,
    { method: 'POST', body: JSON.stringify(input) },
  );
