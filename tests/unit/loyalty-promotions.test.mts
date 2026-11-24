import assert from 'node:assert/strict';
import test from 'node:test';

import { planAdjustment, rewardsCompleted } from '../../lib/utils/balance-adjust.ts';
import { tierLadder } from '../../lib/utils/loyalty-tiers.ts';
import {
  draftFromPromotion,
  draftToFields,
  emptyPromotionDraft,
  promotionDraftProblems,
  promotionStanding,
  usageLabel,
} from '../../lib/utils/promotions.ts';
import { draftToProgram, emptyReferralDraft, referralDraftProblems } from '../../lib/utils/referrals.ts';

// ── Loyalty balance adjustments ──────────────────────────────────────────────

test('a manual adjustment sends a signed whole number and never takes a balance below zero', () => {
  assert.deepEqual(planAdjustment(10, 'add', 5), { delta: 5, after: 15, belowZero: false, valid: true });
  assert.deepEqual(planAdjustment(10, 'remove', 4), { delta: -4, after: 6, belowZero: false, valid: true });
  assert.deepEqual(planAdjustment(10, 'remove', 10), { delta: -10, after: 0, belowZero: false, valid: true });
  assert.deepEqual(planAdjustment(10, 'remove', 15), { delta: -15, after: 0, belowZero: true, valid: false });
  // Fractions are floored, nonsense is nothing, and nothing is not submittable.
  assert.deepEqual(planAdjustment(10.9, 'add', 2.7), { delta: 2, after: 12, belowZero: false, valid: true });
  assert.equal(planAdjustment(10, 'add', Number.NaN).valid, false);
  assert.equal(planAdjustment(10, 'add', -5).delta, 0);
  assert.equal(planAdjustment(Number.NaN, 'remove', 1).belowZero, true);
});

test('a stamp change counts the rewards it completes or takes back', () => {
  assert.equal(rewardsCompleted(8, 12, 10), 1);
  assert.equal(rewardsCompleted(12, 8, 10), -1);
  assert.equal(rewardsCompleted(3, 25, 10), 2);
  assert.equal(rewardsCompleted(3, 5, 10), 0);
  // A nonsense cost is treated as one stamp per reward rather than dividing by zero.
  assert.equal(rewardsCompleted(0, 3, 0), 3);
});

// ── Loyalty tiers ────────────────────────────────────────────────────────────

const rungs = [
  { id: 'bronze', label: 'Bronze', from: 0 },
  { id: 'silver', label: 'Silver', from: 200 },
  { id: 'gold', label: 'Gold', from: 500 },
];

test('the tier ladder places a balance from its points, with the points to the next rung', () => {
  const ladder = tierLadder(250, rungs);
  assert.equal(ladder.current.id, 'silver');
  assert.deepEqual(
    ladder.steps.map((step) => [step.id, step.state, step.fill]),
    [
      ['bronze', 'passed', 1],
      ['silver', 'current', 50 / 300],
      ['gold', 'ahead', 0],
    ],
  );
  assert.deepEqual(ladder.next, { label: 'Gold', needed: 250 });

  const top = tierLadder(900, rungs);
  assert.equal(top.current.id, 'gold');
  assert.equal(top.current.fill, 1);
  assert.equal(top.next, null);

  assert.equal(tierLadder(200, rungs).current.id, 'silver');
  assert.equal(tierLadder(-5, rungs).points, 0);
  // A balance below the first rung sits on it, empty.
  const below = tierLadder(50, [{ id: 'member', label: 'Member', from: 100 }, ...rungs.slice(1)]);
  assert.equal(below.current.id, 'member');
  assert.equal(below.current.fill, 0);
});

// ── Promotions ───────────────────────────────────────────────────────────────

const draft = (patch: Partial<ReturnType<typeof emptyPromotionDraft>> = {}) => ({
  ...emptyPromotionDraft(),
  name: 'Autumn',
  value: '10',
  code: 'autumn 10',
  ...patch,
});

test('a valid promotion draft has no problems, and codes are normalised before checking', () => {
  assert.deepEqual(promotionDraftProblems(draft(), true), {});
});

