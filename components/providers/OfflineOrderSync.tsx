'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { createOrder } from '@/lib/modules/ordering/client';
import { confirmPayment, startPayment } from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { classifyOfflineOrderFailure } from '@/lib/utils/offline-order-sync';
import { replayableOrders } from '@/lib/utils/offline-queue';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineOrdersStore } from '@/stores/offlineOrdersStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Flushes the offline POS order queue. Mounted once app-wide, so queued
 * orders sync even if the barista has navigated away from the POS.
 *
 * Retry semantics (lib/utils/offline-order-sync.ts classifies each failure).
 * A queued sale is financial data and is **never deleted** on failure:
 * - network error, rate limit or 5xx → `retry`: keep queued, stop this round
 * - 401/403 → `pause-auth`: keep queued until the original cashier signs in
 * - any other refusal (bad item id, closed location…) → `needs-attention`:
 *   kept, marked for a manager, and skipped so it cannot block the queue
 *
 * Replay is safe: `POST /orders` replays on the `Idempotency-Key` the queue
 * sends, so a sale that landed before the connection dropped is not duplicated.
 */
export function OfflineOrderSync() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useWorkspaceStore((s) => s.tenantId);
  const pendingQueueLength = useOfflineOrdersStore((state) => replayableOrders(state.queue, userId, tenantId).length);
  const syncing = useRef(false);

  useEffect(() => {
    if (pendingQueueLength === 0 || !userId || !tenantId) return;

    const flush = async () => {
      if (syncing.current || !navigator.onLine) return;
      syncing.current = true;
      try {
        const store = useOfflineOrdersStore.getState;
        let synced = 0;
        const eligible = replayableOrders(store().queue, userId, tenantId);
        for (const queued of eligible) {
          try {
            // Into the workspace it was rung up in, named explicitly — never
            // whichever one the tab happens to be in when the network returns.
            const order = await createOrder(queued.payload, queued.idempotencyKey, queued.tenantId);
            const payment = await startPayment(order.id, {
              provider: queued.paymentProvider,
              idempotencyKey: `pay-${queued.idempotencyKey}`,
            });
            await confirmPayment(payment.id, 'succeeded');
            store().markSynced(queued.id, order.id);
            synced++;
          } catch (err) {
            const action = classifyOfflineOrderFailure(err);
            const message = err instanceof Error ? err.message : 'Unknown sync error';
            if (action === 'needs-attention') {
              store().markAttempt(queued.id, message, 'needs-attention');
              toast('error', `A queued order needs manager attention: ${message}`);
              continue;
            }
            store().markAttempt(queued.id, message);
            if (action === 'pause-auth') {
              toast('error', 'Queued orders are paused until the original cashier signs in again.');
            }
            // Authentication, network, rate-limit, and server failures stop
            // this round without deleting any sale.
            if (action === 'pause-auth' || action === 'retry') {
              break;
            }
          }
        }
        if (synced > 0) {
          toast('success', `${synced} queued ${synced === 1 ? 'order' : 'orders'} synced.`);
          const affectedQueries = [
            moduleQueryKeys.ordering.key('orders'),
            moduleQueryKeys.ordering.key('orders-all'),
            moduleQueryKeys.inventory.key('location-stock'),
            moduleQueryKeys.inventory.key('inventory-forecast'),
          ];
          for (const queryKey of affectedQueries) {
            void qc.invalidateQueries({ queryKey });
          }
        }
      } finally {
        syncing.current = false;
      }
    };

    void flush();
    window.addEventListener('online', flush);
    const interval = setInterval(flush, 30_000);
    return () => {
      window.removeEventListener('online', flush);
      clearInterval(interval);
    };
  }, [pendingQueueLength, qc, tenantId, userId]);

  return null;
}
