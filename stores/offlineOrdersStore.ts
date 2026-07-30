import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CreateOrderPayload } from '@/lib/api/orders.service';

// Offline POS queue. When createOrder fails with a NETWORK error (café Wi-Fi
// blip), the payload is stored here (localStorage) and re-sent automatically
// by <OfflineOrderSync /> once the connection returns — sales never stop.
export interface QueuedOrder {
  id: string;
  idempotencyKey: string;
  ownerUserId: string;
  tenantId: string;
  payload: CreateOrderPayload;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'needs-attention';
}

interface OfflineOrdersStore {
  queue: QueuedOrder[];
  enqueue: (payload: CreateOrderPayload, context: { idempotencyKey: string; ownerUserId: string; tenantId: string }) => void;
  remove: (id: string) => void;
  markAttempt: (id: string, error?: string, status?: QueuedOrder['status']) => void;
  retry: (id: string) => void;
  claimUnscoped: (ownerUserId: string, tenantId: string) => void;
}

export const useOfflineOrdersStore = create<OfflineOrdersStore>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (payload, context) =>
        set((s) => ({
          queue: [
            ...s.queue,
            {
              id: crypto.randomUUID(),
              ...context,
              payload,
              queuedAt: new Date().toISOString(),
              attempts: 0,
              status: 'pending',
            },
          ],
        })),
      remove: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
      markAttempt: (id, error, status = 'pending') =>
        set((s) => ({
          queue: s.queue.map((q) => (q.id === id ? { ...q, attempts: q.attempts + 1, lastError: error, status } : q)),
        })),
      retry: (id) =>
        set((s) => ({
          queue: s.queue.map((q) => (q.id === id ? { ...q, status: 'pending', lastError: undefined } : q)),
        })),
      claimUnscoped: (ownerUserId, tenantId) =>
        set((s) => ({
          queue: s.queue.map((q) =>
            q.ownerUserId
              ? q
              : {
                  ...q,
                  ownerUserId,
                  tenantId,
                  status: 'needs-attention',
                  lastError: 'Legacy offline order — confirm it was not already entered before retrying.',
                },
          ),
        })),
    }),
    {
      name: 'pos-offline-orders',
      version: 2,
      // Version 1 did not record the owning account, tenant, or idempotency key.
      // Preserve those sales but never auto-replay them. WorkspaceInitializer
      // assigns them to the first signed-in profile and requires an explicit
      // manager retry from the POS warning.
      migrate: (persistedState) => {
        const legacy = persistedState as { queue?: Array<Partial<QueuedOrder> & Pick<QueuedOrder, 'id' | 'payload' | 'queuedAt'>> };
        return {
          queue: (legacy.queue ?? []).map((order) => ({
            ...order,
            idempotencyKey: order.idempotencyKey ?? order.id,
            ownerUserId: order.ownerUserId ?? '',
            tenantId: order.tenantId ?? '',
            attempts: order.attempts ?? 0,
            status: 'needs-attention' as const,
            lastError: order.lastError ?? 'Legacy offline order — confirm it was not already entered before retrying.',
          })),
        };
      },
    },
  ),
);
