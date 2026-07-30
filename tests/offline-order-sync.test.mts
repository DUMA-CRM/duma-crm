import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyOfflineOrderFailure } from '../lib/utils/offline-order-sync.ts';

test('retries network and transient server failures', () => {
  assert.equal(classifyOfflineOrderFailure(new TypeError('fetch failed')), 'retry');
  assert.equal(classifyOfflineOrderFailure({ status: 408 }), 'retry');
  assert.equal(classifyOfflineOrderFailure({ status: 429 }), 'retry');
  assert.equal(classifyOfflineOrderFailure({ status: 503 }), 'retry');
});

test('pauses authentication failures without discarding the sale', () => {
  assert.equal(classifyOfflineOrderFailure({ status: 401 }), 'pause-auth');
  assert.equal(classifyOfflineOrderFailure({ status: 403 }), 'pause-auth');
});

test('retains permanent validation failures for manager reconciliation', () => {
  assert.equal(classifyOfflineOrderFailure({ status: 400 }), 'needs-attention');
  assert.equal(classifyOfflineOrderFailure({ status: 404 }), 'needs-attention');
  assert.equal(classifyOfflineOrderFailure({ status: 422 }), 'needs-attention');
});
