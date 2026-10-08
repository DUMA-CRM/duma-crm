import assert from 'node:assert/strict';
import test from 'node:test';

const { hourlyPace } = await import('../lib/utils/hourly-pace.ts');

const buckets = [8, 9, 10, 11].map((hour) => ({ startMinutes: hour * 60 }));

test('the hour in progress counts only its elapsed share of a typical day', () => {
  // 10:30: 8 and 9 are whole, 10 is half; 11 hasn't started.
  const pace = hourlyPace(buckets, [10, 20, 6, 0], [10, 20, 20, 30], 10 * 60 + 30);
  assert.equal(pace.soFar, 36);
  assert.equal(pace.typicalSoFar, 40);
  assert.equal(pace.change, -0.1);
});

test('after close the whole day compares; too thin a typical day gives no change', () => {
  assert.equal(hourlyPace(buckets, [5, 5, 5, 5], [4, 4, 4, 4], 24 * 60).change, 0.25);
  assert.equal(hourlyPace(buckets, [1, 0, 0, 0], [1, 1, 0, 0], 9 * 60 + 30).change, null);
});
