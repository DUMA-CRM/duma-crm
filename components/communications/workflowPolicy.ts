/** Fields are available only when the trigger supplies their record. */
export function workflowFieldAvailable(event: string, field: string): boolean {
  if (field.startsWith('stock.')) return event === 'stock_low';
  if (field.startsWith('booking.')) return event.startsWith('reservation_');
  if (field.startsWith('promotion.')) return event.startsWith('order_') || event === 'promo_redeemed';
  if (field.startsWith('staff.')) return event.startsWith('staff_');
  if (field.startsWith('order.')) return event.startsWith('order_') || event === 'promo_redeemed';
  if (field.startsWith('customer.')) return !event.startsWith('staff_') && event !== 'stock_low';
  return false;
}
