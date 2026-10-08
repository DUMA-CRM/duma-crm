/**
 * The location to select on its own, when choosing would be a formality.
 *
 * A workspace with one active location has nothing to pick between, yet the
 * screens that need a single site (stock, stocktakes, purchase orders) show
 * "No location selected" until someone opens the picker and chooses it. With
 * one site, "All locations" and that site are the same data, so it is chosen
 * for them.
 *
 * Returns `null` when there is no decision to make: none, or several, or the
 * only one is already selected.
 */
export function soleLocationToSelect(
  locations: ReadonlyArray<{ id: string; isActive: boolean }>,
  selectedId: string | null,
): string | null {
  const active = locations.filter((location) => location.isActive);
  if (active.length !== 1) return null;
  return active[0].id === selectedId ? null : active[0].id;
}
