'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { CalendarDays, Clock, LineChart, Receipt, RotateCcw, ShoppingBag, TrendingUp, Wallet } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SOURCE_META } from '@/components/orders/orderMeta';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { useWorkspaceCurrency, useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';

import { getHourlyVolume, getOrderAnalytics, getRevenueByLocation, getTopItems } from '@/lib/modules/analytics/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { REPORTS } from '@/lib/reports/catalogue';
import { cn } from '@/lib/utils/cn';
import { compactMoney } from '@/lib/utils/report-chart';
import {
  type Granularity,
  bucketAxisLabel,
  dayLabel,
  delta,
  exportFileName,
  fillDays,
  fromDateKey,
  groupDays,
  ordersHref,
  share,
  suggestedGranularity,
  toCsv,
  toDateKey,
  weekdayPattern,
} from '@/lib/utils/report-filters';

import { DrawerFacts, DrawerListSkeleton, DrawerMark, DrawerSection, ReportDrawer } from '../kit/DetailDrawer';
import { ReportFrame, downloadFile } from '../kit/ReportFrame';
import { ChangePill, ColumnChart, KpiGrid, ReportBlock, ReportError, ReportLoading, ReportTable, TrendChart } from '../kit/parts';
import { useRangeQuery } from '../kit/useRangeQuery';
import type { ReportFilterState } from '../kit/useReportFilters';

const def = (id: string) => REPORTS.find((report) => report.id === id)!;
const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const count = (value: number) => value.toLocaleString('en-GB');
/** Bar heights for the by-hour skeleton: a trading day's rough shape, quiet morning to a lunch peak. */
const HOUR_BARS = ['h-1/5', 'h-2/5', 'h-3/5', 'h-4/5', 'h-full', 'h-3/4', 'h-1/2', 'h-2/5', 'h-3/5', 'h-1/3'];

/** The order analytics, shared by the overview and every sales report — one cache entry per window. */
export function useOrderAnalytics(filters: ReportFilterState, compare = true) {
  return useRangeQuery('orders', getOrderAnalytics, filters, { compare });
}

// ── Sales summary ────────────────────────────────────────────────────────────

/** The first and last day of a range, as the Orders page takes them. */
export function rangeKeys(range: { from: Date; to: Date }): [string, string] {
  return [toDateKey(range.from), toDateKey(new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1))];
}

/** The last day of a bucket that starts at `key`, clipped to the range. */
function bucketEnd(key: string, by: Granularity, range: { to: Date }) {
  const lastOfRange = toDateKey(new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1));
  let end = key;
  if (by === 'week') {
    const start = fromDateKey(key)!;
    end = toDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
  } else if (by === 'month') {
    const start = fromDateKey(`${key}-01`)!;
    end = toDateKey(new Date(start.getFullYear(), start.getMonth() + 1, 0));
  }
  return end < lastOfRange ? end : lastOfRange;
}

