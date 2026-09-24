'use client';

import { RecipeIngredientEditor } from '@/components/menu/RecipeIngredientEditor';
import { RecipeTotals } from '@/components/menu/RecipeTotals';
import { type SizeColumn, useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { Button } from '@/components/ui/button';

import { getModifierRecipe, setModifierRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

interface ModifierRecipeEditorProps {
  modifierId: string;
  /** Tenant's size modifiers (excluding this one) — rendered as override columns. */
  sizes: SizeColumn[];
}

/**
 * What selecting this modifier ADDS to a drink: Oat Milk → 200ml oat milk,
 * Caramel Syrup → 20ml syrup. Size columns let the amount differ per size.
 *
 * Used by the overlay on the menu item's recipe tab, so you can correct a
 * modifier's amounts without leaving the item you were costing. The modifier's
 * own record renders the same pieces inline with the rest of its fields.
 */
export function ModifierRecipeEditor({ modifierId, sizes }: ModifierRecipeEditorProps) {
  const recipe = useRecipeDraft({
    queryKey: moduleQueryKeys.inventory.key('modifier-recipe', modifierId),
    fetchLines: () => getModifierRecipe(modifierId),
    saveLines: (lines) => setModifierRecipe(modifierId, lines),
    sizes: sizes.filter((s) => s.id !== modifierId),
  });

  if (recipe.isLoading) return <div className="h-20 animate-pulse rounded-sm bg-muted" aria-hidden="true" />;

  return (
    <div className="space-y-4">
      <RecipeIngredientEditor
        rows={recipe.rows}
        onChange={recipe.edit}
        columns={recipe.columns}
        stockItems={recipe.stockItems}
        itemMap={recipe.itemMap}
        usedIds={recipe.usedIds}
        sizes={sizes}
        emptyHint="Nothing yet. Add what this option adds to a drink — Oat Milk uses 200ml of oat milk."
      />

      {recipe.hasIngredients && <RecipeTotals summary={recipe.summary} allAllergens={recipe.allAllergens} title="What it adds" />}

      {/* This overlay is its own scope, so it keeps its own save. */}
      {recipe.dirty && (
        <div className="flex items-center justify-end gap-2 border-t border-rule pt-3">
          <span className="mr-auto text-label font-semibold text-warning">Unsaved changes</span>
          <Button type="button" size="sm" onClick={() => recipe.save.mutate()} disabled={recipe.save.isPending}>
            {recipe.save.isPending ? 'Saving…' : 'Save recipe'}
          </Button>
        </div>
      )}
    </div>
  );
}
