import assert from 'node:assert/strict';
import test from 'node:test';

import { validLoyaltyRewards } from '../../lib/utils/pos-loyalty.ts';
import type { AppliedLoyaltyReward } from '../../types/pos.ts';

const programme = {
  id: 'stamps',
  canRedeem: true,
  balance: 30,
  rewardRule: { kind: 'free_item', cost: 10, modifierGroupIds: [], menuItemIds: ['latte'], categoryIds: [] },
};
const line = (cartId: string, quantity = 2) => ({ cartId, quantity, item: { id: 'latte', category: 'coffee' }, selected: [] });
const reward = (cartId: string): AppliedLoyaltyReward => ({
  programId: 'stamps',
  cartId,
  quantity: 2,
  unitDiscountCents: 350,
  discountCents: 700,
  label: 'Free coffee',
});

test('multiple redemptions share the wallet balance and recalculate the allowed discount', () => {
  const result = validLoyaltyRewards([reward('a'), reward('b')], [line('a'), line('b')], [programme]);
  assert.deepEqual(
    result.map(({ quantity, discountCents }) => ({ quantity, discountCents })),
    [
      { quantity: 2, discountCents: 700 },
      { quantity: 1, discountCents: 350 },
    ],
  );
});

test('redemption is capped by purchased quantity and removed with its cart line', () => {
  const result = validLoyaltyRewards([reward('a'), reward('removed')], [line('a', 1)], [programme]);
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 1);
  assert.equal(result[0].discountCents, 350);
});

test('unknown wallets, exhausted balances, and ineligible items cannot redeem', () => {
  for (const programmes of [undefined, [{ ...programme, canRedeem: false }], [{ ...programme, balance: 9 }]]) {
    assert.deepEqual(validLoyaltyRewards([reward('a')], [line('a')], programmes), []);
  }
  const otherItem = { ...line('a'), item: { id: 'cake', category: 'food' } };
  assert.deepEqual(validLoyaltyRewards([reward('a')], [otherItem], [programme]), []);
});