export function SalesSummaryReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const currency = useWorkspaceCurrency();
  const query = useOrderAnalytics(filters);
  const report = def('sales-summary');
  const summary = query.data?.summary;
  const before = query.previous?.summary;
  // Defaults to what reads well for the range; the reader can override it.
  const [chosen, setChosen] = useState<Granularity | null>(null);
  const by = chosen ?? suggestedGranularity(filters.range);
  const [open, setOpen] = useState<string | null>(null);

  const daily = (data: typeof query.data, range: typeof filters.range) =>
    data
      ? fillDays(data.daily, range, () => 0).map((day) => {
          const row = data.daily.find((entry) => entry.date.slice(0, 10) === day.date);
          return {
            date: day.date,
            orders: row?.count ?? 0,
            gross: num(row?.grossRevenue ?? row?.revenue),
            refunded: num(row?.refunded),
            net: num(row?.revenue),
          };
        })
      : [];
  const days = daily(query.data, filters.range);
  const buckets = groupDays(days, by, ['orders', 'gross', 'refunded', 'net']);
  const previousBuckets = query.previous && filters.previous ? groupDays(daily(query.previous, filters.previous), by, ['net']) : null;
  const rows = buckets.map((bucket, index) => ({
    ...bucket,
    previous: previousBuckets?.[index]?.net ?? null,
  }));
  // Orders, refunds and net are the KPI tiles above; only gross needs a total row.
  const grossTotal = days.reduce((sum, row) => sum + row.gross, 0);
  const pattern = weekdayPattern(days.map((day) => ({ date: day.date, value: day.net })));
  const bestWeekday = pattern.reduce((best, slot, index) => (slot.average > pattern[best].average ? index : best), 0);
  const firstDay = toDateKey(filters.range.from);
  // A bucket's first day, clipped to the range (a week or month can start before it).
  const bucketStart = (key: string) => {
    const start = by === 'month' ? `${key}-01` : key;
    return start > firstDay ? start : firstDay;
  };

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        rows.length
          ? () =>
              downloadFile(
                exportFileName(`${report.id}-by-${by}`, filters.range),
                toCsv(rows, [
                  { header: by === 'day' ? 'Date' : by === 'week' ? 'Week commencing' : 'Month', value: (row) => row.key },
                  { header: 'Days', value: (row) => row.days },
                  { header: 'Orders', value: (row) => row.orders },
                  { header: 'Gross sales', value: (row) => row.gross.toFixed(2) },
                  { header: 'Refunds', value: (row) => row.refunded.toFixed(2) },
                  { header: 'Net sales', value: (row) => row.net.toFixed(2) },
                  { header: 'Comparison net sales', value: (row) => (row.previous === null ? '' : row.previous.toFixed(2)) },
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
              {
                label: 'Net sales',
                icon: Wallet,
                value: money(summary?.totalRevenue),
                current: num(summary?.totalRevenue),
                previous: before ? num(before.totalRevenue) : null,
                hint: 'After refunds',
              },
              {
                label: 'Orders',
                icon: ShoppingBag,
                value: count(summary?.totalOrders ?? 0),
                current: summary?.totalOrders ?? 0,
                previous: before?.totalOrders ?? null,
              },
              {
                label: 'Average order',
                icon: Receipt,
                value: money(summary?.avgOrderValue),
                current: num(summary?.avgOrderValue),
                previous: before ? num(before.avgOrderValue) : null,
              },
              {
                label: 'Refunds',
                icon: RotateCcw,
                value: money(summary?.refundsBySaleDate),
                current: num(summary?.refundsBySaleDate),
                previous: before ? num(before.refundsBySaleDate) : null,
                inverse: true,
                hint: `${money(summary?.refundsByRefundDate)} refunded in these days`,
              },
            ]}
          />
          <ReportBlock
            title={`Net sales by ${by}`}
            description={previousBuckets ? 'Against the comparison period, dashed.' : undefined}
            actions={
              <SegmentedControl<Granularity>
                options={[
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                ]}
                value={by}
                onChange={setChosen}
                ariaLabel="Group by"
              />
            }
          >
            <TrendChart
              points={rows.map((row) => ({ label: row.label, axis: bucketAxisLabel(row.key, by), value: row.net }))}
              previous={previousBuckets?.map((bucket) => bucket.net)}
              format={(value) => money(value)}
              axisFormat={(value) => compactMoney(value, currency)}
              variant={by === 'month' ? 'bars' : 'line'}
              ariaLabel={`Net sales by ${by}`}
            />
          </ReportBlock>
          {days.length >= 7 && (
            <ReportBlock
              title="By day of the week"
              description={`Average net sales per ${pattern[bestWeekday].weekday.toLowerCase()} and every other weekday — ${pattern[bestWeekday].weekday}s trade best.`}
            >
              <ColumnChart
                columns={pattern.map((slot) => ({
                  label: slot.short,
                  value: slot.average,
                  detail: `${slot.days} days · ${money(slot.total)} in total`,
                }))}
                highlight={bestWeekday}
                format={(value) => `${money(value)} a day`}
                ariaLabel="Average net sales by day of the week"
              />
            </ReportBlock>
          )}
          <ReportBlock
            title={by === 'day' ? 'Day by day' : by === 'week' ? 'Week by week' : 'Month by month'}
            description="Open a row for its hours, best sellers and orders."
            flush
          >
            <ReportTable
              rows={rows}
              rowKey={(row) => row.key}
              defaultSort={{ key: 'date', direction: 'desc' }}
              limit={by === 'day' ? 14 : 12}
              onRowClick={(row) => setOpen(row.key)}
              activeKey={open}
              columns={[
                {
                  key: 'date',
                  header: by === 'day' ? 'Date' : by === 'week' ? 'Week' : 'Month',
                  render: (row) => row.label,
                  sort: (row) => row.key,
                },
                {
                  key: 'orders',
                  header: 'Orders',
                  align: 'right',
                  render: (row) => count(row.orders),
                  sort: (row) => row.orders,
                },
                {
                  key: 'gross',
                  header: 'Gross',
                  align: 'right',
                  render: (row) => money(row.gross),
                  sort: (row) => row.gross,
                  total: money(grossTotal),
                },
                {
                  key: 'refunded',
                  header: 'Refunds',
                  align: 'right',
                  render: (row) => (row.refunded ? money(row.refunded) : '—'),
                  sort: (row) => row.refunded,
                },
                {
                  key: 'net',
                  header: 'Net',
                  align: 'right',
                  render: (row) => <span className="font-semibold">{money(row.net)}</span>,
                  sort: (row) => row.net,
                },
                ...(previousBuckets
                  ? [
                      {
                        key: 'change',
                        header: 'vs comparison',
                        align: 'right' as const,
                        render: (row: (typeof rows)[number]) => <ChangePill change={delta(row.net, row.previous)} />,
                      },
                    ]
                  : []),
              ]}
            />
          </ReportBlock>
        </>
      )}
      {open &&
        (() => {
          const row = rows.find((entry) => entry.key === open);
          if (!row) return null;
          const from = bucketStart(row.key);
          const to = bucketEnd(row.key, by, filters.range);
          return (
            <PeriodDrawer
              filters={filters}
              by={by}
              row={row}
              from={from}
              to={to}
              days={days.filter((entry) => entry.date >= from && entry.date <= to)}
              comparisonLabel={filters.filters.compare === 'year' ? 'last year' : 'the period before'}
              onClose={() => setOpen(null)}
            />
          );
        })()}
    </ReportFrame>
  );
}

