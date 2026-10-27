import assert from 'node:assert/strict';
import test from 'node:test';

import { balanceOf, countMinor, needsExplanation, parseMinor } from '../../lib/utils/cash-count.ts';
import { cartTotal, changeDue, promoCheckLines } from '../../lib/utils/pos.ts';
import type { CartItem } from '../../types/pos.ts';

const cart: CartItem[] = [
  {
    cartId: 'coffee',
    quantity: 2,
    item: { id: 'latte', name: 'Latte', category: 'coffee', price: 350, image: '', modifiers: [] },
    selected: [{ id: 'oat', label: 'Oat', price: 45 }],
  },
];

test('checkout charges modifiers per item and handles an empty basket', () => {
  assert.equal(cartTotal(cart), 790);
  assert.equal(cartTotal([]), 0);
});

test('promotion eligibility uses the total after loyalty, never a negative amount', () => {
  assert.deepEqual(promoCheckLines(cart, [{ cartId: 'coffee', discountCents: 395 }]), [
    { menuItemId: 'latte', quantity: 2, lineTotal: '3.95' },
  ]);
  assert.deepEqual(
    promoCheckLines(cart, [
      { cartId: 'coffee', discountCents: 395 },
      { cartId: 'coffee', discountCents: 500 },
    ]),
    [{ menuItemId: 'latte', quantity: 2, lineTotal: '0.00' }],
  );
});

test('cash payment distinguishes change, exact payment, and shortfall', () => {
  for (const [paid, expected] of [
    [1000, { change: 210, short: 0 }],
    [790, { change: 0, short: 0 }],
    [500, { change: 0, short: 290 }],
  ] as const)
    assert.deepEqual(changeDue(paid, 790), expected);
});

test('cash counts use integer minor units and reject invalid amounts', () => {
  assert.equal(countMinor({ 2000: 2, 2: 51, 10: -1, 50: 1.5 }), 4102);
  assert.equal(parseMinor('£1,234.56'), 123456);
  for (const value of ['', '-1', '1.001', 'abc']) assert.equal(parseMinor(value), null, value);
});

test('closing a till requires an explanation at the one-pound boundary in either direction', () => {
  assert.deepEqual(balanceOf(900, 1000), { balance: 'short', difference: -100 });
  assert.deepEqual(balanceOf(1100, 1000), { balance: 'over', difference: 100 });
  assert.deepEqual(balanceOf(1000, 1000), { balance: 'balanced', difference: 0 });
  assert.equal(needsExplanation(-99, 99), false);
  assert.equal(needsExplanation(-100), true);
  assert.equal(needsExplanation(100), true);
});
