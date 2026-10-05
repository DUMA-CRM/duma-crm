import assert from 'node:assert/strict';
import test from 'node:test';

import { restockJourney } from '../lib/utils/restock-journey.ts';

const labels = (
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected',
  directReceive: boolean,
  receivedAt?: string,
  purchaseOrderId?: string,
) => restockJourney({ status, receivedAt, purchaseOrderId }, directReceive).map(({ label, state }) => `${label}:${state}`);

test('an inventory-only workspace moves approved demand directly to receiving', () => {
  assert.deepEqual(labels('approved', true), ['Requested:done', 'Approved:done', 'Receive next:current']);
});

test('a workspace with Purchasing sends approved demand to a purchase order', () => {
  assert.deepEqual(labels('approved', false), ['Requested:done', 'Approved:done', 'Create order:current']);
  assert.deepEqual(labels('fulfilled', false, undefined, 'po-1'), ['Requested:done', 'Approved:done', 'Ordered:done']);
});

test('an ordered request without a purchase order can be recovered after Purchasing is enabled', () => {
  assert.deepEqual(labels('fulfilled', false), ['Requested:done', 'Approved:done', 'Add to purchase orders:current']);
});

test('a direct receipt closes the inventory-only journey', () => {
  assert.deepEqual(labels('fulfilled', true, '2026-10-01T12:00:00.000Z'), ['Requested:done', 'Approved:done', 'Received:done']);
});
