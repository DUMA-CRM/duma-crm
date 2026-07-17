'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { ApiError } from '@/lib/api/client';
import { createOrder } from '@/lib/api/orders.service';
import { useOfflineOrdersStore } from '@/stores/offlineOrdersStore';
import { toast } from '@/stores/toastStore';

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
  const queueLength = useOfflineOrdersStore((s) => s.queue.length);
  const syncing = useRef(false);

  useEffect(() => {
    if (queueLength === 0) return;

    const flush = async () => {
      if (syncing.current || !navigator.onLine) return;
      syncing.current = true;
      try {
        const store = useOfflineOrdersStore.getState;
        let synced = 0;
        for (const queued of [...store().queue]) {
          try {
            await createOrder(queued.payload);
            store().remove(queued.id);
            synced++;
          } catch (err) {
            if (err instanceof ApiError && err.status < 500) {
              store().remove(queued.id);
              toast('error', `A queued order was rejected and removed: ${err.message}`);
            } else {
              // Still unreachable / server error — keep it and stop this round.
              store().markAttempt(queued.id, err instanceof Error ? err.message : undefined);
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
  }, [queueLength, qc]);

  return null;
}
