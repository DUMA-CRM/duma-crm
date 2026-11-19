'use client';

import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';

import { Widget, WidgetBar, WidgetCaption, useFamily, useRows } from '@/components/dashboard/widget/Widget';
import { Award, Coffee, Tag, Trophy } from '@/components/icons';
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

  const family = useFamily();
  const top = rows[0];
  // From medium up the best seller leads with its photo, the way a food diary leads with the plate.
  const hero = family === 'medium' || family === 'large' || family === 'extraLarge';
  const heroPx = family === 'medium' ? 56 : 80;
  const rowsFit = useRows(family === 'large' ? 46 : 38, hero ? heroPx + 12 : 0);
  const listed = hero ? rows.slice(1, 1 + rowsFit) : rows.slice(0, rowsFit);

  return (
    <Widget
      title="Selling today"
      icon={Trophy}
      tint="stock"
      surface="plain"
      href="/menu/items"
      hrefLabel={`Open ${section.toLowerCase()}`}
      loading={loading}
      skeleton={
        <div className="space-y-2.5" role="status" aria-busy="true" aria-label="Loading today’s best sellers">
          {['w-28', 'w-36', 'w-24'].map((width) => (
            <div key={width} className="flex items-center gap-2.5" aria-hidden="true">
              <Bone className="size-7 shrink-0 rounded-md" />
              <Bone className={`h-3.5 ${width} rounded-md`} />
            </div>
          ))}
        </div>
      }
      error={error}
      onRetry={onRetry}
      empty={
        rows.length === 0 ? { icon: Coffee, title: 'Nothing sold yet today', detail: 'Best sellers appear as orders come in.' } : undefined
      }
    >
      {family === 'bar' && top ? (
        // Half a square: a 36px photo beside two short lines — the 44px photo and a figure over a caption outgrew the cell.
        <div className="mt-auto flex min-w-0 items-center gap-2.5">
          <Thumb src={photo.get(top.menuItemId)} fallback={Fallback} className="size-9 rounded-md" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[13px] leading-[18px] text-heading">
              <span className="truncate font-semibold">{top.name}</span>
              <Award size={12} className="shrink-0 text-stock" aria-label="Best seller" />
            </p>
            <p className="truncate text-[11px] leading-4 text-muted-foreground tabular-nums">
              {formatMoney(Number(top.totalRevenue ?? 0))} · {top.orderCount === 1 ? '1 order' : `${top.orderCount} orders`}
            </p>
          </div>
          <p className="shrink-0 text-right leading-none">
            <span className="text-[24px] font-semibold tracking-[-0.035em] text-heading tabular-nums">{quantity(top)}</span>
            <span className="ml-1 text-[13px] text-muted-foreground">sold</span>
          </p>
        </div>
      ) : family === 'small' && top ? (
        // The best seller, the way a music widget leads with the album.
        <div className="flex min-h-0 flex-1 flex-col">
          <Thumb src={photo.get(top.menuItemId)} fallback={Fallback} className="size-12 rounded-md" />
          <div className="mt-auto min-w-0">
            <p className="truncate text-[15px] leading-5 font-semibold text-heading">{top.name}</p>
            <WidgetCaption>
              <span className="font-semibold text-heading tabular-nums">{quantity(top)}</span> sold ·{' '}
              <span className="tabular-nums">{formatMoney(Number(top.totalRevenue ?? 0))}</span>
            </WidgetCaption>
            <WidgetCaption className="text-[11px]">Best seller today</WidgetCaption>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {hero && top && (
            <div className="flex min-w-0 items-center gap-3">
              <Thumb src={photo.get(top.menuItemId)} fallback={Fallback} className="rounded-lg" style={{ width: heroPx, height: heroPx }} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-stock">
                  <Award size={12} className="shrink-0" aria-hidden="true" /> Best seller today
                </p>
                <p className="truncate text-[17px] leading-6 font-semibold text-heading">{top.name}</p>
                <p className="truncate text-[12px] text-muted-foreground tabular-nums">
                  {formatMoney(Number(top.totalRevenue ?? 0))} · {top.orderCount === 1 ? '1 order' : `${top.orderCount} orders`}
                </p>
              </div>
              <p className="shrink-0 text-right leading-none">
                <span className="text-[28px] font-semibold tracking-[-0.035em] text-heading tabular-nums">{quantity(top)}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">sold</span>
              </p>
            </div>
          )}
          <ol className="flex min-h-0 flex-1 flex-col gap-1.5">
            {listed.map((row, position) => {
              const index = hero ? position + 1 : position;
              return (
                <li key={`${row.menuItemId}-${row.name}`} className="flex items-center gap-2.5">
                  {family === 'large' && (
                    <span className="w-3 shrink-0 text-right text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                  )}
                  <Thumb
                    src={photo.get(row.menuItemId)}
                    fallback={Fallback}
                    className={cn('rounded-md', family === 'large' ? 'size-9' : 'size-7')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-[13px] leading-[18px] text-heading">
                      <span className="truncate font-medium">{row.name}</span>
                      {index === 0 && <Award size={12} className="shrink-0 text-stock" aria-label="Best seller" />}
                    </p>
                    {family === 'large' ? (
                      <span className="mt-1 block">
                        <WidgetBar value={quantity(row)} max={best} className="bg-stock" label={`${quantity(row)} sold`} />
                      </span>
                    ) : (
                      <span className="block truncate text-[11px] leading-4 text-muted-foreground tabular-nums">
                        {formatMoney(Number(row.totalRevenue ?? 0))} · {row.orderCount === 1 ? '1 order' : `${row.orderCount} orders`}
                      </span>
                    )}
                  </div>
                  <p className="shrink-0 text-right leading-tight">
                    <span className="block text-[13px] font-semibold text-heading tabular-nums">{quantity(row)}</span>
                    {family === 'large' && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">{formatMoney(Number(row.totalRevenue ?? 0))}</span>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Widget>
  );
}

/** The item's photo, or a quiet tile when it has none. */
function Thumb({
  src,
  fallback: Fallback,
  className,
  style,
}: {
  src: string | null | undefined;
  fallback: typeof Coffee;
  className: string;
  style?: CSSProperties;
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn('shrink-0 bg-band object-cover', className)} style={style} />
  ) : (
    <span
      className={cn('flex shrink-0 items-center justify-center bg-band text-muted-foreground', className)}
      style={style}
      aria-hidden="true"
    >
      <Fallback size={15} />
    </span>
  );
}
