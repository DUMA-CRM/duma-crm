import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateReorder } from '../../lib/utils/reorder-planner.ts';

const example = { onHand: 18, incoming: 0, dailyUsage: 6, leadDays: 3, coverDays: 3, packSize: 12 };

test('rounds a stock shortfall up to whole supplier packs', () => {
  assert.deepEqual(calculateReorder(example), { packs: 2, units: 24, target: 36, daysOnHand: 3, mayRunOut: false });
});

test('counts incoming units toward the target and surfaces a possible earlier stockout', () => {
  const result = calculateReorder({ ...example, onHand: 6, incoming: 30 });
  assert.equal(result?.packs, 0);
  assert.equal(result?.daysOnHand, 1);
  assert.equal(result?.mayRunOut, true);
});

test('avoids unnecessary packs at a decimal demand boundary and refuses invalid pack sizes', () => {
  const result = calculateReorder({ ...example, onHand: 0, dailyUsage: 1.1, leadDays: 10, coverDays: 0, packSize: 11 });
  assert.equal(result?.packs, 1);
  assert.equal(calculateReorder({ ...example, dailyUsage: 0 })?.packs, 0);
  assert.equal(calculateReorder({ ...example, packSize: 0 }), null);
  assert.equal(calculateReorder({ ...example, dailyUsage: 0.0003 }), null);
});
