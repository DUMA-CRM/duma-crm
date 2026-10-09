import assert from 'node:assert/strict';
import test from 'node:test';

const { draftFromProgram, draftToProgram, emptyReferralDraft, referralDraftProblems, sampleReferralCode } =
  await import('../lib/utils/referrals.ts');

const complete = { ...emptyReferralDraft(), friendPromotionId: 'friend', referrerPromotionId: 'thanks' };

test('a complete programme has no problems; an empty one says what to choose', () => {
  assert.deepEqual(referralDraftProblems(complete), {});
  const empty = referralDraftProblems(emptyReferralDraft());
  assert.ok(empty.friendPromotionId && empty.referrerPromotionId);
});

test('the reward needs its own source, and not the friend’s promotion', () => {
  assert.match(referralDraftProblems({ ...complete, referrerPromotionId: 'friend' }).referrerPromotionId!, /different promotion/);
  assert.match(referralDraftProblems({ ...complete, referrerRewardKind: 'loyalty_reward' }).referrerLoyaltyProgramId!, /loyalty programme/);
  assert.match(referralDraftProblems({ ...complete, maxRewardsPerReferrer: '0' }).maxRewardsPerReferrer!, /1 or more/);
  assert.match(referralDraftProblems({ ...complete, codePrefix: 'A' }).codePrefix!, /2 to 12/);
});

test('only the chosen reward’s source is sent, and the form round-trips', () => {
  const sent = draftToProgram({
    ...complete,
    referrerRewardKind: 'loyalty_reward',
    referrerLoyaltyProgramId: 'stamps',
    codePrefix: 'friend',
    maxRewardsPerReferrer: '5',
  });
  assert.equal(sent.referrerPromotionId, null);
  assert.equal(sent.referrerLoyaltyProgramId, 'stamps');
  assert.equal(sent.codePrefix, 'FRIEND');
  assert.equal(sent.maxRewardsPerReferrer, 5);
  assert.deepEqual(draftToProgram(draftFromProgram(sent)), sent);
});

test('the code preview uses the prefix, or a name', () => {
  assert.equal(sampleReferralCode('vip'), 'VIP-7KQ2PX');
  assert.equal(sampleReferralCode(''), 'SAM-7KQ2PX');
});
