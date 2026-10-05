import assert from 'node:assert/strict';
import test from 'node:test';

const { NEXT_STATUS, PREVIOUS_STATUS, allDay, arrivals, elapsedLabel, isOnScreen, ticketName } = await import('../lib/utils/kds.ts');
const { stageSince, ageState } = await import('../lib/utils/kitchen-age.ts');

const T0 = Date.parse('2026-09-28T12:00:00Z');

test('bumps only go forward, and undo never reopens a completed order', () => {
  assert.equal(NEXT_STATUS.pending, 'preparing');
  assert.equal(NEXT_STATUS.ready, 'done');
  assert.equal(PREVIOUS_STATUS.ready, 'preparing');
  assert.equal(PREVIOUS_STATUS.done, undefined);
});

test('only paid, released tickets are on screen', () => {
  assert.equal(isOnScreen({ paymentStatus: 'paid' }, T0), true);
  assert.equal(isOnScreen({ paymentStatus: 'awaiting_cash_approval' }, T0), false);
  assert.equal(isOnScreen({ kitchenReleaseAt: '2026-09-28T12:10:00Z' }, T0), false);
  assert.equal(isOnScreen({ kitchenReleaseAt: '2026-09-28T11:50:00Z' }, T0), true);
});

test('a released pre-order starts its stage clock at release, not when it was placed', () => {
  const preorder = { createdAt: '2026-09-28T11:00:00Z', updatedAt: '2026-09-28T11:00:00Z', kitchenReleaseAt: '2026-09-28T11:59:00Z' };
  assert.equal(stageSince(preorder), '2026-09-28T11:59:00Z');
  assert.equal(ageState(preorder, T0).tone, 'ok');
  assert.equal(stageSince({ createdAt: '2026-09-28T11:00:00Z', updatedAt: '2026-09-28T11:30:00Z' }), '2026-09-28T11:30:00Z');
});

test('timer labels', () => {
  assert.equal(elapsedLabel('2026-09-28T11:59:30Z', T0), '<1m');
  assert.equal(elapsedLabel('2026-09-28T11:53:00Z', T0), '7m');
  assert.equal(elapsedLabel('2026-09-28T10:55:00Z', T0), '1h 05m');
  assert.equal(elapsedLabel('2026-09-28T12:05:00Z', T0), '<1m', 'clock skew never goes negative');
});

test('arrivals chime only for tickets new since the last poll', () => {
  assert.deepEqual(arrivals(null, ['a', 'b']), []);
  assert.deepEqual(arrivals(new Set(['a']), ['a', 'b']), ['b']);
});

test('ticket names and the all-day count', () => {
  assert.equal(ticketName({ id: 'abcdef123', customerName: ' Priya ' }), 'Priya');
  assert.equal(ticketName({ id: 'abcdef123' }), '#ABCDEF');
  assert.deepEqual(
    allDay([{ items: [{ name: 'Latte', quantity: 2 }, { name: 'Cookie', quantity: 1 }] }, { items: [{ name: 'Latte', quantity: 1 }] }, {}]),
    [{ name: 'Latte', quantity: 3 }, { name: 'Cookie', quantity: 1 }],
  );
});
