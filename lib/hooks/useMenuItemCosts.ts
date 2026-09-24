'use client';

import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useVatContext } from '@/lib/hooks/useVatContext';
import { type Costing, computeCosting } from '@/lib/menu/costing';
import { getMenuItemRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import type { MenuItem } from '@/types/menu';

export interface MenuItemCost {
  /** Null until the recipe has loaded. */
  costing: Costing | null;
  /** False when no ingredients are linked — cost is unknown, not zero. */
  hasRecipe: boolean;
  /** True only when every ingredient carries a cost, so the total can be trusted. */
  costComplete: boolean;
  loading: boolean;
}

/**
 * Cost and margin for a list of menu items, for the Profit view of the menu
 * list. Shares the ['menu-item-recipe', id] cache key with the recipe editor,
 * so opening an item afterwards is instant and an edit invalidates both.
 *
 * One request per item: fine for a café menu, but it is the reason the Profit
 * view is a mode you switch into rather than columns shown by default.
 *
 * "No recipe" is deliberately distinct from "£0.00 cost" — an item nobody has
 * costed must not be able to display a flattering 100% margin.
 */
export function useMenuItemCosts(items: MenuItem[]): Map<string, MenuItemCost> {
  const { ctx } = useVatContext();

  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: moduleQueryKeys.inventory.key('menu-item-recipe', item.id),
      queryFn: () => getMenuItemRecipe(item.id),
    })),
  });

  // Depend on the resolved data rather than the query objects, which are new
  // on every render and would defeat the memo entirely.
  const signature = queries.map((q) => (q.isPending ? 'p' : (q.data?.length ?? 0))).join(',');

  return useMemo(() => {
    const out = new Map<string, MenuItemCost>();

    items.forEach((item, index) => {
      const query = queries[index];
      const lines = query?.data ?? [];
      // Size overrides are alternatives to the default line, not additions, so
      // the headline cost is the default configuration only.
      const defaults = lines.filter((line) => line.sizeModifierId == null);
      const hasRecipe = defaults.length > 0;
      const costComplete = hasRecipe && defaults.every((line) => line.stockItem?.costPerUnit != null);

      const cogs = costComplete
        ? defaults.reduce((sum, line) => sum + Number(line.quantity) * Number(line.stockItem?.costPerUnit ?? 0), 0)
        : 0;

      out.set(item.id, {
        costing: costComplete ? computeCosting({ price: Number(item.price) || 0, cogs, itemVatRate: item.vatRate, ctx }) : null,
        hasRecipe,
        costComplete,
        loading: query?.isPending ?? true,
      });
    });

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, signature, ctx.vatRegistered, ctx.defaultVatRate, ctx.pricesIncludeTax]);
}
