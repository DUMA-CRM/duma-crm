import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyOfflineOrderFailure } from '../../lib/utils/offline-order-sync.ts';
import { paymentClears } from '../../lib/utils/order-workflow.ts';

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
