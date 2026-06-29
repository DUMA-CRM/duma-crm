'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { DemandForecastFilters, type StatusFilter } from '@/components/inventory/DemandForecastFilters';
import { ForecastRow } from '@/components/inventory/ForecastRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatCard } from '@/components/shared/StatCard';

import { type InventoryForecast, getInventoryForecast } from '@/lib/api/inventory.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { data?: T[] };
  if (Array.isArray(r.data)) return r.data;
  return Object.values(raw as object) as T[];
}

type SortKey = 'daysOfStockRemaining' | 'avgDailyConsumption' | 'currentQuantity' | 'recommendedReorderQuantity';
type SortDir = 'asc' | 'desc';

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DemandForecastPage() {
  const { tenantId } = useWorkspaceStore();

  const [search, setSearch] = useState('');
  const [filterLocationId, setFilterLocationId] = useState('');
  const [lookbackDays, setLookbackDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('daysOfStockRemaining');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: rawForecast, isLoading } = useQuery({
    queryKey: ['inventory-forecast', filterLocationId, lookbackDays],
    queryFn: () => getInventoryForecast(filterLocationId || undefined, lookbackDays),
  });

  const allItems = useMemo(() => normaliseArray<InventoryForecast>(rawForecast), [rawForecast]);

  const filtered = useMemo(() => {
    let items = allItems;

    if (statusFilter === 'critical') items = items.filter((i) => i.isCritical);
    else if (statusFilter === 'low') items = items.filter((i) => i.isLow && !i.isCritical);
    else if (statusFilter === 'ok') items = items.filter((i) => !i.isLow && !i.isCritical);

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.stockItemName.toLowerCase().includes(q));
    }

    return [...items].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [allItems, statusFilter, search, sortKey, sortDir]);

  const maxDays = useMemo(
    () => Math.max(...filtered.map((i) => i.daysOfStockRemaining), 1),
    [filtered],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const criticalCount = allItems.filter((i) => i.isCritical).length;
  const lowCount = allItems.filter((i) => i.isLow && !i.isCritical).length;
  const avgDays = allItems.length
    ? Math.round(allItems.reduce((s, i) => s + i.daysOfStockRemaining, 0) / allItems.length)
    : 0;
  const stockoutSoon = allItems.filter((i) => i.daysOfStockRemaining <= 7 && i.daysOfStockRemaining > 0).length;

  const hasFilters = !!(filterLocationId || search || statusFilter !== 'all');

  function clearFilters() {
    setSearch('');
    setFilterLocationId('');
    setStatusFilter('all');
  }

  const STATUS_TABS: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: allItems.length },
    { value: 'critical', label: 'Critical', count: criticalCount },
    { value: 'low', label: 'Low', count: lowCount },
    { value: 'ok', label: 'Healthy', count: allItems.length - criticalCount - lowCount },
  ];

  function SortButton({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={cn(
          'flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        <ArrowUpDown size={10} className={active ? 'opacity-100' : 'opacity-40'} />
      </button>
    );
  }

  return (
    <PageLayout eyebrow="Inventory" title="Demand Forecast" headerBorder={false} fullHeight>
      {/* Filters toolbar */}
      <DemandForecastFilters
        search={search}
        onSearchChange={setSearch}
        filterLocationId={filterLocationId}
        onLocationChange={setFilterLocationId}
        lookbackDays={lookbackDays}
        onLookbackChange={setLookbackDays}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        locations={locations}
        statusTabs={STATUS_TABS}
        hasFilters={hasFilters}
        onClearAll={clearFilters}
      />

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatCard label="Total Items" value={String(allItems.length)} icon="ShoppingBag" iconVariant="primary" />
        <StatCard
          label="Critical"
          value={String(criticalCount)}
          icon="Tag"
          iconVariant="gold"
          delta={criticalCount > 0 ? String(criticalCount) : undefined}
          deltaDirection={criticalCount > 0 ? 'down' : undefined}
        />
        <StatCard
          label="Stockout in 7 days"
          value={String(stockoutSoon)}
          icon="Tag"
          iconVariant="gold"
          delta={stockoutSoon > 0 ? String(stockoutSoon) : undefined}
          deltaDirection={stockoutSoon > 0 ? 'down' : undefined}
        />
        <StatCard label="Avg Days of Stock" value={String(avgDays)} icon="CalendarDays" iconVariant="info" />
      </div>

      {/* Table */}
      <div className="flex flex-col h-[calc(100%-17rem)] overflow-hidden rounded-2xl border border-border bg-card">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1.2fr_0.7fr_1fr_1fr_1.6fr_1.2fr_1.1fr_0.9fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-offset/50 shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unit</span>
          <SortButton col="currentQuantity" label="Current" />
          <SortButton col="avgDailyConsumption" label="Daily Avg" />
          <SortButton col="daysOfStockRemaining" label="Days Left" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Stockout Date</span>
          <SortButton col="recommendedReorderQuantity" label="Reorder Qty" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading forecast…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title={hasFilters ? 'No items match your filters' : 'No forecast data available'}
              description={
                hasFilters
                  ? 'Try adjusting your filters.'
                  : 'Forecast data will appear once stock movement history is available.'
              }
            />
          ) : (
            filtered.map((item) => (
              <ForecastRow key={item.locationStockId} item={item} maxDays={maxDays} />
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
              {hasFilters && allItems.length !== filtered.length && ` of ${allItems.length} total`}
              {' · '}Based on last {lookbackDays} days of consumption
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
