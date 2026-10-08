'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCircle2,
  CreditCard,
  Package,
  Receipt,
  Scale,
  Trash2,
  Truck,
  Wallet,
} from '@/components/icons';
import { REASON_LABELS } from '@/components/inventory/stock/shared';
import { StatusDot } from '@/components/shared/StatusDot';
import type { Tone } from '@/components/shared/tone';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';

import type { LossRecord } from '@/lib/api/loss.service';
import { getStockSummary } from '@/lib/modules/analytics/client';
import { getStockItems } from '@/lib/modules/inventory/client';
import { getLossLog } from '@/lib/modules/inventory/client';
import { type CashUp, getCashUps } from '@/lib/modules/payments/client';
import { type PurchaseOrder, getPurchaseOrders } from '@/lib/modules/purchasing/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { REPORTS } from '@/lib/reports/catalogue';
import { cn } from '@/lib/utils/cn';
import { exportFileName, toCsv, toDateKey } from '@/lib/utils/report-filters';
import { movementValue } from '@/lib/utils/stock-cost';

import { DrawerFacts, DrawerList, DrawerMark, DrawerNote, DrawerSection, ReportDrawer } from '../kit/DetailDrawer';
import { ReportFrame, downloadFile } from '../kit/ReportFrame';
import { BarList, KpiGrid, ReportBlock, ReportError, ReportLoading, ReportTable, tenderIcon } from '../kit/parts';
import { useRangeQuery } from '../kit/useRangeQuery';
import type { ReportFilterState } from '../kit/useReportFilters';

