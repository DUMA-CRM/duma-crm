'use client';

import { useQuery } from '@tanstack/react-query';

import { UtensilsCrossed } from '@/components/icons';
import { RecordBlock, RecordList, RecordListRow } from '@/components/people/record/shared';
import { ErrorState } from '@/components/shared/ErrorState';
import { useRecordHrefs } from '@/components/shared/RecordLink';
import { Bone } from '@/components/shared/Skeleton';

import { hasCapability } from '@/lib/auth/capabilities';
import { getStockItemMenuItems } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';

/**
 * The menu items whose recipe uses this stock item, each opening its menu
 * page. Says nothing when the item is in no recipe, or the viewer can't read
 * recipes. Saving a recipe invalidates the `stock-item-menu-items` prefix.
 */
export function UsedInSection({ stockItemId }: { stockItemId: string }) {
  const canRead = useAuthStore((state) => hasCapability(state.capabilities, 'recipes:read'));
  const hrefs = useRecordHrefs();
  const query = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-item-menu-items', stockItemId),
    queryFn: () => getStockItemMenuItems(stockItemId),
    enabled: canRead,
  });

  if (!canRead) return null;
  if (query.isPending)
    return (
      <RecordBlock id="item-used-in" title="Used in">
        <Bone className="h-14 w-full" />
      </RecordBlock>
    );
  if (query.isError)
    return (
      <RecordBlock id="item-used-in" title="Used in">
        <ErrorState title="Menu items couldn’t be loaded" onRetry={() => void query.refetch()} />
      </RecordBlock>
    );
  if (query.data.length === 0) return null;

  return (
    <RecordBlock id="item-used-in" title="Used in">
      <RecordList>
        {query.data.map((menuItem) => (
          <RecordListRow
            key={menuItem.id}
            icon={UtensilsCrossed}
            tone="reference"
            label="Menu item"
            value={menuItem.name}
            href={hrefs.menuItem(menuItem.id) ?? undefined}
          />
        ))}
      </RecordList>
    </RecordBlock>
  );
}
