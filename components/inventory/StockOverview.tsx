'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CalendarDays, ChevronRight, Package, Repeat, Search, ShoppingBag, Tag, X } from '@/components/icons';
import { AddItemDrawer } from '@/components/inventory/stock/StockDrawers';
import {
  STATUS_ICON_BG,
  STATUS_ICON_FG,
  STATUS_LABEL,
  STATUS_VARIANT,
  type StockRow,
  daysColor,
  fmtQty,
  getStatus,
  normaliseArray,
} from '@/components/inventory/stock/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import {
  type InventoryForecast,
  type InventoryOverviewRow,
  type LocationStock,
  getInventoryForecast,
  getInventoryOverview,
  getLocationStock,
} from '@/lib/api/inventory.service';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

// Last track is the row's chevron — fixed so the header grid and the row grids
// resolve their fr columns to identical widths.
const GRID = 'grid-cols-[2fr_0.9fr_0.7fr_0.9fr_1.15fr_0.8fr_0.9fr_1.25rem]';

/**
 * Stock read against its par level, the way a trace is read against a reference.
 *
 * The figures were already here — quantity in one column, threshold in another —
 * but nothing showed the relationship between them, which is the only thing a
 * manager actually wants from this row. The bar fills to the current quantity
 * with the threshold marked as a reference tick, so "below par" is visible
 * before you read either number.
 *
 * The bar supplements the figures rather than replacing them, and the
 * relationship is stated for screen readers, so this is never colour-only.
 */
function LevelAgainstPar({ qty, threshold, unit }: { qty: number; threshold: number; unit?: string }) {
  // Scale to twice par so a healthy item sits mid-bar and there is headroom to
  // show overstock; without a par there is no reference and no bar to draw.
  const scale = threshold > 0 ? threshold * 2 : Math.max(qty, 1);
  const fill = Math.max(0, Math.min(1, qty / scale));
  const parAt = threshold > 0 ? Math.min(1, threshold / scale) : null;
  const tone = qty <= 0 ? 'exception' : threshold > 0 && qty <= threshold ? 'measured' : 'momentum';
  const relation =
    threshold > 0
      ? qty <= 0
        ? 'out of stock'
        : qty <= threshold
          ? `below par of ${threshold}${unit ? ` ${unit}` : ''}`
          : `above par of ${threshold}${unit ? ` ${unit}` : ''}`
      : 'no par level set';

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="sr-only">{relation}</span>
      <span className="relative block h-1.5 w-full max-w-24 bg-band" aria-hidden="true">
        <span
          className={cn(
            'absolute inset-y-0 left-0',
            tone === 'exception' && 'bg-exception',
            tone === 'measured' && 'bg-measured',
            tone === 'momentum' && 'bg-momentum',
          )}
          style={{ width: `${fill * 100}%` }}
        />
        {/* The reference tick: par level, marked on the scale it is measured against. */}
        {parAt !== null && <span className="absolute -inset-y-0.5 w-px bg-reference" style={{ left: `${parAt * 100}%` }} />}
      </span>
    </span>
  );
}

/**
 * What this location holds right now: the health summary across the top and one
 * row per stock item, each opening its record. The Add Item drawer is driven from
 * the workspace header, so the flag comes in as a prop.
 */
