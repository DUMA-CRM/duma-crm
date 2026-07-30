export type OfflineOrderFailureAction = 'retry' | 'pause-auth' | 'needs-attention';

/**
 * A queued sale is financial data, so an HTTP rejection must never silently
 * delete it. Transient failures stay pending; authentication failures pause
 * until the cashier signs in again; permanent validation failures are retained
 * for a manager to reconcile.
 */
export function classifyOfflineOrderFailure(error: unknown): OfflineOrderFailureAction {
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : null;
  if (status === null) return 'retry';
  if (status === 401 || status === 403) return 'pause-auth';
  if (status === 408 || status === 425 || status === 429 || status >= 500) return 'retry';
  return 'needs-attention';
}
