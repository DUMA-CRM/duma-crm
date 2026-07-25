'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';

import { type TopItemAnalytics, getTopItems } from '@/lib/api/analytics.service';
import { getLocations } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { type DashboardRange, formatCompact, formatMoney, getDateWindow, percentageChange } from '@/lib/utils/dashboard';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

type SortBy = 'quantity' | 'revenue';

const panel = 'rounded-2xl border border-border bg-card';

const qtyOf = (row: TopItemAnalytics) => Number(row.totalQuantity ?? 0);
const revOf = (row: TopItemAnalytics) => Number(row.totalRevenue ?? 0);

function ChangeBadge({ change }: { change: number | null | undefined }) {
  if (change === undefined || change === null) return <span className="text-[11px] font-medium text-muted-foreground">New</span>;
  const up = change >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold', up ? 'text-success' : 'text-destructive')}>
      {up ? <TrendingUp size={11} aria-hidden="true" /> : <TrendingDown size={11} aria-hidden="true" />}
      {up ? '+' : ''}
      {change.toFixed(0)}%
    </span>
  );
}

export function TopItemsReportPage() {
  const router = useRouter();
  const { locationId } = useWorkspaceStore();
  const [range, setRange] = useState<DashboardRange>('30d');
  const [sortBy, setSortBy] = useState<SortBy>('quantity');

  const locationsQuery = useQuery({ queryKey: ['locations-accessible'], queryFn: getLocations });
  const locations = locationsQuery.data ?? [];
  const selectedLocation = locations.find((l) => l.id === locationId);
  const activeLocationId = selectedLocation?.id ?? null;
  const timeZone = selectedLocation?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';
  const window = useMemo(() => getDateWindow(range, timeZone), [range, timeZone]);
  const scopeKey = activeLocationId ?? 'all';
  const currentParams = () => ({ from: window.from, to: window.to, ...(activeLocationId ? { locationId: activeLocationId } : {}) });
  const previousParams = () => ({ from: window.previousFrom, to: window.previousTo, ...(activeLocationId ? { locationId: activeLocationId } : {}) });
  const ready = locationsQuery.isSuccess;

  const currentQuery = useQuery({
    queryKey: ['analytics-top-items', range, scopeKey, timeZone, 'report'],
    queryFn: () => getTopItems(currentParams(), 25),
    enabled: ready,
  });
  const previousQuery = useQuery({
    queryKey: ['analytics-top-items-previous', range, scopeKey, timeZone, 'report'],
    queryFn: () => getTopItems(previousParams(), 100),
    enabled: ready,
  });

  const value = sortBy === 'revenue' ? revOf : qtyOf;
  const rows = [...(currentQuery.data ?? [])].sort((a, b) => value(b) - value(a));
  const previousById = new Map((previousQuery.data ?? []).map((r) => [r.menuItemId, r]));
  const comparisonAvailable = previousQuery.isSuccess;

  const totalUnits = rows.reduce((sum, r) => sum + qtyOf(r), 0);
  const totalRevenue = rows.reduce((sum, r) => sum + revOf(r), 0);
  const maxValue = Math.max(1, ...rows.map(value));

  return (
    <div className="flex flex-col -m-4 md:-m-8 h-[calc(100vh-var(--header-height))] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <Button variant="ghost" size="icon" onClick={() => router.push('/reports')} aria-label="Back to reports" className="size-11 shrink-0">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Trophy size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Report</p>
          <h1 className="text-lg font-semibold text-foreground truncate">Top ordered items</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-5 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
          <SegmentedControl
            options={[
              { value: 'quantity', label: 'Units sold' },
              { value: 'revenue', label: 'Revenue' },
            ]}
            value={sortBy}
            onChange={setSortBy}
          />
        </div>

        {/* Summary */}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className={cn(panel, 'p-4')}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Distinct items</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{rows.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedLocation?.name ?? 'All locations'} · {window.label}</p>
          </div>
          <div className={cn(panel, 'p-4')}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Units sold</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{formatCompact(totalUnits)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Across ranked items</p>
          </div>
          <div className={cn(panel, 'p-4')}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{formatMoney(totalRevenue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Across ranked items</p>
          </div>
        </section>

        {/* Ranked list */}
        <section className={cn(panel, 'p-5')}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ranked by {sortBy === 'quantity' ? 'units sold' : 'revenue'}
            </h2>
            {comparisonAvailable && <span className="text-[11px] text-muted-foreground">Change {window.comparisonLabel}</span>}
          </div>

          {locationsQuery.isPending || currentQuery.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No items ordered in this period.</p>
          ) : (
            <div className="space-y-2.5">
              {rows.map((row, i) => {
                const primary = value(row);
                const share = totalUnits > 0 || totalRevenue > 0 ? (primary / maxValue) * 100 : 0;
                const prev = previousById.get(row.menuItemId);
                const change = comparisonAvailable ? (prev ? percentageChange(value(row), value(prev)) : null) : undefined;
                return (
                  <div key={row.menuItemId} className="rounded-xl px-1 py-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                          i === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.name}</span>
                      <ChangeBadge change={change} />
                      <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                        {sortBy === 'quantity' ? `${formatCompact(qtyOf(row))} sold` : formatMoney(revOf(row))}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 pl-9">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${share}%` }} />
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {sortBy === 'quantity' ? formatMoney(revOf(row)) : `${formatCompact(qtyOf(row))} sold`} · {row.orderCount} orders
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className={cn(panel, 'p-4 text-xs text-muted-foreground')}>
          <span className="font-semibold text-foreground">How this is calculated:</span> Ranked from non-cancelled order lines in the selected
          period. Change compares each item&apos;s {sortBy === 'quantity' ? 'units sold' : 'revenue'} against the previous period of the same
          length.
        </p>
      </div>
    </div>
  );
}
