import assert from 'node:assert/strict';
import test from 'node:test';

import { axisLabelIndexes, compactMoney, monotonePath, nearestIndex, niceTicks } from '../lib/utils/report-chart.ts';

test('axis ticks land on round numbers at or above the maximum', () => {
  assert.deepEqual(niceTicks(1874), [0, 500, 1000, 1500, 2000]);
  assert.deepEqual(niceTicks(90), [0, 25, 50, 75, 100]);
  assert.deepEqual(niceTicks(4), [0, 1, 2, 3, 4]);
  assert.deepEqual(niceTicks(0), [0, 1]);
});

test('a smooth line passes through every point and never dips below a flat zero', () => {
  const path = monotonePath([
    { x: 0, y: 100 },
    { x: 10, y: 100 },
    { x: 20, y: 0 },
    { x: 30, y: 100 },
  ]);
  assert.match(path, /^M0,100C/);
  assert.ok(path.endsWith(' 30,100'));
  // Control points between two equal values stay on that value (no overshoot).
  assert.ok(path.includes('C3.33,100 6.67,100 10,100'));
  assert.equal(monotonePath([]), '');
  assert.equal(monotonePath([{ x: 1, y: 2 }]), 'M1,2');
});

test('axis labels are spread out, keep both ends and never crowd the last', () => {
  assert.deepEqual(axisLabelIndexes(5, 8), [0, 1, 2, 3, 4]);
  assert.deepEqual(axisLabelIndexes(30, 6), [0, 6, 12, 18, 24, 29]);
  assert.deepEqual(axisLabelIndexes(31, 6), [0, 6, 12, 18, 24, 30]);
  assert.deepEqual(axisLabelIndexes(8, 3), [0, 4, 7]);
  assert.deepEqual(axisLabelIndexes(1, 6), [0]);
  assert.deepEqual(axisLabelIndexes(0, 6), []);
  for (const count of [2, 7, 13, 30, 90, 365]) {
    const indexes = axisLabelIndexes(count, 6);
    assert.equal(indexes[0], 0);
    assert.equal(indexes[indexes.length - 1], count - 1);
    assert.ok(indexes.length <= 6, `${count} points → ${indexes.length} labels`);
  }
});

test('the pointer picks the nearest point, on lines and on centred bars', () => {
  assert.equal(nearestIndex(0, 10, 900), 0);
  assert.equal(nearestIndex(900, 10, 900), 9);
  assert.equal(nearestIndex(140, 10, 900), 1);
  assert.equal(nearestIndex(-50, 10, 900), 0);
  assert.equal(nearestIndex(5000, 10, 900), 9);
  assert.equal(nearestIndex(50, 4, 400, true), 0);
  assert.equal(nearestIndex(350, 4, 400, true), 3);
  assert.equal(nearestIndex(10, 1, 400), 0);
});

test('axis money is compact and in the workspace currency', () => {
  assert.equal(compactMoney(0, 'GBP'), '£0');
  assert.equal(compactMoney(500, 'GBP'), '£500');
  assert.equal(compactMoney(1500, 'GBP'), '£1.5K');
  assert.equal(compactMoney(2000000, 'EUR'), '€2M');
  assert.equal(compactMoney(-1500, 'GBP'), '-£1.5K');
  assert.equal(compactMoney(3_000_000_000, 'GBP'), '£3B');
});
