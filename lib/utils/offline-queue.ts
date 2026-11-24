// ---------------------------------------------------------------------------
// The offline POS queue's rules, out of the store and the sync provider so they
// can be tested: which queued sales this till may replay now, and how a queue
// saved by an older build is read back. A queued sale is financial data — both
// rules exist to make sure one is never lost and never replayed blind.
// ---------------------------------------------------------------------------

/** The fields the replay rule reads from a queued sale. */
export interface QueuedSaleScope {
  ownerUserId: string;
  tenantId: string;
  status: 'pending' | 'needs-attention';
}

/**
 * The queued sales this session may send now: rung up by this person, in this
 * workspace, and not waiting on a manager. Another cashier's sales wait for
 * them to sign in; a sale held for attention is only resent by an explicit
 * retry. Nothing is replayed before both the person and the workspace are known.
 */
export function replayableOrders<T extends QueuedSaleScope>(
  queue: readonly T[],
  userId: string | null | undefined,
  tenantId: string | null | undefined,
): T[] {
  if (!userId || !tenantId) return [];
  return queue.filter((order) => order.ownerUserId === userId && order.tenantId === tenantId && order.status === 'pending');
}

/** Why a sale restored from an older build is held: nothing proves it wasn't already entered. */
export const LEGACY_ORDER_NOTE = 'Legacy offline order — confirm it was not already entered before retrying.';

/** A queued sale as `migrateOfflineQueue` hands it back. */
export interface MigratedQueuedOrder<P> {
  id: string;
  payload: P;
  queuedAt: string;
  idempotencyKey: string;
  paymentProvider: 'cash' | 'manual_terminal';
  ownerUserId: string;
  tenantId: string;
  attempts: number;
  status: 'needs-attention';
  lastError: string;
}

/**
 * The persisted queue from an older version, made current. Every sale is kept
 * and every one is held for a manager: version 1 recorded no owner, workspace
 * or idempotency key, so replaying it automatically could enter a sale twice or
 * into the wrong workspace. Missing fields get safe stand-ins (the queue id as
 * the key, cash as the provider, an empty owner that `claimUnscoped` fills).
 * Anything unreadable — no state, no array — becomes an empty queue rather
 * than an exception that would wipe the store.
 */
export function migrateOfflineQueue<P, H>(
  persisted: unknown,
): { queue: MigratedQueuedOrder<P>[]; history: H[] } {
  const legacy = (persisted && typeof persisted === 'object' ? persisted : {}) as {
    queue?: unknown;
    history?: unknown;
  };
  const queue = Array.isArray(legacy.queue) ? legacy.queue : [];
  return {
    history: Array.isArray(legacy.history) ? (legacy.history as H[]) : [],
    queue: queue
      .filter((order): order is Record<string, unknown> => !!order && typeof order === 'object')
      .map((order) => {
        const old = order as Partial<MigratedQueuedOrder<P>> & { id: string; payload: P; queuedAt: string };
        return {
          ...old,
          idempotencyKey: old.idempotencyKey ?? old.id,
          paymentProvider: old.paymentProvider ?? 'cash',
          ownerUserId: old.ownerUserId ?? '',
          tenantId: old.tenantId ?? '',
          attempts: old.attempts ?? 0,
          status: 'needs-attention' as const,
          lastError: old.lastError ?? LEGACY_ORDER_NOTE,
        };
      }),
  };
}
