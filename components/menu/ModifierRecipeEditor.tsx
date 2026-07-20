'use client';

import { RecipeGrid, type SizeColumn } from '@/components/menu/RecipeGrid';

import { getModifierRecipe, setModifierRecipe } from '@/lib/api/recipes.service';

interface ModifierRecipeEditorProps {
  modifierId: string;
  /** Tenant's "Size"-category modifiers (excluding this one) — rendered as override columns. */
  sizes: SizeColumn[];
}

/**
 * What selecting this modifier ADDS to a drink: Oat Milk → 200ml oat milk,
 * Caramel Syrup → 20ml syrup. Size columns let the amount differ per size
 * (large oat latte → 260ml). Composes with the item's base recipe at sale time.
 */
export function ModifierRecipeEditor({ modifierId, sizes }: ModifierRecipeEditorProps) {
  return (
    <RecipeGrid
      queryKey={['modifier-recipe', modifierId]}
      fetchLines={() => getModifierRecipe(modifierId)}
      saveLines={(lines) => setModifierRecipe(modifierId, lines)}
      sizes={sizes.filter((s) => s.id !== modifierId)}
      emptyHint="Add what this modifier uses when selected — e.g. Oat Milk → 200ml oat milk. It's added on top of the item's base recipe."
    />
  );
}
