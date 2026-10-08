/**
 * Where "Start an order" for a customer goes: the Till when the workspace has
 * one, otherwise the Orders page's New order with the customer already picked
 * (`?newOrder=<id>` — `?customer=` there filters the list). Null when neither
 * is open to this person, so the button isn't offered.
 */
export function startOrderHref(customerId: string, options: { pos: boolean; manual: boolean }): string | null {
  const id = encodeURIComponent(customerId);
  if (options.pos) return `/pos?customer=${id}`;
  if (options.manual) return `/orders?newOrder=${id}`;
  return null;
}
