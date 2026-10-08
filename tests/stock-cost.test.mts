import assert from 'node:assert/strict';
import test from 'node:test';

const { containerPrice, effectiveUnitCost, movementValue, unitCostFromPrice } = await import('../lib/utils/stock-cost.ts');

test('a container’s own cost wins; the item’s fills in; neither is unknown', () => {
  assert.equal(effectiveUnitCost('0.0030', '0.0050'), 0.003);
  assert.equal(effectiveUnitCost(null, '0.0050'), 0.005);
  assert.equal(effectiveUnitCost(null, null), null);
  assert.equal(effectiveUnitCost('0', '0.0050'), 0, 'a free container is free, not unknown');
});

test('a price for the whole container becomes a cost per unit, and back', () => {
  assert.equal(unitCostFromPrice('3.00', 1000), 0.003);
  assert.equal(unitCostFromPrice('2,50', 1), 2.5, 'a comma decimal is accepted');
  assert.equal(unitCostFromPrice('', 1000), null);
  assert.equal(unitCostFromPrice('abc', 1000), null);
  assert.equal(unitCostFromPrice('3', 0), null);
  assert.equal(containerPrice('0.0030', 1000), 3);
  assert.equal(containerPrice(null, 1000), null);
});

test('a movement is valued at the cost recorded with it, else the item’s', () => {
  assert.equal(movementValue({ quantity: -200, unitCost: '0.0030' }, '0.0100'), 0.6);
  assert.equal(movementValue({ quantity: -200, unitCost: null }, '0.0100'), 2);
  assert.equal(movementValue({ quantity: 5 }, null), null);
});
