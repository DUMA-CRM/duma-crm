'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CircleDollarSign, Grid2X2, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

import { type TopItemAnalytics, getTopItems } from '@/lib/api/analytics.service';
import { getMenuItems } from '@/lib/api/menu.service';
import { getMenuItemRecipe } from '@/lib/api/recipes.service';
import { getLocations } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { type DashboardRange, formatCompact, formatMoney, getDateWindow, percentageChange } from '@/lib/utils/dashboard';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuCategory } from '@/types/menu';

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

type SortBy = 'quantity' | 'revenue' | 'contribution' | 'margin';

interface AggregatedItem extends TopItemAnalytics {
  totalQuantity: number;
  totalRevenue: string;
}

interface MenuPerformanceRow extends AggregatedItem {
  category: MenuCategory | 'uncategorised';
  unitCost: number | null;
  estimatedCost: number | null;
  contribution: number | null;
  margin: number | null;
  costComplete: boolean;
}

const panel = 'rounded-2xl border border-border bg-card';

const qtyOf = (row: TopItemAnalytics) => Number(row.totalQuantity ?? 0);
const revOf = (row: TopItemAnalytics) => Number(row.totalRevenue ?? 0);

const CATEGORY_LABEL: Record<MenuCategory | 'uncategorised', string> = {
  coffee: 'Coffee',
  'other-hot-drinks': 'Other hot drinks',
  'coffee-over-ice': 'Coffee over ice',
  tea: 'Tea',
  snacks: 'Snacks',
  uncategorised: 'Uncategorised',
};

function aggregateItems(rows: TopItemAnalytics[]): AggregatedItem[] {
  const grouped = new Map<string, AggregatedItem>();
  rows.forEach((row) => {
    const current = grouped.get(row.menuItemId);
    if (current) {
      current.totalQuantity += qtyOf(row);
      current.totalRevenue = String(Number(current.totalRevenue) + revOf(row));
      current.orderCount += Number(row.orderCount ?? 0);
      return;
    }
    grouped.set(row.menuItemId, {
      ...row,
      totalQuantity: qtyOf(row),
      totalRevenue: String(revOf(row)),
      orderCount: Number(row.orderCount ?? 0),
    });
  });
  return [...grouped.values()];
}

function ChangeBadge({ change }: { change: number | null | undefined }) {
  if (change === undefined) return <span className="text-[11px] font-medium text-muted-foreground">Unavailable</span>;
  if (change === null) return <span className="text-[11px] font-medium text-muted-foreground">New</span>;
  const up = change >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold', up ? 'text-success' : 'text-destructive')}>
      {up ? <TrendingUp size={11} aria-hidden="true" /> : <TrendingDown size={11} aria-hidden="true" />}
      {up ? '+' : ''}
      {change.toFixed(0)}%
    </span>
  );
}

function SummaryCard({ label, value, note, loading }: { label: string; value: string; note: string; loading: boolean }) {
  return (
    <div className={cn(panel, 'p-4')}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-muted" />
      ) : (
        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      )}
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-[11px] font-medium text-warning">Cost incomplete</span>;
  return (
    <span
      className={cn(
        'rounded-full px-2 py-1 text-[11px] font-bold tabular-nums',
        margin >= 65
          ? 'bg-success-highlight text-success'
          : margin >= 50
            ? 'bg-warning-highlight text-warning'
            : 'bg-destructive/10 text-destructive',
      )}
    >
      {margin.toFixed(1)}%
    </span>
  );
}

