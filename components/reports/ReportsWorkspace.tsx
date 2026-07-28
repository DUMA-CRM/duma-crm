'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarRange,
  ChevronRight,
  CircleDollarSign,
  Download,
  FlaskConical,
  GitCompareArrows,
  Info,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import {
  type HourlyVolume,
  type RevenueByLocation,
  type TopItemAnalytics,
  getCustomerRetention,
  getHourlyVolume,
  getOrderAnalytics,
  getRevenueByLocation,
  getTopItems,
} from '@/lib/api/analytics.service';
import { getLocations } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import {
  REPORT_METRICS,
  REPORT_METRIC_MAP,
  type ReportMetricKey,
  buildReportSnapshot,
  formatReportMetric,
  metricChange,
  metricChangeLabel,
  previousDateRange,
  previousYearDateRange,
  reportDateRange,
  shortDateLabel,
  trailingDateRange,
} from '@/lib/utils/reporting';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ComparisonChart } from './ComparisonChart';

type WorkspaceView = 'overview' | 'compare';
type ComparisonMode = 'previous' | 'previous-year' | 'custom';

const panel = 'rounded-2xl border border-border bg-card';
const inputClass =
  'h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

function LoadingBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} aria-hidden="true" />;
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

function ChangePill({
  metric,
  current,
  comparison,
  comparisonText = 'vs previous period',
}: {
  metric: ReportMetricKey;
  current: number;
  comparison: number;
  comparisonText?: string;
}) {
  const change = metricChange(metric, current, comparison);
  const lowerIsBetter = REPORT_METRIC_MAP[metric].lowerIsBetter;
  const favourable = change !== null && (lowerIsBetter ? change <= 0 : change >= 0);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-semibold',
        change === null ? 'text-muted-foreground' : favourable ? 'text-success' : 'text-destructive',
      )}
    >
      {change !== null && (change >= 0 ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />)}
      {metricChangeLabel(metric, change)} {comparisonText}
    </span>
  );
}

