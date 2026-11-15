import assert from 'node:assert/strict';
import test from 'node:test';

import { type ProgrammeRules, expiryShort, programmeProblem, programmePromise, sentenceList } from '../../lib/utils/loyalty-programme.ts';

const card = (changes: Partial<ProgrammeRules> = {}): ProgrammeRules => ({
  name: 'Coffee card',
  unitSingular: 'stamp',
  unitPlural: 'stamps',
  earnRule: { scope: 'categories', menuItemIds: [], categoryIds: ['coffee'], unitsPerItem: 1, trigger: 'purchase', benefitMode: 'rewards' },
  rewardRule: {
    kind: 'free_item',
    cost: 9,
    menuItemIds: [],
    categoryIds: [],
    modifierGroupIds: [],
    discountPercent: null,
    maxDiscountCents: null,
    validity: { type: 'never' },
  },
  locationIds: null,
  ...changes,
});

test('the promise reads as the customer would hear it, for each way a programme can work', () => {
  const names = { earnOn: 'Coffee', spendOn: 'any item' };
  assert.equal(programmePromise(card(), names), 'Earn 1 stamp for every Coffee item you buy. Collect 9 stamps, get a free item.');
  assert.equal(
    programmePromise(card({ earnRule: { ...card().earnRule, benefitMode: 'points', unitsPerItem: 5, scope: 'all_items' } }), {
      earnOn: 'every product',
      spendOn: 'any item',
    }),
    'Earn 5 points for every item you buy.',
  );
  assert.equal(
    programmePromise(
      card({
        earnRule: { ...card().earnRule, trigger: 'birthday', benefitMode: 'both', unitsPerItem: 50 },
        rewardRule: { ...card().rewardRule, kind: 'percentage_off', discountPercent: 25 },
      }),
      { earnOn: 'Coffee', spendOn: 'Cakes' },
    ),
    'Get 50 points and 25% off on Cakes on your birthday.',
  );
});

test('a draft is held back by the first thing it is missing, and a birthday ignores what earns', () => {
  assert.equal(programmeProblem(card()), null);
  assert.deepEqual(programmeProblem(card({ name: '  ' })), { section: 'details', message: 'Give the programme a name.' });
  assert.equal(
    programmeProblem(card({ earnRule: { ...card().earnRule, categoryIds: [] } }))?.message,
    'Choose at least one section that earns.',
  );
  assert.equal(programmeProblem(card({ earnRule: { ...card().earnRule, categoryIds: [], trigger: 'birthday' } })), null);
  assert.equal(programmeProblem(card({ rewardRule: { ...card().rewardRule, kind: 'free_modifier' } }))?.section, 'reward');
  // A points-only programme has no reward, so the reward's gaps don't block it.
  assert.equal(
    programmeProblem(
      card({ earnRule: { ...card().earnRule, benefitMode: 'points' }, rewardRule: { ...card().rewardRule, kind: 'free_modifier' } }),
    ),
    null,
  );
  assert.equal(programmeProblem(card({ locationIds: [] }))?.section, 'locations');
});

test('lists name two, then count the rest', () => {
  assert.equal(sentenceList([], 'any item'), 'any item');
  assert.equal(sentenceList(['Coffee', 'Tea', 'Cakes', 'Juice'], ''), 'Coffee, Tea and 2 more');
});

test('expiry reads as a row value', () => {
  assert.equal(expiryShort(undefined), 'Never');
  assert.equal(expiryShort({ type: 'days', days: 30 }), 'After 30 days');
  assert.equal(expiryShort({ type: 'date', date: '2027-01-05' }), 'On 5 Jan 2027');
  assert.equal(expiryShort({ type: 'date', date: '' }), 'On a date');
});
