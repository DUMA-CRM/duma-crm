'use client';

import { useState } from 'react';

import {
  AlertTriangle,
  Award,
  ChevronRight,
  Coins,
  type IconComponent,
  Layers3,
  Package,
  Pencil,
  Repeat,
  Scale,
  Sparkles,
  Star,
  TrendingDown,
  UtensilsCrossed,
  Wallet,
} from '@/components/icons';
import { IconTag } from '@/components/shared/IconTag';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { TONE_INK, type Tone } from '@/components/shared/tone';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';

import { getCategorySales, getTopItems } from '@/lib/modules/analytics/client';
import { REPORTS } from '@/lib/reports/catalogue';
import { cn } from '@/lib/utils/cn';
import { type MenuQuadrant, QUADRANT, classifyMenu } from '@/lib/utils/menu-engineering';
import { delta, exportFileName, share, toCsv } from '@/lib/utils/report-filters';

import { DrawerFacts, DrawerList, DrawerListSkeleton, DrawerMark, DrawerSection, ReportDrawer } from '../kit/DetailDrawer';
import { ReportFrame, downloadFile } from '../kit/ReportFrame';
import { ChangePill, KpiGrid, ReportBlock, ReportError, ReportLoading, ReportTable } from '../kit/parts';
import { useMenuCosting } from '../kit/useMenuCosting';
import { useRangeQuery } from '../kit/useRangeQuery';
import type { ReportFilterState } from '../kit/useReportFilters';

const def = (id: string) => REPORTS.find((report) => report.id === id)!;
const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const count = (value: number) => value.toLocaleString('en-GB');

/** Top items at the depth a report needs — one cache entry shared by both menu reports. */
function useItemSales(filters: ReportFilterState) {
  return useRangeQuery('top-items:100', (params) => getTopItems(params, 100), filters);
}

// ── Item & category sales ────────────────────────────────────────────────────

type View = 'items' | 'categories';

