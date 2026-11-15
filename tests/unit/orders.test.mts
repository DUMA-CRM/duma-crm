import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyOfflineOrderFailure } from '../../lib/utils/offline-order-sync.ts';
import { paymentClears } from '../../lib/utils/order-workflow.ts';
import { bulkEligible, moneyFilterParams, orderActivity, parseRefundAmount, paymentSummary } from '../../lib/utils/orders-list.ts';

test('digital orders require payment; manual orders can be prepared on account', () => {
  for (const source of ['pos', 'qr_code', 'online', 'manual']) {
    assert.equal(paymentClears({ source, paymentStatus: 'paid' }), true, source);
    assert.equal(paymentClears({ source, paymentStatus: 'unpaid' }), source === 'manual', source);
    for (const paymentStatus of ['refunded', 'awaiting_cash_approval']) {
      assert.equal(paymentClears({ source, paymentStatus }), false, `${source}: ${paymentStatus}`);
    }
  }
});

test('offline sales retry transient failures without treating permanent rejections as retryable', () => {
  assert.equal(classifyOfflineOrderFailure(new TypeError('Failed to fetch')), 'retry');
  for (const status of [408, 425, 429, 500, 503]) {
    assert.equal(classifyOfflineOrderFailure({ status }), 'retry', String(status));
  }
  for (const status of [401, 403]) {
    assert.equal(classifyOfflineOrderFailure({ status }), 'pause-auth', String(status));
  }
  for (const status of [400, 404, 409, 422]) {
    assert.equal(classifyOfflineOrderFailure({ status }), 'needs-attention', String(status));
  }
});

test('bulk Complete never takes an unpaid or finished order; Mark ready only new or making', () => {
  const orders = [
    { id: 'a', status: 'pending', paymentStatus: 'paid' },
    { id: 'b', status: 'ready', paymentStatus: 'unpaid' },
    { id: 'c', status: 'ready', paymentStatus: 'paid' },
    { id: 'd', status: 'done', paymentStatus: 'paid' },
    { id: 'e', status: 'cancelled', paymentStatus: 'paid' },
    { id: 'f', status: 'preparing', paymentStatus: 'awaiting_cash_approval' },
  ] as const;
  assert.deepEqual(
    bulkEligible([...orders], 'done').map((order) => order.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    bulkEligible([...orders], 'ready').map((order) => order.id),
    ['a', 'f'],
  );
});

test('the Money filter maps onto payment state or refund state, never both', () => {
  assert.deepEqual(moneyFilterParams('all'), {});
  assert.deepEqual(moneyFilterParams('unpaid'), { paymentStatus: 'unpaid' });
  assert.deepEqual(moneyFilterParams('refunded'), { refundStatus: 'refunded' });
  assert.deepEqual(moneyFilterParams('partially_refunded'), { refundStatus: 'partially_refunded' });
});

test('a refund amount is a positive two-decimal sum no larger than what is left', () => {
  assert.deepEqual(parseRefundAmount('£4.5', 10), { ok: true, amount: '4.50', value: 4.5 });
  assert.deepEqual(parseRefundAmount('10', 10), { ok: true, amount: '10.00', value: 10 });
  assert.deepEqual(parseRefundAmount('', 10), { ok: false, problem: null });
  assert.equal(parseRefundAmount('10.01', 10).ok, false);
  assert.equal(parseRefundAmount('0', 10).ok, false);
  assert.equal(parseRefundAmount('4.505', 10).ok, false);
  assert.equal(parseRefundAmount('-2', 10).ok, false);
  // Pennies are compared as whole pennies, never as floats.
  assert.equal(parseRefundAmount('0.30', 0.1 + 0.2).ok, true);
});

test("a payment never shows the API's own words", () => {
  assert.equal(paymentSummary({ paymentMethod: 'manual_terminal', paymentStatus: 'paid' }).method, 'Card terminal');
  assert.equal(paymentSummary({ paymentMethod: 'cash', paymentStatus: 'cancelled' }).state, 'Cancelled');
  assert.equal(paymentSummary({ paymentMethod: 'something_new', paymentStatus: 'paid' }).method, 'Something new');
});

test('the activity feed shows payments that went through or failed, when they were confirmed', () => {
  const feed = orderActivity(
    [
      { id: 's1', createdAt: '2026-11-12T10:00:00.000Z' },
      { id: 's2', createdAt: '2026-11-12T10:05:00.000Z' },
    ],
    [{ id: 'r1', createdAt: '2026-11-12T11:00:00.000Z' }],
    [
      // Cash approved at the counter two minutes after it was rung up.
      { id: 'p1', status: 'succeeded', createdAt: '2026-11-12T10:00:30.000Z', confirmedAt: '2026-11-12T10:02:00.000Z' },
      { id: 'p2', status: 'pending', createdAt: '2026-11-12T10:01:00.000Z', confirmedAt: null },
    ],
  );
  assert.deepEqual(
    feed.map((event) => event.kind),
    ['status', 'payment', 'status', 'refund'],
  );
  assert.equal(feed[1].at, '2026-11-12T10:02:00.000Z');
  assert.equal(feed[1].gapMs, 120_000);
});
