import assert from 'node:assert/strict';
import test from 'node:test';

const { delayAmounts, durationHours, durationMinutes, formatDelay, formatDuration, joinDuration, rangeValues, splitDuration } = await import('../lib/utils/duration.ts');

test('ranges step, and always keep the stored value', () => {
  assert.deepEqual(rangeValues(5, 20, 5), [5, 10, 15, 20]);
  assert.deepEqual(rangeValues(5, 20, 5, 7), [5, 7, 10, 15, 20]);
  assert.deepEqual(rangeValues(1, 3, 1, 50), [1, 2, 3, 50], 'a value outside the range still shows');
  assert.equal(rangeValues(0, 10, 0).length, 11, 'a nonsense step falls back to 1');
});

test('durations split, join within bounds and read naturally', () => {
  assert.deepEqual(splitDuration(90), { hours: 1, minutes: 30 });
  assert.equal(joinDuration(2, 30, 0, 120), 120);
  assert.equal(joinDuration(0, 0, 15, 480), 15);
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(90), '1 h 30 min');
});

test('the minute wheel only offers totals inside the bounds', () => {
  assert.deepEqual(durationHours(0, 150), [0, 1, 2]);
  assert.deepEqual(durationMinutes(2, 15, 0, 150), [0, 15, 30]);
  assert.deepEqual(durationMinutes(0, 15, 30, 150), [30, 45]);
  assert.deepEqual(durationMinutes(1, 15, 0, 150, 7), [0, 7, 15, 30, 45]);
});

test('wait amounts follow the unit and read as a sentence', () => {
  assert.equal(delayAmounts('hours').length, 72);
  assert.ok(delayAmounts('days', 500).includes(500));
  assert.equal(formatDelay(1, 'days'), '1 day');
  assert.equal(formatDelay(3, 'hours'), '3 hours');
});
