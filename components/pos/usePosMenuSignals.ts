'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { hasAnyCapability, hasCapability } from '@/lib/auth/capabilities';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { getTopItems } from '@/lib/modules/analytics/client';
import { getLocationStock, getMenuItemRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { menuStockStatus } from '@/lib/utils/pos';
import { useAuthStore } from '@/stores/authStore';
import type { FavouritesMode } from '@/stores/posSettingsStore';

const FIVE_MINUTES = 5 * 60_000;
const BEST_SELLER_DAYS = 30;

/**
 * The two readings the till layers over its menu, each switched on in
 * Settings → Configuration → Till and each needing read access the till may
 * not have: stock (location stock + each item's recipe) and best sellers
 * (the last 30 days here). Without access the till simply shows neither.
 *
 * There is no bulk "stock status per menu item" endpoint, so this reads one
 * recipe per item — cached for five minutes, and only while the highlight is on.
 */
export function usePosMenuSignals({
  locationId,
  menuItemIds,
  stockHighlight,
  favourites,
  topCount,
}: {
  locationId: string | null;
  menuItemIds: string[];
  stockHighlight: boolean;
  favourites: FavouritesMode;
  topCount: number;
}) {
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReadStock = hasAnyCapability(capabilities, 'stock.locations:read', 'inventory:read') && hasCapability(capabilities, 'recipes:read');
  // Top sellers come from Analytics: the capability alone isn't enough, the API
  // refuses the route while that module is off.
  const analyticsOn = useModuleEnabled('analytics');
  const canReadSales = hasCapability(capabilities, 'analytics:read') && analyticsOn;
  const wantStock = stockHighlight && canReadStock && !!locationId;

  const stock = useQuery({
    queryKey: moduleQueryKeys.inventory.key('location-stock', locationId),
    queryFn: () => getLocationStock(locationId!),
    enabled: wantStock,
    staleTime: 60_000,
  });
  const recipes = useQueries({
    queries: menuItemIds.map((id) => ({
      queryKey: moduleQueryKeys.inventory.key('menu-item-recipe', id),
      queryFn: () => getMenuItemRecipe(id),
      enabled: wantStock && stock.isSuccess,
      staleTime: FIVE_MINUTES,
    })),
    combine: (results) => results.map((result) => result.data),
  });

  const stockStatus = useMemo(() => {
    if (!wantStock || !stock.data) return {};
    const byItem: Record<string, NonNullable<(typeof recipes)[number]>> = {};
    menuItemIds.forEach((id, index) => {
      const lines = recipes[index];
      if (lines) byItem[id] = lines;
    });
    return menuStockStatus(byItem, stock.data);
  }, [menuItemIds, recipes, stock.data, wantStock]);

  const top = useQuery({
    queryKey: moduleQueryKeys.analytics.key('analytics-top-items', 'pos', locationId, topCount),
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - BEST_SELLER_DAYS * 86_400_000);
      return getTopItems({ from: from.toISOString(), to: to.toISOString(), locationId: locationId ?? undefined }, topCount);
    },
    enabled: favourites === 'top' && canReadSales && !!locationId,
    staleTime: 30 * 60_000,
  });
  const topIds = useMemo(() => (top.data ?? []).map((row) => row.menuItemId), [top.data]);

  return { stockStatus, topIds, canReadStock, canReadSales };
}