/**
 * One day, week or month of the sales summary: its figures against the
 * comparison, when in the day it traded (or which days carried the week), the
 * best sellers, and the orders behind it. Hours and items are fetched for just
 * that span when the drawer opens.
 */
function PeriodDrawer({
  filters,
  by,
  row,
  from,
  to,
  days,
  comparisonLabel,
  onClose,
}: {
  filters: ReportFilterState;
  by: Granularity;
  row: { label: string; orders: number; gross: number; refunded: number; net: number; previous: number | null; days: number };
  from: string;
  to: string;
  days: { date: string; net: number; orders: number }[];
  comparisonLabel: string;
  onClose: () => void;
}) {
  const money = useWorkspaceMoney();
  const end = fromDateKey(to)!;
  const params = filters.params({ from: fromDateKey(from)!, to: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) });
  const scope = [params.from, params.to, params.locationId ?? 'all'] as const;
  const hourly = useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', `hourly:${filters.timezone}`, ...scope),
    queryFn: () => getHourlyVolume({ ...params, timezone: filters.timezone }),
    enabled: by === 'day',
    staleTime: 60_000,
  });
  const items = useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', 'top-items:5', ...scope),
    queryFn: () => getTopItems(params, 5),
    staleTime: 60_000,
  });

  // The trading hours only — leading and trailing empty hours say nothing.
  const hours = (hourly.data ?? []).map((entry) => ({
    hour: Number(entry.hour),
    revenue: num(entry.totalRevenue),
    orders: entry.orderCount,
  }));
  const traded = hours.filter((entry) => entry.revenue > 0 || entry.orders > 0).map((entry) => entry.hour);
  const span =
    traded.length > 0
      ? Array.from({ length: Math.max(...traded) - Math.min(...traded) + 1 }, (_, index) => {
          const hour = Math.min(...traded) + index;
          return hours.find((entry) => entry.hour === hour) ?? { hour, revenue: 0, orders: 0 };
        })
      : [];
  const peak = span.reduce((best, entry, index) => (entry.revenue > (span[best]?.revenue ?? 0) ? index : best), 0);
  const bestDay = days.reduce((best, entry, index) => (entry.net > (days[best]?.net ?? 0) ? index : best), 0);
  const kind = by === 'day' ? 'day' : by;

  return (
    <ReportDrawer
      title={by === 'day' ? dayLabel(from) : row.label}
      description={by === 'day' ? undefined : `${row.days} ${row.days === 1 ? 'day' : 'days'} in these dates`}
      leading={<DrawerMark icon={CalendarDays} />}
      links={[{ label: 'See the orders', href: ordersHref(from, to, filters.filters.locationId), icon: Receipt, primary: true }]}
      onClose={onClose}
    >
      <DrawerFacts
        facts={[
          {
            label: 'Net sales',
            value: money(row.net),
            hint:
              row.previous !== null ? (
                <span className="inline-flex items-center gap-1.5">
                  <ChangePill change={delta(row.net, row.previous)} />
                  {money(row.previous)} {comparisonLabel}
                </span>
              ) : undefined,
          },
          { label: 'Orders', value: count(row.orders), hint: row.orders ? `${money(row.net / row.orders)} average` : undefined },
          { label: 'Gross sales', value: money(row.gross) },
          {
            label: 'Refunds',
            value: row.refunded ? money(row.refunded) : '—',
            hint: row.refunded ? `Against this ${kind}’s sales` : undefined,
          },
        ]}
      />

      {by === 'day' ? (
        <DrawerSection title="By hour" aside={span.length ? `Busiest ${hourLabel(span[peak].hour)}` : undefined}>
          {hourly.isError ? (
            <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
              The hours couldn’t be loaded.{' '}
              <button type="button" onClick={() => void hourly.refetch()} className="font-semibold text-primary hover:underline">
                Try again
              </button>
            </p>
          ) : hourly.isPending ? (
            // The column chart's card: bars rising from the baseline, an hour label under each.
            <div
              role="status"
              aria-busy="true"
              aria-label="Loading sales by hour"
              className="rounded-lg border border-rule/60 bg-card px-3 pt-3 pb-2"
            >
              <div className="flex h-52 items-end gap-1" aria-hidden="true">
                {HOUR_BARS.map((height, index) => (
                  <span key={index} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <Bone className={cn('w-full rounded-sm rounded-b-none', height)} />
                    <Bone className="h-2.5 w-4" />
                  </span>
                ))}
              </div>
            </div>
          ) : span.length === 0 ? (
            <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">No trade this day.</p>
          ) : (
            <div className="rounded-lg border border-rule/60 bg-card px-3 pt-3 pb-2">
              <ColumnChart
                columns={span.map((entry) => ({
                  label: String(entry.hour).padStart(2, '0'),
                  value: entry.revenue,
                  detail: `${count(entry.orders)} orders`,
                }))}
                format={(value) => money(value)}
                ariaLabel={`Net sales by hour on ${dayLabel(from)}`}
                highlight={peak}
              />
            </div>
          )}
        </DrawerSection>
      ) : (
        <DrawerSection title="Day by day" aside={days.length ? `Best ${dayLabel(days[bestDay].date)}` : undefined}>
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {days.map((entry, index) => {
              const top = Math.max(1, ...days.map((day) => day.net));
              return (
                <li key={entry.date} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-2 last:border-b-0">
                  <span
                    className={cn('w-24 shrink-0 text-sm', index === bestDay ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                  >
                    {dayLabel(entry.date)}
                  </span>
                  <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-band">
                    <span
                      className={cn('rounded-full', index === bestDay ? 'bg-primary' : 'bg-primary/40')}
                      style={{ width: `${(entry.net / top) * 100}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums text-foreground">{money(entry.net)}</span>
                </li>
              );
            })}
          </ul>
        </DrawerSection>
      )}

      <DrawerSection title="Best sellers">
        {items.isError ? (
          <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
            The items couldn’t be loaded.{' '}
            <button type="button" onClick={() => void items.refetch()} className="font-semibold text-primary hover:underline">
              Try again
            </button>
          </p>
        ) : items.isPending ? (
          <DrawerListSkeleton rows={4} label="Loading best sellers" />
        ) : !items.data?.length ? (
          <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">Nothing sold.</p>
        ) : (
          <ol className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {[...items.data]
              .sort((a, b) => num(b.totalRevenue) - num(a.totalRevenue))
              .map((item, index) => (
                <li key={item.menuItemId} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count(num(item.totalQuantity))} sold</span>
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums text-foreground">{money(item.totalRevenue)}</span>
                </li>
              ))}
          </ol>
        )}
      </DrawerSection>
    </ReportDrawer>
  );
}

// ── Sales by hour ────────────────────────────────────────────────────────────

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export function SalesByHourReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('sales-by-hour');
  // Bucketed in the site's own timezone — without it the API uses UTC hours.
  const query = useRangeQuery(
    `hourly:${filters.timezone}`,
    (params) => getHourlyVolume({ ...params, timezone: filters.timezone }),
    filters,
  );
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const row = query.data?.find((entry) => Number(entry.hour) === hour);
    const before = query.previous?.find((entry) => Number(entry.hour) === hour);
    return {
      hour,
      orders: row?.orderCount ?? 0,
      revenue: num(row?.totalRevenue),
      previousRevenue: before ? num(before.totalRevenue) : null,
    };
  });
  const trading = hours.filter((hour) => hour.orders > 0 || hour.revenue > 0);
  const first = trading[0]?.hour ?? 7;
  const last = trading.at(-1)?.hour ?? 18;
  const window = hours.slice(Math.max(0, first - 1), Math.min(24, last + 2));
  const peak = hours.reduce((best, hour) => (hour.revenue > best.revenue ? hour : best), hours[0]);
  const total = hours.reduce((sum, hour) => sum + hour.revenue, 0);
  const orders = hours.reduce((sum, hour) => sum + hour.orders, 0);

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        query.data
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(hours, [
                  { header: 'Hour', value: (row) => hourLabel(row.hour) },
                  { header: 'Orders', value: (row) => row.orders },
                  { header: 'Net sales', value: (row) => row.revenue.toFixed(2) },
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
              {
                label: 'Peak hour',
                icon: Clock,
                value: total > 0 ? `${hourLabel(peak.hour)}–${hourLabel(peak.hour + 1)}` : '—',
                hint: total > 0 ? `${money(peak.revenue)} · ${Math.round(share(peak.revenue, total) * 100)}% of sales` : undefined,
              },
              {
                label: 'Trading hours',
                icon: TrendingUp,
                value: trading.length ? `${hourLabel(first)}–${hourLabel(last + 1)}` : '—',
                hint: `${trading.length} hours with sales`,
              },
              { label: 'Orders', icon: ShoppingBag, value: count(orders) },
            ]}
          />
          <ReportBlock title="Net sales by hour" description={`Times in ${filters.timezone.replaceAll('_', ' ')}.`}>
            <ColumnChart
              columns={window.map((hour) => ({
                label: String(hour.hour).padStart(2, '0'),
                value: hour.revenue,
                detail: `${count(hour.orders)} orders`,
              }))}
              highlight={window.findIndex((hour) => hour.hour === peak.hour)}
              format={(value) => money(value)}
              ariaLabel="Net sales by hour of the day"
            />
          </ReportBlock>
          <ReportBlock title="Hour by hour" flush>
            <ReportTable
              rows={window}
              rowKey={(row) => String(row.hour)}
              columns={[
                {
                  key: 'hour',
                  header: 'Hour',
                  render: (row) => `${hourLabel(row.hour)}–${hourLabel(row.hour + 1)}`,
                  sort: (row) => row.hour,
                },
                {
                  key: 'orders',
                  header: 'Orders',
                  align: 'right',
                  render: (row) => count(row.orders),
                  sort: (row) => row.orders,
                },
                {
                  key: 'revenue',
                  header: 'Net sales',
                  align: 'right',
                  render: (row) => money(row.revenue),
                  sort: (row) => row.revenue,
                  total: money(total),
                },
                {
                  key: 'share',
                  header: 'Share',
                  align: 'right',
                  render: (row) => `${Math.round(share(row.revenue, total) * 100)}%`,
                  meter: (row) => share(row.revenue, total),
                  sort: (row) => row.revenue,
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
    </ReportFrame>
  );
}

// ── Sales by channel ─────────────────────────────────────────────────────────

// The orders screens' names for a channel, so a report and the orders list agree.
const channel = (source?: string): { label: string; icon: IconComponent } => {
  const meta = (SOURCE_META as Partial<Record<string, { label: string; icon: IconComponent }>>)[source ?? ''];
  return meta ? { label: meta.label, icon: meta.icon } : { label: (source ?? 'Other').replaceAll('_', ' '), icon: LineChart };
};

export function SalesByChannelReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('sales-by-channel');
  const query = useOrderAnalytics(filters);
  const rows = (query.data?.bySource ?? []).map((row) => {
    const before = query.previous?.bySource.find((entry) => entry.source === row.source);
    return {
      source: row.source ?? 'other',
      orders: row.count,
      revenue: num(row.revenue),
      previous: before ? num(before.revenue) : null,
      aov: row.count > 0 ? num(row.revenue) / row.count : 0,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const orders = rows.reduce((sum, row) => sum + row.orders, 0);

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
                  { header: 'Channel', value: (row) => channel(row.source).label },
                  { header: 'Orders', value: (row) => row.orders },
                  { header: 'Net sales', value: (row) => row.revenue.toFixed(2) },
                  { header: 'Average order', value: (row) => row.aov.toFixed(2) },
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
          <ReportBlock title="By channel" flush>
            <ReportTable
              rows={rows}
              rowKey={(row) => row.source}
              defaultSort={{ key: 'revenue', direction: 'desc' }}
              rowHref={(row) => ordersHref(...rangeKeys(filters.range), filters.filters.locationId, { source: row.source })}
              columns={[
                {
                  key: 'channel',
                  header: 'Channel',
                  leading: (row) => {
                    const Icon = channel(row.source).icon;
                    return <Icon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />;
                  },
                  render: (row) => channel(row.source).label,
                  sort: (row) => channel(row.source).label,
                },
                {
                  key: 'orders',
                  header: 'Orders',
                  align: 'right',
                  render: (row) => count(row.orders),
                  sort: (row) => row.orders,
                  total: count(orders),
                },
                { key: 'aov', header: 'Average order', align: 'right', render: (row) => money(row.aov), sort: (row) => row.aov },
                {
                  key: 'revenue',
                  header: 'Net sales',
                  align: 'right',
                  render: (row) => money(row.revenue),
                  sub: (row) => (row.previous === null ? undefined : <ChangePill change={delta(row.revenue, row.previous)} />),
                  sort: (row) => row.revenue,
                  total: money(total),
                },
                {
                  key: 'share',
                  header: 'Share',
                  align: 'right',
                  render: (row) => `${Math.round(share(row.revenue, total) * 100)}%`,
                  meter: (row) => share(row.revenue, total),
                  sort: (row) => row.revenue,
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
    </ReportFrame>
  );
}

// ── Sales by location ────────────────────────────────────────────────────────

export function SalesByLocationReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('sales-by-location');
  // Every site, whatever the location filter says — the comparison is the point.
  const query = useRangeQuery('revenue-by-location', (params) => getRevenueByLocation({ from: params.from, to: params.to }), filters);
  const rows = (query.data ?? []).map((row) => {
    const before = query.previous?.find((entry) => entry.locationId === row.locationId);
    return {
      id: row.locationId,
      name: row.locationName ?? 'Unnamed location',
      orders: row.orderCount,
      gross: num(row.grossRevenue ?? row.totalRevenue),
      refunded: num(row.refundedAmount),
      net: num(row.totalRevenue),
      previous: before ? num(before.totalRevenue) : null,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.net, 0);

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
                  { header: 'Location', value: (row) => row.name },
                  { header: 'Orders', value: (row) => row.orders },
                  { header: 'Gross sales', value: (row) => row.gross.toFixed(2) },
                  { header: 'Refunds', value: (row) => row.refunded.toFixed(2) },
                  { header: 'Net sales', value: (row) => row.net.toFixed(2) },
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
          <ReportBlock title="By location" flush>
            <ReportTable
              rows={rows}
              rowKey={(row) => row.id}
              // The same dates, scoped to that site.
              rowHref={(row) => {
                const query = new URLSearchParams(filters.query);
                query.set('location', row.id);
                return `/reports/sales-summary?${query}`;
              }}
              defaultSort={{ key: 'net', direction: 'desc' }}
              columns={[
                { key: 'name', header: 'Location', render: (row) => row.name, sort: (row) => row.name },
                {
                  key: 'orders',
                  header: 'Orders',
                  align: 'right',
                  render: (row) => count(row.orders),
                  sort: (row) => row.orders,
                  total: count(rows.reduce((sum, row) => sum + row.orders, 0)),
                },
                { key: 'gross', header: 'Gross', align: 'right', render: (row) => money(row.gross), sort: (row) => row.gross },
                {
                  key: 'refunded',
                  header: 'Refunds',
                  align: 'right',
                  render: (row) => (row.refunded ? money(row.refunded) : '—'),
                  sort: (row) => row.refunded,
                },
                {
                  key: 'net',
                  header: 'Net',
                  align: 'right',
                  render: (row) => <span className="font-semibold">{money(row.net)}</span>,
                  sub: (row) => (row.previous === null ? undefined : <ChangePill change={delta(row.net, row.previous)} />),
                  sort: (row) => row.net,
                  total: money(total),
                },
                {
                  key: 'share',
                  header: 'Share',
                  align: 'right',
                  render: (row) => `${Math.round(share(row.net, total) * 100)}%`,
                  meter: (row) => share(Math.max(0, row.net), total),
                  sort: (row) => row.net,
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
    </ReportFrame>
  );
}
