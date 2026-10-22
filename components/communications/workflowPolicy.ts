/** Fields are available only when the trigger supplies their record. */
export function workflowFieldAvailable(event: string, field: string): boolean {
  if (field.startsWith('staff.')) return event.startsWith('staff_');
  if (field.startsWith('order.')) return event.startsWith('order_') || event === 'promo_redeemed';
  if (field.startsWith('customer.')) return !event.startsWith('staff_') && !event.startsWith('reservation_');
  return false;
}
