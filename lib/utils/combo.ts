// ---------------------------------------------------------------------------
// Choosing options the way the till does, from an item's group rules:
// required groups can't drop below their minimum, "choose one" swaps, and
// "choose many" adds up to the maximum. Pure and tested.
// ---------------------------------------------------------------------------

export interface ComboRule {
  minSelections: number;
  /** null = no upper limit. */
  maxSelections: number | null;
}

/** Rule for a group with no configured rule: optional, choose one — how categories behaved before rules. */
export const FALLBACK_RULE: ComboRule = { minSelections: 0, maxSelections: 1 };

/**
 * The selection after tapping `id`, whose group holds `groupIds` (in display
 * order) under `rule`. Returns the same array when the tap isn't allowed.
 */
export function toggleOption(selected: string[], id: string, groupIds: string[], rule: ComboRule = FALLBACK_RULE): string[] {
  const inGroup = selected.filter((s) => groupIds.includes(s));
  if (selected.includes(id)) {
    // Deselecting below the minimum would leave a required group unanswered.
    if (inGroup.length <= rule.minSelections) return selected;
    return selected.filter((s) => s !== id);
  }
  if (rule.maxSelections === 1) return [...selected.filter((s) => !groupIds.includes(s)), id];
  if (rule.maxSelections != null && inGroup.length >= rule.maxSelections) {
    // Full: the earliest choice makes way, as the till does.
    const drop = inGroup[0];
    return [...selected.filter((s) => s !== drop), id];
  }
  return [...selected, id];
}

/** How a rule reads next to its group: "Required · choose one", "Optional · up to 3". */
export function ruleLabel(rule: ComboRule): string {
  const need = rule.minSelections > 0 ? 'Required' : 'Optional';
  if (rule.maxSelections === 1) return `${need} · choose one`;
  if (rule.maxSelections == null) return `${need} · choose any`;
  return `${need} · up to ${rule.maxSelections}`;
}

/** Whether a group's current picks satisfy its minimum. */
export const satisfied = (selected: string[], groupIds: string[], rule: ComboRule = FALLBACK_RULE) =>
  selected.filter((s) => groupIds.includes(s)).length >= rule.minSelections;
