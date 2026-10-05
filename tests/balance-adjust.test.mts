import assert from 'node:assert/strict';
import test from 'node:test';

import { planAdjustment, rewardsCompleted } from '../lib/utils/balance-adjust.ts';

test('adding signs the delta positive and raises the balance', () => {
  assert.deepEqual(planAdjustment(120, 'add', 50), { delta: 50, after: 170, belowZero: false, valid: true });
});

test('removing signs the delta negative', () => {
  assert.deepEqual(planAdjustment(120, 'remove', 20), { delta: -20, after: 100, belowZero: false, valid: true });
});

test('removing more than the balance is refused, and the preview stops at zero', () => {
  assert.deepEqual(planAdjustment(30, 'remove', 50), { delta: -50, after: 0, belowZero: true, valid: false });
});

test('removing exactly the balance is allowed', () => {
  assert.equal(planAdjustment(30, 'remove', 30).valid, true);
});

test('a zero, fractional or missing amount is not something to submit', () => {
  assert.equal(planAdjustment(10, 'add', 0).valid, false);
  assert.equal(planAdjustment(10, 'add', Number.NaN).valid, false);
  assert.equal(planAdjustment(10, 'add', 2.7).delta, 2);
});

test('a stamp change that fills the card completes a reward', () => {
  assert.equal(rewardsCompleted(8, 10, 9), 1);
  assert.equal(rewardsCompleted(8, 19, 9), 2);
  assert.equal(rewardsCompleted(10, 8, 9), -1);
  assert.equal(rewardsCompleted(2, 5, 9), 0);
});
