import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_VAT_CONTEXT, computeCosting, effectiveVatRate, recipeCost, vatContextFrom } from '../../lib/menu/costing.ts';

const registered = { pricesIncludeTax: true, defaultVatRate: 20, vatRegistered: true };

test('VAT context: unloaded settings deduct nothing, and only an explicit false makes prices exclusive', () => {
  assert.deepEqual(vatContextFrom(null), DEFAULT_VAT_CONTEXT);
  assert.equal(DEFAULT_VAT_CONTEXT.vatRegistered, false);
  assert.deepEqual(vatContextFrom({ pricesIncludeTax: false, defaultVatRate: '5', vatRegistered: true }), {
    pricesIncludeTax: false,
    defaultVatRate: 5,
    vatRegistered: true,
  });
  const loose = vatContextFrom({ defaultVatRate: 'n/a' } as unknown as Parameters<typeof vatContextFrom>[0]);
  assert.deepEqual(loose, { pricesIncludeTax: true, defaultVatRate: 0, vatRegistered: false });
});

test('VAT rate: none when not registered; an item override, including zero-rated, beats the default', () => {
  assert.equal(effectiveVatRate('20', { ...registered, vatRegistered: false }), 0);
  assert.equal(effectiveVatRate('5', registered), 5);
  assert.equal(effectiveVatRate('0', registered), 0);
  assert.equal(effectiveVatRate(null, registered), 20);
  assert.equal(effectiveVatRate('', registered), 20);
  assert.equal(effectiveVatRate('abc', registered), 20);
  assert.equal(effectiveVatRate(null, { ...registered, defaultVatRate: -5 }), 0);
});

test('VAT-exclusive prices add VAT on top; the business still keeps the whole price', () => {
  const costing = computeCosting({ price: 10, cogs: 2.5, ctx: { ...registered, pricesIncludeTax: false } });
  assert.equal(costing.vat, 2);
  assert.equal(costing.grossCharged, 12);
  assert.equal(costing.netRevenue, 10);
  assert.equal(costing.margin, 7.5);
  assert.equal(costing.marginPct, 75);
});

test('recipe cost: default lines only, exact, and unknown rather than zero when anything is uncosted', () => {
  const lines = [
    { quantity: '0.018', sizeModifierId: null, stockItem: { costPerUnit: '12.5000' } },
    { quantity: '0.2', sizeModifierId: null, stockItem: { costPerUnit: '1.10' } },
    // A large size's milk replaces the default line; it is not added to it.
    { quantity: '0.3', sizeModifierId: 'large', stockItem: { costPerUnit: '1.10' } },
  ];
  assert.deepEqual(recipeCost(lines), { hasRecipe: true, costComplete: true, cost: 0.445 });

  // 0.1 × 0.2 twice is 0.04000000000000001 in floats.
  assert.equal(
    recipeCost([
      { quantity: '0.1', stockItem: { costPerUnit: '0.2' } },
      { quantity: '0.2', stockItem: { costPerUnit: '0.1' } },
    ]).cost,
    0.04,
  );

  assert.deepEqual(recipeCost([...lines, { quantity: '1', stockItem: { costPerUnit: null } }]), {
    hasRecipe: true,
    costComplete: false,
    cost: null,
  });
  assert.deepEqual(recipeCost([{ quantity: '1', sizeModifierId: 'large', stockItem: { costPerUnit: '1' } }]), {
    hasRecipe: false,
    costComplete: false,
    cost: null,
  });
  assert.deepEqual(recipeCost(undefined), { hasRecipe: false, costComplete: false, cost: null });
  // A costed ingredient at zero is a real cost of nothing, not an unknown one.
  assert.equal(recipeCost([{ quantity: '1', stockItem: { costPerUnit: '0' } }]).cost, 0);
});
