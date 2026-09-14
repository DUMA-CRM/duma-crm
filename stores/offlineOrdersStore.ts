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
  paymentProvider: 'cash' | 'manual_terminal';
  queuedAt: string;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'needs-attention';
}

export interface OfflineOrderSyncRecord {
  queueId: string;
  orderId: string;
  ownerUserId: string;
  tenantId: string;
  queuedAt: string;
  syncedAt: string;
  attempts: number;
}

interface OfflineOrdersStore {
  queue: QueuedOrder[];
  history: OfflineOrderSyncRecord[];
  enqueue: (
    payload: CreateOrderPayload,
    context: { idempotencyKey: string; ownerUserId: string; tenantId: string; paymentProvider: QueuedOrder['paymentProvider'] },
  ) => void;
  remove: (id: string) => void;
  markSynced: (id: string, orderId: string) => void;
  markAttempt: (id: string, error?: string, status?: QueuedOrder['status']) => void;
  retry: (id: string) => void;
  claimUnscoped: (ownerUserId: string, tenantId: string) => void;
}

export const useOfflineOrdersStore = create<OfflineOrdersStore>()(
  persist(
    (set) => ({
      queue: [],
      history: [],
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
      markSynced: (id, orderId) =>
        set((s) => {
          const order = s.queue.find((queued) => queued.id === id);
          if (!order) return s;
          return {
            queue: s.queue.filter((queued) => queued.id !== id),
            history: [
              {
                queueId: order.id,
                orderId,
                ownerUserId: order.ownerUserId,
                tenantId: order.tenantId,
                queuedAt: order.queuedAt,
                syncedAt: new Date().toISOString(),
                attempts: order.attempts,
              },
              ...s.history,
            ].slice(0, 25),
          };
        }),
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
      version: 4,
      // Version 1 did not record the owning account, tenant, or idempotency key.
      // Preserve those sales but never auto-replay them. WorkspaceInitializer
      // assigns them to the first signed-in profile and requires an explicit
      // manager retry from the POS warning.
      migrate: (persistedState) => {
        const legacy = persistedState as {
          queue?: Array<Partial<QueuedOrder> & Pick<QueuedOrder, 'id' | 'payload' | 'queuedAt'>>;
          history?: OfflineOrderSyncRecord[];
        };
        return {
          history: Array.isArray(legacy.history) ? legacy.history : [],
          queue: (legacy.queue ?? []).map((order) => ({
            ...order,
            idempotencyKey: order.idempotencyKey ?? order.id,
            paymentProvider: order.paymentProvider ?? 'cash',
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
