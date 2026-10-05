'use client';

import Link from 'next/link';

import { ArrowUpRight, ChefHat, Loader2, Scale, SlidersHorizontal } from '@/components/icons';
import { RecipeIngredientEditor } from '@/components/menu/RecipeIngredientEditor';
import { RecipeTotals } from '@/components/menu/RecipeTotals';
import { type SizeColumn, useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { Drawer } from '@/components/shared/Drawer';
import { FormSection } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';

import { getModifierRecipe, setModifierRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/dashboard';

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
      title={`${modifier.label} — what it adds`}
      description="The stock this option adds on top of the item’s own recipe. It applies to every item that offers it."
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="lg" className="text-muted-foreground">
            <Link href={`/menu/modifiers/${modifier.id}`}>
              <ArrowUpRight aria-hidden="true" /> Modifier page
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={recipe.save.isPending}>
            {recipe.dirty ? 'Discard' : 'Close'}
          </Button>
          <Button size="lg" className="flex-1" onClick={() => recipe.save.mutate(undefined, { onSuccess: onClose })} disabled={!recipe.dirty || recipe.save.isPending}>
            {recipe.save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {recipe.dirty ? 'Save recipe' : 'Saved'}
          </Button>
        </div>
      }
    >
      <div className="space-y-7">
        <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-card px-4 py-3.5">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', modifier.isSize ? 'bg-primary/8 text-primary' : 'bg-reference/8 text-reference')} aria-hidden="true">
            {modifier.isSize ? <Scale size={18} /> : <SlidersHorizontal size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
              {modifier.label}
              {modifier.isDefault && <span className="shrink-0 rounded-sm bg-primary/8 px-1.5 py-0.5 text-micro font-semibold text-primary">Default</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {modifier.group ?? 'Extra'} · {adjust ? `${adjust > 0 ? '+' : '−'}${formatMoney(Math.abs(adjust), 2)}` : 'no charge'}
            </p>
          </div>
          {recipe.dirty && <span className="shrink-0 rounded-sm bg-measured/10 px-1.5 py-0.5 text-micro font-semibold text-measured">Unsaved</span>}
        </div>

        <FormSection icon={ChefHat} title="Ingredients" note={sizes.length ? `Leave a size blank to use the ${defaultIsSize ? 'All sizes' : 'Default'} amount.` : undefined}>
          {recipe.isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-band/60" aria-hidden="true" />
          ) : (
            <RecipeIngredientEditor
              rows={recipe.rows}
              onChange={recipe.edit}
              columns={recipe.columns}
              stockItems={recipe.stockItems}
              itemMap={recipe.itemMap}
              usedIds={recipe.usedIds}
              sizes={[]}
              emptyHint={modifier.isSize ? 'Sizes usually add nothing themselves — their effect is the per-size amounts on the item’s recipe. Add something only if the size brings its own cup or lid.' : `Nothing yet. Add what ${modifier.label} adds to a drink — e.g. 200 ml of oat milk.`}
            />
          )}
        </FormSection>

        {recipe.hasIngredients && <RecipeTotals summary={recipe.summary} allAllergens={recipe.allAllergens} title="What it adds" />}
      </div>
    </Drawer>
  );
}
