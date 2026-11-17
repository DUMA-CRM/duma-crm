'use client';

import Link from 'next/link';

import { ArrowUpRight, ChefHat, Loader2, Scale, SlidersHorizontal } from '@/components/icons';
import { RecipeIngredientEditor, RecipeIngredientSkeleton } from '@/components/menu/RecipeIngredientEditor';
import { RecipeTotals } from '@/components/menu/RecipeTotals';
import { type SizeColumn, useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { Drawer } from '@/components/shared/Drawer';
import { FormSection } from '@/components/shared/FormParts';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { getModifierRecipe, setModifierRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

/**
 * What selecting a modifier ADDS to a drink — Oat Milk → 200 ml oat milk,
 * Caramel → 20 ml syrup — edited from the menu item's recipe tab without
 * leaving the item being costed. A drawer, like every other edit in the back
 * office; it keeps its own save because it writes a different record.
 */
export function ModifierRecipeDrawer({
  modifier,
  sizes,
  defaultIsSize = false,
  onClose,
}: {
  modifier: { id: string; label: string; group: string | null; isSize: boolean; priceAdjust?: string | null; isDefault?: boolean };
  /** The item's size modifiers (excluding this one) — rendered as override columns. */
  sizes: SizeColumn[];
  /** The item has a default size — the size-less column is an inherited base, not a sold size. */
  defaultIsSize?: boolean;
  onClose: () => void;
}) {
  const formatMoney = useFormatMoney();
  const recipe = useRecipeDraft({
    queryKey: moduleQueryKeys.inventory.key('modifier-recipe', modifier.id),
    fetchLines: () => getModifierRecipe(modifier.id),
    saveLines: (lines) => setModifierRecipe(modifier.id, lines),
    sizes: sizes.filter((s) => s.id !== modifier.id),
    defaultIsSize,
  });
  const adjust = Number(modifier.priceAdjust) || 0;

  return (
    <Drawer
      icon={ChefHat}
      title={`${modifier.label} — what it adds`}
      guidance="The stock this option adds on top of the item’s own recipe. It applies to every item that offers it."
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="default" className="text-muted-foreground">
            <Link href={`/menu/modifiers/${modifier.id}`}>
              <ArrowUpRight aria-hidden="true" /> Modifier page
            </Link>
          </Button>
          <Button variant="outline" size="default" className="flex-1" onClick={onClose} disabled={recipe.save.isPending}>
            {recipe.dirty ? 'Discard' : 'Close'}
          </Button>
          <Button
            size="default"
            className="flex-1"
            onClick={() => recipe.save.mutate(undefined, { onSuccess: onClose })}
            disabled={!recipe.dirty || recipe.save.isPending}
          >
            {recipe.save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {recipe.dirty ? 'Save recipe' : 'Saved'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* The drawer's title names the modifier; one line says where it sits and what it costs. */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {modifier.isSize ? <Scale size={14} aria-hidden="true" /> : <SlidersHorizontal size={14} aria-hidden="true" />}
          <span>
            {modifier.group ?? 'Extra'} · {adjust ? `${adjust > 0 ? '+' : '−'}${formatMoney(Math.abs(adjust), 2)}` : 'no charge'}
          </span>
          {modifier.isDefault && (
            <span className="rounded-sm bg-primary/8 px-1.5 py-0.5 text-micro font-semibold text-primary">Default</span>
          )}
          {recipe.dirty && <span className="rounded-sm bg-measured/10 px-1.5 py-0.5 text-micro font-semibold text-measured">Unsaved</span>}
        </p>

        <FormSection
          framed={false}
          title="Ingredients"
          note={sizes.length ? `Leave a size blank to use the ${defaultIsSize ? 'All sizes' : 'Default'} amount.` : undefined}
        >
          {recipe.isLoading ? (
            <RecipeIngredientSkeleton />
          ) : (
            <RecipeIngredientEditor
              rows={recipe.rows}
              onChange={recipe.edit}
              columns={recipe.columns}
              stockItems={recipe.stockItems}
              itemMap={recipe.itemMap}
              usedIds={recipe.usedIds}
              sizes={[]}
              emptyHint={
                modifier.isSize
                  ? 'Sizes usually add nothing themselves — their effect is the per-size amounts on the item’s recipe. Add something only if the size brings its own cup or lid.'
                  : `Nothing yet. Add what ${modifier.label} adds to a drink — e.g. 200 ml of oat milk.`
              }
            />
          )}
        </FormSection>

        {recipe.hasIngredients && (
          <RecipeTotals summary={recipe.summary} allAllergens={recipe.allAllergens} title="What it adds" framed={false} />
        )}
      </div>
    </Drawer>
  );
}
