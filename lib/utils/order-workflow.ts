/**
 * Whether an order's payment lets it into the workflow — the kitchen screen,
 * the "next step" button, the status menu.
 *
 * Till, QR and online orders are paid first. An order staff took by hand
 * (`manual`: phone, email, wholesale) may be prepared and completed now and
 * paid later — the customer is known and may be invoiced. Mirrors
 * duma-api/src/lib/order-payment-policy.ts; the API enforces it.
 */
export function paymentClears(order: { source?: string | null; paymentStatus?: string | null }): boolean {
  if (!order.paymentStatus || order.paymentStatus === 'paid') return true;
  return order.source === 'manual' && order.paymentStatus === 'unpaid';
}
