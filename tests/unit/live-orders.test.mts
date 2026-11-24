import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTIVE_ORDER_STATUSES, activeOrderCount, statusCountsQuery } from '../../lib/utils/live-orders.ts';

test('status-counts query lists the statuses once, comma-separated, and scopes to a location only when given', () => {
  assert.equal(
    statusCountsQuery({ statuses: ACTIVE_ORDER_STATUSES, paymentStatus: 'paid', locationId: 'loc-1' }),
    'statuses=pending%2Cpreparing%2Cready&paymentStatus=paid&locationId=loc-1',
  );
  assert.equal(statusCountsQuery({ statuses: ['pending', 'pending', ' '], paymentStatus: 'paid', locationId: null }), 'statuses=pending&paymentStatus=paid');
});

test('the badge sums the active statuses and ignores missing, negative or malformed counts', () => {
  assert.equal(activeOrderCount({ pending: 3, preparing: 1, ready: 0 }), 4);
  assert.equal(activeOrderCount({ pending: 2, done: 40 }), 2);
  assert.equal(activeOrderCount({ pending: Number.NaN, preparing: -1, ready: 2 }), 2);
  assert.equal(activeOrderCount(undefined), 0);
});
