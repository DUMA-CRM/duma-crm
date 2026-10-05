'use client';

import Link from 'next/link';

import { AlertTriangle, ChevronRight, Gauge, Scale, Timer, UtensilsCrossed, Wallet } from '@/components/icons';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';

import { getLabourAnalytics } from '@/lib/modules/analytics/client';
import { REPORTS } from '@/lib/reports/catalogue';
import { cn } from '@/lib/utils/cn';
import { exportFileName, share, toCsv } from '@/lib/utils/report-filters';
import { type PrimeCostBand, type ProfitSummary, primeCostBand, profitSummary } from '@/lib/utils/report-profit';

import { ReportFrame, downloadFile } from '../kit/ReportFrame';
import { KpiGrid, ReportBlock, ReportError, ReportLoading, ReportTable } from '../kit/parts';
import { type CostedItem, salesExVat, useMenuCosting } from '../kit/useMenuCosting';
import { useRangeQuery } from '../kit/useRangeQuery';
import type { ReportFilterState } from '../kit/useReportFilters';

import { useOrderAnalytics } from './SalesReports';

const def = (id: string) => REPORTS.find((report) => report.id === id)!;
const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const pct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;

/**
 * Prime cost for the period and the one before: sales without VAT, food cost
 * from the recipes, labour from the clock. The home page's Profit card and the
 * Prime cost report both read this, so they can't disagree.
 */
export function usePrimeCost(filters: ReportFilterState) {
  const sales = useOrderAnalytics(filters);
  const labour = useRangeQuery('labour', getLabourAnalytics, filters);
  const costing = useMenuCosting(filters);

  const summarise = (totalSales: number | null, labourCost: number | null, totals: typeof costing.totals | null) =>
    totalSales === null || !totals
      ? null
      : profitSummary({
          salesExVat: salesExVat(totalSales, totals),
          costedSalesExVat: totals.costedNetRevenue,
          costedCost: totals.cost,
          labour: labourCost,
        });

  const current = summarise(
    sales.data ? num(sales.data.summary.totalRevenue) : null,
    labour.data ? labour.data.estimatedCost : null,
    costing.totals,
  );
  const previous = summarise(
    sales.previous ? num(sales.previous.summary.totalRevenue) : null,
    labour.previous ? labour.previous.estimatedCost : null,
    costing.previousTotals,
  );

  return {
    current,
    previous,
    costing,
    labour,
    loading: sales.isPending || labour.isPending || costing.loading,
    isError: sales.isError || costing.isError,
    refetch: () => {
      sales.refetch();
      labour.refetch();
      costing.refetch();
    },
  };
}

export const BAND_LOOK: Record<PrimeCostBand, { label: string; text: string; bar: string; pill: string }> = {
  healthy: { label: 'Healthy', text: 'text-momentum', bar: 'bg-momentum', pill: 'bg-momentum/10 text-momentum' },
  watch: { label: 'Worth watching', text: 'text-measured', bar: 'bg-measured', pill: 'bg-measured/10 text-measured' },
  high: { label: 'Too high', text: 'text-exception', bar: 'bg-exception', pill: 'bg-exception/8 text-exception' },
};

/**
 * Sales as one bar split into food, labour and what's left — the shape of the
 * money at a glance, with the 60% rule of thumb marked.
 */
export function ProfitBar({ summary }: { summary: ProfitSummary }) {
  const food = Math.max(0, Math.min(1, summary.foodCostPct));
  const labour = Math.max(0, Math.min(1 - food, summary.labourPct ?? 0));
  const left = Math.max(0, 1 - food - labour);
  return (
    <div>
      <div
        className="relative flex h-3 overflow-hidden rounded-full bg-band"
        role="img"
        aria-label={`Food ${pct(food)}, labour ${pct(labour)}, left ${pct(left)}`}
      >
        <span className="h-full bg-reference/70" style={{ width: `${food * 100}%` }} />
        <span className="h-full bg-measured/70" style={{ width: `${labour * 100}%` }} />
        <span className="h-full bg-momentum/50" style={{ width: `${left * 100}%` }} />
        {/* The 60% line: prime cost should end before it. */}
        <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: '60%' }} aria-hidden="true" />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs bg-reference/70" /> Food {pct(food, 0)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs bg-measured/70" /> Labour {summary.labourPct === null ? '—' : pct(labour, 0)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs bg-momentum/50" /> Left {pct(left, 0)}
        </span>
        <span className="ml-auto">| aim under 60%</span>
      </p>
    </div>
  );
}

