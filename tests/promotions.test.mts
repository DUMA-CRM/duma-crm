import assert from 'node:assert/strict';
import test from 'node:test';

const {
  codesCsv,
  draftFromPromotion,
  draftToFields,
  emptyPromotionDraft,
  promotionConditions,
  promotionDraftProblems,
  promotionStanding,
  usageLabel,
} = await import('../lib/utils/promotions.ts');

const draft = (patch = {}) => ({ ...emptyPromotionDraft(), name: 'Summer', value: '10', code: 'summer10', ...patch });

test('a complete new percentage promotion has no problems; an empty one says what is missing', () => {
  assert.deepEqual(promotionDraftProblems(draft(), true), {});
  const problems = promotionDraftProblems(emptyPromotionDraft(), true);
  assert.ok(problems.name && problems.value && problems.code);
});

test('the API’s rules are caught where they are typed', () => {
  assert.match(promotionDraftProblems(draft({ value: '120' }), true).value!, /more than 100/);
  assert.match(promotionDraftProblems(draft({ kind: 'free_item', value: '' }), true).menuItemIds!, /can be free/);
  assert.match(promotionDraftProblems(draft({ appliesTo: 'items' }), true).menuItemIds!, /items or categories/);
  assert.match(promotionDraftProblems(draft({ maxRedemptions: '0' }), true).maxRedemptions!, /1 or more/);
  assert.match(
    promotionDraftProblems(draft({ startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-10-01T00:00:00Z' }), true).endsAt!,
    /after the start/,
  );
  assert.match(promotionDraftProblems(draft({ locationIds: [] }), true).locationIds!, /at least one location/);
  assert.match(promotionDraftProblems(draft({ code: 'a b' }), true).code!, /3 to 50/);
  assert.equal(promotionDraftProblems(draft({ code: '' }), false).code, undefined, 'an existing promotion keeps its codes');
});

test('the draft becomes API fields: empties are null, and what the kind ignores is cleared', () => {
  const fields = draftToFields(draft({ kind: 'fixed_amount', value: '5.50', maxDiscount: '3', menuItemIds: ['x'], maxRedemptions: '100' }));
  assert.equal(fields.value, '5.50');
  assert.equal(fields.maxDiscount, null, 'only a percentage has a cap');
  assert.deepEqual(fields.menuItemIds, [], 'an order-wide amount lists no items');
  assert.equal(fields.maxRedemptions, 100);
  assert.equal(fields.minSubtotal, null);

  const free = draftToFields(draft({ kind: 'free_item', value: '9', categoryIds: ['pastry'] }));
  assert.equal(free.value, null);
  assert.equal(free.appliesTo, 'items');
  assert.deepEqual(free.categoryIds, ['pastry']);
});

test('a saved promotion round-trips through the form unchanged', () => {
  const saved = draftToFields(draft({ maxDiscount: '5', minSubtotal: '20', channels: ['pos'], maxRedemptionsPerCustomer: '1' }));
  const reloaded = { ...saved, value: '10.00', maxDiscount: '5.00', minSubtotal: '20.00' };
  assert.deepEqual(draftToFields(draftFromPromotion(reloaded)), { ...saved, value: '10', maxDiscount: '5', minSubtotal: '20' });
});

test('standing reads the status, the window and the limit — in that order', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  const base = { status: 'active' as const, startsAt: null, endsAt: null, maxRedemptions: null, redemptionCount: 0 };
  assert.equal(promotionStanding(base, now), 'live');
  assert.equal(promotionStanding({ ...base, startsAt: '2026-11-01T00:00:00Z' }, now), 'scheduled');
  assert.equal(promotionStanding({ ...base, endsAt: '2026-10-01T00:00:00Z' }, now), 'ended');
  assert.equal(promotionStanding({ ...base, maxRedemptions: 5, redemptionCount: 5 }, now), 'used_up');
  assert.equal(promotionStanding({ ...base, status: 'paused', endsAt: '2026-10-01T00:00:00Z' }, now), 'paused');
});

test('usage and conditions read as a till would say them', () => {
  assert.equal(usageLabel({ maxRedemptions: null, redemptionCount: 1 }), '1 use');
  assert.equal(usageLabel({ maxRedemptions: 100, redemptionCount: 12 }), '12 of 100 used');
  assert.deepEqual(
    promotionConditions({ minSubtotal: '20.00', maxRedemptionsPerCustomer: 1, firstOrderOnly: true, combinesWithLoyalty: false }),
    ['Min. spend £20.00', 'First order only', 'Once per customer', 'Not with loyalty rewards'],
  );
});

test('codes export as CSV with a header', () => {
  assert.equal(
    codesCsv([{ code: 'VIP-ABC', maxRedemptions: 1, redemptionCount: 0, isActive: true }]),
    'code,max_uses,uses,active\nVIP-ABC,1,0,yes',
  );
});

test('free delivery needs no amount and sends none, nor any items', async () => {
  const freeDelivery = draft({ kind: 'free_delivery', value: '', menuItemIds: ['x'], appliesTo: 'items' });
  assert.deepEqual(promotionDraftProblems(freeDelivery, true), {});
  const fields = draftToFields(freeDelivery);
  assert.equal(fields.kind, 'free_delivery');
  assert.equal(fields.value, null);
  assert.deepEqual(fields.menuItemIds, []);
  assert.equal(fields.appliesTo, 'order');
});
