'use client';

import { useQuery } from '@tanstack/react-query';

import { ModuleCard } from '@/components/dashboard/ModuleCards';
import { Award, Coffee, Tag } from '@/components/icons';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { proxiedImage } from '@/lib/api/client';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import type { TopItemAnalytics } from '@/lib/modules/analytics/client';
import { getMenuItems } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* What is actually selling today, ranked by quantity net of refunds — the
   Stock health card's frame: every item with its photo, its name and the
   count large, the first marked as the best seller. */

export function TopItemsToday({ rows, loading }: { rows: TopItemAnalytics[]; loading: boolean }) {
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
  const best = rows[0];
  const Fallback = tools.kitchen ? Coffee : Tag;

  return (
    <ModuleCard
      title="Selling today"
      subtitle="Ranked by quantity, net of refunds"
      href="/menu/items"
      hrefLabel={`Open ${section.toLowerCase()}`}
      loading={loading}
      error={false}
      onRetry={() => undefined}
      empty={
        rows.length === 0
          ? { icon: Coffee, title: 'Nothing sold yet today', description: 'Your best sellers appear here as orders come in.' }
          : undefined
      }
    >
      {best && (
        // Every item drawn the same way — photo, name, the count large and what it took;
        // only the first carries the Best seller mark.
        <ol className="space-y-4">
          {rows.map((row, index) => (
            <li key={`${row.menuItemId}-${row.name}`} className="flex items-center gap-3">
              <Thumb src={photo.get(row.menuItemId)} fallback={Fallback} className="size-12 rounded-lg" />
              <div className="min-w-0 flex-1">
                {index === 0 && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Award size={12} className="text-measured" aria-hidden="true" />
                    Best seller
                  </p>
                )}
                <p className="truncate text-base font-semibold text-foreground">{row.name}</p>
              </div>
              <p className="shrink-0 text-right">
                <span data-figure className="block text-2xl font-semibold leading-none tracking-figure text-foreground">
                  {quantity(row)}
                </span>
                <span data-figure className="text-xs text-muted-foreground">
                  sold · {formatMoney(Number(row.totalRevenue ?? 0))}
                </span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </ModuleCard>
  );
}

/** The item's photo, or a quiet tile when it has none (or can't be read). */
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
