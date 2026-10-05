import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Customer } from '@/types/customers';
import type { CartItem } from '@/types/pos';

/**
 * Tickets parked on this till — "hold on, I'll grab my card" — so the next
 * customer can be served. Device-local on purpose: nothing has been sent to
 * the API, so there is no order yet and nothing to reconcile. Scoped to the
 * workspace and location it was held at; any cashier on the till can resume it.
 */
export interface HeldTicket {
  id: string;
  name: string;
  cart: CartItem[];
  customer: Customer | null;
  notes: string;
  heldAt: string;
  heldBy: string | null;
  tenantId: string;
  locationId: string;
}

interface HeldTicketsStore {
  tickets: HeldTicket[];
  hold: (ticket: Omit<HeldTicket, 'id' | 'heldAt'>) => void;
  take: (id: string) => HeldTicket | undefined;
  discard: (id: string) => void;
}

/** A till with more than this many parked tickets is using holds as a tab system — cap it. */
export const MAX_HELD = 12;

export const useHeldTicketsStore = create<HeldTicketsStore>()(
  persist(
    (set, get) => ({
      tickets: [],
      hold: (ticket) =>
        set((state) => ({
          tickets: [{ ...ticket, id: crypto.randomUUID(), heldAt: new Date().toISOString() }, ...state.tickets].slice(0, 50),
        })),
      take: (id) => {
        const ticket = get().tickets.find((entry) => entry.id === id);
        set((state) => ({ tickets: state.tickets.filter((entry) => entry.id !== id) }));
        return ticket;
      },
      discard: (id) => set((state) => ({ tickets: state.tickets.filter((entry) => entry.id !== id) })),
    }),
    { name: 'pos-held-tickets', version: 1 },
  ),
);
