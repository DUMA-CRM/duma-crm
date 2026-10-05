import assert from 'node:assert/strict';
import test from 'node:test';

const { byImpact, countDuration, formatDelta, inView, parseCount, summarise, variance } = await import('../lib/utils/stocktake.ts');

test('counts are read the way the API accepts them', () => {
  assert.equal(parseCount(''), null);
  assert.equal(parseCount(' 12 '), 12);
  assert.equal(parseCount('0,5'), 0.5);
  assert.equal(parseCount('1.25'), 1.25);
  assert.equal(parseCount('1.255'), 'invalid');
  assert.equal(parseCount('-1'), 'invalid');
  assert.equal(parseCount('abc'), 'invalid');
  assert.equal(parseCount('1000000'), 'invalid');
});

test('variance tone, size and the minus sign', () => {
  assert.deepEqual(variance(10, 10), { delta: 0, tone: 'match', large: false });
  assert.deepEqual(variance(10, 9.5), { delta: -0.5, tone: 'short', large: false });
  assert.equal(variance(10, 8).large, true);
  assert.equal(variance(0, 1).large, true);
  assert.equal(variance(0.3, 0.1).delta, -0.2);
  assert.equal(formatDelta(2), '+2');
  assert.equal(formatDelta(-0.5), '−0.5');
});

test('summary counts, and values only priced differences', () => {
  const s = summarise([
    { stockItemId: 'a', expected: 10, counted: 10, cost: 1 },
    { stockItemId: 'b', expected: 10, counted: 8, cost: 1.5 },
    { stockItemId: 'c', expected: 2, counted: 3, cost: null },
    { stockItemId: 'd', expected: 5, counted: null, cost: 2 },
  ]);
  assert.deepEqual(s, { total: 4, counted: 3, uncounted: 1, matched: 1, over: 1, short: 1, differences: 2, valuePence: -300, unpriced: 1 });
});

test('views and worst-first ordering', () => {
  assert.equal(inView('todo', 5, null), true);
  assert.equal(inView('differences', 5, 5), false);
  assert.equal(inView('differences', 5, 4), true);
  const ordered = byImpact([
    { stockItemId: 'small', expected: 10, counted: 9, cost: 0.1 },
    { stockItemId: 'big', expected: 10, counted: 5, cost: 2 },
    { stockItemId: 'none', expected: 10, counted: null },
  ]);
  assert.deepEqual(ordered.map((l) => l.stockItemId), ['big', 'small', 'none']);
});

test('duration reads in minutes and hours', () => {
  assert.equal(countDuration('2026-09-27T08:00:00Z', '2026-09-27T08:42:00Z'), '42 min');
  assert.equal(countDuration('2026-09-27T08:00:00Z', '2026-09-27T09:05:00Z'), '1 h 5 min');
  assert.equal(countDuration('2026-09-27T08:00:00Z', null), null);
});