export function ItemSalesReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('item-sales');
  const [view, setView] = useState<View>('items');
  const [open, setOpen] = useState<Opened>(null);
  const items = useItemSales(filters);
  const categories = useRangeQuery('category-sales', getCategorySales, filters);

  const itemRows = (items.data ?? []).map((row) => {
    const before = items.previous?.find((entry) => entry.menuItemId === row.menuItemId);
    return {
      id: row.menuItemId,
      name: row.name,
      quantity: num(row.totalQuantity),
      revenue: num(row.totalRevenue),
      orders: row.orderCount,
      previous: before ? num(before.totalRevenue) : null,
    };
  });
  const categoryRows = (categories.data ?? []).map((row) => {
    const before = categories.previous?.find((entry) => entry.categoryId === row.categoryId);
    return {
      id: row.categoryId ?? 'none',
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue,
      orders: row.orders,
      previous: before ? before.revenue : null,
    };
  });
  const rows = view === 'items' ? itemRows : categoryRows;
  const active = view === 'items' ? items : categories;
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const units = rows.reduce((sum, row) => sum + row.quantity, 0);
  const best = [...rows].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        rows.length
          ? () =>
              downloadFile(
                exportFileName(`${report.id}-${view}`, filters.range),
                toCsv(rows, [
                  { header: view === 'items' ? 'Item' : 'Category', value: (row) => row.name },
                  { header: 'Units', value: (row) => row.quantity },
                  { header: 'Sales', value: (row) => row.revenue.toFixed(2) },
                  { header: 'Orders', value: (row) => row.orders },
                  { header: 'Share', value: (row) => `${(share(row.revenue, total) * 100).toFixed(1)}%` },
                ]),
              )
          : undefined
      }
    >
      <SegmentedControl<View>
        options={[
          { value: 'items', label: 'Items' },
          { value: 'categories', label: 'Categories' },
        ]}
        value={view}
        onChange={setView}
        ariaLabel="Show items or categories"
      />
      {active.isError ? (
        <ReportError onRetry={active.refetch} />
      ) : active.isPending ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              { label: 'Sales', icon: Wallet, value: money(total), hint: 'Before refunds' },
              { label: 'Units sold', icon: Package, value: count(units) },
              {
                label: view === 'items' ? 'Best seller' : 'Top category',
                icon: Award,
                value: best?.name ?? '—',
                hint: best ? `${money(best.revenue)} · ${Math.round(share(best.revenue, total) * 100)}%` : undefined,
              },
            ]}
          />
          <ReportBlock
            title={view === 'items' ? 'Every item' : 'Every category'}
            description={view === 'items' ? 'The top 100 items by units sold.' : undefined}
            flush
          >
            <ReportTable
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) =>
                setOpen(view === 'items' ? { kind: 'item', id: row.id } : { kind: 'category', id: row.id, name: row.name })
              }
              activeKey={open?.id}
              defaultSort={{ key: 'revenue', direction: 'desc' }}
              limit={25}
              ranked
              search={{ text: (row) => row.name, noun: view === 'items' ? ['item', 'items'] : ['category', 'categories'] }}
              columns={[
                {
                  key: 'name',
                  header: view === 'items' ? 'Item' : 'Category',
                  render: (row) => row.name,
                  sort: (row) => row.name,
                },
                {
                  key: 'quantity',
                  header: 'Units',
                  align: 'right',
                  render: (row) => count(row.quantity),
                  sort: (row) => row.quantity,
                },
                { key: 'orders', header: 'Orders', align: 'right', render: (row) => count(row.orders), sort: (row) => row.orders },
                {
                  key: 'revenue',
                  header: 'Sales',
                  align: 'right',
                  render: (row) => money(row.revenue),
                  sort: (row) => row.revenue,
                },
                {
                  key: 'share',
                  header: 'Share',
                  align: 'right',
                  render: (row) => `${(share(row.revenue, total) * 100).toFixed(1)}%`,
                  meter: (row) => share(row.revenue, total),
                  sort: (row) => row.revenue,
                },
                {
                  key: 'change',
                  header: 'Change',
                  align: 'right',
                  render: (row) => <ChangePill change={delta(row.revenue, row.previous)} />,
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
      {open?.kind === 'item' && <ItemDrawer filters={filters} itemId={open.id} onClose={() => setOpen(null)} />}
      {open?.kind === 'category' && (
        <CategoryDrawer
          filters={filters}
          category={categoryRows.find((row) => row.id === open.id) ?? null}
          name={open.name}
          onOpenItem={(id) => setOpen({ kind: 'item', id })}
          onClose={() => setOpen(null)}
        />
      )}
    </ReportFrame>
  );
}

// ── Menu engineering ─────────────────────────────────────────────────────────

/** The class's glyph — the table's Class column, keyed by the cards above it. */
const QUADRANT_ICON: Record<MenuQuadrant, { icon: IconComponent; tone: Tone }> = {
  star: { icon: Star, tone: 'success' },
  workhorse: { icon: Repeat, tone: 'warning' },
  opportunity: { icon: Sparkles, tone: 'info' },
  low: { icon: TrendingDown, tone: 'muted' },
};

const QUADRANT_TONE: Record<MenuQuadrant, string> = {
  star: 'border-momentum/35 bg-momentum/5',
  workhorse: 'border-measured/35 bg-measured/5',
  opportunity: 'border-reference/35 bg-reference/5',
  low: 'border-rule/60 bg-field',
};

export function MenuEngineeringReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('menu-engineering');
  // The same costing the Profit card and the Prime cost report read.
  const costing = useMenuCosting(filters);
  const [open, setOpen] = useState<string | null>(null);
  const rows = costing.rows;
  const { quadrants } = classifyMenu(rows);
  const placed = rows.map((row, index) => ({ ...row, quadrant: quadrants[index] }));
  const netCovered = costing.totals.costedNetRevenue;
  const cost = costing.totals.cost;
  const contribution = netCovered - cost;
  const revenue = costing.totals.revenue;
  const coverage = share(costing.totals.costedRevenue, revenue);
  const loading = costing.loading;

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        placed.length
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(placed, [
                  { header: 'Item', value: (row) => row.name },
                  { header: 'Category', value: (row) => row.category },
                  { header: 'Units', value: (row) => row.units },
                  { header: 'Sales', value: (row) => row.revenue.toFixed(2) },
                  { header: 'Net of VAT', value: (row) => row.netRevenue.toFixed(2) },
                  { header: 'Food cost', value: (row) => row.cost?.toFixed(2) ?? '' },
                  { header: 'Contribution', value: (row) => row.contribution?.toFixed(2) ?? '' },
                  { header: 'Margin %', value: (row) => (row.margin === null ? '' : row.margin.toFixed(1)) },
                  { header: 'Class', value: (row) => (row.quadrant ? QUADRANT[row.quadrant].label : 'Not costed') },
                ]),
              )
          : undefined
      }
    >
      {costing.isError ? (
        <ReportError onRetry={costing.refetch} />
      ) : loading ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              { label: 'Contribution', icon: Coins, value: money(contribution), hint: 'Net sales less recipe cost, costed items' },
              {
                label: 'Margin',
                icon: Scale,
                value: netCovered > 0 ? `${((contribution / netCovered) * 100).toFixed(1)}%` : '—',
                hint: 'Of net sales, costed items',
              },
              { label: 'Food cost', icon: UtensilsCrossed, value: money(cost), inverse: true },
              { label: 'Costed', icon: Package, value: `${Math.round(coverage * 100)}%`, hint: 'Of sales with a full recipe cost' },
            ]}
          />
          {costing.recipesError && (
            <p
              className="flex items-start gap-2.5 rounded-lg border border-exception/30 bg-exception/5 px-3.5 py-3 text-sm text-foreground"
              role="alert"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-exception" aria-hidden="true" />
              Recipe costs couldn’t be loaded, so every item shows as not costed.
              <button
                type="button"
                onClick={costing.refetchRecipes}
                className="ml-auto shrink-0 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          )}
          {!costing.recipesError && coverage < 0.8 && (
            <p className="flex items-start gap-2.5 rounded-lg border border-measured/30 bg-measured/6 px-3.5 py-3 text-sm text-foreground">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
              Only {Math.round(coverage * 100)}% of sales come from items with a full recipe cost. Add recipes and stock costs in Menu to
              make this report complete — uncosted items are left out of the classes below.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {(['star', 'workhorse', 'opportunity', 'low'] as const).map((quadrant) => {
              const members = placed.filter((row) => row.quadrant === quadrant).sort((a, b) => b.units - a.units);
              return (
                <section
                  key={quadrant}
                  className={cn('rounded-lg border px-4 py-3.5', QUADRANT_TONE[quadrant])}
                  aria-label={QUADRANT[quadrant].label}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {(() => {
                        const { icon: Icon, tone } = QUADRANT_ICON[quadrant];
                        return <Icon size={14} className={TONE_INK[tone]} aria-hidden="true" />;
                      })()}
                      {QUADRANT[quadrant].label}
                    </h2>
                    <span className="text-xs tabular-nums text-muted-foreground">{members.length} items</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{QUADRANT[quadrant].advice}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground">
                    {members.length ? members.map((row) => row.name).join(' · ') : 'None'}
                  </p>
                </section>
              );
            })}
          </div>
          <ReportBlock title="Every item" description="Popularity is units sold; profitability is margin on net-of-VAT sales." flush>
            <ReportTable
              rows={placed}
              rowKey={(row) => row.id}
              onRowClick={(row) => setOpen(row.id)}
              activeKey={open}
              defaultSort={{ key: 'contribution', direction: 'desc' }}
              limit={25}
              search={{ text: (row) => `${row.name} ${row.category}`, noun: ['item', 'items'] }}
              columns={[
                { key: 'name', header: 'Item', render: (row) => row.name, sub: (row) => row.category, sort: (row) => row.name },
                { key: 'units', header: 'Units', align: 'right', render: (row) => count(row.units), sort: (row) => row.units },
                {
                  key: 'revenue',
                  header: 'Sales',
                  align: 'right',
                  render: (row) => money(row.revenue),
                  sort: (row) => row.revenue,
                  total: money(revenue),
                },
                {
                  key: 'contribution',
                  header: 'Contribution',
                  align: 'right',
                  render: (row) => (row.contribution === null ? '—' : money(row.contribution)),
                  sort: (row) => row.contribution ?? -Infinity,
                },
                {
                  key: 'margin',
                  header: 'Margin',
                  align: 'right',
                  render: (row) =>
                    row.margin === null ? (
                      <span className="text-muted-foreground" title="Not costed">
                        —<span className="sr-only">Not costed</span>
                      </span>
                    ) : (
                      `${row.margin.toFixed(1)}%`
                    ),
                  sort: (row) => row.margin ?? -Infinity,
                },
                {
                  key: 'class',
                  header: 'Class',
                  render: (row) =>
                    row.quadrant ? (
                      <IconTag
                        icon={QUADRANT_ICON[row.quadrant].icon}
                        label={QUADRANT[row.quadrant].label}
                        tone={QUADRANT_ICON[row.quadrant].tone}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                  sort: (row) => row.quadrant ?? 'z',
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
      {open && <ItemDrawer filters={filters} itemId={open} onClose={() => setOpen(null)} />}
    </ReportFrame>
  );
}

// ── Drawers ──────────────────────────────────────────────────────────────────

const QUADRANT_ONE: Record<MenuQuadrant, string> = {
  star: 'A star',
  workhorse: 'A workhorse',
  opportunity: 'An opportunity',
  low: 'A low performer',
};

type Opened = { kind: 'item'; id: string } | { kind: 'category'; id: string; name: string } | null;

/**
 * One item over the period: what it sold, its share and rank, its change, and
 * — when its recipe is costed — what each one earns and where it sits in menu
 * engineering. Item sales and Menu engineering open the same drawer, so an
 * item reads the same wherever it's clicked.
 */
export function ItemDrawer({ filters, itemId, onClose }: { filters: ReportFilterState; itemId: string; onClose: () => void }) {
  const money = useWorkspaceMoney();
  const items = useItemSales(filters);
  const costing = useMenuCosting(filters);
  const all = [...(items.data ?? [])].sort((a, b) => num(b.totalRevenue) - num(a.totalRevenue));
  const item = all.find((entry) => entry.menuItemId === itemId);
  const before = items.previous?.find((entry) => entry.menuItemId === itemId);
  const total = all.reduce((sum, entry) => sum + num(entry.totalRevenue), 0);
  const { quadrants } = classifyMenu(costing.rows);
  const position = costing.rows.findIndex((row) => row.id === itemId);
  const costed = position >= 0 ? costing.rows[position] : null;
  const quadrant = position >= 0 ? quadrants[position] : null;

  const revenue = num(item?.totalRevenue);
  const units = num(item?.totalQuantity);
  const edit = { label: 'Edit item', href: `/menu/items/${itemId}`, icon: Pencil };

  return (
    <ReportDrawer
      title={item?.name ?? costed?.name ?? 'Item'}
      description={costed?.category}
      leading={<DrawerMark icon={UtensilsCrossed} />}
      links={[edit]}
      onClose={onClose}
    >
      {!item ? (
        <p className="text-sm text-muted-foreground">Not among the top 100 sellers in these dates.</p>
      ) : (
        <>
          <DrawerFacts
            facts={[
              {
                label: 'Sales',
                value: money(revenue),
                hint: before ? <ChangePill change={delta(revenue, num(before.totalRevenue))} /> : 'Nothing to compare',
              },
              {
                label: 'Units sold',
                value: count(units),
                hint: `on ${count(item.orderCount)} ${item.orderCount === 1 ? 'order' : 'orders'}`,
              },
              { label: 'Average price', value: units ? money(revenue / units) : '—', hint: 'Sales ÷ units' },
              {
                label: 'Share of sales',
                value: `${(share(revenue, total) * 100).toFixed(1)}%`,
                hint: `#${all.indexOf(item) + 1} of ${count(all.length)}`,
              },
            ]}
          />

          <DrawerSection title="What each one earns">
            {costing.loading ? (
              <DrawerListSkeleton rows={4} label="Loading what each one earns" />
            ) : costed && costed.cost !== null ? (
              <>
                <DrawerList
                  rows={[
                    { label: 'Food cost', value: `${money(costed.cost / (costed.units || 1))} each` },
                    { label: 'Sales without VAT', value: money(costed.netRevenue) },
                    { label: 'Contribution', value: <span className="font-semibold">{money(costed.contribution)}</span> },
                    {
                      label: 'Margin',
                      value: costed.margin === null ? '—' : `${costed.margin.toFixed(1)}%`,
                    },
                  ]}
                />
                {quadrant && (
                  <div className={cn('mt-3 rounded-lg border px-3.5 py-3', QUADRANT_TONE[quadrant])}>
                    <p className="text-sm font-semibold text-foreground">{QUADRANT_ONE[quadrant]}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{QUADRANT[quadrant].advice}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
                {costing.recipesError
                  ? 'Recipe costs couldn’t be read.'
                  : 'No full recipe cost yet — add its recipe and ingredient costs to see what it earns.'}
              </p>
            )}
          </DrawerSection>
        </>
      )}
    </ReportDrawer>
  );
}

/** A category's figures, and its items — each opening the item drawer. */
function CategoryDrawer({
  filters,
  category,
  name,
  onOpenItem,
  onClose,
}: {
  filters: ReportFilterState;
  category: { revenue: number; quantity: number; orders: number; previous: number | null } | null;
  name: string;
  onOpenItem: (id: string) => void;
  onClose: () => void;
}) {
  const money = useWorkspaceMoney();
  const costing = useMenuCosting(filters);
  const members = costing.rows.filter((row) => row.category === name).sort((a, b) => b.revenue - a.revenue);
  const inCategory = members.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <ReportDrawer title={name} description="Category" leading={<DrawerMark icon={Layers3} />} onClose={onClose}>
      {category && (
        <DrawerFacts
          facts={[
            {
              label: 'Sales',
              value: money(category.revenue),
              hint: category.previous !== null ? <ChangePill change={delta(category.revenue, category.previous)} /> : undefined,
            },
            { label: 'Units sold', value: count(category.quantity), hint: `on ${count(category.orders)} orders` },
          ]}
        />
      )}
      <DrawerSection title="Items" aside={members.length ? `${members.length} in the top 100` : undefined}>
        {costing.loading ? (
          <DrawerListSkeleton rows={4} lines={2} label="Loading the items" />
        ) : members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
            None of its items are among the top 100 sellers.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {members.map((row) => (
              <li key={row.id} className="border-b border-rule/45 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onOpenItem(row.id)}
                  className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">{count(row.units)} sold</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm tabular-nums text-foreground">{money(row.revenue)}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {Math.round(share(row.revenue, inCategory) * 100)}% of category
                    </span>
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-muted-foreground/50 group-hover:text-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DrawerSection>
    </ReportDrawer>
  );
}