const def = (id: string) => REPORTS.find((report) => report.id === id)!;
const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const count = (value: number) => value.toLocaleString('en-GB');
const qty = (value: number, unit?: string) => `${(Math.round(value * 100) / 100).toLocaleString('en-GB')}${unit ? ` ${unit}` : ''}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Stock items by id — names, units and last known cost for every inventory report. */
function useStockItems() {
  return useQuery({ queryKey: moduleQueryKeys.inventory.key('stock-items'), queryFn: getStockItems, staleTime: 5 * 60_000 });
}

/** Pages through a listing until the window is covered — capped, so a huge history can't stall the page. */
async function collectPages<T>(
  fetch: (page: number) => Promise<{ data: T[]; pages: number }>,
  maxPages = 10,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let page = 1;
  let pages = 1;
  do {
    const result = await fetch(page);
    rows.push(...result.data);
    pages = result.pages;
    page += 1;
  } while (page <= pages && page <= maxPages);
  return { rows, truncated: pages > maxPages };
}

// ── Stock usage ──────────────────────────────────────────────────────────────

export function StockUsageReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('stock-usage');
  const [open, setOpen] = useState<string | null>(null);
  const query = useRangeQuery('stock-summary', getStockSummary, filters);
  const items = useStockItems();
  const byId = new Map((items.data ?? []).map((item) => [item.id, item]));

  const rows = [
    ...(query.data ?? [])
      .reduce((map, movement) => {
        const row = map.get(movement.stockItemId) ?? {
          id: movement.stockItemId,
          consume: 0,
          receive: 0,
          waste: 0,
          adjust: 0,
          transfer: 0,
          movements: 0,
          consumeValue: 0,
          consumeUncosted: 0,
          wasteValue: 0,
          wasteUncosted: 0,
        };
        const amount = Math.abs(num(movement.totalQty));
        // Value at the cost each movement was made at; what predates recorded
        // costs is kept apart and valued at the item's cost below.
        const recorded = num(movement.totalValue ?? 0);
        const uncosted = movement.totalValue === undefined ? amount : num(movement.uncostedQty ?? 0);
        if (movement.type === 'consume') {
          row.consumeValue += recorded;
          row.consumeUncosted += uncosted;
        } else if (movement.type === 'waste') {
          row.wasteValue += recorded;
          row.wasteUncosted += uncosted;
        }
        if (movement.type === 'consume') row.consume += amount;
        else if (movement.type === 'receive') row.receive += amount;
        else if (movement.type === 'waste') row.waste += amount;
        else if (movement.type === 'adjust') row.adjust += amount;
        else if (movement.type === 'transfer') row.transfer += amount;
        row.movements += movement.movementCount;
        map.set(movement.stockItemId, row);
        return map;
      }, new Map<
        string,
        {
          id: string;
          consume: number;
          receive: number;
          waste: number;
          adjust: number;
          transfer: number;
          movements: number;
          consumeValue: number;
          consumeUncosted: number;
          wasteValue: number;
          wasteUncosted: number;
        }
      >())
      .values(),
  ].map((row) => {
    const item = byId.get(row.id);
    const cost = item?.costPerUnit ? Number(item.costPerUnit) : null;
    // Recorded value, plus anything without a recorded cost at the item's. Unknown
    // only when part of it has no cost from either.
    const valued = (recorded: number, uncosted: number) => (uncosted > 0 ? (cost === null ? null : recorded + uncosted * cost) : recorded);
    return {
      ...row,
      name: item?.name ?? 'Removed item',
      unit: item?.unit,
      usageCost: row.consume > 0 ? valued(row.consumeValue, row.consumeUncosted) : 0,
      wasteCost: row.waste > 0 ? valued(row.wasteValue, row.wasteUncosted) : 0,
    };
  });
  const usageCost = rows.reduce((sum, row) => sum + (row.usageCost ?? 0), 0);
  const wasteCost = rows.reduce((sum, row) => sum + (row.wasteCost ?? 0), 0);
  const uncosted = rows.filter((row) => row.usageCost === null && row.consume > 0).length;
  const previousUsage = query.previous
    ? query.previous
        .filter((movement) => movement.type === 'consume')
        .reduce((sum, movement) => {
          const cost = byId.get(movement.stockItemId)?.costPerUnit;
          const uncosted = movement.totalValue === undefined ? Math.abs(num(movement.totalQty)) : num(movement.uncostedQty ?? 0);
          return sum + num(movement.totalValue ?? 0) + (cost ? uncosted * Number(cost) : 0);
        }, 0)
    : null;

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        rows.length
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(rows, [
                  { header: 'Item', value: (row) => row.name },
                  { header: 'Unit', value: (row) => row.unit ?? '' },
                  { header: 'Used', value: (row) => row.consume },
                  { header: 'Received', value: (row) => row.receive },
                  { header: 'Wasted', value: (row) => row.waste },
                  { header: 'Adjusted', value: (row) => row.adjust },
                  { header: 'Usage cost', value: (row) => row.usageCost?.toFixed(2) ?? '' },
                ]),
              )
          : undefined
      }
    >
      {query.isError ? (
        <ReportError onRetry={query.refetch} />
      ) : query.isPending || items.isPending ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              {
                label: 'Usage cost',
                icon: Package,
                value: money(usageCost),
                current: usageCost,
                previous: previousUsage,
                hint: 'Used × last known cost',
              },
              { label: 'Waste cost', icon: Trash2, value: money(wasteCost), inverse: true },
              {
                label: 'Items moved',
                icon: Scale,
                value: count(rows.length),
                hint: uncosted ? `${count(uncosted)} without a cost yet` : 'All costed',
              },
            ]}
          />
          <ReportBlock
            title="By item"
            description="Quantities in each item’s own unit. Costs use the last price paid, set by goods receipts."
            flush
          >
            <ReportTable
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => setOpen(row.id)}
              activeKey={open}
              defaultSort={{ key: 'cost', direction: 'desc' }}
              limit={25}
              empty="No stock moved in this period."
              columns={[
                { key: 'name', header: 'Item', render: (row) => row.name, sort: (row) => row.name },
                { key: 'used', header: 'Used', align: 'right', render: (row) => qty(row.consume, row.unit), sort: (row) => row.consume },
                {
                  key: 'received',
                  header: 'Received',
                  align: 'right',
                  render: (row) => qty(row.receive, row.unit),
                  sort: (row) => row.receive,
                },
                {
                  key: 'wasted',
                  header: 'Wasted',
                  align: 'right',
                  render: (row) => (row.waste ? qty(row.waste, row.unit) : '—'),
                  sort: (row) => row.waste,
                },
                {
                  key: 'cost',
                  header: 'Usage cost',
                  align: 'right',
                  render: (row) => (row.usageCost === null ? <span className="text-muted-foreground">No cost</span> : money(row.usageCost)),
                  sort: (row) => row.usageCost ?? -1,
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
      {open && rows.find((row) => row.id === open) && (
        <StockItemDrawer item={rows.find((row) => row.id === open)!} onClose={() => setOpen(null)} />
      )}
    </ReportFrame>
  );
}

// ── Waste & loss ─────────────────────────────────────────────────────────────

export function WasteReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('waste');
  const [open, setOpen] = useState<string | null>(null);
  const query = useRangeQuery(
    'loss-log',
    (params) => collectPages((page) => getLossLog({ from: params.from, to: params.to, locationId: params.locationId, limit: 100, page })),
    filters,
    { compare: false },
  );
  const items = useStockItems();
  const byId = new Map((items.data ?? []).map((item) => [item.id, item]));
  const rows = (query.data?.rows ?? []).map((record) => {
    const item = byId.get(record.stockItemId);
    const amount = Math.abs(num(record.quantity));
    // At what it cost when written off; older entries at the item's cost.
    const cost = movementValue({ quantity: amount, unitCost: record.unitCost }, item?.costPerUnit);
    return {
      ...record,
      amount,
      cost,
      name: record.stockItem?.name ?? item?.name ?? 'Removed item',
      unit: record.stockItem?.unit ?? item?.unit,
    };
  });
  const total = rows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
  const reasonOf = (reason?: string | null) =>
    reason && reason in REASON_LABELS ? REASON_LABELS[reason as keyof typeof REASON_LABELS] : reason ? reason : 'Waste';
  const byReason = [
    ...rows.reduce(
      (map, row) => map.set(reasonOf(row.reason), (map.get(reasonOf(row.reason)) ?? 0) + (row.cost ?? 0)),
      new Map<string, number>(),
    ),
  ];

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        rows.length
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(rows, [
                  { header: 'When', value: (row) => row.createdAt },
                  { header: 'Item', value: (row) => row.name },
                  { header: 'Quantity', value: (row) => row.amount },
                  { header: 'Unit', value: (row) => row.unit ?? '' },
                  { header: 'Reason', value: (row) => reasonOf(row.reason) },
                  { header: 'Location', value: (row) => row.location?.name ?? '' },
                  { header: 'Estimated cost', value: (row) => row.cost?.toFixed(2) ?? '' },
                  { header: 'Notes', value: (row) => row.notes ?? '' },
                ]),
              )
          : undefined
      }
    >
      {query.isError ? (
        <ReportError onRetry={query.refetch} />
      ) : query.isPending || items.isPending ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              { label: 'Written off', icon: Trash2, value: money(total), inverse: true, hint: 'At last known cost' },
              { label: 'Entries', icon: Receipt, value: count(rows.length) },
              { label: 'Items affected', icon: Package, value: count(new Set(rows.map((row) => row.stockItemId)).size) },
            ]}
          />
          {query.data?.truncated && (
            <p className="flex items-start gap-2.5 rounded-lg border border-measured/30 bg-measured/6 px-3.5 py-3 text-sm text-foreground">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
              This period holds more than 1,000 entries; only the latest 1,000 are shown. Narrow the dates for the full list.
            </p>
          )}
          {byReason.length > 0 && (
            <ReportBlock title="By reason">
              <BarList
                rows={byReason.sort((a, b) => b[1] - a[1]).map(([reason, value]) => ({ key: reason, label: reason, value }))}
                format={(value) => money(value)}
              />
            </ReportBlock>
          )}
          <ReportBlock title="Every entry" flush>
            <ReportTable
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => setOpen(row.id)}
              activeKey={open}
              defaultSort={{ key: 'when', direction: 'desc' }}
              limit={25}
              empty="Nothing written off in this period."
              columns={[
                { key: 'when', header: 'When', render: (row) => day(row.createdAt), sort: (row) => row.createdAt },
                { key: 'item', header: 'Item', render: (row) => row.name, sort: (row) => row.name },
                { key: 'qty', header: 'Quantity', align: 'right', render: (row) => qty(row.amount, row.unit), sort: (row) => row.amount },
                { key: 'reason', header: 'Reason', render: (row) => reasonOf(row.reason), sort: (row) => reasonOf(row.reason) },
                {
                  key: 'cost',
                  header: 'Cost',
                  align: 'right',
                  render: (row) => (row.cost === null ? '—' : money(row.cost)),
                  sort: (row) => row.cost ?? -1,
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
      {open && rows.find((row) => row.id === open) && (
        <WasteDrawer
          entry={rows.find((row) => row.id === open)!}
          reason={reasonOf(rows.find((row) => row.id === open)!.reason)}
          onClose={() => setOpen(null)}
        />
      )}
    </ReportFrame>
  );
}

// ── Purchasing ───────────────────────────────────────────────────────────────

const PO_STATUS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Sent',
  partially_received: 'Part received',
  received: 'Received',
  cancelled: 'Cancelled',
};
const PO_TONE: Record<string, Tone> = {
  draft: 'muted',
  submitted: 'info',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'muted',
};

/** A purchase order's state as a dot, its word beside it. */
function PoStatus({ status }: { status: string }) {
  const label = PO_STATUS[status] ?? status;
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot tone={PO_TONE[status] ?? 'muted'} label={label} dashed={status === 'draft'} />
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

export function PurchasingReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('purchasing');
  const [open, setOpen] = useState<string | null>(null);
  // The PO listing has no date filter, so pages are read and kept to the window here.
  const query = useRangeQuery(
    'purchase-orders',
    async (params) => {
      const { rows, truncated } = await collectPages((page) => getPurchaseOrders({ locationId: params.locationId, limit: 100, page }), 5);
      return { rows: rows.filter((order) => order.createdAt >= params.from && order.createdAt <= params.to), truncated };
    },
    filters,
    { compare: false },
  );
  const orders = (query.data?.rows ?? []).filter((order) => order.status !== 'cancelled');
  const value = (order: (typeof orders)[number]) =>
    (order.lines ?? []).reduce((sum, line) => sum + num(line.quantityOrdered) * num(line.unitCost), 0);
  const received = (order: (typeof orders)[number]) =>
    (order.lines ?? []).reduce((sum, line) => sum + num(line.quantityReceived) * num(line.unitCost), 0);
  const committed = orders.reduce((sum, order) => sum + value(order), 0);
  const receivedValue = orders.reduce((sum, order) => sum + received(order), 0);
  const invoiced = orders.filter((order) => order.invoiceNumber);
  const bySupplier = [
    ...orders
      .reduce((map, order) => {
        const name = order.supplier?.name ?? 'Unknown supplier';
        const row = map.get(name) ?? { name, orders: 0, value: 0 };
        row.orders += 1;
        row.value += value(order);
        return map.set(name, row);
      }, new Map<string, { name: string; orders: number; value: number }>())
      .values(),
  ];

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        orders.length
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(orders, [
                  { header: 'Reference', value: (order) => order.reference },
                  { header: 'Raised', value: (order) => order.createdAt },
                  { header: 'Supplier', value: (order) => order.supplier?.name ?? '' },
                  { header: 'Location', value: (order) => order.location?.name ?? '' },
                  { header: 'Status', value: (order) => PO_STATUS[order.status] ?? order.status },
                  { header: 'Ordered value', value: (order) => value(order).toFixed(2) },
                  { header: 'Received value', value: (order) => received(order).toFixed(2) },
                  { header: 'Invoice', value: (order) => order.invoiceNumber ?? '' },
                  { header: 'Invoice amount', value: (order) => order.invoiceAmount ?? '' },
                ]),
              )
          : undefined
      }
    >
      {query.isError ? (
        <ReportError onRetry={query.refetch} />
      ) : query.isPending ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              { label: 'Ordered', icon: Truck, value: money(committed), hint: `${count(orders.length)} purchase orders` },
              {
                label: 'Received',
                icon: Package,
                value: money(receivedValue),
                hint: committed ? `${Math.round((receivedValue / committed) * 100)}% of ordered value` : undefined,
              },
              {
                label: 'Invoices matched',
                icon: CheckCircle2,
                value: invoiced.length
                  ? `${count(invoiced.filter((order) => order.invoiceMatched).length)} of ${count(invoiced.length)}`
                  : '—',
              },
            ]}
          />
          <ReportBlock title="By supplier">
            <BarList
              rows={bySupplier
                .sort((a, b) => b.value - a.value)
                .map((row) => ({ key: row.name, label: row.name, value: row.value, detail: `${count(row.orders)} orders` }))}
              format={(amount) => money(amount)}
            />
          </ReportBlock>
          <ReportBlock title="Purchase orders" flush>
            <ReportTable
              rows={orders}
              rowKey={(order) => order.id}
              onRowClick={(order) => setOpen(order.id)}
              activeKey={open}
              defaultSort={{ key: 'raised', direction: 'desc' }}
              limit={25}
              empty="No purchase orders raised in this period."
              columns={[
                {
                  key: 'reference',
                  header: 'Reference',
                  render: (order) => <span className="font-mono text-xs">{order.reference}</span>,
                  sort: (order) => order.reference,
                },
                { key: 'raised', header: 'Raised', render: (order) => day(order.createdAt), sort: (order) => order.createdAt },
                {
                  key: 'supplier',
                  header: 'Supplier',
                  render: (order) => order.supplier?.name ?? '—',
                  sort: (order) => order.supplier?.name ?? '',
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (order) => <PoStatus status={order.status} />,
                  sort: (order) => order.status,
                },
                {
                  key: 'value',
                  header: 'Value',
                  align: 'right',
                  render: (order) => money(value(order)),
                  sort: (order) => value(order),
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
      {open && orders.find((order) => order.id === open) && (
        <PurchaseOrderDrawer order={orders.find((order) => order.id === open)!} onClose={() => setOpen(null)} />
      )}
    </ReportFrame>
  );
}

// ── End of day ───────────────────────────────────────────────────────────────

/**
 * Each day's cash-up as a record — the Z-read history. Running the close is an
 * action, so it lives in the till (Cash up); this only reads what it saved.
 */
export function EndOfDayReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('end-of-day');
  const [open, setOpen] = useState<string | null>(null);
  const sites = filters.filters.locationId
    ? filters.locations.filter((location) => location.id === filters.filters.locationId)
    : filters.locations;
  const from = toDateKey(filters.range.from);
  const lastDay = toDateKey(new Date(filters.range.to.getFullYear(), filters.range.to.getMonth(), filters.range.to.getDate() - 1));
  const query = useQuery({
    queryKey: moduleQueryKeys.payments.key('cash-ups-report', sites.map((site) => site.id).join(',')),
    // The cash-up listing is per site, so each site is read and the days kept to the window below.
    queryFn: async () =>
      (
        await Promise.all(sites.map(async (site) => (await getCashUps(site.id)).map((cashUp) => ({ ...cashUp, locationName: site.name }))))
      ).flat(),
    enabled: sites.length > 0,
  });
  const rows = (query.data ?? []).filter((cashUp) => cashUp.tradingDate.slice(0, 10) >= from && cashUp.tradingDate.slice(0, 10) <= lastDay);
  const closed = rows.filter((cashUp) => cashUp.status === 'closed');
  const cashVariance = closed.reduce((sum, cashUp) => sum + num(cashUp.cashVariance), 0);
  const cardVariance = closed.reduce((sum, cashUp) => sum + num(cashUp.cardVariance), 0);
  const offDays = closed.filter(
    (cashUp) => Math.abs(num(cashUp.cashVariance)) >= 0.01 || Math.abs(num(cashUp.cardVariance)) >= 0.01,
  ).length;

  const variance = (value?: string) => {
    if (value === undefined || value === null) return <span className="text-muted-foreground">—</span>;
    const amount = num(value);
    return (
      <span className={cn('font-semibold', Math.abs(amount) < 0.01 ? 'text-momentum' : 'text-exception')}>
        {amount > 0 ? '+' : amount < 0 ? '−' : ''}
        {money(Math.abs(amount))}
      </span>
    );
  };

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        rows.length
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(rows as (CashUp & { locationName: string })[], [
                  { header: 'Trading date', value: (row) => row.tradingDate.slice(0, 10) },
                  { header: 'Location', value: (row) => row.locationName },
                  { header: 'Status', value: (row) => row.status },
                  { header: 'Opening float', value: (row) => num(row.openingFloat).toFixed(2) },
                  { header: 'Expected cash', value: (row) => num(row.expectedCash).toFixed(2) },
                  { header: 'Counted cash', value: (row) => (row.countedCash === undefined ? '' : num(row.countedCash).toFixed(2)) },
                  { header: 'Cash over/short', value: (row) => (row.cashVariance === undefined ? '' : num(row.cashVariance).toFixed(2)) },
                  { header: 'Expected card', value: (row) => num(row.expectedCard).toFixed(2) },
                  {
                    header: 'Terminal card total',
                    value: (row) => (row.terminalCardTotal === undefined ? '' : num(row.terminalCardTotal).toFixed(2)),
                  },
                  { header: 'Card over/short', value: (row) => (row.cardVariance === undefined ? '' : num(row.cardVariance).toFixed(2)) },
                ]),
              )
          : undefined
      }
    >
      {query.isError ? (
        <ReportError onRetry={() => void query.refetch()} />
      ) : query.isPending && sites.length > 0 ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              {
                label: 'Days closed',
                icon: CheckCircle2,
                value: count(closed.length),
                hint: rows.length > closed.length ? `${count(rows.length - closed.length)} still open` : 'None left open',
              },
              {
                label: 'Cash over/short',
                icon: Banknote,
                value: `${cashVariance > 0 ? '+' : cashVariance < 0 ? '−' : ''}${money(Math.abs(cashVariance))}`,
                hint: 'Counted against expected',
              },
              {
                label: 'Card over/short',
                icon: CreditCard,
                value: `${cardVariance > 0 ? '+' : cardVariance < 0 ? '−' : ''}${money(Math.abs(cardVariance))}`,
                hint: 'Terminal against expected',
              },
              { label: 'Days that didn’t balance', icon: Wallet, value: count(offDays), inverse: true },
            ]}
          />
          <ReportBlock title="Each day" description="Days are opened and closed at the till, under Cash up." flush>
            <ReportTable
              rows={rows as (CashUp & { locationName: string })[]}
              rowKey={(row) => row.id}
              onRowClick={(row) => setOpen(row.id)}
              activeKey={open}
              defaultSort={{ key: 'date', direction: 'desc' }}
              limit={31}
              empty="No days were opened in this period."
              columns={[
                {
                  key: 'date',
                  header: 'Day',
                  // Closed is the norm, so it is only a dot; an open day says so.
                  leading: (row) =>
                    row.status === 'closed' ? <StatusDot tone="success" label="Closed" /> : <StatusDot tone="warning" label="Open" />,
                  render: (row) => day(row.tradingDate),
                  sub: (row) =>
                    row.status === 'closed' ? undefined : (
                      <span className="font-semibold text-measured" aria-hidden="true">
                        Open
                      </span>
                    ),
                  sort: (row) => row.tradingDate,
                },
                {
                  key: 'location',
                  header: 'Location',
                  render: (row) => <span className="text-muted-foreground">{row.locationName}</span>,
                  sort: (row) => row.locationName,
                },
                { key: 'expected', header: 'Expected cash', align: 'right', render: (row) => money(row.expectedCash) },
                {
                  key: 'counted',
                  header: 'Counted',
                  align: 'right',
                  render: (row) => (row.countedCash === undefined ? '—' : money(row.countedCash)),
                },
                {
                  key: 'cash',
                  header: 'Cash ±',
                  align: 'right',
                  render: (row) => variance(row.cashVariance),
                  sort: (row) => num(row.cashVariance),
                },
                {
                  key: 'card',
                  header: 'Card ±',
                  align: 'right',
                  render: (row) => variance(row.cardVariance),
                  sort: (row) => num(row.cardVariance),
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
      {open && rows.find((row) => row.id === open) && (
        <CashUpDayDrawer day={rows.find((row) => row.id === open) as CashUp & { locationName: string }} onClose={() => setOpen(null)} />
      )}
    </ReportFrame>
  );
}

// ── Drawers ──────────────────────────────────────────────────────────────────

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const signed = (amount: number, money: (value: number) => string) =>
  `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${money(Math.abs(amount))}`;

/** One stock item's movements over the period, and its cost. */
function StockItemDrawer({
  item,
  onClose,
}: {
  item: {
    id: string;
    name: string;
    unit?: string;
    consume: number;
    receive: number;
    waste: number;
    adjust: number;
    transfer: number;
    movements: number;
    usageCost: number | null;
    wasteCost: number | null;
  };
  onClose: () => void;
}) {
  const money = useWorkspaceMoney();
  const unitCost =
    item.usageCost !== null && item.consume > 0
      ? item.usageCost / item.consume
      : item.wasteCost !== null && item.waste > 0
        ? item.wasteCost / item.waste
        : null;
  const wasteShare = item.consume + item.waste > 0 ? item.waste / (item.consume + item.waste) : 0;
  return (
    <ReportDrawer
      title={item.name}
      description={`${count(item.movements)} stock ${item.movements === 1 ? 'movement' : 'movements'} in these dates`}
      leading={<DrawerMark icon={Package} />}
      links={[{ label: 'Open stock item', href: `/inventory/items/${item.id}`, icon: Package }]}
      onClose={onClose}
    >
      <DrawerFacts
        facts={[
          { label: 'Used', value: qty(item.consume, item.unit), hint: item.usageCost === null ? 'No cost yet' : money(item.usageCost) },
          {
            label: 'Wasted',
            value: qty(item.waste, item.unit),
            hint:
              item.wasteCost === null
                ? item.waste
                  ? 'No cost yet'
                  : undefined
                : `${money(item.wasteCost)} · ${Math.round(wasteShare * 100)}% of what went out`,
          },
          { label: 'Received', value: qty(item.receive, item.unit) },
          { label: 'Cost per unit', value: unitCost === null ? '—' : money(unitCost), hint: 'Last price paid' },
        ]}
      />
      <DrawerList
        rows={[
          { label: 'Adjusted (stock counts)', value: item.adjust ? qty(item.adjust, item.unit) : 'None' },
          { label: 'Transferred between sites', value: item.transfer ? qty(item.transfer, item.unit) : 'None' },
        ]}
      />
    </ReportDrawer>
  );
}

/** One write-off in full: what, how much, why, and what it did to the stock. */
function WasteDrawer({
  entry,
  reason,
  onClose,
}: {
  entry: LossRecord & { amount: number; cost: number | null; name: string; unit?: string };
  reason: string;
  onClose: () => void;
}) {
  const money = useWorkspaceMoney();
  return (
    <ReportDrawer
      title={`${qty(entry.amount, entry.unit)} ${entry.name}`}
      description={`${reason}${entry.location?.name ? ` · ${entry.location.name}` : ''}`}
      leading={<DrawerMark icon={Trash2} tone="bg-exception/8 text-exception" />}
      links={[
        { label: 'Open stock item', href: `/inventory/items/${entry.stockItemId}`, icon: Package },
        ...(entry.orderId ? [{ label: 'Open the order', href: `/orders?order=${entry.orderId}&location=all`, icon: Receipt }] : []),
      ]}
      onClose={onClose}
    >
      <DrawerFacts
        facts={[
          { label: 'Written off', value: qty(entry.amount, entry.unit) },
          {
            label: 'Cost',
            value: entry.cost === null ? '—' : money(entry.cost),
            hint: entry.cost === null ? 'No cost on file' : 'At last price paid',
          },
        ]}
      />
      <DrawerList
        rows={[
          { label: 'When', value: when(entry.createdAt) },
          { label: 'Reason', value: reason },
          {
            label: 'Stock',
            value: `${qty(Math.abs(num(entry.quantityBefore)), entry.unit)} → ${qty(Math.abs(num(entry.quantityAfter)), entry.unit)}`,
          },
          { label: 'Location', value: entry.location?.name },
        ]}
      />
      {entry.notes && <DrawerNote>{entry.notes}</DrawerNote>}
    </ReportDrawer>
  );
}

/** A purchase order: its lines, what's arrived, and the invoice against it. */
function PurchaseOrderDrawer({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const money = useWorkspaceMoney();
  const lines = order.lines ?? [];
  const ordered = lines.reduce((sum, line) => sum + num(line.quantityOrdered) * num(line.unitCost), 0);
  const received = lines.reduce((sum, line) => sum + num(line.quantityReceived) * num(line.unitCost), 0);
  return (
    <ReportDrawer
      title={order.reference}
      description={`${order.supplier?.name ?? 'Unknown supplier'}${order.location?.name ? ` · ${order.location.name}` : ''}`}
      leading={<DrawerMark icon={Truck} />}
      links={[{ label: 'Open Purchasing', href: '/inventory/purchasing', icon: Truck }]}
      onClose={onClose}
    >
      <DrawerFacts
        facts={[
          { label: 'Ordered', value: money(ordered), hint: `${count(lines.length)} ${lines.length === 1 ? 'line' : 'lines'}` },
          {
            label: 'Received',
            value: money(received),
            hint: ordered ? `${Math.round((received / ordered) * 100)}% of the order` : undefined,
          },
        ]}
      />
      <DrawerList
        rows={[
          { label: 'Status', value: <PoStatus status={order.status} /> },
          { label: 'Raised', value: day(order.createdAt) },
          { label: 'Expected', value: order.expectedAt ? day(order.expectedAt) : undefined },
          {
            label: 'Invoice',
            value: order.invoiceNumber
              ? `${order.invoiceNumber}${order.invoiceAmount ? ` · ${money(order.invoiceAmount)}` : ''}${order.invoiceMatched ? ' · matched' : ' · not matched'}`
              : 'None yet',
          },
        ]}
      />
      <DrawerSection title="Lines">
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
            No lines on this order.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {lines.map((line) => {
              const wanted = num(line.quantityOrdered);
              const got = num(line.quantityReceived);
              const unit = line.stockItem?.unit;
              return (
                <li key={line.id} className="border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{line.stockItem?.name ?? 'Removed item'}</span>
                    <span className="shrink-0 text-sm tabular-nums text-foreground">{money(wanted * num(line.unitCost))}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="flex h-1 flex-1 overflow-hidden rounded-full bg-band">
                      <span
                        className={cn('rounded-full', got >= wanted ? 'bg-momentum' : 'bg-primary/70')}
                        style={{ width: `${wanted ? Math.min(100, (got / wanted) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {qty(got, unit)} of {qty(wanted, unit)} · {money(line.unitCost)} each
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DrawerSection>
      {order.notes && <DrawerNote>{order.notes}</DrawerNote>}
    </ReportDrawer>
  );
}

