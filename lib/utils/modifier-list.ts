// ---------------------------------------------------------------------------
// The Modifiers list: modifiers under their group in the till's order, with a
// search over the label. Pure and tested.
// ---------------------------------------------------------------------------

export interface ModifierRow {
  id: string;
  label: string;
  groupId?: string | null;
  category?: string | null;
  sortOrder?: number | null;
  isAvailable: boolean;
}

export interface GroupRow {
  id: string;
  name: string;
  sortOrder: number;
  isSize: boolean;
}

/**
 * Groups in their set order, each with its modifiers in their own order; a
 * modifier whose group is unknown falls under "Other" at the end. Empty groups
 * are kept only when `keepEmpty` (no search), so a new group shows up here too.
 */
export function groupModifiers<M extends ModifierRow, G extends GroupRow>(modifiers: M[], groups: G[], search = '', keepEmpty = !search.trim()) {
  const q = search.trim().toLowerCase();
  const matching = modifiers.filter((m) => !q || m.label.toLowerCase().includes(q));
  const byGroup = new Map<string, M[]>();
  for (const m of matching) {
    const key = m.groupId && groups.some((g) => g.id === m.groupId) ? m.groupId : 'other';
    byGroup.set(key, [...(byGroup.get(key) ?? []), m]);
  }
  const order = (a: M, b: M) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label);
  const sections = [...groups]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((g) => ({ id: g.id, name: g.name, isSize: g.isSize, modifiers: (byGroup.get(g.id) ?? []).sort(order) }))
    .filter((section) => keepEmpty || section.modifiers.length > 0);
  const other = byGroup.get('other');
  if (other?.length) sections.push({ id: 'other', name: 'Other', isSize: false, modifiers: other.sort(order) });
  return sections;
}
