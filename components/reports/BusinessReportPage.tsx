'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, PackageSearch, ReceiptText, RefreshCw, TrendingDown, TrendingUp, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';

import {
  type AnalyticsRangeParams,
  type StaffHoursAnalytics,
  getOrderAnalytics,
  getStaffHours,
  getStockSummary,
  getTopItems,
} from '@/lib/api/analytics.service';
import { getInventoryForecast, getStockItems } from '@/lib/api/inventory.service';
import { getLossLog } from '@/lib/api/loss.service';
import { type PurchaseOrder, getPurchaseOrders } from '@/lib/api/purchasing.service';
import { getMenuItemRecipe } from '@/lib/api/recipes.service';
import { getVariance } from '@/lib/api/scheduling.service';
import { getLocations } from '@/lib/api/workspace.service';
import type { BusinessReportSection } from '@/lib/utils/business-reports';
import { cn } from '@/lib/utils/cn';
import { formatCompact, formatMoney, orderMetrics, percentageChange } from '@/lib/utils/dashboard';
import { previousDateRange, reportDateRange, shortDateLabel, trailingDateRange } from '@/lib/utils/reporting';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const panel = 'rounded-2xl border border-border bg-card';

const SECTION_META = {
  labour: {
    title: 'Labour and productivity',
    eyebrow: 'People performance',
    description: 'Worked time, schedule delivery and trading output per labour hour.',
    icon: UsersRound,
  },
  inventory: {
    title: 'Inventory and waste',
    eyebrow: 'Stock intelligence',
    description: 'Consumption, replenishment, loss and stockout exposure.',
    icon: Boxes,
  },
  purchasing: {
    title: 'Purchasing and suppliers',
    eyebrow: 'Supply performance',
    description: 'Purchase commitments, receiving, invoice matching and supplier fulfilment.',
    icon: PackageSearch,
  },
  profitability: {
    title: 'Menu profitability',
    eyebrow: 'Current cost estimate',
    description: 'Recorded menu sales compared with current base-recipe ingredient costs.',
    icon: ReceiptText,
  },
} as const;

function LoadingBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} aria-hidden="true" />;
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
      <AlertTriangle size={22} className="text-destructive" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">This report could not be loaded.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw size={14} /> Try again
      </Button>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  previous,
  current,
  lowerIsBetter,
  loading,
}: {
  label: string;
  value: string;
  note?: string;
  previous?: number;
  current?: number;
  lowerIsBetter?: boolean;
  loading?: boolean;
}) {
  const change = previous !== undefined && current !== undefined ? percentageChange(current, previous) : undefined;
  const good = change !== undefined && change !== null && (lowerIsBetter ? change <= 0 : change >= 0);

  return (
    <div className={cn(panel, 'min-h-36 p-4')}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <LoadingBlock className="mt-4 h-8 w-28" />
      ) : (
        <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
      )}
      {change !== undefined && (
        <p
          className={cn(
            'mt-2 inline-flex items-center gap-1 text-[11px] font-semibold',
            change === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
          )}
        >
          {change !== null && (change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
          {change === null ? 'New vs previous period' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs previous period`}
        </p>
      )}
      {note && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function DataNotice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed',
        tone === 'warning' ? 'border-warning/25 bg-warning/5 text-warning' : 'border-info/20 bg-info/5 text-muted-foreground',
      )}
    >
      <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

interface ReportContext {
  current: AnalyticsRangeParams;
  previous: AnalyticsRangeParams;
  dates: { from: string; to: string };
  previousDates: { from: string; to: string };
  locationId: string | null;
  locationName: string;
  days: number;
}

function LabourReport({ context }: { context: ReportContext }) {
  const currentHours = useQuery({
    queryKey: ['report-labour-hours', context.dates.from, context.dates.to, context.locationId],
    queryFn: () => getStaffHours(context.current),
  });
  const previousHours = useQuery({
    queryKey: ['report-labour-hours-previous', context.previousDates.from, context.previousDates.to, context.locationId],
    queryFn: () => getStaffHours(context.previous),
  });
  const currentOrders = useQuery({
    queryKey: ['report-labour-orders', context.dates.from, context.dates.to, context.locationId],
    queryFn: () => getOrderAnalytics(context.current),
  });
  const previousOrders = useQuery({
    queryKey: ['report-labour-orders-previous', context.previousDates.from, context.previousDates.to, context.locationId],
    queryFn: () => getOrderAnalytics(context.previous),
  });
  const variance = useQuery({
    queryKey: ['report-labour-variance', context.dates.from, context.dates.to, context.locationId],
    queryFn: () =>
      getVariance({
        from: context.current.from,
        to: context.current.to,
        ...(context.locationId ? { locationId: context.locationId } : {}),
      }),
  });
  const previousVariance = useQuery({
    queryKey: ['report-labour-variance-previous', context.previousDates.from, context.previousDates.to, context.locationId],
    queryFn: () =>
      getVariance({
        from: context.previous.from,
        to: context.previous.to,
        ...(context.locationId ? { locationId: context.locationId } : {}),
      }),
  });

  const loading =
    currentHours.isPending ||
    previousHours.isPending ||
    currentOrders.isPending ||
    previousOrders.isPending ||
    variance.isPending ||
    previousVariance.isPending;
  const error =
    currentHours.isError ||
    previousHours.isError ||
    currentOrders.isError ||
    previousOrders.isError ||
    variance.isError ||
    previousVariance.isError;
  const total = (rows: StaffHoursAnalytics[] | undefined, key: 'totalHours' | 'totalShifts') =>
    (rows ?? []).reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
  const hours = total(currentHours.data, 'totalHours');
  const oldHours = total(previousHours.data, 'totalHours');
  const shifts = total(currentHours.data, 'totalShifts');
  const orders = orderMetrics(currentOrders.data);
  const oldOrders = orderMetrics(previousOrders.data);
  const plannedHours = (variance.data ?? []).reduce((sum, row) => sum + row.plannedMinutes / 60, 0);
  const workedHours = (variance.data ?? []).reduce((sum, row) => sum + row.workedMinutes / 60, 0);
  const oldWorkedHours = (previousVariance.data ?? []).reduce((sum, row) => sum + row.workedMinutes / 60, 0);
  const noShows = (variance.data ?? []).filter((row) => row.status === 'no_show').length;
  const noShowRate = (variance.data?.length ?? 0) ? (noShows / variance.data!.length) * 100 : 0;
  const oldNoShows = (previousVariance.data ?? []).filter((row) => row.status === 'no_show').length;
  const oldNoShowRate = (previousVariance.data?.length ?? 0) ? (oldNoShows / previousVariance.data!.length) * 100 : 0;
  const ranked = [...(currentHours.data ?? [])].sort((a, b) => b.totalHours - a.totalHours);

  if (error) {
    return (
      <div className={panel}>
        <ErrorBlock
          onRetry={() => {
            void currentHours.refetch();
            void previousHours.refetch();
            void currentOrders.refetch();
            void previousOrders.refetch();
            void variance.refetch();
            void previousVariance.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Hours worked"
          value={`${hours.toFixed(1)}h`}
          current={hours}
          previous={oldHours}
          loading={loading}
          note={`${shifts} completed shifts`}
        />
        <Stat
          label="Sales per labour hour"
          value={formatMoney(hours ? orders.revenue / hours : 0, 2)}
          current={hours ? orders.revenue / hours : 0}
          previous={oldHours ? oldOrders.revenue / oldHours : 0}
          loading={loading}
          note="Net revenue divided by completed-shift hours"
        />
        <Stat
          label="Orders per labour hour"
          value={(hours ? orders.orders / hours : 0).toFixed(2)}
          current={hours ? orders.orders / hours : 0}
          previous={oldHours ? oldOrders.orders / oldHours : 0}
          loading={loading}
          note="Non-cancelled orders per completed-shift hour"
        />
        <Stat
          label="No-show rate"
          value={`${noShowRate.toFixed(1)}%`}
          current={noShowRate}
          previous={oldNoShowRate}
          lowerIsBetter
          loading={loading}
          note={`${noShows} of ${variance.data?.length ?? 0} scheduled shifts`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className={cn(panel, 'p-5')}>
          <SectionTitle title="Hours by staff member" description="Completed shift hours and average shift length" />
          {loading ? (
            <LoadingBlock className="mt-4 h-64" />
          ) : ranked.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No completed shifts in this period.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-120 text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-semibold">Team member</th>
                    <th className="pb-2 text-right font-semibold">Shifts</th>
                    <th className="pb-2 text-right font-semibold">Hours</th>
                    <th className="pb-2 text-right font-semibold">Avg shift</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => (
                    <tr key={row.userId} className="border-b border-border/60 last:border-0">
                      <td className="py-3 font-medium text-foreground">{row.userName ?? 'Unknown staff member'}</td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">{row.totalShifts}</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-foreground">{Number(row.totalHours).toFixed(1)}h</td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {row.totalShifts ? (Number(row.totalHours) / row.totalShifts).toFixed(1) : '0.0'}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={cn(panel, 'p-5')}>
          <SectionTitle title="Schedule delivery" description="Planned time compared with recorded attendance" />
          <div className="mt-5 space-y-3">
            {[
              { label: 'Planned hours', value: `${plannedHours.toFixed(1)}h` },
              { label: 'Worked scheduled hours', value: `${workedHours.toFixed(1)}h` },
              {
                label: 'Delivery against plan',
                value: `${plannedHours ? ((workedHours / plannedHours) * 100).toFixed(1) : '0.0'}%`,
              },
              { label: 'Variance from previous period', value: `${(workedHours - oldWorkedHours).toFixed(1)}h` },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-4 py-3">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-sm font-bold tabular-nums text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DataNotice>
        Labour cost is intentionally excluded: the current analytics endpoint supplies hours, not fully burdened payroll allocation by
        location. Sales and orders per labour hour are available without exposing individual pay.
      </DataNotice>
    </>
  );
}

function InventoryReport({ context }: { context: ReportContext }) {
  const summary = useQuery({
    queryKey: ['report-stock-summary', context.dates.from, context.dates.to, context.locationId],
    queryFn: () => getStockSummary(context.current),
  });
  const previousSummary = useQuery({
    queryKey: ['report-stock-summary-previous', context.previousDates.from, context.previousDates.to, context.locationId],
    queryFn: () => getStockSummary(context.previous),
  });
  const stockItems = useQuery({ queryKey: ['stock-items'], queryFn: getStockItems });
  const forecast = useQuery({
    queryKey: ['report-inventory-forecast', context.locationId, context.days],
    queryFn: () => getInventoryForecast(context.locationId ?? undefined, context.days),
  });
  const losses = useQuery({
    queryKey: ['report-losses', context.dates.from, context.dates.to, context.locationId],
    queryFn: () =>
      getLossLog({
        from: context.current.from,
        to: context.current.to,
        ...(context.locationId ? { locationId: context.locationId } : {}),
        limit: 100,
      }),
  });

  const loading = summary.isPending || previousSummary.isPending || stockItems.isPending || forecast.isPending || losses.isPending;
  const error = summary.isError || previousSummary.isError || stockItems.isError || forecast.isError || losses.isError;
  const itemMap = new Map((stockItems.data ?? []).map((item) => [item.id, item]));
  const grouped = new Map<string, { deducted: number; restocked: number; movements: number }>();
  (summary.data ?? []).forEach((row) => {
    const current = grouped.get(row.stockItemId) ?? { deducted: 0, restocked: 0, movements: 0 };
    const quantity = Math.abs(Number(row.totalQty ?? 0));
    if (row.type === 'deduction') current.deducted += quantity;
    if (row.type === 'restock') current.restocked += quantity;
    current.movements += Number(row.movementCount ?? 0);
    grouped.set(row.stockItemId, current);
  });
  const rows = [...grouped.entries()]
    .map(([stockItemId, values]) => {
      const item = itemMap.get(stockItemId);
      const cost = item?.costPerUnit == null ? null : Number(item.costPerUnit);
      return {
        stockItemId,
        name: item?.name ?? 'Unknown stock item',
        unit: item?.unit ?? '',
        ...values,
        estimatedUsageCost: cost == null ? null : values.deducted * cost,
      };
    })
    .sort((a, b) => (b.estimatedUsageCost ?? -1) - (a.estimatedUsageCost ?? -1));
  const movements = (summary.data ?? []).reduce((sum, row) => sum + Number(row.movementCount ?? 0), 0);
  const oldMovements = (previousSummary.data ?? []).reduce((sum, row) => sum + Number(row.movementCount ?? 0), 0);
  const estimatedUsage = rows.reduce((sum, row) => sum + (row.estimatedUsageCost ?? 0), 0);
  const lossesRows = losses.data?.data ?? [];
  const estimatedWaste = lossesRows.reduce((sum, loss) => {
    const cost = itemMap.get(loss.stockItemId)?.costPerUnit;
    return sum + (cost == null ? 0 : Math.abs(Number(loss.quantity)) * Number(cost));
  }, 0);
  const critical = (forecast.data ?? []).filter((row) => row.isCritical);
  const costCoverage = rows.length ? (rows.filter((row) => row.estimatedUsageCost !== null).length / rows.length) * 100 : 0;

  if (error) {
    return (
      <div className={panel}>
        <ErrorBlock
          onRetry={() => {
            void summary.refetch();
            void previousSummary.refetch();
            void stockItems.refetch();
            void forecast.refetch();
            void losses.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Stock movements"
          value={formatCompact(movements)}
          current={movements}
          previous={oldMovements}
          loading={loading}
          note="All deduction and restock ledger entries"
        />
        <Stat
          label="Estimated usage cost"
          value={formatMoney(estimatedUsage)}
          loading={loading}
          note={`Using current item costs · ${costCoverage.toFixed(0)}% item coverage`}
        />
        <Stat
          label="Estimated waste cost"
          value={formatMoney(estimatedWaste)}
          loading={loading}
          note={`${lossesRows.length} waste/loss records loaded`}
        />
        <Stat
          label="Critical stock items"
          value={formatCompact(critical.length)}
          loading={loading}
          lowerIsBetter
          note="Forecast at three days of stock or less"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className={cn(panel, 'p-5')}>
          <SectionTitle
            title="Consumption by stock item"
            description="Ledger quantities with a current-cost usage estimate where available"
          />
          {loading ? (
            <LoadingBlock className="mt-4 h-72" />
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No stock movements in this period.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-semibold">Stock item</th>
                    <th className="pb-2 text-right font-semibold">Deducted</th>
                    <th className="pb-2 text-right font-semibold">Restocked</th>
                    <th className="pb-2 text-right font-semibold">Movements</th>
                    <th className="pb-2 text-right font-semibold">Usage estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 25).map((row) => (
                    <tr key={row.stockItemId} className="border-b border-border/60 last:border-0">
                      <td className="py-3 font-medium text-foreground">{row.name}</td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {row.deducted.toLocaleString()} {row.unit}
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {row.restocked.toLocaleString()} {row.unit}
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">{row.movements}</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-foreground">
                        {row.estimatedUsageCost === null ? 'Cost missing' : formatMoney(row.estimatedUsageCost, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={cn(panel, 'p-5')}>
          <SectionTitle title="Stockout exposure" description="Items with the shortest forecast stock cover" />
          <div className="mt-4 space-y-2">
            {[...(forecast.data ?? [])]
              .sort((a, b) => (a.daysOfStockRemaining ?? Number.POSITIVE_INFINITY) - (b.daysOfStockRemaining ?? Number.POSITIVE_INFINITY))
              .slice(0, 10)
              .map((item) => (
                <div key={item.locationStockId} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{item.stockItemName}</p>
                    <p className="text-[10px] text-muted-foreground">{item.locationName ?? context.locationName}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-sm font-bold tabular-nums',
                        item.isCritical ? 'text-destructive' : item.isLow ? 'text-warning' : 'text-foreground',
                      )}
                    >
                      {item.daysOfStockRemaining == null ? '—' : `${item.daysOfStockRemaining.toFixed(1)}d`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {Number(item.currentQuantity).toLocaleString()} {item.unit}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <DataNotice tone="warning">
        Usage and waste values use each item’s current cost, not its cost at the time of movement. Quantities are never summed across
        incompatible units; financial estimates are shown only when a unit cost exists. The loss endpoint returns at most 100 records in
        this view.
      </DataNotice>
    </>
  );
}

async function getAllPurchaseOrders(locationId?: string) {
  const first = await getPurchaseOrders({ ...(locationId ? { locationId } : {}), page: 1, limit: 100 });
  if (first.pages <= 1) return first.data;
  const remaining = await Promise.all(
    Array.from({ length: first.pages - 1 }, (_, index) =>
      getPurchaseOrders({ ...(locationId ? { locationId } : {}), page: index + 2, limit: 100 }),
    ),
  );
  return [...first.data, ...remaining.flatMap((page) => page.data)];
}

function purchaseOrderValue(order: PurchaseOrder) {
  return (order.lines ?? []).reduce((sum, line) => sum + Number(line.quantityOrdered) * Number(line.unitCost), 0);
}

function PurchasingReport({ context }: { context: ReportContext }) {
  const [asOf] = useState(() => Date.now());
  const ordersQuery = useQuery({
    queryKey: ['report-purchase-orders-all', context.locationId],
    queryFn: () => getAllPurchaseOrders(context.locationId ?? undefined),
  });
  const inPeriod = (order: PurchaseOrder, range: AnalyticsRangeParams) => {
    const created = new Date(order.createdAt).getTime();
    return created >= new Date(range.from).getTime() && created <= new Date(range.to).getTime();
  };
  const current = (ordersQuery.data ?? []).filter((order) => inPeriod(order, context.current));
  const previous = (ordersQuery.data ?? []).filter((order) => inPeriod(order, context.previous));
  const totalValue = current.reduce((sum, order) => sum + purchaseOrderValue(order), 0);
  const oldTotalValue = previous.reduce((sum, order) => sum + purchaseOrderValue(order), 0);
  const lines = current.flatMap((order) => order.lines ?? []);
  const orderedQty = lines.reduce((sum, line) => sum + Number(line.quantityOrdered), 0);
  const receivedQty = lines.reduce((sum, line) => sum + Number(line.quantityReceived), 0);
  const fillRate = orderedQty ? (receivedQty / orderedQty) * 100 : 0;
  const oldLines = previous.flatMap((order) => order.lines ?? []);
  const oldOrdered = oldLines.reduce((sum, line) => sum + Number(line.quantityOrdered), 0);
  const oldReceived = oldLines.reduce((sum, line) => sum + Number(line.quantityReceived), 0);
  const oldFillRate = oldOrdered ? (oldReceived / oldOrdered) * 100 : 0;
  const invoiceEligible = current.filter((order) => order.status !== 'draft' && order.status !== 'cancelled');
  const invoiceMatchRate = invoiceEligible.length
    ? (invoiceEligible.filter((order) => order.invoiceMatched).length / invoiceEligible.length) * 100
    : 0;
  const open = current.filter((order) => order.status === 'submitted' || order.status === 'partially_received');
  const overdue = open.filter((order) => order.expectedAt && new Date(order.expectedAt).getTime() < asOf);
  const supplierMap = new Map<string, { name: string; orders: number; value: number; ordered: number; received: number }>();
  current.forEach((order) => {
    const row = supplierMap.get(order.supplierId) ?? {
      name: order.supplier?.name ?? 'Unknown supplier',
      orders: 0,
      value: 0,
      ordered: 0,
      received: 0,
    };
    row.orders += 1;
    row.value += purchaseOrderValue(order);
    (order.lines ?? []).forEach((line) => {
      row.ordered += Number(line.quantityOrdered);
      row.received += Number(line.quantityReceived);
    });
    supplierMap.set(order.supplierId, row);
  });
  const suppliers = [...supplierMap.values()].sort((a, b) => b.value - a.value);

  if (ordersQuery.isError) {
    return (
      <div className={panel}>
        <ErrorBlock onRetry={() => void ordersQuery.refetch()} />
      </div>
    );
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Purchase commitments"
          value={formatMoney(totalValue)}
          current={totalValue}
          previous={oldTotalValue}
          loading={ordersQuery.isPending}
          note={`${current.length} purchase orders created`}
        />
        <Stat
          label="Quantity fill rate"
          value={`${fillRate.toFixed(1)}%`}
          current={fillRate}
          previous={oldFillRate}
          loading={ordersQuery.isPending}
          note="Received quantity divided by ordered quantity"
        />
        <Stat
          label="Invoice match rate"
          value={`${invoiceMatchRate.toFixed(1)}%`}
          loading={ordersQuery.isPending}
          note={`${invoiceEligible.filter((order) => order.invoiceMatched).length} of ${invoiceEligible.length} eligible orders`}
        />
        <Stat
          label="Overdue open orders"
          value={formatCompact(overdue.length)}
          loading={ordersQuery.isPending}
          lowerIsBetter
          note={`${open.length} submitted or partially received`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={cn(panel, 'p-5')}>
          <SectionTitle
            title="Supplier performance"
            description="Purchase value and quantity fulfilment for orders created in the period"
          />
          {ordersQuery.isPending ? (
            <LoadingBlock className="mt-4 h-64" />
          ) : suppliers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No purchase orders created in this period.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {suppliers.map((supplier) => (
                <div key={supplier.name} className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {supplier.orders} orders · {supplier.ordered ? ((supplier.received / supplier.ordered) * 100).toFixed(1) : '0.0'}%
                      filled
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatMoney(supplier.value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cn(panel, 'p-5')}>
          <SectionTitle title="Recent purchase orders" description="Latest commitments created inside the selected period" />
          <div className="mt-4 space-y-2">
            {[...current]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 12)
              .map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{order.reference}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {order.supplier?.name ?? 'Unknown supplier'} · {order.status.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">{formatMoney(purchaseOrderValue(order))}</p>
                    <p className="text-[10px] text-muted-foreground">{shortDateLabel(order.createdAt.slice(0, 10))}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <DataNotice>
        Purchase reports load the complete accessible purchase-order history, then apply the selected date range by creation date.
        Quantities from different stock units are used only for per-line fill rates and are not presented as a combined physical quantity.
      </DataNotice>
    </>
  );
}

function ProfitabilityReport({ context }: { context: ReportContext }) {
  const topItems = useQuery({
    queryKey: ['report-profitability-top-items', context.dates.from, context.dates.to, context.locationId],
    queryFn: () => getTopItems(context.current, 25),
  });
  const recipeQueries = useQueries({
    queries: (topItems.data ?? []).map((item) => ({
      queryKey: ['menu-item-recipe', item.menuItemId, 'report-profitability'],
      queryFn: () => getMenuItemRecipe(item.menuItemId),
      enabled: topItems.isSuccess,
    })),
  });
  const loading = topItems.isPending || recipeQueries.some((query) => query.isPending);
  const error = topItems.isError;
  const rows = (topItems.data ?? []).map((item, index) => {
    const recipe = recipeQueries[index]?.data ?? [];
    const hasRecipe = recipe.length > 0;
    const complete = hasRecipe && recipe.every((line) => line.stockItem?.costPerUnit != null);
    const unitCost = complete
      ? recipe.reduce((sum, line) => sum + Number(line.quantity) * Number(line.stockItem?.costPerUnit ?? 0), 0)
      : null;
    const units = Number(item.totalQuantity ?? 0);
    const revenue = Number(item.totalRevenue ?? 0);
    const estimatedCost = unitCost == null ? null : unitCost * units;
    const contribution = estimatedCost == null ? null : revenue - estimatedCost;
    return {
      ...item,
      units,
      revenue,
      unitCost,
      estimatedCost,
      contribution,
      margin: contribution == null || revenue === 0 ? null : (contribution / revenue) * 100,
      complete,
    };
  });
  const covered = rows.filter((row) => row.complete);
  const coveredRevenue = covered.reduce((sum, row) => sum + row.revenue, 0);
  const estimatedCost = covered.reduce((sum, row) => sum + (row.estimatedCost ?? 0), 0);
  const contribution = coveredRevenue - estimatedCost;
  const margin = coveredRevenue ? (contribution / coveredRevenue) * 100 : 0;
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const revenueCoverage = totalRevenue ? (coveredRevenue / totalRevenue) * 100 : 0;

  if (error) {
    return (
      <div className={panel}>
        <ErrorBlock onRetry={() => void topItems.refetch()} />
      </div>
    );
  }

  return (
    <>
      <DataNotice tone="warning">
        This is a current-cost estimate, not historical accounting COGS. It applies today’s base-recipe ingredient costs to period sales and
        excludes modifier recipes, historical supplier prices, labour, tax and overhead.
      </DataNotice>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Analysed item revenue"
          value={formatMoney(totalRevenue)}
          loading={loading}
          note={`Top ${rows.length} sold items returned by analytics`}
        />
        <Stat
          label="Cost-covered revenue"
          value={formatMoney(coveredRevenue)}
          loading={loading}
          note={`${revenueCoverage.toFixed(1)}% of analysed revenue has complete base-recipe cost`}
        />
        <Stat
          label="Estimated base ingredient cost"
          value={formatMoney(estimatedCost)}
          loading={loading}
          note="Current base-recipe costs for covered items"
        />
        <Stat
          label="Estimated contribution margin"
          value={`${margin.toFixed(1)}%`}
          loading={loading}
          note={`${formatMoney(contribution)} before modifier cost, labour and overhead`}
        />
      </section>

      <section className={cn(panel, 'p-5')}>
        <SectionTitle
          title="Menu contribution analysis"
          description="Popularity, current base-recipe cost and estimated contribution by sold item"
        />
        {loading ? (
          <LoadingBlock className="mt-4 h-96" />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No item sales in this period.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-semibold">Menu item</th>
                  <th className="pb-2 text-right font-semibold">Units</th>
                  <th className="pb-2 text-right font-semibold">Revenue</th>
                  <th className="pb-2 text-right font-semibold">Cost / unit</th>
                  <th className="pb-2 text-right font-semibold">Estimated cost</th>
                  <th className="pb-2 text-right font-semibold">Contribution</th>
                  <th className="pb-2 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => (b.contribution ?? -1) - (a.contribution ?? -1))
                  .map((row) => (
                    <tr key={row.menuItemId} className="border-b border-border/60 last:border-0">
                      <td className="py-3">
                        <p className="font-medium text-foreground">{row.name}</p>
                        {!row.complete && <p className="text-[10px] font-medium text-warning">Recipe or ingredient cost incomplete</p>}
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">{row.units.toLocaleString()}</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-foreground">{formatMoney(row.revenue)}</td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {row.unitCost == null ? '—' : formatMoney(row.unitCost, 2)}
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {row.estimatedCost == null ? '—' : formatMoney(row.estimatedCost)}
                      </td>
                      <td className="py-3 text-right font-semibold tabular-nums text-foreground">
                        {row.contribution == null ? '—' : formatMoney(row.contribution)}
                      </td>
                      <td
                        className={cn(
                          'py-3 text-right font-bold tabular-nums',
                          row.margin == null
                            ? 'text-muted-foreground'
                            : row.margin >= 65
                              ? 'text-success'
                              : row.margin >= 50
                                ? 'text-warning'
                                : 'text-destructive',
                        )}
                      >
                        {row.margin == null ? '—' : `${row.margin.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function BusinessReportPage({ section }: { section: BusinessReportSection }) {
  const router = useRouter();
  const { locationId } = useWorkspaceStore();
  const [days, setDays] = useState(30);
  const locationsQuery = useQuery({ queryKey: ['locations-accessible'], queryFn: getLocations });
  const locations = locationsQuery.data ?? [];
  const selectedLocation = locations.find((location) => location.id === locationId);
  const activeLocationId = selectedLocation?.id ?? null;
  const timeZone = selectedLocation?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';
  const dates = useMemo(() => trailingDateRange(days, timeZone), [days, timeZone]);
  const previousDates = useMemo(() => previousDateRange(dates.from, dates.to), [dates]);
  const currentRange = useMemo(() => reportDateRange(dates.from, dates.to, timeZone), [dates, timeZone]);
  const previousRange = useMemo(() => reportDateRange(previousDates.from, previousDates.to, timeZone), [previousDates, timeZone]);
  const context: ReportContext = {
    current: { ...currentRange, ...(activeLocationId ? { locationId: activeLocationId } : {}) },
    previous: { ...previousRange, ...(activeLocationId ? { locationId: activeLocationId } : {}) },
    dates,
    previousDates,
    locationId: activeLocationId,
    locationName: selectedLocation?.name ?? 'All accessible locations',
    days,
  };
  const meta = SECTION_META[section];
  const Icon = meta.icon;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
        ]}
        value={String(days)}
        onChange={(value) => setDays(Number(value))}
      />
      <p className="text-xs text-muted-foreground">
        {shortDateLabel(dates.from)}–{shortDateLabel(dates.to)} · compared with the preceding {days} days · {context.locationName}
      </p>
    </div>
  );

  return (
    <EditorShell
      eyebrow={meta.eyebrow}
      title={meta.title}
      icon={<Icon size={20} aria-hidden="true" />}
      meta={<span className="text-xs text-muted-foreground">{meta.description}</span>}
      onClose={() => router.push('/reports/library')}
    >
      <div className="space-y-4">
        {header}
        {locationsQuery.isPending ? (
          <LoadingBlock className="h-96" />
        ) : locationsQuery.isError ? (
          <div className={panel}>
            <ErrorBlock onRetry={() => void locationsQuery.refetch()} />
          </div>
        ) : section === 'labour' ? (
          <LabourReport context={context} />
        ) : section === 'inventory' ? (
          <InventoryReport context={context} />
        ) : section === 'purchasing' ? (
          <PurchasingReport context={context} />
        ) : (
          <ProfitabilityReport context={context} />
        )}
      </div>
    </EditorShell>
  );
}
