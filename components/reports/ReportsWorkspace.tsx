'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarRange,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  FlaskConical,
  Gift,
  GitCompareArrows,
  type IconComponent,
  Info,
  Landmark,
  Leaf,
  LibraryBig,
  LineChart,
  Megaphone,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Truck,
  Users,
  UsersRound,
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { DeltaBadge, DeltaText, StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';

import {
  type DailyOrderAnalytics,
  type HourlyVolume,
  type TopItemAnalytics,
  getCustomerRetention,
  getHourlyVolume,
  getOrderAnalytics,
  getTopItems,
} from '@/lib/api/analytics.service';
import { getLocations } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import {
  REPORT_METRICS,
  REPORT_METRIC_MAP,
  type ReportMetricKey,
  buildReportSnapshot,
  dailyMetricValues,
  formatReportMetric,
  metricAccent,
  metricChange,
  metricDelta,
  previousDateRange,
  previousYearDateRange,
  reportDateRange,
  shortDateLabel,
  trailingDateRange,
} from '@/lib/utils/reporting';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ComparisonChart } from './ComparisonChart';

export type ReportsTab = 'overview' | 'compare' | 'library';
type ComparisonMode = 'previous' | 'previous-year' | 'custom';
type PeriodPreset = '7' | '30' | '90' | 'custom';

const panel = 'rounded-sm border border-rule bg-card shadow-sm';
/** Overview period picker — preset ranges plus a custom from/to. Lives in the page header. */
function PeriodSelector({
  preset,
  dates,
  onPresetChange,
  onCustomChange,
}: {
  preset: PeriodPreset;
  dates: { from: string; to: string };
  onPresetChange: (value: string) => void;
  onCustomChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <DatePicker
            value={dates.from}
            max={dates.to || undefined}
            onValueChange={(from) => onCustomChange(from, dates.to)}
            aria-label="From date"
            className="h-10 w-38"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <DatePicker
            value={dates.to}
            min={dates.from || undefined}
            onValueChange={(to) => onCustomChange(dates.from, to)}
            aria-label="To date"
            className="h-10 w-38"
          />
        </div>
      )}
      <Select
        value={preset}
        onValueChange={onPresetChange}
        options={[
          { value: '7', label: 'Last 7 days' },
          { value: '30', label: 'Last 30 days' },
          { value: '90', label: 'Last 90 days' },
          { value: 'custom', label: 'Custom range' },
        ]}
        ariaLabel="Report period"
        icon={<CalendarRange size={14} aria-hidden="true" />}
        className="h-10"
      />
    </div>
  );
}

function LoadingBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-muted', className)} aria-hidden="true" />;
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
      <p className="text-sm font-semibold text-foreground">This report data could not be loaded.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw size={14} /> Try again
      </Button>
    </div>
  );
}

