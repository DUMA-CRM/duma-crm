'use client';

import { useQuery } from '@tanstack/react-query';

import { ModuleCard } from '@/components/dashboard/ModuleCards';
import { Award, Coffee, Tag } from '@/components/icons';
import { MiniBar } from '@/components/shared/MiniBar';
import { Bone } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { proxiedImage } from '@/lib/api/client';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import type { TopItemAnalytics } from '@/lib/modules/analytics/client';
import { getMenuItems } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* What is actually selling today, ranked by quantity net of refunds: each
   item's photo, name and a bar against the best seller, the count and what
   it took on the right. */

export function TopItemsToday({
  rows,
  loading,
  error = false,
  onRetry = () => undefined,
}: {
  rows: TopItemAnalytics[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const formatMoney = useFormatMoney();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const { tools, section } = useCatalogWords();
  // The products list's own query and cache — photos without another request when it's warm.
  const items = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId && rows.length > 0,
  });
  const photo = new Map((items.data ?? []).map((item) => [item.id, proxiedImage(item.imageUrl)]));
  const quantity = (row: TopItemAnalytics) => Number(row.totalQuantity ?? 0);
  const best = Math.max(1, ...rows.map(quantity));
  const Fallback = tools.kitchen ? Coffee : Tag;

  return (
    <ModuleCard
      id="dashboard-top-items"
      title="Selling today"
      href="/menu/items"
      linkLabel={section}
      hrefLabel={`Open ${section.toLowerCase()}`}
      loading={loading}
      skeleton={
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading today’s best sellers">
          {['w-28', 'w-36', 'w-24', 'w-32', 'w-20'].map((width) => (
            <div key={width} className="flex items-center gap-3" aria-hidden="true">
              <Bone className="size-10 shrink-0" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <Bone className={`h-3.5 ${width}`} />
                <Bone className="h-1 w-full rounded-full" />
              </span>
              <Bone className="h-4 w-10 shrink-0" />
            </div>
          ))}
        </div>
      }
      error={error}
      onRetry={onRetry}
      empty={
        rows.length === 0
          ? { icon: Coffee, title: 'Nothing sold yet today', description: 'Your best sellers appear here as orders come in.' }
          : undefined
      }
    >
      <ol className="space-y-3">
        {rows.map((row, index) => (
          <li key={`${row.menuItemId}-${row.name}`} className="flex items-center gap-3">
            <Thumb src={photo.get(row.menuItemId)} fallback={Fallback} className="size-10 rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm text-foreground">
                <span className="truncate font-medium">{row.name}</span>
                {index === 0 && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                    <Award size={12} className="text-measured" aria-hidden="true" />
                    Best seller
                  </span>
                )}
              </p>
              <MiniBar value={quantity(row)} max={best} tone="warning" label={`${quantity(row)} sold`} className="mt-1.5 h-1" />
            </div>
            <p className="shrink-0 text-right">
              <span data-figure className="block text-sm font-semibold text-foreground">
                {quantity(row)}
              </span>
              <span data-figure className="text-xs text-muted-foreground">
                {formatMoney(Number(row.totalRevenue ?? 0))}
              </span>
            </p>
          </li>
        ))}
      </ol>
    </ModuleCard>
  );
}

/** The item's photo, or a quiet tile when it has none. */
function Thumb({ src, fallback: Fallback, className }: { src: string | null | undefined; fallback: typeof Coffee; className: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn('shrink-0 bg-band object-cover', className)} />
  ) : (
    <span className={cn('flex shrink-0 items-center justify-center bg-band text-muted-foreground', className)} aria-hidden="true">
      <Fallback size={15} />
    </span>
  );
}
