import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CreateOrderPayload } from '@/lib/api/orders.service';

// Offline POS queue. When createOrder fails with a NETWORK error (café Wi-Fi
// blip), the payload is stored here (localStorage) and re-sent automatically
// by <OfflineOrderSync /> once the connection returns — sales never stop.
export interface QueuedOrder {
  id: string;
  payload: CreateOrderPayload;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

interface OfflineOrdersStore {
  queue: QueuedOrder[];
  enqueue: (payload: CreateOrderPayload) => void;
  remove: (id: string) => void;
  markAttempt: (id: string, error?: string) => void;
}

export const useOfflineOrdersStore = create<OfflineOrdersStore>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (payload) =>
        set((s) => ({
          queue: [...s.queue, { id: crypto.randomUUID(), payload, queuedAt: new Date().toISOString(), attempts: 0 }],
        })),
      remove: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
      markAttempt: (id, error) =>
        set((s) => ({
          queue: s.queue.map((q) => (q.id === id ? { ...q, attempts: q.attempts + 1, lastError: error } : q)),
        })),
    }),
    { name: 'pos-offline-orders' },
  ),
);
