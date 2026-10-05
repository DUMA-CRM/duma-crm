'use client';

import { useQuery } from '@tanstack/react-query';

import { useVatContext } from '@/lib/hooks/useVatContext';
import { computeCosting } from '@/lib/menu/costing';
import { type TopItemAnalytics, getTopItems } from '@/lib/modules/analytics/client';
import { getMenuCategories, getMenuItems } from '@/lib/modules/catalog/client';
import { getMenuItemRecipes } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { useRangeQuery } from './useRangeQuery';
import type { ReportFilterState } from './useReportFilters';

const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;

export interface CostedItem {
  id: string;
  name: string;
  category: string;
  units: number;
  /** Net sales as taken, VAT included where charged. */
  revenue: number;
  /** The same sales with VAT taken out, through `computeCosting`. */
  netRevenue: number;
  /** Ingredient cost of the units sold; null when the recipe is missing or not fully costed. */
  cost: number | null;
  contribution: number | null;
  margin: number | null;
}

export interface CostingTotals {
  revenue: number;
  netRevenue: number;
  /** Sales (VAT included / excluded) of the items with a costed recipe. */
  costedRevenue: number;
  costedNetRevenue: number;
  cost: number;
}

/**
 * Every sold item with its recipe cost and margin — menu engineering's sums,
 * shared so the Profit card and the Prime cost report cost a plate exactly the
 * way the menu report does. Margin goes through `computeCosting`, the one place
 * it is calculated, VAT-aware. Recipes are today's: a past period is costed at
 * current ingredient prices.
 *
 * Reads the top 100 items, the same cache entry the menu reports fill; the
 * long tail is outside `coverage`, which callers show.
 */
export function useMenuCosting(filters: ReportFilterState) {
  const { ctx: vat } = useVatContext();
  const { tenantId } = useWorkspaceStore();
  const items = useRangeQuery('top-items:100', (params) => getTopItems(params, 100), filters);
  const menu = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const categories = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const soldIds = [...new Set([...(items.data ?? []), ...(items.previous ?? [])].map((item) => item.menuItemId))];
  const recipes = useQuery({
    queryKey: moduleQueryKeys.inventory.key('menu-item-recipes-batch', [...soldIds].sort().join(',')),
    queryFn: () => getMenuItemRecipes(soldIds),
    enabled: soldIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const menuById = new Map((menu.data ?? []).map((item) => [item.id, item]));
  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category.name]));

  const cost = (list: TopItemAnalytics[]): CostedItem[] =>
    list.map((item) => {
      const recipe = recipes.data?.[item.menuItemId] ?? [];
      const lines = recipe.filter((line) => line.sizeModifierId == null);
      const costComplete = lines.length > 0 && lines.every((line) => line.stockItem?.costPerUnit != null);
      const unitCost = costComplete
        ? lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.stockItem?.costPerUnit ?? 0), 0)
        : null;
      const units = num(item.totalQuantity);
      const revenue = num(item.totalRevenue);
      const menuItem = menuById.get(item.menuItemId);
      const itemCost = unitCost === null ? null : unitCost * units;
      // Margin against revenue net of VAT — against gross it overstates by the VAT fraction.
      const costing = computeCosting({ price: revenue, cogs: itemCost ?? 0, itemVatRate: menuItem?.vatRate, ctx: vat });
      return {
        id: item.menuItemId,
        name: item.name,
        category: menuItem ? (categoryById.get(menuItem.categoryId) ?? 'Uncategorised') : 'Uncategorised',
        units,
        revenue,
        netRevenue: costing.netRevenue,
        cost: itemCost,
        contribution: itemCost === null ? null : costing.margin,
        margin: itemCost === null || costing.netRevenue === 0 ? null : costing.marginPct,
      };
    });

  const rows = cost(items.data ?? []);
  const previousRows = items.previous ? cost(items.previous) : null;
  const recipesLoading = soldIds.length > 0 && recipes.isPending;

  return {
    rows,
    previousRows,
    totals: costingTotals(rows),
    previousTotals: previousRows ? costingTotals(previousRows) : null,
    loading: items.isPending || menu.isPending || recipesLoading,
    /** The sales couldn't be read — nothing to show. */
    isError: items.isError,
    refetch: () => void items.refetch(),
    /** The recipes couldn't be read — items show, all uncosted. */
    recipesError: recipes.isError,
    refetchRecipes: () => void recipes.refetch(),
  };
}

export function costingTotals(rows: CostedItem[]): CostingTotals {
  const costed = rows.filter((row) => row.cost !== null);
  return {
    revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    netRevenue: rows.reduce((sum, row) => sum + row.netRevenue, 0),
    costedRevenue: costed.reduce((sum, row) => sum + row.revenue, 0),
    costedNetRevenue: costed.reduce((sum, row) => sum + row.netRevenue, 0),
    cost: costed.reduce((sum, row) => sum + (row.cost ?? 0), 0),
  };
}

/**
 * All of a period's sales with VAT taken out: the order total scaled by the
 * VAT share the item lines show. Exact when VAT is one rate, close otherwise.
 */
export function salesExVat(totalSales: number, totals: CostingTotals): number {
  return totals.revenue > 0 ? totalSales * (totals.netRevenue / totals.revenue) : totalSales;
}
