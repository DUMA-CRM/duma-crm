// ---------------------------------------------------------------------------
// The referral programme as the settings form shapes it: the draft, what stops
// it being saved (the API's own rules, in the editor's words), and the words
// the referrals list uses. Rewards are granted by the API when a friend's
// first order is completed — nothing here decides one.
// ---------------------------------------------------------------------------

export type ReferralRewardKind = 'loyalty_reward' | 'promo_code';
export type ReferralStatus = 'pending' | 'rewarded' | 'declined' | 'cancelled';

export interface ReferralProgramDraft {
  active: boolean;
  friendPromotionId: string;
  referrerRewardKind: ReferralRewardKind;
  referrerLoyaltyProgramId: string;
  referrerPromotionId: string;
  maxRewardsPerReferrer: string;
  codePrefix: string;
}

export function emptyReferralDraft(): ReferralProgramDraft {
  return {
    active: true,
    friendPromotionId: '',
    referrerRewardKind: 'promo_code',
    referrerLoyaltyProgramId: '',
    referrerPromotionId: '',
    maxRewardsPerReferrer: '',
    codePrefix: '',
  };
}

export function draftFromProgram(program: {
  status: 'active' | 'paused';
  friendPromotionId: string;
  referrerRewardKind: ReferralRewardKind;
  referrerLoyaltyProgramId: string | null;
  referrerPromotionId: string | null;
  maxRewardsPerReferrer: number | null;
  codePrefix: string | null;
}): ReferralProgramDraft {
  return {
    active: program.status === 'active',
    friendPromotionId: program.friendPromotionId,
    referrerRewardKind: program.referrerRewardKind,
    referrerLoyaltyProgramId: program.referrerLoyaltyProgramId ?? '',
    referrerPromotionId: program.referrerPromotionId ?? '',
    maxRewardsPerReferrer: program.maxRewardsPerReferrer === null ? '' : String(program.maxRewardsPerReferrer),
    codePrefix: program.codePrefix ?? '',
  };
}

/** The draft as the API takes it; only the chosen reward's source is sent. */
export function draftToProgram(draft: ReferralProgramDraft) {
  const loyalty = draft.referrerRewardKind === 'loyalty_reward';
  return {
    status: draft.active ? ('active' as const) : ('paused' as const),
    friendPromotionId: draft.friendPromotionId,
    referrerRewardKind: draft.referrerRewardKind,
    referrerLoyaltyProgramId: loyalty ? draft.referrerLoyaltyProgramId || null : null,
    referrerPromotionId: loyalty ? null : draft.referrerPromotionId || null,
    maxRewardsPerReferrer: draft.maxRewardsPerReferrer.trim() ? Number.parseInt(draft.maxRewardsPerReferrer, 10) : null,
    codePrefix: draft.codePrefix.trim().toUpperCase() || null,
  };
}

export function referralDraftProblems(draft: ReferralProgramDraft): Partial<Record<keyof ReferralProgramDraft, string>> {
  const problems: Partial<Record<keyof ReferralProgramDraft, string>> = {};
  if (!draft.friendPromotionId) problems.friendPromotionId = 'Choose what the friend gets';
  if (draft.referrerRewardKind === 'loyalty_reward' && !draft.referrerLoyaltyProgramId) {
    problems.referrerLoyaltyProgramId = 'Choose the loyalty programme the reward comes from';
  }
  if (draft.referrerRewardKind === 'promo_code') {
    if (!draft.referrerPromotionId) problems.referrerPromotionId = 'Choose the promotion the reward code comes from';
    else if (draft.referrerPromotionId === draft.friendPromotionId) {
      problems.referrerPromotionId = 'Use a different promotion from the friend’s offer';
    }
  }
  const cap = draft.maxRewardsPerReferrer.trim();
  if (cap && (!/^\d+$/.test(cap) || Number(cap) < 1)) problems.maxRewardsPerReferrer = 'A whole number, 1 or more — or empty for no limit';
  const prefix = draft.codePrefix.trim();
  if (prefix && !/^[A-Za-z0-9]{2,12}$/.test(prefix))
    problems.codePrefix = '2 to 12 letters or numbers — or empty to use each customer’s name';
  return problems;
}

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: 'Waiting for the order',
  rewarded: 'Rewarded',
  declined: 'No reward',
  cancelled: 'Order cancelled',
};

export const REFERRAL_STATUS_BADGE: Record<ReferralStatus, 'reference' | 'success' | 'warning' | 'muted'> = {
  pending: 'reference',
  rewarded: 'success',
  declined: 'warning',
  cancelled: 'muted',
};

/** "SAM-7KQ2PX" — how a customer's code will look, for the settings preview. */
export const sampleReferralCode = (prefix: string) => `${prefix.trim().toUpperCase() || 'SAM'}-7KQ2PX`;
