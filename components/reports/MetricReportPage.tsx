'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { ReceiptText, ShoppingBag, TrendingDown, TrendingUp, Users, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

import {
  type DailyOrderAnalytics,
  getCustomerRetention,
  getOrderAnalytics,
  getRevenueByLocation,
  getTopItems,
} from '@/lib/api/analytics.service';
import { getOrders } from '@/lib/api/orders.service';
import { getLocations } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { type DashboardRange, formatCompact, formatMoney, getDateWindow, orderMetrics, percentageChange } from '@/lib/utils/dashboard';
import { type MetricKey, buildMetricDetail } from '@/lib/utils/reports';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const METRIC_ICON = { revenue: WalletCards, orders: ShoppingBag, average: ReceiptText, retention: Users } as const;
const panel = 'rounded-2xl border border-border bg-card';

// ── Small line/area chart with optional previous-period overlay ──────────────────
const CW = 640;
const CH = 150;

function buildPath(values: number[], max: number) {
  const n = values.length;
  if (n === 0) return { line: '', area: '' };
  const x = (i: number) => (n === 1 ? CW / 2 : (i / (n - 1)) * CW);
  const y = (v: number) => CH - (max <= 0 ? 0 : (v / max) * (CH - 6)) - 3;
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = n > 1 ? `${line} L${CW},${CH} L0,${CH} Z` : '';
  return { line, area };
}

function TrendChart({
  current,
  previous,
  labels,
  format,
  showPrevious,
}: {
  current: number[];
  previous: number[];
  labels: string[];
  format: (v: number) => string;
  showPrevious: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...current, ...(showPrevious ? previous : []));
  const cur = buildPath(current, max);
  const prev = buildPath(previous, max);
  const active = hover ?? current.length - 1;
  const curVal = current[active] ?? 0;
  const prevVal = previous[active];

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{labels[active] ?? '—'}</p>
          <p className="text-lg font-bold tabular-nums text-foreground">{format(curVal)}</p>
        </div>
        {showPrevious && prevVal !== undefined && (
          <p className="text-xs text-muted-foreground">
            Prev: <span className="font-semibold tabular-nums text-foreground">{format(prevVal)}</span>
          </p>
        )}
      </div>
      <svg
        viewBox={`0 0 ${CW} ${CH}`}
        preserveAspectRatio="none"
        className="h-40 w-full text-primary"
        role="img"
        aria-label="Trend chart"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          setHover(Math.max(0, Math.min(current.length - 1, Math.round(pct * (current.length - 1)))));
        }}
      >
        <defs>
          <linearGradient id="metric-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {showPrevious && prev.line && (
          <path
            d={prev.line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            className="text-muted-foreground/60"
          />
        )}
        {cur.area && <path d={cur.area} fill="url(#metric-area)" />}
        {cur.line && <path d={cur.line} fill="none" stroke="currentColor" strokeWidth={2} />}
      </svg>
    </div>
  );
}

function ChangeBadge({ change, label, points }: { change: number | null | undefined; label: string; points?: boolean }) {
  if (change === undefined) return <span className="text-xs font-medium text-warning">Comparison unavailable</span>;
  if (change === null) return <span className="text-xs font-medium text-muted-foreground">New {label}</span>;
  const up = change >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        up ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive',
      )}
    >
      {up ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
      {up ? '+' : ''}
      {change.toFixed(1)}
      {points ? ' pts' : '%'} {label}
    </span>
  );
}

