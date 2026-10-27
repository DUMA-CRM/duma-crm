import assert from 'node:assert/strict';
import test from 'node:test';

import { effectiveUnitCost, movementValue, unitCostFromPrice } from '../../lib/utils/stock-cost.ts';
import { parseCount, summarise } from '../../lib/utils/stocktake.ts';

test('stock costs distinguish free stock from unknown cost', () => {
  assert.equal(effectiveUnitCost('0', '0.005'), 0);
  assert.equal(effectiveUnitCost(null, '0.005'), 0.005);
  assert.equal(effectiveUnitCost(null, null), null);
  assert.equal(unitCostFromPrice('3.00', 1000), 0.003);
  for (const [price, quantity] of [
    ['3', 0],
    ['-3', 1000],
    ['', 1000],
  ] as const) {
    assert.equal(unitCostFromPrice(price, quantity), null);
  }
});

test('historical stock movements retain their recorded cost instead of current prices', () => {
  assert.equal(movementValue({ quantity: -250, unitCost: '0.004' }, '0.010'), 1);
  assert.equal(movementValue({ quantity: -250 }, '0.010'), 2.5);
  assert.equal(movementValue({ quantity: 250 }, null), null);
});

test('stock counts distinguish missing counts from zero and reject impossible precision or range', () => {
  assert.equal(parseCount(''), null);
  assert.equal(parseCount('0'), 0);
  assert.equal(parseCount('1,25'), 1.25);
  assert.equal(parseCount('999999'), 999999);
  for (const input of ['-1', '1.255', '1000000', 'abc']) assert.equal(parseCount(input), 'invalid', input);
});

test('stocktake values counted differences without valuing unknown or uncounted stock', () => {
  const result = summarise([
    { stockItemId: 'milk', expected: 10, counted: 8, cost: 1.25 },
    { stockItemId: 'beans', expected: 2, counted: 3, cost: 4 },
    { stockItemId: 'cups', expected: 5, counted: 0, cost: null },
    { stockItemId: 'syrup', expected: 5, counted: null, cost: 10 },
  ]);
  assert.equal(result.valuePence, 150);
  assert.equal(result.unpriced, 1);
  assert.equal(result.uncounted, 1);
  assert.equal(result.differences, 3);
});
