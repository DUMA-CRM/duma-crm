import assert from 'node:assert/strict';
import test from 'node:test';

import { LEGACY_ORDER_NOTE, migrateOfflineQueue, replayableOrders } from '../../lib/utils/offline-queue.ts';

const sale = (id: string, ownerUserId: string, tenantId: string, status: 'pending' | 'needs-attention' = 'pending') => ({
  id,
  ownerUserId,
  tenantId,
  status,
});

test('a till replays only its own cashier’s pending sales, into the workspace they were rung up in', () => {
  const queue = [
    sale('mine', 'sam', 'cafe'),
    sale('held', 'sam', 'cafe', 'needs-attention'),
    sale('colleague', 'alex', 'cafe'),
    sale('other-workspace', 'sam', 'bakery'),
    sale('unclaimed', '', ''),
  ];
  assert.deepEqual(
    replayableOrders(queue, 'sam', 'cafe').map((order) => order.id),
    ['mine'],
  );
  // Before the person and the workspace are known, nothing goes.
  assert.deepEqual(replayableOrders(queue, null, 'cafe'), []);
  assert.deepEqual(replayableOrders(queue, 'sam', undefined), []);
  // An unclaimed legacy sale never matches an empty session.
  assert.deepEqual(replayableOrders(queue, '', ''), []);
});

test('a version 1 queue keeps every sale but holds each for a manager', () => {
  const migrated = migrateOfflineQueue<{ items: string[] }, { orderId: string }>({
    queue: [{ id: 'q1', payload: { items: ['latte'] }, queuedAt: '2026-11-24T09:00:00Z' }],
  });
  assert.deepEqual(migrated, {
    history: [],
    queue: [
      {
        id: 'q1',
        payload: { items: ['latte'] },
        queuedAt: '2026-11-24T09:00:00Z',
        idempotencyKey: 'q1',
        paymentProvider: 'cash',
        ownerUserId: '',
        tenantId: '',
        attempts: 0,
        status: 'needs-attention',
        lastError: LEGACY_ORDER_NOTE,
      },
    ],
  });
});

test('a later version keeps its owner, key and error, and its history', () => {
  const history = [{ orderId: 'o1' }];
  const [order] = migrateOfflineQueue({
    history,
    queue: [
      {
        id: 'q2',
        payload: {},
        queuedAt: '2026-11-24T09:00:00Z',
        idempotencyKey: 'key-2',
        paymentProvider: 'manual_terminal',
        ownerUserId: 'sam',
        tenantId: 'cafe',
        attempts: 3,
        status: 'pending',
        lastError: '503',
      },
    ],
  }).queue;
  assert.equal(order!.idempotencyKey, 'key-2');
  assert.equal(order!.paymentProvider, 'manual_terminal');
  assert.equal(order!.ownerUserId, 'sam');
  assert.equal(order!.attempts, 3);
  assert.equal(order!.lastError, '503');
  // Still held: a sale restored across a version change is never replayed blind.
  assert.equal(order!.status, 'needs-attention');
  assert.deepEqual(migrateOfflineQueue({ history, queue: [] }).history, history);
});

test('unreadable persisted state becomes an empty queue instead of throwing', () => {
  for (const persisted of [undefined, null, 'garbage', 42, { queue: 'nope', history: {} }]) {
    assert.deepEqual(migrateOfflineQueue(persisted), { queue: [], history: [] }, String(persisted));
  }
  assert.equal(migrateOfflineQueue({ queue: [null, { id: 'q', payload: {}, queuedAt: '' }] }).queue.length, 1);
});
