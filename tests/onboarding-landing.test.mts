import assert from 'node:assert/strict';
import test from 'node:test';

const { homeFor, landingFor } = await import('../lib/onboarding/landing.ts');

test('an online shop starts on its products, then connects its website', () => {
  const landing = landingFor(['catalog', 'ordering', 'inventory', 'customers'], { presence: 'online', businessName: 'Thread' });
  assert.equal(landing.primary.href, '/menu/items');
  assert.equal(landing.secondary.href, '/settings/developers');
  assert.match(landing.message, /^Thread is ready/);
});

test('without Reports there is no dashboard to send anyone to', () => {
  assert.equal(homeFor(['catalog', 'ordering', 'pos']).href, '/pos');
  assert.equal(homeFor(['ordering']).href, '/orders');
  assert.equal(homeFor(['analytics', 'pos']).href, '/dashboard');
  assert.equal(homeFor([]).href, '/settings');
  const cafe = landingFor(['catalog', 'ordering', 'pos', 'payments'], { presence: 'in_person', businessName: 'Bean' });
  assert.equal(cafe.primary.href, '/settings/workspaces');
  assert.equal(cafe.secondary.href, '/pos');
});

test('an online-only shop may leave its address blank, and pays through its website', async () => {
  const { EMPTY_DRAFT, isStepComplete } = await import('../lib/onboarding/flow.ts');
  const { toOnboardingAnswers } = await import('../lib/onboarding/answers.ts');
  const shop = { ...EMPTY_DRAFT, businessName: 'Thread', presence: 'online' as const, servesFood: false, businessType: 'online_retail' as const, locationName: 'Online store' };
  assert.equal(isStepComplete('location', shop, ''), true, 'no address needed online');
  assert.equal(isStepComplete('location', { ...shop, locationAddress: 'x' }, ''), false, 'but a typed one must be a real one');
  assert.equal(isStepComplete('location', { ...shop, presence: 'in_person' as const }, ''), false, 'a shop with a door needs its address');
  const answers = toOnboardingAnswers({ ...shop, paymentMethods: ['external', 'cash'], extras: ['cms'] });
  assert.deepEqual(answers.paymentMethods, ['external'], 'no till, so no cash');
  assert.equal(answers.cms, true);
  // A café that only takes payment in person cannot claim a website checkout.
  assert.deepEqual(toOnboardingAnswers({ ...shop, presence: 'in_person' as const, paymentMethods: ['external', 'card'] }).paymentMethods, ['card']);
});
