import assert from 'node:assert/strict';
import test from 'node:test';

const { APPROACH_MINS, CRASH_MINS, ageState, isLate, stageSince } = await import('../lib/utils/kitchen-age.ts');

const NOW = new Date('2026-08-07T12:00:00Z').getTime();
const minutesAgo = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

test('the stage clock is the current stage, not when the customer ordered', () => {
  const order = { createdAt: minutesAgo(45), updatedAt: minutesAgo(1) };
  assert.equal(stageSince(order), order.updatedAt);
  assert.equal(Math.round(ageState(order, NOW).mins), 1);
});

test('an order that has never moved falls back to when it was created', () => {
  const order = { createdAt: minutesAgo(7), updatedAt: undefined };
  assert.equal(stageSince(order), order.createdAt);
  assert.equal(Math.round(ageState(order, NOW).mins), 7);
});

test('the dashboard flags exactly what the kitchen paints red', () => {
  // The reported case: 8 minutes in one stage. Red on KDS, so late on the
  // dashboard too — it used to need 15 minutes and reported zero.
  const eightMinutes = { createdAt: minutesAgo(8), updatedAt: minutesAgo(8) };
  assert.equal(ageState(eightMinutes, NOW).tone, 'crashed');
  assert.equal(isLate(eightMinutes, NOW), true);
});

test('the three tones follow the thresholds', () => {
  const at = (mins: number) => ageState({ createdAt: minutesAgo(mins), updatedAt: minutesAgo(mins) }, NOW).tone;
  assert.equal(at(0), 'ok');
  assert.equal(at(APPROACH_MINS - 0.1), 'ok');
  assert.equal(at(APPROACH_MINS), 'approaching');
  assert.equal(at(CRASH_MINS - 0.1), 'approaching');
  assert.equal(at(CRASH_MINS), 'crashed');
});

test('the ageing bar fills toward the limit and stops there', () => {
  const at = (mins: number) => ageState({ createdAt: minutesAgo(mins), updatedAt: minutesAgo(mins) }, NOW).ratio;
  assert.equal(at(0), 0);
  assert.equal(at(CRASH_MINS / 2), 0.5);
  assert.equal(at(CRASH_MINS), 1);
  assert.equal(at(CRASH_MINS * 10), 1, 'the bar cannot overflow');
});

test('a timestamp in the future does not read as negative age', () => {
  const future = { createdAt: minutesAgo(-5), updatedAt: minutesAgo(-5) };
  assert.equal(ageState(future, NOW).mins, 0);
  assert.equal(isLate(future, NOW), false);
});