export function StockOverview({
  locationId,
  addOpen,
  onAddOpenChange,
}: {
  locationId: string;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expiryCutoff] = useState(() => Date.now() + 7 * 86400000);

  function invalidateStock() {
    void queryClient.invalidateQueries({ queryKey: ['location-stock', locationId] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-overview', locationId] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-forecast', locationId] });
  }

  const { data: rawStock, isLoading } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId),
  });

  const { data: rawForecast } = useQuery({
    queryKey: ['inventory-forecast', locationId],
    queryFn: () => getInventoryForecast(locationId),
  });

  const { data: rawOverview } = useQuery({
    queryKey: ['inventory-overview', locationId],
    queryFn: () => getInventoryOverview(locationId),
  });

  const allStock = useMemo(() => normaliseArray<LocationStock>(rawStock), [rawStock]);

  const forecastMap = useMemo(() => {
    const m = new Map<string, InventoryForecast>();
    normaliseArray<InventoryForecast>(rawForecast).forEach((f) => m.set(f.locationStockId, f));
    return m;
  }, [rawForecast]);

  const overviewMap = useMemo(() => {
    const map = new Map<string, InventoryOverviewRow>();
    normaliseArray<InventoryOverviewRow>(rawOverview).forEach((row) => map.set(row.stockItemId, row));
    return map;
  }, [rawOverview]);

  const enriched = useMemo<StockRow[]>(
    () =>
      allStock.map((s) => {
        const overview = overviewMap.get(s.stockItemId);
        const projected = { ...s, quantity: overview?.totalOnHand ?? s.quantity };
        return {
          ...projected,
          status: getStatus(projected),
          qty: parseFloat(projected.quantity),
          threshold: parseFloat(s.lowThreshold),
          forecast: forecastMap.get(s.id),
          category: overview?.category,
          activeUnitCount: overview?.activeUnitCount ?? 0,
          earliestExpiryDate: overview?.earliestExpiryDate,
          needsReorder: overview?.needsReorder,
        };
      }),
    [allStock, forecastMap, overviewMap],
  );

  const filtered = useMemo(
    () =>
      enriched.filter((s) => {
        if (search && !(s.stockItem?.name ?? '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [enriched, search],
  );

  const existingIds = useMemo(() => new Set(allStock.map((s) => s.stockItemId)), [allStock]);

  const outCount = enriched.filter((s) => s.status === 'out').length;
  const attentionCount = enriched.filter((s) => s.status === 'low' || s.status === 'critical' || s.status === 'out').length;
  const soonCount = enriched.filter((s) => s.forecast && s.forecast.daysOfStockRemaining <= 7).length;
  const expiringCount = enriched.filter((s) => s.earliestExpiryDate && new Date(s.earliestExpiryDate).getTime() <= expiryCutoff).length;

  const hasFilters = !!search;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search items…"
        leftIcon={<Search size={14} />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        rightAction={
          search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          ) : undefined
        }
      />

      <StatCardGrid>
        <StatCard label="Total Items" value={enriched.length} icon={ShoppingBag} accent="primary" />
        <StatCard
          label="Out of Stock"
          value={outCount}
          icon={Repeat}
          accent="warning"
          delta={outCount > 0 ? { value: `${outCount} to reorder`, trend: 'down' } : undefined}
        />
        <StatCard
          label="Needs Attention"
          value={attentionCount}
          icon={Tag}
          accent="warning"
          delta={attentionCount > 0 ? { value: `${attentionCount} below par`, trend: 'down' } : undefined}
        />
        <StatCard
          label="Expiry Attention"
          value={expiringCount}
          icon={CalendarDays}
          accent={expiringCount > 0 ? 'warning' : 'info'}
          delta={soonCount > 0 ? { value: `${soonCount} low soon`, trend: 'flat' } : undefined}
        />
      </StatCardGrid>

      <div className="overflow-hidden rounded-sm border border-rule bg-card shadow-sm">
        {/* Horizontal scroll on narrow screens — header and rows scroll together */}
        <div className="overflow-x-auto">
          <div className="min-w-160">
            <div className={cn('grid gap-4 border-b border-rule bg-band px-4 py-2.5', GRID)}>
              {['Item', 'On Hand', 'Units', 'Reorder At', 'Earliest Expiry', 'Days Left', 'Status'].map((h) => (
                <span key={h} className="text-micro font-semibold tracking-micro text-muted-foreground uppercase">
                  {h}
                </span>
              ))}
              <span className="sr-only">Open</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-muted-foreground">Loading stock…</p>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Package}
                title={hasFilters ? 'No items match your filters' : 'No stock items at this location'}
                description={hasFilters ? 'Try adjusting your filters.' : 'Add items using the button above.'}
              />
            ) : (
              filtered.map((s) => {
                const days = s.forecast?.daysOfStockRemaining;
                return (
                  <Link
                    key={s.id}
                    href={`/inventory/items/${s.stockItemId}`}
                    className={cn(
                      'grid gap-4 border-b border-rule px-4 py-3 transition-colors last:border-0 hover:bg-band',
                      GRID,
                    )}
                  >
                    {/* Item */}
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-sm', STATUS_ICON_BG[s.status])}>
                        <Package size={13} className={STATUS_ICON_FG[s.status]} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{s.stockItem?.name ?? s.stockItemId.slice(0, 8)}</p>
                        {s.stockItem?.unit && (
                          <p className="text-label text-muted-foreground">
                            {s.category ? `${s.category} · ` : ''}
                            {s.stockItem.unit}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity, read against par */}
                    <div className="flex flex-col justify-center gap-1">
                      <span
                        data-figure
                        className={cn('text-sm font-semibold', (s.status === 'critical' || s.status === 'out') && 'text-exception')}
                      >
                        {fmtQty(s.qty)}
                      </span>
                      <LevelAgainstPar qty={s.qty} threshold={s.threshold} unit={s.stockItem?.unit} />
                    </div>

                    {/* Active physical containers */}
                    <div className="flex items-center text-sm tabular-nums text-foreground">{s.activeUnitCount ?? 0}</div>

                    {/* Threshold */}
                    <div className="flex items-center text-sm tabular-nums text-muted-foreground">{fmtQty(s.threshold)}</div>

                    {/* Earliest expiry */}
                    <div className="flex min-w-0 flex-col justify-center">
                      <span
                        className={cn(
                          'truncate text-sm tabular-nums',
                          s.earliestExpiryDate && new Date(s.earliestExpiryDate) < new Date() ? 'text-destructive' : 'text-foreground',
                        )}
                      >
                        {formatDate(s.earliestExpiryDate)}
                      </span>
                    </div>

                    {/* Days left */}
                    <div className="flex items-center">
                      {days === undefined ? (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      ) : (
                        <span className={cn('text-sm font-medium tabular-nums', daysColor(days))}>{Math.round(days)}d</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center">
                      <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    </div>

                    <div className="flex items-center text-muted-foreground">
                      <ChevronRight size={15} aria-hidden="true" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {filtered.length > 0 && (
          <div className="border-t border-rule px-4 py-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
              {hasFilters && enriched.length !== filtered.length && ` of ${enriched.length} total`}
            </p>
          </div>
        )}
      </div>

      {addOpen && (
        <AddItemDrawer
          locationId={locationId}
          existingIds={existingIds}
          onClose={() => onAddOpenChange(false)}
          onSuccess={() => {
            invalidateStock();
            toast('success', 'Item added.');
          }}
        />
      )}
    </div>
  );
}
