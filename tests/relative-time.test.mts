import assert from 'node:assert/strict';
import test from 'node:test';

const { relativeTime } = await import('../lib/utils/relative-time.ts');
const { meterGeometry } = await import('../lib/utils/meter.ts');

const NOW = Date.parse('2026-10-05T12:00:00Z');
const at = (ms: number) => new Date(NOW - ms).toISOString();

test('relative time reads the past in one spelling', () => {
  assert.equal(relativeTime(at(20_000), NOW), 'just now');
  assert.equal(relativeTime(at(12 * 60_000), NOW), '12m ago');
  assert.equal(relativeTime(at(3 * 3_600_000), NOW), '3h ago');
  assert.equal(relativeTime(at(2 * 86_400_000), NOW), '2d ago');
  assert.equal(relativeTime(at(90 * 86_400_000), NOW), '3mo ago');
  assert.equal(relativeTime(at(800 * 86_400_000), NOW), '2y ago');
});

test('relative time reads the future forwards', () => {
  assert.equal(relativeTime(at(-3 * 3_600_000), NOW), 'in 3h');
  assert.equal(relativeTime(at(-23 * 86_400_000), NOW), 'in 23d');
});

test('relative time gives up quietly on a bad timestamp', () => {
  assert.equal(relativeTime('not a date', NOW), '');
  assert.equal(relativeTime(null, NOW), '');
});

test('a meter fills against its max and clamps', () => {
  assert.deepEqual(meterGeometry(5, 10), { fill: 50, mark: null, over: false });
  assert.deepEqual(meterGeometry(15, 10), { fill: 100, mark: null, over: false });
  assert.deepEqual(meterGeometry(-2, 10), { fill: 0, mark: null, over: false });
});

test('a meter with only a target puts the target at two thirds', () => {
  const g = meterGeometry(4, null, 8);
  assert.equal(Math.round(g.mark ?? -1), 67);
  assert.equal(Math.round(g.fill), 33);
  assert.equal(g.over, false);
  assert.equal(meterGeometry(20, null, 8).over, true);
  assert.equal(meterGeometry(20, null, 8).fill, 100);
});

test('an empty meter is an empty track, not NaN', () => {
  assert.deepEqual(meterGeometry(0, 0), { fill: 0, mark: null, over: false });
  assert.deepEqual(meterGeometry(0, null, 0), { fill: 0, mark: null, over: false });
});
