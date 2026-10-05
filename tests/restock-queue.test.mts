import assert from 'node:assert/strict';
import test from 'node:test';

const { dayLabel, orderRequests, requestContext } = await import('../lib/utils/restock-queue.ts');

test('pending requests queue urgent first, then the longest-waiting; history reads newest first', () => {
  const r = (id: string, status: string, createdAt: string, urgent = false) => ({ id, status, createdAt, urgent });
  const priority = (x: { urgent: boolean }) => (x.urgent ? 'urgent' : 'standard') as 'urgent' | 'standard';
  assert.deepEqual(
    orderRequests([r('a', 'pending', '2026-09-27T09:00Z'), r('b', 'pending', '2026-09-27T08:00Z'), r('c', 'pending', '2026-09-27T10:00Z', true)], priority).map((x) => x.id),
    ['c', 'b', 'a'],
  );
  assert.deepEqual(
    orderRequests([r('a', 'approved', '2026-09-26T09:00Z'), r('b', 'approved', '2026-09-27T09:00Z')], priority).map((x) => x.id),
    ['b', 'a'],
  );
});

test('the decision context says what is on the shelf and flags an oversized request', () => {
  assert.equal(requestContext(3, undefined), null);
  assert.deepEqual(requestContext(3, { qty: 1.5, threshold: 2, unit: 'kg', coverDays: 3.2 }), { text: '1.5 kg on hand · par 2 · 3 days left', tone: 'low' });
  assert.equal(requestContext(50, { qty: 5, threshold: 4, unit: 'kg', coverDays: null })?.tone, 'over');
  assert.equal(requestContext(1, { qty: 10, threshold: 4, unit: 'kg', coverDays: 20 })?.tone, 'ok');
});

test('day labels', () => {
  const now = new Date(2026, 8, 27, 12);
  assert.equal(dayLabel(new Date(2026, 8, 27, 8).toISOString(), now), 'Today');
  assert.equal(dayLabel(new Date(2026, 8, 26, 8).toISOString(), now), 'Yesterday');
  assert.equal(dayLabel(new Date(2026, 8, 20, 8).toISOString(), now), 'Sunday 20 September');
});