export function TopItemsReportPage() {
  const router = useRouter();
  const { tenantId, locationId } = useWorkspaceStore();
  const [range, setRange] = useState<DashboardRange>('30d');
  const [sortBy, setSortBy] = useState<SortBy>('quantity');

  const locationsQuery = useQuery({ queryKey: ['locations-accessible'], queryFn: getLocations });
  const menuQuery = useQuery({
    queryKey: ['menu-items', tenantId, 'report-performance'],
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const locations = locationsQuery.data ?? [];
  const selectedLocation = locations.find((location) => location.id === locationId);
  const activeLocationId = selectedLocation?.id ?? null;
  const timeZone = selectedLocation?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';
  const window = useMemo(() => getDateWindow(range, timeZone), [range, timeZone]);
  const scopeKey = activeLocationId ?? 'all';
  const currentParams = () => ({ from: window.from, to: window.to, ...(activeLocationId ? { locationId: activeLocationId } : {}) });
  const previousParams = () => ({
    from: window.previousFrom,
    to: window.previousTo,
    ...(activeLocationId ? { locationId: activeLocationId } : {}),
  });
  const ready = locationsQuery.isSuccess;

  const currentQuery = useQuery({
    queryKey: ['analytics-top-items', range, scopeKey, timeZone, 'report'],
    queryFn: () => getTopItems(currentParams(), 100),
    enabled: ready,
  });
  const previousQuery = useQuery({
    queryKey: ['analytics-top-items-previous', range, scopeKey, timeZone, 'report'],
    queryFn: () => getTopItems(previousParams(), 100),
    enabled: ready,
  });

  const aggregated = useMemo(() => aggregateItems(currentQuery.data ?? []), [currentQuery.data]);
  const previous = useMemo(() => aggregateItems(previousQuery.data ?? []), [previousQuery.data]);
  const previousById = new Map(previous.map((row) => [row.menuItemId, row]));
  const menuById = new Map((menuQuery.data ?? []).map((item) => [item.id, item]));
  const recipeQueries = useQueries({
    queries: aggregated.map((item) => ({
      queryKey: ['menu-item-recipe', item.menuItemId, 'menu-performance'],
      queryFn: () => getMenuItemRecipe(item.menuItemId),
      enabled: currentQuery.isSuccess,
    })),
  });

  const performanceRows: MenuPerformanceRow[] = aggregated.map((item, index) => {
    const recipe = recipeQueries[index]?.data ?? [];
    const defaultLines = recipe.filter((line) => line.sizeModifierId == null);
    const costComplete = defaultLines.length > 0 && defaultLines.every((line) => line.stockItem?.costPerUnit != null);
    const unitCost = costComplete
      ? defaultLines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.stockItem?.costPerUnit ?? 0), 0)
      : null;
    const units = qtyOf(item);
    const revenue = revOf(item);
    const estimatedCost = unitCost === null ? null : unitCost * units;
    const contribution = estimatedCost === null ? null : revenue - estimatedCost;
    return {
      ...item,
      category: menuById.get(item.menuItemId)?.category ?? 'uncategorised',
      unitCost,
      estimatedCost,
      contribution,
      margin: contribution === null || revenue === 0 ? null : (contribution / revenue) * 100,
      costComplete,
    };
  });

  const value = (row: MenuPerformanceRow) => {
    if (sortBy === 'revenue') return revOf(row);
    if (sortBy === 'contribution') return row.contribution ?? -1;
    if (sortBy === 'margin') return row.margin ?? -1;
    return qtyOf(row);
  };
  const rows = [...performanceRows].sort((a, b) => value(b) - value(a));
  const comparisonAvailable = previousQuery.isSuccess;
  const recipesLoading = recipeQueries.some((query) => query.isPending);
  const loading = locationsQuery.isPending || menuQuery.isPending || currentQuery.isPending || recipesLoading;
  const totalUnits = rows.reduce((sum, row) => sum + qtyOf(row), 0);
  const totalRevenue = rows.reduce((sum, row) => sum + revOf(row), 0);
  const coveredRows = rows.filter((row) => row.costComplete);
  const coveredRevenue = coveredRows.reduce((sum, row) => sum + revOf(row), 0);
  const estimatedCost = coveredRows.reduce((sum, row) => sum + (row.estimatedCost ?? 0), 0);
  const contribution = coveredRevenue - estimatedCost;
  const contributionMargin = coveredRevenue ? (contribution / coveredRevenue) * 100 : 0;
  const costCoverage = totalRevenue ? (coveredRevenue / totalRevenue) * 100 : 0;
  const maxValue = Math.max(1, ...rows.map((row) => Math.max(0, value(row))));

  const categories = [
    ...rows
      .reduce((map, row) => {
        const current = map.get(row.category) ?? { category: row.category, units: 0, revenue: 0, contribution: 0, coveredRevenue: 0 };
        current.units += qtyOf(row);
        current.revenue += revOf(row);
        if (row.contribution !== null) {
          current.contribution += row.contribution;
          current.coveredRevenue += revOf(row);
        }
        map.set(row.category, current);
        return map;
      }, new Map<MenuPerformanceRow['category'], { category: MenuPerformanceRow['category']; units: number; revenue: number; contribution: number; coveredRevenue: number }>())
      .values(),
  ].sort((a, b) => b.revenue - a.revenue);

  const matrixRows = coveredRows.filter((row) => row.margin !== null);
  const sortedUnits = matrixRows.map(qtyOf).sort((a, b) => a - b);
  const sortedMargins = matrixRows.map((row) => row.margin ?? 0).sort((a, b) => a - b);
  const median = (values: number[]) =>
    values.length === 0
      ? 0
      : values.length % 2
        ? values[Math.floor(values.length / 2)]
        : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
  const medianUnits = median(sortedUnits);
  const medianMargin = median(sortedMargins);
  const quadrants = {
    Stars: matrixRows.filter((row) => qtyOf(row) >= medianUnits && (row.margin ?? 0) >= medianMargin),
    Workhorses: matrixRows.filter((row) => qtyOf(row) >= medianUnits && (row.margin ?? 0) < medianMargin),
    Opportunities: matrixRows.filter((row) => qtyOf(row) < medianUnits && (row.margin ?? 0) >= medianMargin),
    'Low performers': matrixRows.filter((row) => qtyOf(row) < medianUnits && (row.margin ?? 0) < medianMargin),
  };

  return (
    <EditorShell
      eyebrow="Menu intelligence"
      title="Menu performance"
      icon={<Trophy size={20} aria-hidden="true" />}
      onClose={() => router.push('/reports')}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
          <SegmentedControl
            options={[
              { value: 'quantity', label: 'Units sold' },
              { value: 'revenue', label: 'Revenue' },
              { value: 'contribution', label: 'Contribution' },
              { value: 'margin', label: 'Margin' },
            ]}
            value={sortBy}
            onChange={setSortBy}
          />
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <p>
            Contribution uses today&apos;s default base-recipe ingredient costs. It excludes modifier recipes, size overrides, historical
            supplier prices, labour, tax and overhead. Items with incomplete recipes remain visible but are excluded from contribution
            totals.
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <SummaryCard
            label="Distinct items"
            value={formatCompact(rows.length)}
            note={`${selectedLocation?.name ?? 'All locations'} · ${window.label}`}
            loading={loading}
          />
          <SummaryCard label="Units sold" value={formatCompact(totalUnits)} note="Across returned menu items" loading={loading} />
          <SummaryCard label="Recorded revenue" value={formatMoney(totalRevenue)} note="Non-cancelled item revenue" loading={loading} />
          <SummaryCard
            label="Cost coverage"
            value={`${costCoverage.toFixed(1)}%`}
            note={`${coveredRows.length} of ${rows.length} items fully costed`}
            loading={loading}
          />
          <SummaryCard
            label="Contribution estimate"
            value={formatMoney(contribution)}
            note="On cost-covered revenue only"
            loading={loading}
          />
          <SummaryCard
            label="Contribution margin"
            value={`${contributionMargin.toFixed(1)}%`}
            note={`${formatMoney(estimatedCost)} estimated base cost`}
            loading={loading}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className={cn(panel, 'p-5')}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Ranked by {sortBy === 'quantity' ? 'units sold' : sortBy === 'revenue' ? 'revenue' : sortBy}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Item momentum and share within the selected period</p>
              </div>
              {comparisonAvailable && <span className="text-[11px] text-muted-foreground">Change {window.comparisonLabel}</span>}
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No items ordered in this period.</p>
            ) : (
              <div className="space-y-2.5">
                {rows.slice(0, 25).map((row, index) => {
                  const primary = Math.max(0, value(row));
                  const share = maxValue ? (primary / maxValue) * 100 : 0;
                  const previousRow = previousById.get(row.menuItemId);
                  const currentComparisonValue = sortBy === 'revenue' ? revOf(row) : qtyOf(row);
                  const previousComparisonValue = previousRow ? (sortBy === 'revenue' ? revOf(previousRow) : qtyOf(previousRow)) : 0;
                  const change =
                    sortBy === 'contribution' || sortBy === 'margin'
                      ? undefined
                      : comparisonAvailable
                        ? previousRow
                          ? percentageChange(currentComparisonValue, previousComparisonValue)
                          : null
                        : undefined;
                  return (
                    <div key={row.menuItemId} className="rounded-xl px-1 py-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                            index === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.name}</span>
                        {(sortBy === 'quantity' || sortBy === 'revenue') && <ChangeBadge change={change} />}
                        <span className="w-28 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                          {sortBy === 'quantity'
                            ? `${formatCompact(qtyOf(row))} sold`
                            : sortBy === 'revenue'
                              ? formatMoney(revOf(row))
                              : sortBy === 'contribution'
                                ? row.contribution === null
                                  ? '—'
                                  : formatMoney(row.contribution)
                                : row.margin === null
                                  ? '—'
                                  : `${row.margin.toFixed(1)}%`}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 pl-9">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${share}%` }} />
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {CATEGORY_LABEL[row.category]} · {row.orderCount} orders
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={cn(panel, 'p-5')}>
            <div className="flex items-center gap-2">
              <CircleDollarSign size={16} className="text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Category mix</h2>
                <p className="mt-1 text-xs text-muted-foreground">Revenue, units and covered contribution</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {categories.map((category) => (
                <div key={category.category} className="rounded-xl bg-muted/40 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{CATEGORY_LABEL[category.category]}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatCompact(category.units)} units ·{' '}
                        {totalRevenue ? ((category.revenue / totalRevenue) * 100).toFixed(1) : '0.0'}% revenue
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-foreground">{formatMoney(category.revenue)}</p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        {category.coveredRevenue ? `${formatMoney(category.contribution)} contribution` : 'Cost incomplete'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-offset">
                    <div
                      className="h-full rounded-full bg-primary/75"
                      style={{ width: `${totalRevenue ? (category.revenue / totalRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(panel, 'p-5')}>
          <div className="flex items-center gap-2">
            <Grid2X2 size={16} className="text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Menu engineering matrix</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Relative popularity and contribution margin using medians of cost-complete items
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.entries(quadrants).map(([name, items]) => {
              const copy =
                name === 'Stars'
                  ? 'Popular with above-median margin'
                  : name === 'Workhorses'
                    ? 'Popular with below-median margin'
                    : name === 'Opportunities'
                      ? 'Higher margin with lower popularity'
                      : 'Below-median margin and popularity';
              return (
                <div key={name} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">{name}</h3>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{copy}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {items.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No items</span>
                    ) : (
                      items.slice(0, 12).map((item) => (
                        <span key={item.menuItemId} className="rounded-lg bg-muted/70 px-2 py-1 text-[11px] font-medium text-foreground">
                          {item.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={cn(panel, 'overflow-hidden')}>
          <div className="border-b border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">Detailed item economics</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Current base-recipe costs applied to actual item sales in the selected period
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/35">
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-right font-semibold">Units</th>
                  <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-3 text-right font-semibold">Base cost/unit</th>
                  <th className="px-4 py-3 text-right font-semibold">Estimated cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Contribution</th>
                  <th className="px-4 py-3 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => revOf(b) - revOf(a))
                  .map((row) => (
                    <tr key={row.menuItemId} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{CATEGORY_LABEL[row.category]}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{qtyOf(row).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{formatMoney(revOf(row))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.unitCost === null ? '—' : formatMoney(row.unitCost, 2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.estimatedCost === null ? '—' : formatMoney(row.estimatedCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                        {row.contribution === null ? '—' : formatMoney(row.contribution)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MarginBadge margin={row.margin} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className={cn(panel, 'p-4 text-xs text-muted-foreground')}>
          <span className="font-semibold text-foreground">Coverage:</span> Sales are aggregated by menu item before rendering, so duplicate
          analytics rows cannot create duplicate keys or double-rendered items. Period change is available for units and revenue.
          Contribution comparisons are withheld because current costs cannot represent historical ingredient prices.
        </p>
      </div>
    </EditorShell>
  );
}