function MetricCard({
  metric,
  current,
  comparison,
  href,
  loading,
}: {
  metric: ReportMetricKey;
  current: number;
  comparison: number;
  href?: string;
  loading: boolean;
}) {
  const definition = REPORT_METRIC_MAP[metric];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{definition.label}</p>
        {href && <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" />}
      </div>
      {loading ? (
        <div className="mt-4 space-y-3">
          <LoadingBlock className="h-8 w-28" />
          <LoadingBlock className="h-3 w-36" />
        </div>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-foreground">{formatReportMetric(metric, current)}</p>
          <div className="mt-2">
            <ChangePill metric={metric} current={current} comparison={comparison} />
          </div>
        </>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{definition.description}</p>
    </>
  );

  const className = cn(panel, 'min-h-40 p-4', href && 'group transition-colors hover:border-primary/35 hover:bg-surface');
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
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

function HourlyHeatmap({ rows, loading }: { rows: HourlyVolume[]; loading: boolean }) {
  if (loading) return <LoadingBlock className="mt-5 h-40" />;
  const hours = Array.from(
    { length: 24 },
    (_, hour) => rows.find((row) => row.hour === hour) ?? { hour, orderCount: 0, totalRevenue: '0' },
  );
  const max = Math.max(...hours.map((row) => row.orderCount), 1);
  const peak = hours.reduce((best, row) => (row.orderCount > best.orderCount ? row : best), hours[0]);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
        {hours.map((row) => {
          const strength = row.orderCount / max;
          return (
            <div
              key={row.hour}
              className="flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg border border-primary/10 text-center"
              style={{ backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(8 + strength * 72)}%, var(--card))` }}
              title={`${String(row.hour).padStart(2, '0')}:00 — ${row.orderCount} orders`}
            >
              <span className={cn('text-[10px] font-semibold', strength > 0.55 ? 'text-primary-foreground' : 'text-foreground')}>
                {String(row.hour).padStart(2, '0')}
              </span>
              <span className={cn('text-[9px]', strength > 0.55 ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {row.orderCount}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Peak hour: <span className="font-semibold text-foreground">{String(peak.hour).padStart(2, '0')}:00</span> with{' '}
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
      <table className="w-full min-w-120 text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 font-semibold">Item</th>
            <th className="pb-2 text-right font-semibold">Units</th>
            <th className="pb-2 text-right font-semibold">Orders</th>
            <th className="pb-2 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const revenue = Number(row.totalRevenue ?? 0);
            return (
              <tr key={`${row.menuItemId}-${row.name}`} className="border-b border-border/60 last:border-0">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-xs font-bold text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{row.name}</p>
                      <div className="mt-1 h-1 max-w-40 overflow-hidden rounded-full bg-surface-offset">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(revenue / maxRevenue) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">{Number(row.totalQuantity ?? 0).toLocaleString()}</td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">{row.orderCount.toLocaleString()}</td>
                <td className="py-3 text-right font-semibold tabular-nums text-foreground">{formatReportMetric('netRevenue', revenue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LocationTable({ rows, loading }: { rows: RevenueByLocation[]; loading: boolean }) {
  if (loading) return <LoadingBlock className="mt-5 h-52" />;
  if (!rows.length) return <p className="py-12 text-center text-sm text-muted-foreground">Select “all locations” to compare sites.</p>;
  const sorted = [...rows].sort((a, b) => Number(b.totalRevenue ?? 0) - Number(a.totalRevenue ?? 0));
  const total = sorted.reduce((sum, row) => sum + Number(row.totalRevenue ?? 0), 0);

  return (
    <div className="mt-4 space-y-2">
      {sorted.map((row, index) => {
        const revenue = Number(row.totalRevenue ?? 0);
        return (
          <div key={row.locationId} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-3">
            <span className="w-5 text-xs font-bold text-muted-foreground">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{row.locationName ?? 'Unknown location'}</p>
              <p className="text-[11px] text-muted-foreground">
                {row.orderCount} orders · {total ? ((revenue / total) * 100).toFixed(1) : '0.0'}% of revenue
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-foreground">{formatReportMetric('netRevenue', revenue)}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {formatReportMetric('averageOrderValue', row.orderCount ? revenue / row.orderCount : 0)} avg
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const reportPacks = [
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
];

function ReportsOverview({
  timeZone,
  activeLocationId,
  selectedLocationName,
  onOpenCompare,
}: {
  timeZone: string;
  activeLocationId: string | null;
  selectedLocationName: string;
  onOpenCompare: () => void;
}) {
  const [days, setDays] = useState(30);
  const dates = useMemo(() => trailingDateRange(days, timeZone), [days, timeZone]);
  const previousDates = useMemo(() => previousDateRange(dates.from, dates.to), [dates]);
  const currentRange = useMemo(() => reportDateRange(dates.from, dates.to, timeZone), [dates, timeZone]);
  const comparisonRange = useMemo(() => reportDateRange(previousDates.from, previousDates.to, timeZone), [previousDates, timeZone]);
  const scope = activeLocationId ?? 'all';
  const scoped = (range: { from: string; to: string }) => ({ ...range, ...(activeLocationId ? { locationId: activeLocationId } : {}) });

  const currentOrders = useQuery({
    queryKey: ['reports-overview-orders', dates.from, dates.to, scope, timeZone],
    queryFn: () => getOrderAnalytics(scoped(currentRange)),
  });
  const comparisonOrders = useQuery({
    queryKey: ['reports-overview-orders-comparison', previousDates.from, previousDates.to, scope, timeZone],
    queryFn: () => getOrderAnalytics(scoped(comparisonRange)),
  });
  const currentRetention = useQuery({
    queryKey: ['reports-overview-retention', dates.from, dates.to, scope, timeZone],
    queryFn: () => getCustomerRetention(scoped(currentRange)),
  });
  const comparisonRetention = useQuery({
    queryKey: ['reports-overview-retention-comparison', previousDates.from, previousDates.to, scope, timeZone],
    queryFn: () => getCustomerRetention(scoped(comparisonRange)),
  });
  const topItems = useQuery({
    queryKey: ['reports-overview-top-items', dates.from, dates.to, scope, timeZone],
    queryFn: () => getTopItems(scoped(currentRange), 10),
  });
  const hourly = useQuery({
    queryKey: ['reports-overview-hourly', dates.from, dates.to, scope, timeZone],
    queryFn: () => getHourlyVolume(scoped(currentRange)),
  });
  const locations = useQuery({
    queryKey: ['reports-overview-locations', dates.from, dates.to, timeZone],
    queryFn: () => getRevenueByLocation(currentRange),
    enabled: !activeLocationId,
  });

  const current = buildReportSnapshot(currentOrders.data, currentRetention.data);
  const comparison = buildReportSnapshot(comparisonOrders.data, comparisonRetention.data);
  const coreLoading = currentOrders.isPending || comparisonOrders.isPending || currentRetention.isPending || comparisonRetention.isPending;
  const coreError = currentOrders.isError || comparisonOrders.isError || currentRetention.isError || comparisonRetention.isError;
  const retry = () => {
    void currentOrders.refetch();
    void comparisonOrders.refetch();
    void currentRetention.refetch();
    void comparisonRetention.refetch();
  };

  if (coreError)
    return (
      <div className={panel}>
        <ErrorBlock onRetry={retry} />
      </div>
    );

  return (
    <>
      <section
        className={cn(
          panel,
          'overflow-hidden bg-[linear-gradient(135deg,var(--card),color-mix(in_oklab,var(--primary)_8%,var(--card)))] p-5 md:p-6',
        )}
      >
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles size={15} aria-hidden="true" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Business intelligence</p>
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Understand what changed, where, and why.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Detailed trading, customer and operational analysis for {selectedLocationName.toLowerCase()}. Compare any supported metric
              across periods or locations.
            </p>
          </div>
          <Button size="lg" onClick={onOpenCompare} className="shrink-0">
            <GitCompareArrows size={17} /> Create comparison
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-card p-1" aria-label="Report period">
          {[7, 30, 90].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                days === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {option} days
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {shortDateLabel(dates.from)}–{shortDateLabel(dates.to)} · {selectedLocationName}
        </p>
      </div>

      <section aria-label="Key performance metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          metric="netRevenue"
          current={current.values.netRevenue}
          comparison={comparison.values.netRevenue}
          href="/reports/revenue"
          loading={coreLoading}
        />
        <MetricCard
          metric="orders"
          current={current.values.orders}
          comparison={comparison.values.orders}
          href="/reports/orders"
          loading={coreLoading}
        />
        <MetricCard
          metric="averageOrderValue"
          current={current.values.averageOrderValue}
          comparison={comparison.values.averageOrderValue}
          href="/reports/average"
          loading={coreLoading}
        />
        <MetricCard
          metric="repeatRate"
          current={current.values.repeatRate}
          comparison={comparison.values.repeatRate}
          href="/reports/retention"
          loading={coreLoading}
        />
        <MetricCard
          metric="completionRate"
          current={current.values.completionRate}
          comparison={comparison.values.completionRate}
          loading={coreLoading}
        />
        <MetricCard
          metric="cancellationRate"
          current={current.values.cancellationRate}
          comparison={comparison.values.cancellationRate}
          loading={coreLoading}
        />
        <MetricCard
          metric="newCustomers"
          current={current.values.newCustomers}
          comparison={comparison.values.newCustomers}
          loading={coreLoading}
        />
        <MetricCard
          metric="returningCustomers"
          current={current.values.returningCustomers}
          comparison={comparison.values.returningCustomers}
          loading={coreLoading}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className={cn(panel, 'p-5')}>
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
        <div className={cn(panel, 'p-5')}>
          <PanelTitle title="Channel mix" description="Recorded order volume and value by order source" />
          <div className="mt-5 space-y-3">
            {[
              { label: 'POS', orders: current.values.posOrders, value: current.values.posValue, colour: 'bg-primary' },
              { label: 'Mobile', orders: current.values.mobileOrders, value: current.values.mobileValue, colour: 'bg-info' },
            ].map((source) => {
              const totalOrders = current.values.posOrders + current.values.mobileOrders;
              const share = totalOrders ? (source.orders / totalOrders) * 100 : 0;
              return (
                <div key={source.label} className="rounded-xl bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{source.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{source.orders.toLocaleString()} orders</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-foreground">{formatReportMetric('posValue', source.value)}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">{share.toFixed(1)}% share</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-offset">
                    <div className={cn('h-full rounded-full', source.colour)} style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Channel value is reported before the headline cancellation adjustment because the current API does not cross-break down status
            and source.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={cn(panel, 'p-5')}>
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
        <div className={cn(panel, 'p-5')}>
          <PanelTitle title="Demand by hour" description="Order concentration across the selected period" />
          {hourly.isError ? (
            <ErrorBlock onRetry={() => void hourly.refetch()} />
          ) : (
            <HourlyHeatmap rows={hourly.data ?? []} loading={hourly.isPending} />
          )}
        </div>
      </section>

      <section className={cn(panel, 'p-5')}>
        <PanelTitle title="Location performance" description="Revenue share, order volume and average order value" />
        {locations.isError ? (
          <ErrorBlock onRetry={() => void locations.refetch()} />
        ) : (
          <LocationTable rows={locations.data ?? []} loading={locations.isPending && !activeLocationId} />
        )}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Report library</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Current and planned business intelligence areas, separated by data readiness.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reportPacks.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide',
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
    </>
  );
}

function MetricPicker({ selected, onToggle }: { selected: ReportMetricKey[]; onToggle: (metric: ReportMetricKey) => void }) {
  const categories = ['Sales', 'Operations', 'Customers', 'Channels'] as const;
  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <fieldset key={category}>
          <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{category}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REPORT_METRICS.filter((metric) => metric.category === category).map((metric) => (
              <label
                key={metric.key}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
                  selected.includes(metric.key) ? 'border-primary/35 bg-primary/5' : 'border-border bg-background hover:bg-muted/40',
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
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{metric.description}</span>
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
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={cn(panel, 'self-start p-4 xl:sticky xl:top-0')}>
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Comparison builder</h2>
            <p className="text-[11px] text-muted-foreground">Configure two independent business views.</p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <fieldset>
            <legend className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">View A</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => applyPreset(days)}
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
                >
                  Last {days}d
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[10px] font-semibold text-muted-foreground">
                From
                <input
                  type="date"
                  value={fromA}
                  max={toA}
                  onChange={(event) => setFromA(event.target.value)}
                  className={cn(inputClass, 'mt-1 w-full')}
                />
              </label>
              <label className="text-[10px] font-semibold text-muted-foreground">
                To
                <input
                  type="date"
                  value={toA}
                  min={fromA}
                  onChange={(event) => setToA(event.target.value)}
                  className={cn(inputClass, 'mt-1 w-full')}
                />
              </label>
            </div>
            <Select
              value={locationA}
              onValueChange={setLocationA}
              options={locationOptions}
              ariaLabel="View A location"
              className="mt-2 w-full"
            />
          </fieldset>

          <fieldset>
            <legend className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">View B</legend>
            <Select
              value={comparisonMode}
              onValueChange={(value) => setComparisonMode(value as ComparisonMode)}
              options={[
                { value: 'previous', label: 'Previous equivalent period' },
                { value: 'previous-year', label: 'Same dates last year' },
                { value: 'custom', label: 'Custom period' },
              ]}
              ariaLabel="Comparison period"
              className="mt-2 w-full"
            />
            {comparisonMode === 'custom' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold text-muted-foreground">
                  From
                  <input
                    type="date"
                    value={fromB}
                    max={toB}
                    onChange={(event) => setFromB(event.target.value)}
                    className={cn(inputClass, 'mt-1 w-full')}
                  />
                </label>
                <label className="text-[10px] font-semibold text-muted-foreground">
                  To
                  <input
                    type="date"
                    value={toB}
                    min={fromB}
                    onChange={(event) => setToB(event.target.value)}
                    className={cn(inputClass, 'mt-1 w-full')}
                  />
                </label>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {shortDateLabel(effectiveB.from)}–{shortDateLabel(effectiveB.to)}
            </p>
            <Select
              value={locationB}
              onValueChange={setLocationB}
              options={locationOptions}
              ariaLabel="View B location"
              className="mt-2 w-full"
            />
          </fieldset>

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-foreground">
              Metrics <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{metrics.length} selected</span>
            </summary>
            <div className="mt-3 max-h-[34rem] overflow-y-auto pr-1">
              <MetricPicker selected={metrics} onToggle={toggleMetric} />
            </div>
          </details>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <section className={cn(panel, 'p-4')}>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Custom comparison</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">View A against View B</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                Date boundaries use {timeZone}. Percentage metrics show percentage-point differences; all other metrics show relative
                change.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-lg border border-border bg-background p-1">
                {(['charts', 'table'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setVisual(option)}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-semibold capitalize',
                      visual === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
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
            <div className="rounded-xl border-l-4 border-primary bg-primary/5 px-3 py-2">
              <span className="font-bold text-primary">A</span> <span className="text-muted-foreground">{labelA}</span>
            </div>
            <div className="rounded-xl border-l-4 border-info bg-info/5 px-3 py-2">
              <span className="font-bold text-info">B</span> <span className="text-muted-foreground">{labelB}</span>
            </div>
          </div>
        </section>

        {!validA || !validB ? (
          <div className={cn(panel, 'p-8 text-center text-sm text-destructive')}>Choose valid start and end dates for both views.</div>
        ) : error ? (
          <div className={panel}>
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
          <div className={cn(panel, 'p-12 text-center')}>
            <BarChart3 className="mx-auto text-muted-foreground" size={28} />
            <p className="mt-3 text-sm font-semibold text-foreground">Select at least one metric</p>
            <p className="mt-1 text-xs text-muted-foreground">Open Metrics in the builder to choose what to compare.</p>
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
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{definition.description}</p>
                    </div>
                    <span title={definition.description} className="text-muted-foreground">
                      <Info size={14} aria-hidden="true" />
                    </span>
                  </div>
                  {loading ? (
                    <LoadingBlock className="mt-5 h-56" />
                  ) : (
                    <>
                      <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
                        <p className="text-2xl font-bold tabular-nums text-foreground">{formatReportMetric(metric, current)}</p>
                        <ChangePill metric={metric} current={current} comparison={comparison} comparisonText="A vs B" />
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
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
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
                    const change = metricChange(metric, current, comparison);
                    const lowerIsBetter = definition.lowerIsBetter;
                    const favourable = change !== null && (lowerIsBetter ? change <= 0 : change >= 0);
                    return (
                      <tr key={metric} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{definition.label}</p>
                          <p className="mt-0.5 max-w-md text-[11px] text-muted-foreground">{definition.description}</p>
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
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-bold tabular-nums',
                            change === null ? 'text-muted-foreground' : favourable ? 'text-success' : 'text-destructive',
                          )}
                        >
                          {metricChangeLabel(metric, change)}
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

export function ReportsWorkspace() {
  const [view, setView] = useState<WorkspaceView>('overview');
  const { locationId } = useWorkspaceStore();
  const locationsQuery = useQuery({ queryKey: ['locations-accessible'], queryFn: getLocations });
  const locations = locationsQuery.data ?? [];
  const selectedLocation = locations.find((location) => location.id === locationId);
  const activeLocationId = selectedLocation?.id ?? null;
  const timeZone = selectedLocation?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';
  const selectedLocationName = selectedLocation?.name ?? 'All accessible locations';

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Reports view">
        {[
          { value: 'overview' as const, label: 'Overview', icon: BarChart3 },
          { value: 'compare' as const, label: 'Explore & compare', icon: GitCompareArrows },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={view === item.value}
              onClick={() => setView(item.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                view === item.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon size={14} aria-hidden="true" /> {item.label}
            </button>
          );
        })}
      </div>
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarRange size={13} aria-hidden="true" /> {selectedLocationName} · {timeZone}
      </p>
    </div>
  );

  return (
    <PageLayout eyebrow="Business intelligence" title="Reports" headerSlot={header}>
      {locationsQuery.isError ? (
        <div className={panel}>
          <ErrorBlock onRetry={() => void locationsQuery.refetch()} />
        </div>
      ) : locationsQuery.isPending ? (
        <LoadingBlock className="h-96" />
      ) : view === 'overview' ? (
        <ReportsOverview
          timeZone={timeZone}
          activeLocationId={activeLocationId}
          selectedLocationName={selectedLocationName}
          onOpenCompare={() => setView('compare')}
        />
      ) : (
        <ComparisonWorkspace locations={locations} timeZone={timeZone} initialLocationId={activeLocationId} />
      )}
    </PageLayout>
  );
}