export function MetricReportPage({ metric }: { metric: MetricKey }) {
  const router = useRouter();
  const { locationId, setLocationId } = useWorkspaceStore();
  const [range, setRange] = useState<DashboardRange>('30d');
  const [showPrevious, setShowPrevious] = useState(true);

  const locationsQuery = useQuery({ queryKey: ['locations-accessible'], queryFn: getLocations });
  const locations = locationsQuery.data ?? [];
  const selectedLocation = locations.find((l) => l.id === locationId);
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

  const currentOrders = useQuery({
    queryKey: ['analytics-orders', range, scopeKey, timeZone],
    queryFn: () => getOrderAnalytics(currentParams()),
    enabled: ready,
  });
  const previousOrders = useQuery({
    queryKey: ['analytics-orders-previous', range, scopeKey, timeZone],
    queryFn: () => getOrderAnalytics(previousParams()),
    enabled: ready,
  });
  const retention = useQuery({
    queryKey: ['analytics-retention', range, scopeKey, timeZone],
    queryFn: () => getCustomerRetention(currentParams()),
    enabled: ready && metric === 'retention',
  });
  const previousRetention = useQuery({
    queryKey: ['analytics-retention-previous', range, scopeKey, timeZone],
    queryFn: () => getCustomerRetention(previousParams()),
    enabled: ready && metric === 'retention',
  });
  const byLocation = useQuery({
    queryKey: ['analytics-locations', range, scopeKey, timeZone],
    queryFn: () => getRevenueByLocation(currentParams()),
    enabled: ready && !activeLocationId && metric !== 'retention',
  });
  const topItems = useQuery({
    queryKey: ['analytics-top-items', range, scopeKey, timeZone, 'metric'],
    queryFn: () => getTopItems(currentParams(), 8),
    enabled: ready && (metric === 'revenue' || metric === 'orders'),
  });
  const liveOrderQueries = useQueries({
    queries: (['pending', 'preparing', 'ready'] as const).map((status) => ({
      queryKey: ['orders-live-dashboard', status, scopeKey],
      queryFn: () => getOrders({ status, limit: 10, locationId: activeLocationId ?? undefined }),
      enabled: ready && metric === 'orders',
    })),
  });
  const liveOrders = liveOrderQueries.reduce((total, q) => total + (q.data?.total ?? 0), 0);

  const current = orderMetrics(currentOrders.data);
  const previous = orderMetrics(previousOrders.data);
  const comparisonAvailable = metric === 'retention' ? previousRetention.isSuccess : previousOrders.isSuccess;

  const detail = buildMetricDetail({
    metric,
    current,
    previous,
    analytics: currentOrders.data,
    retention: retention.data,
    previousRetention: previousRetention.data,
    comparisonAvailable,
    liveOrders,
    periodLabel: window.label,
    comparisonLabel: window.comparisonLabel,
  });

  // Headline change (percentage for money/count, points for retention rate).
  const headlineChange =
    metric === 'retention'
      ? comparisonAvailable
        ? (retention.data?.repeatRate ?? 0) - (previousRetention.data?.repeatRate ?? 0)
        : undefined
      : comparisonAvailable
        ? percentageChange(
            metric === 'revenue' ? current.revenue : metric === 'orders' ? current.orders : current.averageOrderValue,
            metric === 'revenue' ? previous.revenue : metric === 'orders' ? previous.orders : previous.averageOrderValue,
          )
        : undefined;

  // Daily series for the trend chart (retention has no daily series).
  const dailyValue = (row: DailyOrderAnalytics) =>
    metric === 'orders'
      ? row.count
      : metric === 'average'
        ? row.count
          ? Number(row.revenue ?? 0) / row.count
          : 0
        : Number(row.revenue ?? 0);
  const currentDaily = (currentOrders.data?.daily ?? []).map(dailyValue);
  const previousDaily = (previousOrders.data?.daily ?? []).map(dailyValue);
  const dayLabels = (currentOrders.data?.daily ?? []).map((r) =>
    new Date(`${r.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  );
  const chartFormat = (v: number) => (metric === 'orders' ? formatCompact(v) : formatMoney(v, metric === 'average' ? 2 : 0));

  // Location comparison (only org-wide scope, money/count metrics).
  const locationValue = (r: { totalRevenue: string | null; orderCount: number }) =>
    metric === 'orders'
      ? r.orderCount
      : metric === 'average'
        ? r.orderCount
          ? Number(r.totalRevenue ?? 0) / r.orderCount
          : 0
        : Number(r.totalRevenue ?? 0);
  const locationRows = [...(byLocation.data ?? [])].sort((a, b) => locationValue(b) - locationValue(a));
  const locationMax = Math.max(1, ...locationRows.map(locationValue));
  const showLocationCompare = !activeLocationId && metric !== 'retention' && locationRows.length > 0;

  const Icon = METRIC_ICON[metric];
  const loading = locationsQuery.isPending || currentOrders.isPending || (metric === 'retention' && retention.isPending);

  const header = <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />;

  return (
    <EditorShell eyebrow="Report" title={detail.title} icon={<Icon size={20} aria-hidden="true" />} onClose={() => router.push('/reports')}>
      <div className="space-y-4">
        {header}

        {/* Hero */}
        <section className={cn(panel, 'p-5 md:p-6')}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{detail.description}</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-foreground">{loading ? '—' : detail.headline}</p>
            <ChangeBadge change={headlineChange} label={window.comparisonLabel} points={metric === 'retention'} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedLocation?.name ?? 'All accessible locations'} · {window.label}
          </p>

          {metric !== 'retention' && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trend</h2>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showPrevious}
                    onChange={(e) => setShowPrevious(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  Compare to previous period
                </label>
              </div>
              {currentDaily.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No activity in this period.</p>
              ) : (
                <TrendChart
                  current={currentDaily}
                  previous={previousDaily}
                  labels={dayLabels}
                  format={chartFormat}
                  showPrevious={showPrevious}
                />
              )}
            </div>
          )}
        </section>

        {/* Stat tiles */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {detail.values.map((item) => (
            <div key={item.label} className={cn(panel, 'p-4')}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">{loading ? '—' : item.value}</p>
              {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
            </div>
          ))}
        </section>

        {/* Breakdown + location comparison */}
        <section className={cn('grid gap-4', showLocationCompare && 'xl:grid-cols-2')}>
          {detail.breakdown.length > 0 && (
            <div className={cn(panel, 'p-5')}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Breakdown</h2>
              <div className="mt-3 space-y-2">
                {detail.breakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl bg-muted/45 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize text-foreground">{item.label}</p>
                      {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showLocationCompare && (
            <div className={cn(panel, 'p-5')}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Compare locations</h2>
              <div className="mt-3 space-y-2.5">
                {locationRows.map((row) => {
                  const value = locationValue(row);
                  return (
                    <button
                      key={row.locationId}
                      type="button"
                      onClick={() => setLocationId(row.locationId)}
                      className="block w-full rounded-xl px-1 py-1 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-foreground">{row.locationName ?? 'Unknown location'}</span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                          {metric === 'orders' ? formatCompact(value) : formatMoney(value, metric === 'average' ? 2 : 0)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(value / locationMax) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{row.orderCount} orders</p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">Select a location to scope this report to it.</p>
            </div>
          )}
        </section>

        {/* Top items (revenue/orders only) */}
        {(metric === 'revenue' || metric === 'orders') && (topItems.data?.length ?? 0) > 0 && (
          <section className={cn(panel, 'p-5')}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top items</h2>
            <div className="mt-3 divide-y divide-border/60">
              {(topItems.data ?? []).map((item, i) => (
                <div key={item.menuItemId} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {metric === 'orders'
                      ? `${formatCompact(Number(item.totalQuantity ?? 0))} sold`
                      : formatMoney(Number(item.totalRevenue ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Definition */}
        <p className={cn(panel, 'p-4 text-xs text-muted-foreground')}>
          <span className="font-semibold text-foreground">How this is calculated:</span> {detail.definition}
        </p>
      </div>
    </EditorShell>
  );
}
