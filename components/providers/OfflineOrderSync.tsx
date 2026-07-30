'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { createOrder } from '@/lib/api/orders.service';
import { classifyOfflineOrderFailure } from '@/lib/utils/offline-order-sync';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineOrdersStore } from '@/stores/offlineOrdersStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Flushes the offline POS order queue. Mounted once app-wide, so queued
 * orders sync even if the barista has navigated away from the POS.
 *
 * Retry semantics:
 * - network error (fetch throws, no HTTP response) → keep queued, try later
 * - 5xx → server hiccup, keep queued
 * - 4xx → the order will never be accepted (bad item id, closed location…)
 *   → drop it and tell staff, otherwise it would block the queue forever
 */
export function OfflineOrderSync() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useWorkspaceStore((s) => s.tenantId);
  const pendingQueueLength = useOfflineOrdersStore(
    (state) =>
      state.queue.filter((order) => order.ownerUserId === userId && order.tenantId === tenantId && order.status === 'pending').length,
  );
  const syncing = useRef(false);

  useEffect(() => {
    if (pendingQueueLength === 0 || !userId || !tenantId) return;

    const flush = async () => {
      if (syncing.current || !navigator.onLine) return;
      syncing.current = true;
      try {
        const store = useOfflineOrdersStore.getState;
        let synced = 0;
        const eligible = store().queue.filter(
          (queued) => queued.ownerUserId === userId && queued.tenantId === tenantId && queued.status === 'pending',
        );
        for (const queued of eligible) {
          try {
            await createOrder(queued.payload, queued.idempotencyKey);
            store().remove(queued.id);
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
          for (const key of ['orders', 'orders-all', 'location-stock', 'inventory-forecast']) {
            void qc.invalidateQueries({ queryKey: [key] });
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
