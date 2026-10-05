import assert from 'node:assert/strict';
import test from 'node:test';

const {
  EMPTY_DRAFT, nextStep, previousStep, progressFor, resolveStep, slugFrom, visibleSteps,
} = await import('../lib/onboarding/flow.ts');
const { businessProfile, selectedModulesFor, toOnboardingAnswers } = await import('../lib/onboarding/answers.ts');

type Draft = typeof EMPTY_DRAFT;
const draft = (overrides: Partial<Draft>): Draft => ({ ...EMPTY_DRAFT, ...overrides });
const ids = (d: Draft) => visibleSteps(d).map((step) => step.id);

const cafe = draft({
  businessName: 'North Street Coffee', presence: 'in_person', servesFood: true, businessType: 'cafe', locationCount: 3,
  fulfilment: ['table_service', 'collection'], kitchenScreen: true, qrOrdering: true, paymentMethods: ['card', 'cash'],
  stockTracking: 'batch_expiry', automaticConsumption: true, purchasing: true, teamSize: 'small',
  teamNeeds: ['scheduling', 'payroll'], customerNeeds: ['loyalty'], extras: ['analytics'],
});

test('a café sees the kitchen and table-ordering questions', () => {
  const steps = ids(cafe);
  for (const id of ['locations', 'kitchen', 'qr', 'consumption', 'suppliers', 'teamNeeds'] as const) assert.ok(steps.includes(id), id);
});

test('an online-only shop skips premises questions', () => {
  const steps = ids(draft({ presence: 'online', servesFood: false, businessType: 'online_retail', stockTracking: 'none', teamSize: 'solo' }));
  for (const id of ['locations', 'kitchen', 'qr', 'consumption', 'suppliers', 'teamNeeds'] as const) assert.ok(!steps.includes(id), id);
});

test('services skip fulfilment', () => {
  assert.ok(!ids(draft({ businessType: 'services' })).includes('fulfilment'));
});

test('next and previous walk only visible steps', () => {
  const online = draft({ presence: 'online', businessType: 'online_retail' });
  assert.equal(nextStep('kind', online), 'channels');
  assert.equal(previousStep('channels', online), 'kind');
  assert.equal(previousStep('welcome', online), null);
});

test('a deep link past an unanswered question lands on that question', () => {
  assert.equal(resolveStep('review', draft({ businessName: 'Acme' }), ''), 'presence');
  assert.equal(resolveStep('name', EMPTY_DRAFT, ''), 'name');
});

test('a restored session without the password is sent back for it', () => {
  const ready = draft({ ...cafe, ownerName: 'Alex Morgan', email: 'alex@example.com', locationName: 'North', locationAddress: '12 North St' });
  assert.equal(resolveStep('location', ready, ''), 'password');
  assert.equal(resolveStep('location', ready, 'a-long-enough-password'), 'location');
});

test('an unknown or hidden step falls back safely', () => {
  const online = draft({ ...cafe, presence: 'online' });
  // kitchen is hidden for an online business; clamp rather than render it
  assert.notEqual(resolveStep('kitchen', online, ''), 'kitchen');
});

test('progress counts questions, not interstitials, and never reports zero minutes', () => {
  const start = progressFor('welcome', cafe);
  assert.equal(start.overall, 0);
  assert.equal(start.activeSection, null);
  const review = progressFor('review', cafe);
  assert.ok(review.overall > 0.9 && review.overall < 1);
  assert.deepEqual(review.sections.slice(0, 3), [1, 1, 1]);
  assert.equal(review.activeSection, 'account');
  assert.equal(review.minutesLeft, 1);
});

test('a café maps to the API answer contract', () => {
  const answers = toOnboardingAnswers(cafe);
  assert.equal(answers.businessType, 'cafe');
  assert.equal(answers.locationCount, 3);
  assert.deepEqual(answers.salesChannels, ['counter', 'qr']);
  assert.deepEqual(answers.fulfilment, ['collection', 'prepare', 'table_service']);
  assert.deepEqual(answers.paymentMethods, ['card', 'cash']);
  assert.equal(answers.liveFulfilmentQueue, true);
  assert.equal(answers.automaticConsumption, true);
  assert.equal(answers.scheduling, true);
  assert.equal(answers.payroll, true);
  assert.equal(answers.attendance, false);
  assert.equal(answers.loyalty, true);
  assert.equal(answers.analytics, true);
});

test('answers on steps a later answer hid are ignored', () => {
  const answers = toOnboardingAnswers(draft({
    ...cafe, presence: 'online', stockTracking: 'none', teamSize: 'solo',
  }));
  assert.equal(answers.locationCount, 1);
  assert.deepEqual(answers.salesChannels, ['online']);
  assert.ok(!answers.fulfilment.includes('table_service'));
  assert.ok(!answers.paymentMethods.includes('cash'));
  assert.equal(answers.liveFulfilmentQueue, false);
  assert.equal(answers.automaticConsumption, false);
  assert.equal(answers.purchasing, false);
  assert.equal(answers.scheduling, false);
  assert.equal(answers.payroll, false);
});

test('only offered add-ons are activated', () => {
  assert.deepEqual(
    selectedModulesFor({ requiredModules: ['core', 'ordering'], optionalModules: ['analytics'] }, ['analytics', 'payments']),
    ['analytics', 'core', 'ordering'],
  );
});

test('the business profile reads naturally', () => {
  const profile = businessProfile(cafe);
  assert.equal(profile.noun, 'coffee shop group');
  assert.equal(profile.article, 'a');
  assert.ok(profile.traits.includes('3 locations'));
  assert.ok(profile.traits.includes('table ordering'));
  assert.equal(businessProfile(draft({ businessType: 'online_retail', presence: 'online' })).article, 'an');
  assert.equal(businessProfile(draft({ businessType: 'retail', presence: 'both' })).noun, 'shop with an online store');
});

test('workspace IDs are derived safely', () => {
  assert.equal(slugFrom('Café Crème & Co.'), 'cafe-creme-co');
  assert.equal(slugFrom(`${'a'.repeat(62)} b`), 'a'.repeat(62));
});

const { draftFromAnswers } = await import('../lib/onboarding/answers.ts');

test('saved answers round-trip back into a draft', () => {
  const answers = toOnboardingAnswers(cafe);
  const restored = draft({ ...draftFromAnswers(answers), businessName: cafe.businessName });
  assert.deepEqual(toOnboardingAnswers(restored), answers);
});

test('restoring tolerates missing and legacy answers', () => {
  assert.deepEqual(draftFromAnswers(null), {});
  const legacy = draftFromAnswers({ businessType: 'people_management', stockTracking: 'container', salesChannels: ['online'] });
  assert.equal(legacy.businessType, 'other');
  assert.equal(legacy.stockTracking, 'simple');
  assert.equal(legacy.presence, 'online');
  assert.equal(legacy.teamSize, undefined);
});
