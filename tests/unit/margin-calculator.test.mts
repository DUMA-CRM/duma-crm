import assert from 'node:assert/strict';
import test from 'node:test';

import { computeCosting } from '../../lib/menu/costing.ts';
import { foodCostPct, parseAmount, priceForTargetMargin, recipeCost, roundUpPrice } from '../../lib/utils/margin-calculator.ts';

const REGISTERED_INCLUSIVE = { pricesIncludeTax: true, defaultVatRate: 20, vatRegistered: true };
const REGISTERED_EXCLUSIVE = { pricesIncludeTax: false, defaultVatRate: 20, vatRegistered: true };
const NOT_REGISTERED = { pricesIncludeTax: true, defaultVatRate: 20, vatRegistered: false };

test('typed amounts: blanks and nonsense are not zero, and a pound sign or thousands comma is fine', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('  '), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('-2'), null);
  assert.equal(parseAmount('1.2.3'), null);
  assert.equal(parseAmount('£3.20'), 3.2);
  assert.equal(parseAmount('1,250.00'), 1250);
  assert.equal(parseAmount('0'), 0);
  assert.equal(parseAmount('.5'), 0.5);
});

test('recipe cost adds fractions of a penny without float drift and skips blank lines', () => {
  assert.equal(recipeCost([{ cost: '0.1' }, { cost: '0.2' }, { cost: '' }, { cost: 'x' }]), 0.3);
  assert.equal(recipeCost([{ cost: '0.125' }, { cost: '0.125' }, { cost: '0.35' }]), 0.6);
});

test('food cost is the share of the net price, so VAT is not counted as the cafe’s money', () => {
  // £3.20 inclusive at 20%: VAT 53p, the cafe keeps £2.67, ingredients 60p.
  const costing = computeCosting({ price: 3.2, cogs: 0.6, ctx: REGISTERED_INCLUSIVE });
  assert.equal(costing.netRevenue, 2.67);
  const pct = foodCostPct(costing);
  assert.ok(pct !== null && Math.abs(pct - (0.6 / 2.67) * 100) < 1e-9);
  assert.equal(foodCostPct(computeCosting({ price: 0, cogs: 0.6, ctx: REGISTERED_INCLUSIVE })), null);
});

test('target price is the lowest penny that reaches the margin, judged by costing.ts', () => {
  for (const ctx of [REGISTERED_INCLUSIVE, REGISTERED_EXCLUSIVE, NOT_REGISTERED]) {
    for (const [cogs, target] of [
      [0.6, 70],
      [1.37, 65],
      [2.49, 72.5],
      [0.07, 90],
    ] as const) {
      const price = priceForTargetMargin({ cogs, targetPct: target, ctx });
      assert.ok(price !== null, `${cogs} @ ${target}%`);
      assert.ok(computeCosting({ price, cogs, ctx }).marginPct >= target, `reaches ${target}% at ${price}`);
      const penny_less = Math.round(price * 100 - 1) / 100;
      assert.ok(computeCosting({ price: penny_less, cogs, ctx }).marginPct < target, `${penny_less} would not reach ${target}%`);
    }
  }
});

test('VAT changes the answer: a registered cafe must charge more for the same margin', () => {
  // 60p of ingredients at 70%: £2.00 net, so £2.40 on a VAT-inclusive menu, £2.00 if not registered.
  assert.equal(priceForTargetMargin({ cogs: 0.6, targetPct: 70, ctx: REGISTERED_INCLUSIVE }), 2.4);
  assert.equal(priceForTargetMargin({ cogs: 0.6, targetPct: 70, ctx: NOT_REGISTERED }), 2);
  // A zero-rated item on a registered menu needs no VAT on top.
  assert.equal(priceForTargetMargin({ cogs: 0.6, targetPct: 70, itemVatRate: 0, ctx: REGISTERED_INCLUSIVE }), 2);
  // A 5% item.
  assert.equal(priceForTargetMargin({ cogs: 0.6, targetPct: 70, itemVatRate: 5, ctx: REGISTERED_INCLUSIVE }), 2.1);
});

test('impossible targets have no price', () => {
  assert.equal(priceForTargetMargin({ cogs: 0.6, targetPct: 100, ctx: REGISTERED_INCLUSIVE }), null);
  assert.equal(priceForTargetMargin({ cogs: 0.6, targetPct: -5, ctx: REGISTERED_INCLUSIVE }), null);
  assert.equal(priceForTargetMargin({ cogs: 0.6, targetPct: Number.NaN, ctx: REGISTERED_INCLUSIVE }), null);
  assert.equal(priceForTargetMargin({ cogs: 0, targetPct: 80, ctx: REGISTERED_INCLUSIVE }), 0.01);
});

test('a target price rounded up for the menu never falls below the target margin', () => {
  for (const ctx of [REGISTERED_INCLUSIVE, NOT_REGISTERED]) {
    const exact = priceForTargetMargin({ cogs: 0.73, targetPct: 70, ctx })!;
    const menu = roundUpPrice(exact, 10);
    assert.ok(menu >= exact && Math.round(menu * 100) % 10 === 0);
    assert.ok(computeCosting({ price: menu, cogs: 0.73, ctx }).marginPct >= 70);
  }
  assert.equal(roundUpPrice(2.4, 10), 2.4);
  assert.equal(roundUpPrice(2.41, 10), 2.5);
  assert.equal(roundUpPrice(2.41, 5), 2.45);
});
