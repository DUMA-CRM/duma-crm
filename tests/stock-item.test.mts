import assert from 'node:assert/strict';
import test from 'node:test';

const { expiryLabel, itemAttention } = await import('../lib/utils/stock-item.ts');

const now = new Date(2026, 8, 27, 15);
const base = { isAvailable: true, onHand: 10, threshold: 4, unit: 'kg', daysLeft: 12, earliestExpiry: null, cost: '2.50', now };

test('a healthy item needs nothing', () => {
  assert.deepEqual(itemAttention(base), []);
});

test('stock level: out, critical, low, running out', () => {
  assert.equal(itemAttention({ ...base, onHand: 0 })[0].id, 'out');
  assert.equal(itemAttention({ ...base, onHand: 2 })[0].severity, 'blocking');
  assert.equal(itemAttention({ ...base, onHand: 3 })[0].severity, 'attention');
  assert.equal(itemAttention({ ...base, daysLeft: 2 })[0].id, 'running-out');
});

test('expiry, availability and missing setup, worst first', () => {
  const ids = itemAttention({ ...base, earliestExpiry: '2026-09-26', isAvailable: false, threshold: 0, cost: null }).map((i) => i.id);
  assert.deepEqual(ids, ['expired', 'unavailable', 'no-threshold', 'no-cost']);
  assert.equal(itemAttention({ ...base, earliestExpiry: '2026-09-28' })[0].title, 'A container expires tomorrow');
  assert.deepEqual(itemAttention({ ...base, onHand: 0, earliestExpiry: '2026-09-20' }).map((i) => i.id), ['out']);
});

test('expiry labels', () => {
  assert.equal(expiryLabel('2026-09-26', now), 'Expired');
  assert.equal(expiryLabel('2026-09-27', now), 'Today');
  assert.equal(expiryLabel('2026-10-02', now), 'In 5 days');
  assert.equal(expiryLabel('2026-12-01', now), '1 Dec 2026');
  assert.equal(expiryLabel(null, now), null);
});

test('one day reads singular', () => {
  assert.match(itemAttention({ ...base, onHand: 3, daysLeft: 1 })[0].detail, /about 1 day left/);
});
