import assert from 'node:assert/strict';
import test from 'node:test';

import { describeRewardScope, getLoyaltyCardProgress, stampColumns } from '../lib/utils/loyalty-card.ts';

test('shows exact progress for a small stamp card', () => {
  assert.deepEqual(getLoyaltyCardProgress(8, 9), {
    rewardCount: 0,
    stampsTowardNext: 8,
    stampsRemaining: 1,
    slots: 9,
    filledSlots: 8,
  });
});

test('starts the next card after a reward is earned', () => {
  assert.deepEqual(getLoyaltyCardProgress(10, 9), {
    rewardCount: 1,
    stampsTowardNext: 1,
    stampsRemaining: 8,
    slots: 9,
    filledSlots: 1,
  });
});

test('compresses large programmes into a readable card', () => {
  assert.deepEqual(getLoyaltyCardProgress(5, 20), {
    rewardCount: 0,
    stampsTowardNext: 5,
    stampsRemaining: 15,
    slots: 12,
    filledSlots: 3,
  });
});

test('stamps sit in one row up to six, then two even rows', () => {
  assert.equal(stampColumns(6), 6);
  assert.equal(stampColumns(10), 5);
  assert.equal(stampColumns(9), 5);
  assert.equal(stampColumns(12), 6);
  assert.equal(stampColumns(0), 1);
});

test('a reward scope reads as names when they resolve', () => {
  const items = new Map([
    ['a', 'Flat white'],
    ['b', 'Latte'],
  ]);
  assert.deepEqual(describeRewardScope({ kind: 'free_item', menuItemIds: ['a', 'b'], categoryIds: [], modifierGroupIds: [] }, { items }), [
    'Flat white',
    'Latte',
  ]);
});

test('a reward scope falls back to a count, never to "any item"', () => {
  const items = new Map([['a', 'Flat white']]);
  assert.deepEqual(
    describeRewardScope({ kind: 'free_item', menuItemIds: ['a', 'gone'], categoryIds: ['c'], modifierGroupIds: [] }, { items }),
    ['2 menu items', '1 category'],
  );
  assert.deepEqual(describeRewardScope({ kind: 'percentage_off', menuItemIds: [], categoryIds: [], modifierGroupIds: [] }), [
    'Any item on the menu',
  ]);
  assert.deepEqual(describeRewardScope({ kind: 'free_modifier', menuItemIds: ['x'], categoryIds: [], modifierGroupIds: [] }), [
    'Any modifier',
  ]);
});