function ReportMetricCard({
  metric,
  current,
  comparison,
  href,
  loading,
  series,
}: {
  metric: ReportMetricKey;
  current: number;
  comparison: number;
  href?: string;
  loading: boolean;
  /** Daily values for the metric, when it has a series worth sparklining. */
  series?: number[];
}) {
  const definition = REPORT_METRIC_MAP[metric];
  return (
    <StatCard
      size="sm"
      label={definition.label}
      value={formatReportMetric(metric, current)}
      caption={definition.description}
      delta={metricDelta(metric, current, comparison)}
      accent={metricAccent(metric)}
      visual={series ? { type: 'sparkline', points: series } : undefined}
      href={href}
      loading={loading}
      action={href ? <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" /> : undefined}
    />
  );
}

function PanelTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function OperationalStrip({
  metrics,
  loading,
}: {
  metrics: Array<{ metric: ReportMetricKey; current: number; comparison: number }>;
  loading: boolean;
}) {
  return (
    <section className="rounded-sm border border-rule bg-card p-1 shadow-sm" aria-label="Supporting performance metrics">
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ metric, current, comparison }) => {
          const definition = REPORT_METRIC_MAP[metric];
          return (
            <div key={metric} className="min-w-0 rounded-sm px-3 py-3 transition-colors hover:bg-muted/35">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-micro font-semibold uppercase tracking-micro text-muted-foreground">{definition.label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                    {loading ? '—' : formatReportMetric(metric, current)}
                  </p>
                </div>
                {!loading && <DeltaText delta={metricDelta(metric, current, comparison, '')} />}
              </div>
              <p className="mt-1 truncate text-label text-muted-foreground">{definition.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PerformanceBrief({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    detail: string;
    icon: IconComponent;
  }>;
}) {
  return (
    <section className="rounded-sm border border-primary/20 bg-[color-mix(in_oklab,var(--primary)_4%,var(--card))] px-4 py-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={15} className="text-primary" aria-hidden="true" />
        <h2 className="text-xs font-bold uppercase tracking-micro text-foreground">Performance brief</h2>
        <span className="text-label text-muted-foreground">Quick answers from this period</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex min-w-0 gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-card text-primary shadow-sm">
                <Icon size={15} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">{item.label}</p>
                <p className="mt-0.5 truncate text-sm font-bold text-foreground">{item.value}</p>
                <p className="truncate text-label text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HourlyHeatmap({ rows, loading }: { rows: HourlyVolume[]; loading: boolean }) {
  if (loading) return <LoadingBlock className="mt-5 h-40" />;
  const hours = Array.from(
    { length: 24 },
    (_, hour) => rows.find((row) => row.hour === hour) ?? { hour, orderCount: 0, totalRevenue: '0' },
  );
  const max = Math.max(...hours.map((row) => row.orderCount), 1);
  const peak = hours.reduce((best, row) => (row.orderCount > best.orderCount ? row : best), hours[0]);
  const dayparts = [
    { label: 'Morning', hours: hours.slice(6, 12) },
    { label: 'Lunch', hours: hours.slice(12, 16) },
    { label: 'Evening', hours: hours.slice(16, 22) },
    { label: 'Late', hours: [...hours.slice(22), ...hours.slice(0, 6)] },
  ].map((part) => ({ ...part, orders: part.hours.reduce((sum, row) => sum + row.orderCount, 0) }));
  const busiestPart = dayparts.reduce((best, part) => (part.orders > best.orders ? part : best), dayparts[0]);

  return (
    <div className="mt-5">
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {dayparts.map((part) => (
          <div
            key={part.label}
            className={cn(
              'rounded-sm bg-muted/35 px-2 py-2',
              part.label === busiestPart.label && 'bg-band text-primary ring-1 ring-primary/15',
            )}
          >
            <p className="truncate text-micro font-semibold text-muted-foreground">{part.label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{part.orders}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
        {hours.map((row) => {
          const strength = row.orderCount / max;
          return (
            <div
              key={row.hour}
              className="flex aspect-square min-w-0 flex-col items-center justify-center rounded-sm border border-primary/10 text-center"
              style={{ backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(8 + strength * 72)}%, var(--card))` }}
              title={`${String(row.hour).padStart(2, '0')}:00 — ${row.orderCount} orders`}
            >
              <span className={cn('text-micro font-semibold', strength > 0.55 ? 'text-primary-foreground' : 'text-foreground')}>
                {String(row.hour).padStart(2, '0')}
              </span>
              <span className={cn('text-micro', strength > 0.55 ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {row.orderCount}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{busiestPart.label}</span> is the busiest service window. Peak hour is{' '}
        <span className="font-semibold text-foreground">{String(peak.hour).padStart(2, '0')}:00</span> with{' '}
        <span className="font-semibold text-foreground">{peak.orderCount} orders</span>.
      </p>
    </div>
  );
}

function TopItemsTable({ rows, loading }: { rows: TopItemAnalytics[]; loading: boolean }) {
  if (loading) return <LoadingBlock className="mt-5 h-64" />;
  if (!rows.length) return <p className="py-12 text-center text-sm text-muted-foreground">No items sold in this period.</p>;
  const maxRevenue = Math.max(...rows.map((row) => Number(row.totalRevenue ?? 0)), 1);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-120 border-separate border-spacing-y-1 text-sm">
        <thead>
          <tr className="text-left text-micro uppercase tracking-micro text-muted-foreground">
            <th className="px-3 pb-1 font-semibold">Item</th>
            <th className="px-3 pb-1 text-right font-semibold">Units</th>
            <th className="px-3 pb-1 text-right font-semibold">Orders</th>
            <th className="px-3 pb-1 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const revenue = Number(row.totalRevenue ?? 0);
            return (
              <tr key={`${row.menuItemId}-${row.name}`} className="group">
                <td className="rounded-l-sm bg-muted/25 py-2.5 pr-4 pl-3 transition-colors group-hover:bg-muted/45">
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-xs font-bold text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{row.name}</p>
                      <div className="mt-1 h-1 max-w-40 overflow-hidden rounded-full bg-band">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(revenue / maxRevenue) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="bg-muted/25 px-3 py-2.5 text-right tabular-nums text-muted-foreground transition-colors group-hover:bg-muted/45">
                  {Number(row.totalQuantity ?? 0).toLocaleString()}
                </td>
                <td className="bg-muted/25 px-3 py-2.5 text-right tabular-nums text-muted-foreground transition-colors group-hover:bg-muted/45">
                  {row.orderCount.toLocaleString()}
                </td>
                <td className="rounded-r-sm bg-muted/25 px-3 py-2.5 text-right font-semibold tabular-nums text-foreground transition-colors group-hover:bg-muted/45">
                  {formatReportMetric('netRevenue', revenue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const reportPacks = [
  {
    title: 'Refunds',
    description: 'Item and modifier refunds by refund date or original sale date, with reasons and CSV export.',
    icon: RotateCcw,
    status: 'Available',
    href: '/reports/refunds',
  },
  {
    title: 'Sales and demand',
    description: 'Revenue, orders, average value, channels and peak trading periods.',
    icon: CircleDollarSign,
    status: 'Available',
    href: '/reports/revenue',
  },
  {
    title: 'Menu performance',
    description: 'Item and category sales, current recipe-cost coverage, contribution estimates and menu engineering.',
    icon: ReceiptText,
    status: 'Available',
    href: '/reports/top-items',
  },
  {
    title: 'Customers and loyalty',
    description: 'New and returning customers, repeat rate and known-customer activity.',
    icon: Users,
    status: 'Available',
    href: '/reports/retention',
  },
  {
    title: 'Labour and productivity',
    description: 'Scheduled versus worked time, labour cost and sales per labour hour.',
    icon: UsersRound,
    status: 'Available',
    href: '/reports/labour',
  },
  {
    title: 'Inventory and waste',
    description: 'Consumption, days of stock, waste, stocktake variance and stockout risk.',
    icon: Boxes,
    status: 'Available',
    href: '/reports/inventory',
  },
  {
    title: 'Purchasing and suppliers',
    description: 'Purchase spend, price variance, fulfilment and receiving performance.',
    icon: PackageSearch,
    status: 'Available',
    href: '/reports/purchasing',
  },
  {
    title: 'Menu profitability',
    description: 'Recorded sales against current base-recipe ingredient costs, with completeness warnings.',
    icon: ReceiptText,
    status: 'Available',
    href: '/reports/profitability',
  },
  {
    title: 'Marketing and promotions',
    description: 'Campaign reach, promo redemption, discount cost and incremental revenue lift.',
    icon: Megaphone,
    status: 'Coming soon',
  },
  {
    title: 'Financial statements',
    description: 'Profit and loss, gross margin and cash flow rolled up across locations.',
    icon: Landmark,
    status: 'Coming soon',
  },
  {
    title: 'Demand forecasting',
    description: 'Predicted sales and covers by day and hour to guide prep, ordering and rotas.',
    icon: LineChart,
    status: 'Coming soon',
  },
  {
    title: 'Sustainability and waste',
    description: 'Food-waste footprint, packaging use and energy intensity per cover.',
    icon: Leaf,
    status: 'Coming soon',
  },
  {
    title: 'Customer feedback',
    description: 'Review scores, sentiment trends and response times across channels.',
    icon: Star,
    status: 'Coming soon',
  },
  {
    title: 'Payments and settlement',
    description: 'Open and close the trading day, count cash and reconcile terminal totals.',
    icon: CreditCard,
    status: 'Available',
    href: '/cash-up',
  },
  {
    title: 'Speed of service',
    description: 'Order-to-serve times, KDS throughput and bottlenecks by daypart.',
    icon: Timer,
    status: 'Coming soon',
  },
  {
    title: 'Compliance and food safety',
    description: 'Temperature logs, allergen coverage, stocktake accuracy and audit trails.',
    icon: ShieldCheck,
    status: 'Coming soon',
  },
  {
    title: 'Loyalty and rewards',
    description: 'Points earned and redeemed, reward ROI and member lifetime value.',
    icon: Gift,
    status: 'Coming soon',
  },
  {
    title: 'Delivery and channels',
    description: 'Third-party platform mix, commission cost and channel profitability.',
    icon: Truck,
    status: 'Coming soon',
  },
  {
    title: 'Smart alerts and anomalies',
    description: 'Automatic detection of sales dips, waste spikes and unusual voids or discounts.',
    icon: Sparkles,
    status: 'Coming soon',
  },
];

function ReportsOverview({
  dates,
  timeZone,
  activeLocationId,
  selectedLocationName,
}: {
  dates: { from: string; to: string };
  timeZone: string;
  activeLocationId: string | null;
  selectedLocationName: string;
}) {
  const valid = Boolean(dates.from && dates.to && dates.from <= dates.to);
  const dayCount = valid ? Math.round((new Date(dates.to).getTime() - new Date(dates.from).getTime()) / 86_400_000) + 1 : 0;
  const previousDates = useMemo(() => (valid ? previousDateRange(dates.from, dates.to) : { from: '', to: '' }), [dates, valid]);
  const currentRange = useMemo(() => (valid ? reportDateRange(dates.from, dates.to, timeZone) : null), [dates, timeZone, valid]);
  const comparisonRange = useMemo(
    () => (valid ? reportDateRange(previousDates.from, previousDates.to, timeZone) : null),
    [previousDates, timeZone, valid],
  );
  const scope = activeLocationId ?? 'all';
  const scoped = (range: { from: string; to: string }) => ({ ...range, ...(activeLocationId ? { locationId: activeLocationId } : {}) });

  const currentOrders = useQuery({
    queryKey: ['reports-overview-orders', dates.from, dates.to, scope, timeZone],
    queryFn: () => getOrderAnalytics(scoped(currentRange!)),
    enabled: valid,
  });
  const comparisonOrders = useQuery({
    queryKey: ['reports-overview-orders-comparison', previousDates.from, previousDates.to, scope, timeZone],
    queryFn: () => getOrderAnalytics(scoped(comparisonRange!)),
    enabled: valid,
  });
  const currentRetention = useQuery({
    queryKey: ['reports-overview-retention', dates.from, dates.to, scope, timeZone],
    queryFn: () => getCustomerRetention(scoped(currentRange!)),
    enabled: valid,
  });
  const comparisonRetention = useQuery({
    queryKey: ['reports-overview-retention-comparison', previousDates.from, previousDates.to, scope, timeZone],
    queryFn: () => getCustomerRetention(scoped(comparisonRange!)),
    enabled: valid,
  });
  const topItems = useQuery({
    queryKey: ['reports-overview-top-items', dates.from, dates.to, scope, timeZone],
    queryFn: () => getTopItems(scoped(currentRange!), 10),
    enabled: valid,
  });
  const hourly = useQuery({
    queryKey: ['reports-overview-hourly', dates.from, dates.to, scope, timeZone],
    queryFn: () => getHourlyVolume(scoped(currentRange!)),
    enabled: valid,
  });
  const current = buildReportSnapshot(currentOrders.data, currentRetention.data);
  const comparison = buildReportSnapshot(comparisonOrders.data, comparisonRetention.data);
  const coreLoading = currentOrders.isPending || comparisonOrders.isPending || currentRetention.isPending || comparisonRetention.isPending;
  const coreError = currentOrders.isError || comparisonOrders.isError || currentRetention.isError || comparisonRetention.isError;
  const dailyRows = currentOrders.data?.daily ?? [];
  const strongestDay = dailyRows.reduce<DailyOrderAnalytics | null>(
    (best, row) => (!best || Number(row.revenue ?? 0) > Number(best.revenue ?? 0) ? row : best),
    null,
  );
  const hourlyRows = hourly.data ?? [];
  const peakHour = hourlyRows.reduce<HourlyVolume | null>((best, row) => (!best || row.orderCount > best.orderCount ? row : best), null);
  const posLeads = current.values.posOrders >= current.values.mobileOrders;
  const leadingChannelOrders = posLeads ? current.values.posOrders : current.values.mobileOrders;
  const totalChannelOrders = current.values.posOrders + current.values.mobileOrders;
  const leadingItem = topItems.data?.[0];
  const retry = () => {
    void currentOrders.refetch();
    void comparisonOrders.refetch();
    void currentRetention.refetch();
    void comparisonRetention.refetch();
  };

  if (!valid)
    return (
      <div className={cn(panel, 'p-8 text-center text-sm text-destructive')}>Choose a valid start and end date for the custom range.</div>
    );

  if (coreError)
    return (
      <div className={panel}>
        <ErrorBlock onRetry={retry} />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* The period control now lives in the page header; this is the resolved-range caption. */}
      <p className="text-xs text-muted-foreground">
        {shortDateLabel(dates.from)}–{shortDateLabel(dates.to)} · compared with the preceding {dayCount === 1 ? 'day' : `${dayCount} days`}{' '}
        · {selectedLocationName}
      </p>

      <PerformanceBrief
        items={[
          {
            label: 'Strongest day',
            value: strongestDay ? shortDateLabel(strongestDay.date) : 'No trading data',
            detail: strongestDay
              ? `${formatReportMetric('netRevenue', Number(strongestDay.revenue ?? 0))} recorded`
              : 'Awaiting completed orders',
            icon: LineChart,
          },
          {
            label: 'Peak hour',
            value: peakHour ? `${String(peakHour.hour).padStart(2, '0')}:00` : 'No hourly data',
            detail: peakHour ? `${peakHour.orderCount} orders in the hour` : 'No demand pattern yet',
            icon: Timer,
          },
          {
            label: 'Leading channel',
            value: totalChannelOrders ? (posLeads ? 'POS' : 'Mobile') : 'No channel data',
            detail: totalChannelOrders
              ? `${((leadingChannelOrders / totalChannelOrders) * 100).toFixed(1)}% of recorded orders`
              : 'No orders attributed',
            icon: CreditCard,
          },
          {
            label: 'Top menu item',
            value: leadingItem?.name ?? 'No item data',
            detail: leadingItem
              ? `${formatReportMetric('netRevenue', Number(leadingItem.totalRevenue ?? 0))} recorded`
              : 'No item sales recorded',
            icon: Star,
          },
        ]}
      />

      <StatCardGrid aria-label="Key performance metrics">
        <ReportMetricCard
          metric="netRevenue"
          current={current.values.netRevenue}
          comparison={comparison.values.netRevenue}
          series={dailyMetricValues('netRevenue', currentOrders.data?.daily ?? [])}
          href="/reports/revenue"
          loading={coreLoading}
        />
        <ReportMetricCard
          metric="orders"
          current={current.values.orders}
          comparison={comparison.values.orders}
          series={dailyMetricValues('orders', currentOrders.data?.daily ?? [])}
          href="/reports/orders"
          loading={coreLoading}
        />
        <ReportMetricCard
          metric="averageOrderValue"
          current={current.values.averageOrderValue}
          comparison={comparison.values.averageOrderValue}
          series={dailyMetricValues('averageOrderValue', currentOrders.data?.daily ?? [])}
          href="/reports/average"
          loading={coreLoading}
        />
        <ReportMetricCard
          metric="repeatRate"
          current={current.values.repeatRate}
          comparison={comparison.values.repeatRate}
          href="/reports/retention"
          loading={coreLoading}
        />
      </StatCardGrid>

      <OperationalStrip
        loading={coreLoading}
        metrics={[
          { metric: 'completionRate', current: current.values.completionRate, comparison: comparison.values.completionRate },
          { metric: 'cancellationRate', current: current.values.cancellationRate, comparison: comparison.values.cancellationRate },
          { metric: 'newCustomers', current: current.values.newCustomers, comparison: comparison.values.newCustomers },
          { metric: 'returningCustomers', current: current.values.returningCustomers, comparison: comparison.values.returningCustomers },
        ]}
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className={cn(panel, 'min-w-0 p-5')}>
          <PanelTitle title="Revenue trend" description="Current period against the immediately preceding equivalent period" />
          <ComparisonChart
            metric="netRevenue"
            current={currentOrders.data?.daily ?? []}
            comparison={comparisonOrders.data?.daily ?? []}
            currentValue={current.values.netRevenue}
            comparisonValue={comparison.values.netRevenue}
            currentLabel="Current period"
            comparisonLabel="Previous period"
          />
        </div>
        <div className={cn(panel, 'min-w-0 p-5')}>
          <PanelTitle title="Channel mix" description="Recorded order volume and value by order source" />
          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold tabular-nums text-foreground">{totalChannelOrders.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">orders with a recorded source</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">
                Leader
                <br />
                <span className="text-sm font-bold text-foreground">{totalChannelOrders ? (posLeads ? 'POS' : 'Mobile') : '—'}</span>
              </p>
            </div>
            <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-band" aria-label="Order source share">
              <div
                className="h-full bg-chart-1 transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${totalChannelOrders ? (current.values.posOrders / totalChannelOrders) * 100 : 0}%` }}
              />
              <div
                className="h-full bg-chart-2 transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${totalChannelOrders ? (current.values.mobileOrders / totalChannelOrders) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-4 space-y-1">
              {[
                { label: 'POS', orders: current.values.posOrders, value: current.values.posValue, dot: 'bg-chart-1' },
                { label: 'Mobile', orders: current.values.mobileOrders, value: current.values.mobileValue, dot: 'bg-chart-2' },
              ].map((source) => {
                const share = totalChannelOrders ? (source.orders / totalChannelOrders) * 100 : 0;
                return (
                  <div
                    key={source.label}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 rounded-sm bg-muted/25 px-3 py-2.5"
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className={cn('size-2.5 rounded-full', source.dot)} /> {source.label}
                    </span>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      {source.orders.toLocaleString()} · {share.toFixed(1)}%
                    </span>
                    <span className="w-24 text-right text-sm font-bold tabular-nums text-foreground">
                      {formatReportMetric('posValue', source.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-3 text-label leading-relaxed text-muted-foreground">
            Channel value is reported before the headline cancellation adjustment because the current API does not cross-break down status
            and source.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={cn(panel, 'min-w-0 p-5')}>
          <PanelTitle
            title="Top menu items"
            description="Ranked by recorded non-cancelled revenue"
            action={
              <Link href="/reports/top-items" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Full report <ChevronRight size={13} />
              </Link>
            }
          />
          {topItems.isError ? (
            <ErrorBlock onRetry={() => void topItems.refetch()} />
          ) : (
            <TopItemsTable rows={topItems.data ?? []} loading={topItems.isPending} />
          )}
        </div>
        <div className={cn(panel, 'min-w-0 self-start p-5')}>
          <PanelTitle title="Demand by hour" description="Order concentration across the selected period" />
          {hourly.isError ? (
            <ErrorBlock onRetry={() => void hourly.refetch()} />
          ) : (
            <HourlyHeatmap rows={hourly.data ?? []} loading={hourly.isPending} />
          )}
        </div>
      </section>
    </div>
  );
}

function MetricPicker({ selected, onToggle }: { selected: ReportMetricKey[]; onToggle: (metric: ReportMetricKey) => void }) {
  const categories = ['Sales', 'Operations', 'Customers', 'Channels'] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
      {categories.map((category) => (
        <fieldset key={category}>
          <legend className="mb-2 text-micro font-semibold uppercase tracking-micro text-muted-foreground">{category}</legend>
          <div className="grid gap-1.5">
            {REPORT_METRICS.filter((metric) => metric.category === category).map((metric) => (
              <label
                key={metric.key}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-sm bg-background/70 px-2.5 py-2 transition-colors hover:bg-muted',
                  selected.includes(metric.key) && 'bg-band ring-1 ring-primary/20',
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(metric.key)}
                  onChange={() => onToggle(metric.key)}
                  className="mt-0.5 size-3.5 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-foreground">{metric.label}</span>
                  <span className="mt-0.5 block text-micro leading-relaxed text-muted-foreground">{metric.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function downloadComparisonCsv(
  metrics: ReportMetricKey[],
  currentValues: Record<ReportMetricKey, number>,
  comparisonValues: Record<ReportMetricKey, number>,
  currentLabel: string,
  comparisonLabel: string,
) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ['Metric', currentLabel, comparisonLabel, 'Absolute difference', 'Relative change'],
    ...metrics.map((key) => {
      const current = currentValues[key];
      const comparison = comparisonValues[key];
      const change = metricChange(key, current, comparison);
      return [REPORT_METRIC_MAP[key].label, current, comparison, current - comparison, change === null ? 'New' : change];
    }),
  ];
  const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `duma-comparison-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ComparisonWorkspace({
  locations,
  timeZone,
  initialLocationId,
}: {
  locations: Awaited<ReturnType<typeof getLocations>>;
  timeZone: string;
  initialLocationId: string | null;
}) {
  const initial = useMemo(() => trailingDateRange(30, timeZone), [timeZone]);
  const [fromA, setFromA] = useState(initial.from);
  const [toA, setToA] = useState(initial.to);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('previous');
  const defaultB = previousDateRange(initial.from, initial.to);
  const [fromB, setFromB] = useState(defaultB.from);
  const [toB, setToB] = useState(defaultB.to);
  const [locationA, setLocationA] = useState(initialLocationId ?? '');
  const [locationB, setLocationB] = useState(initialLocationId ?? '');
  const [metrics, setMetrics] = useState<ReportMetricKey[]>(['netRevenue', 'orders', 'averageOrderValue', 'repeatRate']);
  const [visual, setVisual] = useState<'charts' | 'table'>('charts');

  const effectiveB = useMemo(() => {
    if (comparisonMode === 'previous') return previousDateRange(fromA, toA);
    if (comparisonMode === 'previous-year') return previousYearDateRange(fromA, toA);
    return { from: fromB, to: toB };
  }, [comparisonMode, fromA, fromB, toA, toB]);
  const validA = Boolean(fromA && toA && fromA <= toA);
  const validB = Boolean(effectiveB.from && effectiveB.to && effectiveB.from <= effectiveB.to);
  const rangeA = useMemo(() => (validA ? reportDateRange(fromA, toA, timeZone) : null), [fromA, timeZone, toA, validA]);
  const rangeB = useMemo(
    () => (validB ? reportDateRange(effectiveB.from, effectiveB.to, timeZone) : null),
    [effectiveB.from, effectiveB.to, timeZone, validB],
  );
  const paramsA = rangeA ? { ...rangeA, ...(locationA ? { locationId: locationA } : {}) } : null;
  const paramsB = rangeB ? { ...rangeB, ...(locationB ? { locationId: locationB } : {}) } : null;

  const ordersA = useQuery({
    queryKey: ['reports-compare-orders-a', fromA, toA, locationA, timeZone],
    queryFn: () => getOrderAnalytics(paramsA!),
    enabled: Boolean(paramsA),
  });
  const ordersB = useQuery({
    queryKey: ['reports-compare-orders-b', effectiveB.from, effectiveB.to, locationB, timeZone],
    queryFn: () => getOrderAnalytics(paramsB!),
    enabled: Boolean(paramsB),
  });
  const retentionA = useQuery({
    queryKey: ['reports-compare-retention-a', fromA, toA, locationA, timeZone],
    queryFn: () => getCustomerRetention(paramsA!),
    enabled: Boolean(paramsA),
  });
  const retentionB = useQuery({
    queryKey: ['reports-compare-retention-b', effectiveB.from, effectiveB.to, locationB, timeZone],
    queryFn: () => getCustomerRetention(paramsB!),
    enabled: Boolean(paramsB),
  });

  const snapshotA = buildReportSnapshot(ordersA.data, retentionA.data);
  const snapshotB = buildReportSnapshot(ordersB.data, retentionB.data);
  const loading = ordersA.isPending || ordersB.isPending || retentionA.isPending || retentionB.isPending;
  const error = ordersA.isError || ordersB.isError || retentionA.isError || retentionB.isError;
  const locationName = (id: string) => locations.find((location) => location.id === id)?.name ?? 'All locations';
  const labelA = `${locationName(locationA)} · ${shortDateLabel(fromA)}–${shortDateLabel(toA)}`;
  const labelB = `${locationName(locationB)} · ${shortDateLabel(effectiveB.from)}–${shortDateLabel(effectiveB.to)}`;
  const locationOptions = [
    { value: '', label: 'All accessible locations' },
    ...locations.map((location) => ({ value: location.id, label: location.name })),
  ];

  const applyPreset = (days: number) => {
    const range = trailingDateRange(days, timeZone);
    setFromA(range.from);
    setToA(range.to);
  };
  const toggleMetric = (metric: ReportMetricKey) =>
    setMetrics((current) => (current.includes(metric) ? current.filter((key) => key !== metric) : [...current, metric]));

  return (
    <div className="space-y-5">
      <section className={cn(panel, 'p-4')}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <FlaskConical size={17} className="text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Build a comparison</h2>
              <p className="text-label text-muted-foreground">Choose two views, then focus the metrics you need.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-micro font-semibold uppercase tracking-micro text-muted-foreground">View A range</span>
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => applyPreset(days)}
                className="rounded-sm bg-muted/70 px-2.5 py-1.5 text-label font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Last {days}d
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <fieldset className="rounded-sm bg-muted/30 p-3">
            <legend className="sr-only">View A</legend>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 items-center justify-center rounded-sm bg-chart-1 text-micro font-semibold text-primary-foreground">
                A
              </span>
              <span className="text-xs font-semibold text-foreground">Primary view</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr]">
              <DatePicker label="From" value={fromA} max={toA} onValueChange={setFromA} />
              <DatePicker label="To" value={toA} min={fromA} onValueChange={setToA} />
              <Select
                value={locationA}
                onValueChange={setLocationA}
                options={locationOptions}
                ariaLabel="View A location"
                className="w-full self-end"
              />
            </div>
          </fieldset>

          <fieldset className="rounded-sm bg-muted/30 p-3">
            <legend className="sr-only">View B</legend>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded-sm bg-chart-5 text-micro font-semibold text-card">
                  B
                </span>
                <span className="text-xs font-semibold text-foreground">Comparison view</span>
              </div>
              <span className="text-micro text-muted-foreground">
                {shortDateLabel(effectiveB.from)}–{shortDateLabel(effectiveB.to)}
              </span>
            </div>
            <div className={cn('mt-2 grid gap-2', comparisonMode === 'custom' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2')}>
              <Select
                value={comparisonMode}
                onValueChange={(value) => setComparisonMode(value as ComparisonMode)}
                options={[
                  { value: 'previous', label: 'Previous equivalent period' },
                  { value: 'previous-year', label: 'Same dates last year' },
                  { value: 'custom', label: 'Custom period' },
                ]}
                ariaLabel="Comparison period"
                className="w-full"
              />
              {comparisonMode === 'custom' && (
                <>
                  <DatePicker label="From" value={fromB} max={toB} onValueChange={setFromB} />
                  <DatePicker label="To" value={toB} min={fromB} onValueChange={setToB} />
                </>
              )}
              <Select
                value={locationB}
                onValueChange={setLocationB}
                options={locationOptions}
                ariaLabel="View B location"
                className="w-full"
              />
            </div>
          </fieldset>
        </div>

        <details className="group mt-3 rounded-sm bg-muted/30 px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-foreground">
            <span>Choose metrics</span>
            <span className="rounded-full bg-band px-2 py-0.5 text-micro text-primary">{metrics.length} selected</span>
          </summary>
          <div className="mt-3">
            <MetricPicker selected={metrics} onToggle={toggleMetric} />
          </div>
        </details>
      </section>

      <div className="min-w-0 space-y-4">
        <section>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-micro font-semibold uppercase tracking-micro text-primary">Custom comparison</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">View A against View B</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                Date boundaries use {timeZone}. Percentage metrics show percentage-point differences; all other metrics show relative
                change.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-sm bg-muted/60 p-1">
                {(['charts', 'table'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setVisual(option)}
                    className={cn(
                      'rounded-sm px-3 py-1 text-xs font-semibold capitalize',
                      visual === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-background',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!metrics.length || loading}
                onClick={() => downloadComparisonCsv(metrics, snapshotA.values, snapshotB.values, labelA, labelB)}
              >
                <Download size={14} /> CSV
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-sm bg-band px-3 py-2.5">
              <span className="mr-2 inline-flex size-5 items-center justify-center rounded-sm bg-chart-1 text-micro font-semibold text-primary-foreground">
                A
              </span>
              <span className="text-muted-foreground">{labelA}</span>
            </div>
            <div className="rounded-sm bg-chart-5/10 px-3 py-2.5">
              <span className="mr-2 inline-flex size-5 items-center justify-center rounded-sm bg-chart-5 text-micro font-semibold text-card">
                B
              </span>
              <span className="text-muted-foreground">{labelB}</span>
            </div>
          </div>
        </section>

        {!validA || !validB ? (
          <div className={cn(panel, 'px-4 py-10 text-center text-sm text-destructive')}>
            Choose valid start and end dates for both views.
          </div>
        ) : error ? (
          <div className={cn(panel, 'p-4')}>
            <ErrorBlock
              onRetry={() => {
                void ordersA.refetch();
                void ordersB.refetch();
                void retentionA.refetch();
                void retentionB.refetch();
              }}
            />
          </div>
        ) : metrics.length === 0 ? (
          <div className={cn(panel, 'px-4 py-12 text-center')}>
            <BarChart3 className="mx-auto text-muted-foreground" size={28} />
            <p className="mt-3 text-sm font-semibold text-foreground">Select at least one metric</p>
            <p className="mt-1 text-xs text-muted-foreground">Open Choose metrics above to select what to compare.</p>
          </div>
        ) : visual === 'charts' ? (
          <div className="grid gap-4 2xl:grid-cols-2">
            {metrics.map((metric) => {
              const definition = REPORT_METRIC_MAP[metric];
              const current = snapshotA.values[metric];
              const comparison = snapshotB.values[metric];
              return (
                <section key={metric} className={cn(panel, 'min-w-0 p-5')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{definition.label}</h3>
                      <p className="mt-1 text-label leading-relaxed text-muted-foreground">{definition.description}</p>
                    </div>
                    <span title={definition.description} className="text-muted-foreground">
                      <Info size={14} aria-hidden="true" />
                    </span>
                  </div>
                  {loading ? (
                    <LoadingBlock className="mt-5 h-56" />
                  ) : (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-2xl font-bold tabular-nums text-foreground">{formatReportMetric(metric, current)}</p>
                        <DeltaBadge delta={metricDelta(metric, current, comparison, 'A vs B')} size="sm" />
                      </div>
                      <ComparisonChart
                        metric={metric}
                        current={ordersA.data?.daily ?? []}
                        comparison={ordersB.data?.daily ?? []}
                        currentValue={current}
                        comparisonValue={comparison}
                        currentLabel="View A"
                        comparisonLabel="View B"
                      />
                    </>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <section className={cn(panel, 'overflow-hidden')}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead className="bg-muted/35">
                  <tr className="border-b border-rule text-left text-micro uppercase tracking-micro text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Metric</th>
                    <th className="px-4 py-3 text-right font-semibold">View A</th>
                    <th className="px-4 py-3 text-right font-semibold">View B</th>
                    <th className="px-4 py-3 text-right font-semibold">Difference</th>
                    <th className="px-4 py-3 text-right font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => {
                    const definition = REPORT_METRIC_MAP[metric];
                    const current = snapshotA.values[metric];
                    const comparison = snapshotB.values[metric];
                    return (
                      <tr key={metric} className="border-b border-rule last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{definition.label}</p>
                          <p className="mt-0.5 max-w-md text-label text-muted-foreground">{definition.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
                          {formatReportMetric(metric, current)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-muted-foreground">
                          {formatReportMetric(metric, comparison)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatReportMetric(metric, current - comparison)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DeltaText delta={metricDelta(metric, current, comparison, '')} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const REPORTS_TABS: SectionTab<ReportsTab>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'compare', label: 'Compare', icon: GitCompareArrows },
  { value: 'library', label: 'Library', icon: LibraryBig },
];

/** Each tab is its own route, so a report view can be linked to and bookmarked. */
const TAB_PATH: Record<ReportsTab, string> = {
  overview: '/reports',
  compare: '/reports/compare',
  library: '/reports/library',
};

export function ReportsWorkspace({ tab = 'overview' }: { tab?: ReportsTab }) {
  const router = useRouter();
  const { locationId } = useWorkspaceStore();
  const locationsQuery = useQuery({ queryKey: ['locations-accessible'], queryFn: getLocations });
  const locations = locationsQuery.data ?? [];
  const selectedLocation = locations.find((location) => location.id === locationId);
  const activeLocationId = selectedLocation?.id ?? null;
  const timeZone = selectedLocation?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';
  const selectedLocationName = selectedLocation?.name ?? 'All accessible locations';

  // Overview period — lifted here so the picker can live in the page header.
  const [preset, setPreset] = useState<PeriodPreset>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const overviewDates = useMemo(
    () => (preset === 'custom' ? { from: customFrom, to: customTo } : trailingDateRange(Number(preset), timeZone)),
    [preset, customFrom, customTo, timeZone],
  );
  const changePreset = (value: string) => {
    if (value === 'custom') {
      // Seed the custom inputs from the range currently shown so it stays valid.
      setCustomFrom(overviewDates.from);
      setCustomTo(overviewDates.to);
    }
    setPreset(value as PeriodPreset);
  };

  return (
    <EditorShell
      eyebrow="Business intelligence"
      title="Reports"
      icon={<BarChart3 size={20} aria-hidden="true" />}
      actions={
        tab === 'overview' ? (
          <div>
            <PeriodSelector
              preset={preset}
              dates={overviewDates}
              onPresetChange={changePreset}
              onCustomChange={(from, to) => {
                setCustomFrom(from);
                setCustomTo(to);
              }}
            />
          </div>
        ) : undefined
      }
      subheader={
        <SectionTabs tabs={REPORTS_TABS} value={tab} onChange={(next) => router.push(TAB_PATH[next])} ariaLabel="Reports sections" />
      }
    >
      {locationsQuery.isError ? (
        <div className={panel}>
          <ErrorBlock onRetry={() => void locationsQuery.refetch()} />
        </div>
      ) : locationsQuery.isPending ? (
        <LoadingBlock className="h-96" />
      ) : tab === 'overview' ? (
        <ReportsOverview
          dates={overviewDates}
          timeZone={timeZone}
          activeLocationId={activeLocationId}
          selectedLocationName={selectedLocationName}
        />
      ) : tab === 'compare' ? (
        <ComparisonWorkspace locations={locations} timeZone={timeZone} initialLocationId={activeLocationId} />
      ) : (
        <ReportLibrary />
      )}
    </EditorShell>
  );
}

/** Every report area in one place — the way into the deeper reports. */
function ReportLibrary() {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Report library</h2>
        <p className="mt-1 text-xs text-muted-foreground">Current and planned business intelligence areas, separated by data readiness.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reportPacks.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-sm bg-band text-primary">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-1 text-micro font-semibold uppercase tracking-micro',
                    item.status === 'Available'
                      ? 'bg-success-highlight text-success'
                      : item.status === 'Partial'
                        ? 'bg-warning-highlight text-warning'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {item.status}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </>
          );
          return item.href ? (
            <Link
              key={item.title}
              href={item.href}
              className={cn(panel, 'group p-4 transition-colors hover:border-primary/35 hover:bg-surface')}
            >
              {content}
            </Link>
          ) : (
            <div key={item.title} className={cn(panel, 'p-4')}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