test('promotion drafts are refused the way the API refuses them', () => {
  const problems = (patch: Partial<ReturnType<typeof emptyPromotionDraft>>, isNew = false) =>
    Object.keys(promotionDraftProblems(draft(patch), isNew)).sort();
  assert.deepEqual(problems({ name: '  ' }), ['name']);
  assert.deepEqual(problems({ value: '0' }), ['value']);
  assert.deepEqual(problems({ value: '101' }), ['value']);
  assert.deepEqual(problems({ kind: 'fixed_amount', value: '5.555' }), ['value']);
  assert.deepEqual(problems({ kind: 'fixed_amount', value: '150' }), []);
  assert.deepEqual(problems({ maxDiscount: '0' }), ['maxDiscount']);
  assert.deepEqual(problems({ appliesTo: 'items' }), ['menuItemIds']);
  assert.deepEqual(problems({ kind: 'free_item', value: '' }), ['menuItemIds']);
  assert.deepEqual(problems({ kind: 'free_delivery', value: '', appliesTo: 'items' }), []);
  assert.deepEqual(problems({ maxRedemptions: '0', maxRedemptionsPerCustomer: '1.5' }), ['maxRedemptions', 'maxRedemptionsPerCustomer']);
  assert.deepEqual(problems({ startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' }), ['endsAt']);
  assert.deepEqual(problems({ locationIds: [], channels: [] }), ['channels', 'locationIds']);
  assert.deepEqual(problems({ code: 'ab' }, true), ['code']);
});

test('a draft becomes API fields with what does not apply to its kind sent empty', () => {
  const freeDelivery = draftToFields(draft({ kind: 'free_delivery', value: '10', appliesTo: 'items', menuItemIds: ['latte'] }));
  assert.equal(freeDelivery.kind, 'free_delivery');
  assert.equal(freeDelivery.value, null);
  assert.equal(freeDelivery.appliesTo, 'order');
  assert.deepEqual(freeDelivery.menuItemIds, []);

  const fixed = draftToFields(draft({ kind: 'fixed_amount', value: ' 5.50 ', maxDiscount: '3', maxRedemptions: '40' }));
  assert.equal(fixed.value, '5.50');
  assert.equal(fixed.maxDiscount, null);
  assert.equal(fixed.maxRedemptions, 40);
  assert.equal(fixed.minSubtotal, null);

  const freeItem = draftToFields(draft({ kind: 'free_item', menuItemIds: ['cookie'] }));
  assert.equal(freeItem.appliesTo, 'items');
  assert.equal(freeItem.value, null);
  assert.deepEqual(freeItem.menuItemIds, ['cookie']);

  // And back: amounts read the way someone would have typed them.
  const back = draftFromPromotion({ ...fixed, value: '10.00', minSubtotal: '2.50', locationIds: [], channels: null });
  assert.equal(back.value, '10');
  assert.equal(back.minSubtotal, '2.50');
  assert.equal(back.locationIds, null);
  assert.equal(back.maxRedemptions, '40');
});

test('a promotion’s standing: archived and paused first, then ended, used up, scheduled, live', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const base = { status: 'active' as const, startsAt: null, endsAt: null, maxRedemptions: null, redemptionCount: 3 };
  assert.equal(promotionStanding(base, now), 'live');
  assert.equal(promotionStanding({ ...base, status: 'paused', endsAt: '2026-01-01T00:00:00Z' }, now), 'paused');
  assert.equal(promotionStanding({ ...base, status: 'archived' }, now), 'archived');
  assert.equal(promotionStanding({ ...base, endsAt: '2026-11-24T12:00:00Z' }, now), 'ended');
  assert.equal(promotionStanding({ ...base, maxRedemptions: 3 }, now), 'used_up');
  assert.equal(promotionStanding({ ...base, startsAt: '2026-11-25T00:00:00Z' }, now), 'scheduled');
  assert.equal(promotionStanding({ ...base, startsAt: '2026-11-25T00:00:00Z', maxRedemptions: 3 }, now), 'used_up');
  assert.equal(usageLabel({ maxRedemptions: 100, redemptionCount: 12 }), '12 of 100 used');
  assert.equal(usageLabel({ maxRedemptions: null, redemptionCount: 1 }), '1 use');
});

// ── Referrals ────────────────────────────────────────────────────────────────

test('a referral programme needs a friend offer and a different reward for the referrer', () => {
  const valid = { ...emptyReferralDraft(), friendPromotionId: 'p1', referrerPromotionId: 'p2' };
  assert.deepEqual(referralDraftProblems(valid), {});
  assert.deepEqual(Object.keys(referralDraftProblems(emptyReferralDraft())).sort(), ['friendPromotionId', 'referrerPromotionId']);
  assert.ok(referralDraftProblems({ ...valid, referrerPromotionId: 'p1' }).referrerPromotionId);
  assert.ok(referralDraftProblems({ ...valid, referrerRewardKind: 'loyalty_reward' }).referrerLoyaltyProgramId);
  assert.ok(referralDraftProblems({ ...valid, maxRewardsPerReferrer: '0' }).maxRewardsPerReferrer);
  assert.ok(referralDraftProblems({ ...valid, codePrefix: 'A' }).codePrefix);
  assert.ok(referralDraftProblems({ ...valid, codePrefix: 'SAM-1' }).codePrefix);
});

test('only the chosen reward’s source is sent', () => {
  const loyalty = draftToProgram({
    ...emptyReferralDraft(),
    friendPromotionId: 'p1',
    referrerRewardKind: 'loyalty_reward',
    referrerLoyaltyProgramId: 'stamps',
    referrerPromotionId: 'p2',
    maxRewardsPerReferrer: ' 5 ',
    codePrefix: ' sam ',
    active: false,
  });
  assert.deepEqual(loyalty, {
    status: 'paused',
    friendPromotionId: 'p1',
    referrerRewardKind: 'loyalty_reward',
    referrerLoyaltyProgramId: 'stamps',
    referrerPromotionId: null,
    maxRewardsPerReferrer: 5,
    codePrefix: 'SAM',
  });
  const promo = draftToProgram({ ...emptyReferralDraft(), friendPromotionId: 'p1', referrerPromotionId: 'p2', referrerLoyaltyProgramId: 'x' });
  assert.equal(promo.referrerLoyaltyProgramId, null);
  assert.equal(promo.referrerPromotionId, 'p2');
  assert.equal(promo.maxRewardsPerReferrer, null);
  assert.equal(promo.codePrefix, null);
});