// ── Prime cost report ────────────────────────────────────────────────────────

export function PrimeCostReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('prime-cost');
  const { current, previous, costing, labour, loading, isError, refetch } = usePrimeCost(filters);

  const categories = byCategory(costing.rows);
  const uncosted = costing.rows
    .filter((row) => row.cost === null)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const band = current?.primeCostPct != null ? primeCostBand(current.primeCostPct) : null;

  const lines = current
    ? [
        { key: 'sales', label: 'Sales, without VAT', value: current.salesExVat, sign: '' },
        { key: 'food', label: 'Food cost', value: -current.foodCost, sign: '−', note: `${pct(current.foodCostPct)} of sales` },
        { key: 'gross', label: 'Gross profit', value: current.grossProfit, sign: '=', strong: true },
        ...(current.labour !== null
          ? [{ key: 'labour', label: 'Labour', value: -current.labour, sign: '−', note: `${pct(current.labourPct)} of sales` }]
          : []),
        ...(current.primeCost !== null
          ? [{ key: 'left', label: 'Left after food and labour', value: current.salesExVat - current.primeCost, sign: '=', strong: true }]
          : []),
      ]
    : [];

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        current
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(
                  [
                    ...lines.map((line) => ({ measure: line.label, value: line.value.toFixed(2) })),
                    { measure: 'Food cost %', value: pct(current.foodCostPct) },
                    { measure: 'Labour %', value: pct(current.labourPct) },
                    { measure: 'Prime cost %', value: pct(current.primeCostPct) },
                    { measure: 'Sales with a costed recipe', value: pct(current.coverage, 0) },
                  ],
                  [
                    { header: 'Measure', value: (row) => row.measure },
                    { header: 'Value', value: (row) => row.value },
                  ],
                ),
              )
          : undefined
      }
    >
      {isError ? (
        <ReportError onRetry={refetch} />
      ) : loading ? (
        <ReportLoading />
      ) : !current ? (
        <p className="rounded-lg border border-dashed border-rule/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {costing.recipesError
            ? 'Recipe costs couldn’t be read, so there’s no food cost to measure.'
            : 'No sales with a costed recipe in these dates. Add recipes and stock costs in Menu to see your prime cost.'}
        </p>
      ) : (
        <>
          {current.coverage < 0.8 && (
            <p className="flex items-start gap-2.5 rounded-lg border border-measured/30 bg-measured/6 px-3.5 py-3 text-sm text-foreground">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
              Food cost is measured on the {pct(current.coverage, 0)} of sales with a full recipe cost and applied to the rest. Cost the
              items below to make it exact.
            </p>
          )}
          {labour.data && !labour.data.costComplete && (
            <p className="flex items-start gap-2.5 rounded-lg border border-measured/30 bg-measured/6 px-3.5 py-3 text-sm text-foreground">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
              Some staff have no pay rate on file, so labour — and prime cost — read low.
            </p>
          )}

          <KpiGrid
            kpis={[
              {
                label: 'Prime cost',
                icon: Gauge,
                value: pct(current.primeCostPct),
                current: current.primeCostPct ?? undefined,
                previous: previous?.primeCostPct ?? null,
                inverse: true,
                hint: band ? BAND_LOOK[band].label : 'Labour unavailable',
              },
              {
                label: 'Food cost',
                icon: UtensilsCrossed,
                value: pct(current.foodCostPct),
                current: current.foodCostPct,
                previous: previous?.foodCostPct ?? null,
                inverse: true,
                hint: money(current.foodCost),
              },
              {
                label: 'Labour',
                icon: Timer,
                value: pct(current.labourPct),
                current: current.labourPct ?? undefined,
                previous: previous?.labourPct ?? null,
                inverse: true,
                hint: current.labour === null ? undefined : money(current.labour),
              },
              {
                label: 'Gross profit',
                icon: Wallet,
                value: money(current.grossProfit),
                current: current.grossProfit,
                previous: previous?.grossProfit ?? null,
                hint: `${pct(1 - current.foodCostPct)} margin`,
              },
            ]}
          />

          <ReportBlock title="Where the money went" description="Sales without VAT, less what the food and the team cost.">
            <ProfitBar summary={current} />
            <dl className="mt-4 divide-y divide-rule/45 border-t border-rule/45">
              {lines.map((line) => (
                <div key={line.key} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className={cn('flex items-baseline gap-2', line.strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    <span className="w-3 text-center tabular-nums text-muted-foreground" aria-hidden="true">
                      {line.sign}
                    </span>
                    {line.label}
                    {line.note && <span className="text-xs font-normal text-muted-foreground">{line.note}</span>}
                  </dt>
                  <dd className={cn('tabular-nums', line.strong ? 'font-semibold text-foreground' : 'text-foreground')}>
                    {money(Math.abs(line.value))}
                  </dd>
                </div>
              ))}
            </dl>
            {band && current.primeCostPct !== null && (
              <p className="mt-3 text-xs text-muted-foreground">
                Prime cost {pct(current.primeCostPct)} —{' '}
                <span className={cn('font-semibold', BAND_LOOK[band].text)}>{BAND_LOOK[band].label.toLowerCase()}</span>. Most restaurants
                aim for 60% or less; above 65% leaves little for rent and everything else.
              </p>
            )}
          </ReportBlock>

          <ReportBlock title="Food cost by category" description="Costed items only, VAT excluded." flush>
            <ReportTable
              rows={categories}
              rowKey={(row) => row.category}
              defaultSort={{ key: 'sales', direction: 'desc' }}
              empty="No costed items in these dates."
              columns={[
                {
                  key: 'category',
                  header: 'Category',
                  render: (row) => row.category,
                  sub: (row) => `${row.items} ${row.items === 1 ? 'item' : 'items'}`,
                  sort: (row) => row.category,
                },
                { key: 'sales', header: 'Sales', align: 'right', render: (row) => money(row.sales), sort: (row) => row.sales },
                { key: 'cost', header: 'Food cost', align: 'right', render: (row) => money(row.cost), sort: (row) => row.cost },
                {
                  key: 'pct',
                  header: 'Food cost %',
                  align: 'right',
                  render: (row) => pct(share(row.cost, row.sales)),
                  meter: (row) => share(row.cost, row.sales),
                  sort: (row) => share(row.cost, row.sales),
                },
              ]}
            />
          </ReportBlock>

          {uncosted.length > 0 && (
            <ReportBlock
              title="Not costed yet"
              description="Best sellers without a full recipe cost — costing these does the most for accuracy."
              flush
            >
              <ReportTable
                rows={uncosted}
                rowKey={(row) => row.id}
                rowHref={(row) => `/menu/items/${row.id}`}
                columns={[
                  { key: 'name', header: 'Item', render: (row) => row.name, sub: (row) => row.category },
                  { key: 'sales', header: 'Sales', align: 'right', render: (row) => money(row.revenue) },
                  {
                    key: 'share',
                    header: 'Of all sales',
                    align: 'right',
                    render: (row) => pct(share(row.revenue, costing.totals.revenue)),
                    meter: (row) => share(row.revenue, costing.totals.revenue),
                  },
                ]}
              />
            </ReportBlock>
          )}

          <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Scale size={13} aria-hidden="true" />
            Recipes are costed at today’s ingredient prices.
            <Link
              href={`/reports/menu-engineering${filters.query ? `?${filters.query}` : ''}`}
              className="ml-1 inline-flex items-center font-semibold text-primary hover:underline"
            >
              Margin by item
              <ChevronRight size={12} aria-hidden="true" />
            </Link>
          </p>
        </>
      )}
    </ReportFrame>
  );
}

function byCategory(rows: CostedItem[]) {
  const groups = new Map<string, { category: string; items: number; sales: number; cost: number }>();
  for (const row of rows) {
    if (row.cost === null) continue;
    const group = groups.get(row.category) ?? { category: row.category, items: 0, sales: 0, cost: 0 };
    group.items += 1;
    group.sales += row.netRevenue;
    group.cost += row.cost;
    groups.set(row.category, group);
  }
  return [...groups.values()];
}
