export type ToastPosition = 'top-center' | 'bottom-right';

/**
 * Screens whose top edge holds the primary filters or the live working surface
 * (till, ticket rail, order board, report controls). Toasts go bottom-right
 * there so they never cover what the operator is acting on.
 */
const DATA_HEAVY_ROUTES = ['/pos', '/kds', '/orders', '/reports', '/inventory', '/audit-log', '/cash-up'];

/**
 * Where a toast lands:
 * - critical/transactional confirmations (money taken, payslips issued,
 *   something published live) → top-center, wherever you are;
 * - data-heavy screens → bottom-right;
 * - everything else → top-center.
 */
export function toastPositionFor(pathname: string | null | undefined, critical = false): ToastPosition {
  if (critical) return 'top-center';
  const path = pathname ?? '';
  return DATA_HEAVY_ROUTES.some((route) => path === route || path.startsWith(`${route}/`)) ? 'bottom-right' : 'top-center';
}
