import assert from 'node:assert/strict';
import test from 'node:test';

const { validLoyaltyRewards } = await import('../lib/utils/pos-loyalty.ts');

const programme = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  canRedeem: true,
  balance: 30,
  rewards: null,
  rewardRule: { kind: 'free_item', cost: 10, modifierGroupIds: [], menuItemIds: [], categoryIds: [] },
  ...over,
});
const line = (over: Record<string, unknown> = {}) => ({
  cartId: 'c1',
  quantity: 2,
  item: { id: 'latte', category: 'coffee' },
  selected: [],
  ...over,
});
const reward = (over: Record<string, unknown> = {}) => ({
  programId: 'p1',
  cartId: 'c1',
  quantity: 1,
  unitDiscountCents: 350,
  discountCents: 350,
  label: 'Free latte',
  ...over,
});

test('a reward that still fits is returned as the same array', () => {
  const chosen = [reward()];
  assert.equal(validLoyaltyRewards(chosen, [line()], [programme()]), chosen);
});

test('a reward on a removed line is dropped', () => {
  assert.deepEqual(validLoyaltyRewards([reward()], [], [programme()]), []);
});

test('quantity is capped by the line and re-priced', () => {
  const out = validLoyaltyRewards([reward({ quantity: 3, discountCents: 1050 })], [line({ quantity: 2 })], [programme()]);
  assert.equal(out[0].quantity, 2);
  assert.equal(out[0].discountCents, 700);
});

test('two rewards share one programme balance', () => {
  const out = validLoyaltyRewards(
    [reward({ quantity: 2, discountCents: 700 }), reward({ cartId: 'c2', quantity: 2, discountCents: 700 })],
    [line({ quantity: 2 }), line({ cartId: 'c2', quantity: 2 })],
    [programme({ balance: 30 })],
  );
  assert.deepEqual(
    out.map((row) => row.quantity),
    [2, 1],
  );
});

test('nothing applies while the wallet is unknown or the programme cannot redeem', () => {
  assert.deepEqual(validLoyaltyRewards([reward()], [line()], undefined), []);
  assert.deepEqual(validLoyaltyRewards([reward()], [line()], [programme({ canRedeem: false })]), []);
});

test('a free modifier needs that modifier, from an allowed group, on the line', () => {
  const rule = { kind: 'free_modifier', cost: 10, modifierGroupIds: ['milk'], menuItemIds: [], categoryIds: [] };
  const chosen = [reward({ modifierId: 'oat' })];
  assert.equal(
    validLoyaltyRewards(chosen, [line({ selected: [{ id: 'oat', groupId: 'milk' }] })], [programme({ rewardRule: rule })]).length,
    1,
  );
  assert.equal(
    validLoyaltyRewards(chosen, [line({ selected: [{ id: 'oat', groupId: 'syrup' }] })], [programme({ rewardRule: rule })]).length,
    0,
  );
});

test('an item rule limits by menu item and category', () => {
  const rule = { kind: 'free_item', cost: 10, modifierGroupIds: [], menuItemIds: ['flat-white'], categoryIds: [] };
  assert.deepEqual(validLoyaltyRewards([reward()], [line()], [programme({ rewardRule: rule })]), []);
});
