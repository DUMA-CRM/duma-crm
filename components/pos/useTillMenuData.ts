'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePosMenuSignals } from '@/components/pos/usePosMenuSignals';

import { proxiedImage } from '@/lib/api/client';
import { getMenuCategories, getMenuItems } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { resolveFavourites } from '@/lib/utils/pos';
import type { PosLayout } from '@/stores/posSettingsStore';
import type { MenuItem as ApiMenuItem } from '@/types/menu';
import type { MenuItem } from '@/types/pos';

export const MENU_STALE_MS = 5 * 60_000;
const EMPTY: string[] = [];

export const pence = (decimal: string) => Math.round(Number.parseFloat(decimal) * 100);

export const toPosItem = (api: ApiMenuItem): MenuItem => ({
  id: api.id,
  name: api.name,
  category: api.categoryId,
  price: pence(api.price),
  image: proxiedImage(api.imageUrl) ?? '',
  modifiers: [],
});

/**
 * Everything the till's menu shows, read once for the till and for its live
 * preview in Settings → Configuration — so the preview is the real menu, not
 * a drawing of one.
 */
export function useTillMenuData({
  tenantId,
  locationId,
  layout,
  pinned,
}: {
  tenantId: string | null;
  locationId: string | null;
  layout: PosLayout;
  pinned: string[] | undefined;
}) {
  const menu = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
    staleTime: MENU_STALE_MS,
  });
  const { data: menuCategories = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId ?? undefined),
    enabled: Boolean(tenantId),
    staleTime: MENU_STALE_MS,
  });

  const items = useMemo(() => (menu.data ?? []).filter((item) => item.isAvailable).map(toPosItem), [menu.data]);
  // Only categories that have something to sell — an empty tab is a dead end mid-rush.
  const categories = useMemo(() => {
    const used = new Set(items.map((item) => item.category));
    return [...menuCategories].filter((c) => c.isActive && used.has(c.id)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [menuCategories, items]);

  const menuItemIds = useMemo(() => items.map((item) => item.id), [items]);
  const { stockStatus, topIds } = usePosMenuSignals({
    locationId,
    menuItemIds,
    stockHighlight: layout.stockHighlight,
    favourites: layout.favourites,
    topCount: layout.topCount,
  });
  const pinnedIds = pinned ?? EMPTY;
  const favourites = useMemo(
    () => resolveFavourites(layout.favourites, items, pinnedIds, topIds, layout.favourites === 'top' ? layout.topCount : 24),
    [layout.favourites, layout.topCount, pinnedIds, items, topIds],
  );

  return {
    menu,
    items,
    categories,
    favourites,
    favouritesLabel: layout.favourites === 'top' ? 'Best sellers' : 'Favourites',
    stockStatus,
  };
}