const TENDER_LABEL: Record<string, string> = { cash: 'Cash sales', unknown: 'Refunds with no method recorded' };

/** One day's cash-up: what was expected, what was counted, and where the takings came from. */
function CashUpDayDrawer({ day: cashUp, onClose }: { day: CashUp & { locationName: string }; onClose: () => void }) {
  const money = useWorkspaceMoney();
  const closed = cashUp.status === 'closed';
  const cash = num(cashUp.cashVariance);
  const card = num(cashUp.cardVariance);
  const balanced = closed && Math.abs(cash) < 0.01 && Math.abs(card) < 0.01;
  const tenders = Object.entries(cashUp.tenderSummary ?? {}).sort(([a], [b]) =>
    a === 'cash' ? -1 : b === 'cash' ? 1 : a.localeCompare(b),
  );
  const tone = !closed ? 'bg-measured/10 text-measured' : balanced ? 'bg-momentum/10 text-momentum' : 'bg-exception/8 text-exception';

  return (
    <ReportDrawer
      title={new Date(`${cashUp.tradingDate.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', tone)}>
            {!closed ? 'Open' : balanced ? 'Balanced' : 'Didn’t balance'}
          </span>
          {cashUp.locationName}
        </span>
      }
      leading={<DrawerMark icon={Calculator} tone={tone} />}
      links={!closed ? [{ label: 'Close it at the till', href: '/pos?cashup=open', icon: Calculator, primary: true }] : []}
      onClose={onClose}
    >
      {closed ? (
        <DrawerFacts
          facts={[
            {
              label: 'Cash',
              value: <span className={Math.abs(cash) < 0.01 ? 'text-momentum' : 'text-exception'}>{signed(cash, money)}</span>,
              hint: `Counted ${money(num(cashUp.countedCash))} of ${money(num(cashUp.expectedCash))}`,
            },
            {
              label: 'Card',
              value: <span className={Math.abs(card) < 0.01 ? 'text-momentum' : 'text-exception'}>{signed(card, money)}</span>,
              hint: `Terminal ${money(num(cashUp.terminalCardTotal))} of ${money(num(cashUp.expectedCard))}`,
            },
          ]}
        />
      ) : (
        <p className="rounded-lg border border-measured/30 bg-measured/6 px-3.5 py-3 text-sm text-foreground">
          This day is still open. Its expected figures are worked out when it’s closed at the till.
        </p>
      )}
      <DrawerList
        rows={[
          { label: 'Opening float', value: money(num(cashUp.openingFloat)) },
          { label: 'Opened', value: cashUp.openedAt ? when(cashUp.openedAt) : undefined },
          { label: 'Closed', value: cashUp.closedAt ? when(cashUp.closedAt) : undefined },
        ]}
      />
      {closed && tenders.length > 0 && (
        <DrawerSection title="Takings by tender" aside="Net of refunds">
          <DrawerList
            rows={tenders.map(([provider, total]) => ({
              label: TENDER_LABEL[provider] ?? provider.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase()),
              icon: tenderIcon(provider === 'unknown' ? 'unrecorded' : provider),
              value: <span className={cn('tabular-nums', total < 0 && 'text-exception')}>{money(total)}</span>,
            }))}
          />
        </DrawerSection>
      )}
      {cashUp.notes && <DrawerNote>{cashUp.notes}</DrawerNote>}
    </ReportDrawer>
  );
}
