'use client';

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Coffee,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

import {
  type DailyOrderAnalytics,
  type HourlyVolume,
  type RevenueByLocation,
  type TopItemAnalytics,
  getCustomerRetention,
  getHourlyVolume,
  getOrderAnalytics,
  getRevenueByLocation,
  getTopItems,
} from '@/lib/api/analytics.service';
import { getInventoryForecast } from '@/lib/api/inventory.service';
import { getOrders } from '@/lib/api/orders.service';
import { decodeNotes, getRestockRequests } from '@/lib/api/restock.service';
import { getActiveShifts } from '@/lib/api/shifts.service';
import type { StaffRole } from '@/lib/api/staff.service';
import { getLocations } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { type DashboardRange, formatCompact, formatMoney, getDateWindow, orderMetrics, percentageChange } from '@/lib/utils/dashboard';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type DashboardMode = 'dashboard' | 'reports';

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const panelClass =
  'rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_5%,transparent),0_10px_32px_color-mix(in_oklab,var(--foreground)_3%,transparent)]';

function DashboardSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} aria-hidden="true" />;
}

function PanelHeader({
  title,
  description,
  href,
  hrefLabel = 'View details',
  badge,
}: {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {badge && (
            <span className="rounded-full border border-border bg-muted/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {hrefLabel}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function ChangeBadge({ change, label, points = false }: { change: number | null | undefined; label: string; points?: boolean }) {
  if (change === undefined)
    return <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">No comparison</span>;
  if (change === null) return <span className="rounded-full bg-info/10 px-2 py-1 text-[10px] font-semibold text-info">New {label}</span>;
  const improving = change >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold',
        improving ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
      )}
    >
      {improving ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
      {Math.abs(change).toFixed(1)}
      {points ? ' pts' : '%'} {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  change,
  comparisonLabel,
  icon: Icon,
  href,
  onSelect,
  loading,
  points,
  selected,
  tone = 'bg-primary/10 text-primary',
}: {
  label: string;
  value: string;
  hint: string;
  change: number | null | undefined;
  comparisonLabel: string;
  icon: typeof WalletCards;
  href?: string;
  onSelect?: () => void;
  loading: boolean;
  points?: boolean;
  selected?: boolean;
  tone?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <div className={cn('flex size-8 items-center justify-center rounded-lg', tone)}>
          <Icon size={15} strokeWidth={2.1} aria-hidden="true" />
        </div>
      </div>
      {loading ? (
        <div className="mt-4 space-y-3">
          <DashboardSkeleton className="h-8 w-28" />
          <DashboardSkeleton className="h-3 w-36" />
        </div>
      ) : (
        <>
          <p className="mt-4 text-[28px] font-bold leading-none tracking-[-0.04em] text-foreground tabular-nums">{value}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ChangeBadge change={change} label={comparisonLabel} points={points} />
            <span className="text-[11px] text-muted-foreground">{hint}</span>
          </div>
        </>
      )}
    </>
  );

  const className = cn(
    panelClass,
    'group min-h-36 p-4 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
    selected && 'border-primary bg-primary/5 ring-2 ring-primary/10',
  );
  const ariaLabel = `${label}: ${value}. ${hint}${onSelect ? '. Show detailed statistics' : ''}`;

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={className} aria-label={ariaLabel} aria-expanded={selected}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href ?? '#'} className={className} aria-label={ariaLabel}>
      {content}
    </Link>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
      <AlertTriangle size={22} className="text-destructive" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-foreground">This section could not be loaded</p>
        <p className="mt-1 text-xs text-muted-foreground">Your other dashboard data is still available.</p>
      </div>
      <button onClick={onRetry} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
        Try again
      </button>
    </div>
  );
}

function RevenueChart({ rows, loading }: { rows: DailyOrderAnalytics[]; loading: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  if (loading) return <DashboardSkeleton className="mt-6 h-56 w-full" />;
  if (rows.length === 0) {
    return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No order activity in this period.</div>;
  }

  const values = rows.map((row) => Number(row.revenue ?? 0));
  const max = Math.max(...values, 1);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const highlighted = active === null ? rows.length - 1 : active;
  const current = rows[highlighted];
  const dateLabel = new Date(`${current.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="mt-5">
      <div className="mb-5 flex min-h-12 flex-wrap items-end justify-between gap-4" aria-live="polite">
        <div className="flex items-end gap-3">
          <p className="text-2xl font-bold tracking-[-0.03em] text-foreground tabular-nums">{formatMoney(Number(current.revenue ?? 0))}</p>
          <p className="pb-0.5 text-xs text-muted-foreground">
            {dateLabel} · {current.count} orders
          </p>
        </div>
        <div className="rounded-lg bg-muted/65 px-3 py-1.5 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily average</p>
          <p className="text-xs font-semibold tabular-nums text-foreground">{formatMoney(average)}</p>
        </div>
      </div>
      <div className="flex h-44 gap-3">
        <div className="flex w-11 shrink-0 flex-col justify-between pb-1 text-right text-[9px] font-medium tabular-nums text-muted-foreground">
          <span>{formatCompact(max)}</span>
          <span>{formatCompact(max / 2)}</span>
          <span>£0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            <span className="border-t border-dashed border-border/70" />
            <span className="border-t border-dashed border-border/70" />
            <span className="border-t border-dashed border-border/70" />
          </div>
          <div className="relative flex h-full items-end gap-1 sm:gap-1.5" role="group" aria-label="Daily order value chart">
            {rows.map((row, index) => {
              const value = Number(row.revenue ?? 0);
              const selected = highlighted === index;
              const shortDate = new Date(`${row.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              return (
                <button
                  key={row.date}
                  type="button"
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => setActive(index)}
                  aria-label={`${shortDate}: ${formatMoney(value)}, ${row.count} orders`}
                  className="group flex h-full min-w-0 flex-1 items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    className={cn(
                      'w-full rounded-t-[5px] transition-[height,background-color,opacity] duration-300',
                      selected
                        ? 'bg-primary shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_15%,transparent)]'
                        : 'bg-primary/18 group-hover:bg-primary/45',
                    )}
                    style={{ height: `${value === 0 ? 2 : Math.max(7, (value / max) * 100)}%` }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 ml-14 flex justify-between text-[10px] font-medium text-muted-foreground">
        <span>{new Date(`${rows[0].date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        <span>{new Date(`${rows.at(-1)!.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
}

function TopItems({ rows, loading }: { rows: TopItemAnalytics[]; loading: boolean }) {
  if (loading)
    return (
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <DashboardSkeleton key={i} className="h-10" />
        ))}
      </div>
    );
  if (!rows.length) return <p className="py-12 text-center text-sm text-muted-foreground">No items sold in this period.</p>;
  const max = Math.max(...rows.map((row) => Number(row.totalQuantity ?? 0)), 1);
  return (
    <div className="mt-5 space-y-4">
      {rows.map((row, index) => {
        const quantity = Number(row.totalQuantity ?? 0);
        return (
          <div key={`${row.menuItemId}-${row.name}`}>
            <div className="mb-1.5 flex items-center gap-3">
              <span className="w-4 text-xs font-bold text-muted-foreground">{index + 1}</span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.name}</p>
              <p className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{quantity} sold</p>
            </div>
            <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-surface-offset">
              <div className="h-full rounded-full bg-primary/75" style={{ width: `${(quantity / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HourlyDemand({ rows, loading }: { rows: HourlyVolume[]; loading: boolean }) {
  if (loading) return <DashboardSkeleton className="mt-6 h-44" />;
  const complete = Array.from(
    { length: 24 },
    (_, hour) => rows.find((row) => row.hour === hour) ?? { hour, orderCount: 0, totalRevenue: '0' },
  );
  const max = Math.max(...complete.map((row) => row.orderCount), 1);
  const peak = complete.reduce((best, row) => (row.orderCount > best.orderCount ? row : best), complete[0]);
  return (
    <div className="mt-5">
      <div
        className="flex h-36 items-end gap-0.5"
        role="img"
        aria-label={`Hourly demand. Peak hour ${String(peak.hour).padStart(2, '0')}:00 with ${peak.orderCount} orders.`}
      >
        {complete.map((row) => (
          <div key={row.hour} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn('w-full rounded-t-sm', row.hour === peak.hour && peak.orderCount > 0 ? 'bg-info' : 'bg-surface-offset')}
              style={{ height: `${row.orderCount ? Math.max(5, (row.orderCount / max) * 100) : 2}%` }}
              title={`${String(row.hour).padStart(2, '0')}:00 — ${row.orderCount} orders`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Peak period:{' '}
        <span className="font-semibold text-foreground">
          {String(peak.hour).padStart(2, '0')}:00–{String((peak.hour + 1) % 24).padStart(2, '0')}:00
        </span>
      </p>
    </div>
  );
}

function LocationPerformance({ rows, loading }: { rows: RevenueByLocation[]; loading: boolean }) {
  if (loading)
    return (
      <div className="mt-5 space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <DashboardSkeleton key={i} className="h-12" />
        ))}
      </div>
    );
  if (!rows.length) return <p className="py-12 text-center text-sm text-muted-foreground">No location activity in this period.</p>;
  const columns: DataTableColumn<RevenueByLocation>[] = [
    {
      id: 'location',
      header: 'Location',
      minWidth: 180,
      cellClassName: 'font-medium',
      cell: ({ row, rowIndex }) => (
        <>
          <span className="mr-2 text-xs text-muted-foreground">{rowIndex + 1}</span>
          {row.locationName ?? 'Unknown location'}
        </>
      ),
    },
    {
      id: 'orders',
      header: 'Orders',
      align: 'right',
      width: 'fit',
      cellClassName: 'tabular-nums text-muted-foreground',
      cell: ({ row }) => row.orderCount,
    },
    {
      id: 'value',
      header: 'Order value',
      align: 'right',
      width: 'fit',
      cellClassName: 'font-semibold tabular-nums',
      cell: ({ row }) => formatMoney(Number(row.totalRevenue ?? 0)),
    },
    {
      id: 'average',
      header: 'Avg order',
      align: 'right',
      width: 'fit',
      cellClassName: 'tabular-nums text-muted-foreground',
      cell: ({ row }) => {
        const revenue = Number(row.totalRevenue ?? 0);
        return formatMoney(row.orderCount ? revenue / row.orderCount : 0, 2);
      },
    },
  ];

  return (
    <DataTable
      aria-label="Location performance"
      className="mt-4"
      data={rows}
      columns={columns}
      getRowKey={(row) => row.locationId}
      minWidth={480}
      density="compact"
      borders={{ outer: false }}
    />
  );
}

export function ManagerDashboard({ role, mode = 'dashboard' }: { role: StaffRole; mode?: DashboardMode }) {
  const queryClient = useQueryClient();
  const { locationId } = useWorkspaceStore();
  const [range, setRange] = useState<DashboardRange>(mode === 'reports' ? '30d' : '7d');

  const locationsQuery = useQuery({ queryKey: ['locations-accessible'], queryFn: getLocations });
  const locations = locationsQuery.data ?? [];
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setSecondaryEnabled(true), { timeout: 1_200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(() => setSecondaryEnabled(true), 700);
    return () => globalThis.clearTimeout(id);
  }, []);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const activeLocationId = selectedLocation?.id ?? null;
  const timeZone = selectedLocation?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';
  const dateWindow = useMemo(() => getDateWindow(range, timeZone), [range, timeZone]);
  const scopeKey = activeLocationId ?? 'all';
  const currentParams = () => {
    const fresh = getDateWindow(range, timeZone);
    return { from: fresh.from, to: fresh.to, ...(activeLocationId ? { locationId: activeLocationId } : {}) };
  };
  const comparisonParams = () => {
    const fresh = getDateWindow(range, timeZone);
    return { from: fresh.previousFrom, to: fresh.previousTo, ...(activeLocationId ? { locationId: activeLocationId } : {}) };
  };

  const currentOrders = useQuery({
    queryKey: ['analytics-orders', range, scopeKey, timeZone],
    queryFn: () => getOrderAnalytics(currentParams()),
    enabled: locationsQuery.isSuccess,
    refetchInterval: 60_000,
  });
  const previousOrders = useQuery({
    queryKey: ['analytics-orders-previous', range, scopeKey, timeZone],
    queryFn: () => getOrderAnalytics(comparisonParams()),
    enabled: locationsQuery.isSuccess && secondaryEnabled,
  });
  const retention = useQuery({
    queryKey: ['analytics-retention', range, scopeKey, timeZone],
    queryFn: () => getCustomerRetention(currentParams()),
    enabled: locationsQuery.isSuccess && secondaryEnabled,
  });
  const previousRetention = useQuery({
    queryKey: ['analytics-retention-previous', range, scopeKey, timeZone],
    queryFn: () => getCustomerRetention(comparisonParams()),
    enabled: locationsQuery.isSuccess && secondaryEnabled,
  });
  const topItems = useQuery({
    queryKey: ['analytics-top-items', range, scopeKey, timeZone, mode],
    queryFn: () => getTopItems(currentParams(), mode === 'reports' ? 10 : 5),
    enabled: locationsQuery.isSuccess && secondaryEnabled,
  });
  const hourly = useQuery({
    queryKey: ['analytics-hourly', range, scopeKey, timeZone],
    queryFn: () => getHourlyVolume(currentParams()),
    enabled: locationsQuery.isSuccess && secondaryEnabled,
  });
  const byLocation = useQuery({
    queryKey: ['analytics-locations', range, scopeKey, timeZone],
    queryFn: () => getRevenueByLocation(currentParams()),
    enabled: locationsQuery.isSuccess && secondaryEnabled && !activeLocationId,
  });
  const forecast = useQuery({
    queryKey: ['inventory-forecast-dashboard', scopeKey],
    queryFn: () => getInventoryForecast(activeLocationId ?? undefined),
    enabled: locationsQuery.isSuccess,
  });
  const restocks = useQuery({
    queryKey: ['restock-requests', 'pending', scopeKey, 'dashboard'],
    queryFn: () => getRestockRequests({ status: 'pending', ...(activeLocationId ? { locationId: activeLocationId } : {}), limit: 6 }),
    enabled: locationsQuery.isSuccess,
  });
  const activeShifts = useQuery({ queryKey: ['shifts-active'], queryFn: getActiveShifts, refetchInterval: 60_000 });
  const liveOrderQueries = useQueries({
    queries: (['pending', 'preparing', 'ready'] as const).map((status) => ({
      queryKey: ['orders-live-dashboard', status, scopeKey],
      queryFn: () => getOrders({ status, limit: 10, locationId: activeLocationId ?? undefined }),
      enabled: locationsQuery.isSuccess,
      refetchInterval: 30_000,
    })),
  });

  const metrics = orderMetrics(currentOrders.data);
  const previousMetrics = orderMetrics(previousOrders.data);
  const repeatRate = retention.data?.repeatRate ?? 0;
  const previousRepeatRate = previousRetention.data?.repeatRate ?? 0;
  const liveOrders = liveOrderQueries.reduce((total, query) => total + (query.data?.total ?? 0), 0);
  const visibleShifts = (activeShifts.data ?? []).filter((shift) => !activeLocationId || shift.locationId === activeLocationId);
  const criticalStock = (forecast.data ?? []).filter((item) => item.isCritical);
  const urgentRestocks = (restocks.data?.data ?? []).filter((request) => decodeNotes(request.notes).priority === 'urgent');
  const preparingOrders = liveOrderQueries[1]?.data?.data ?? [];
  const stuckOrders = preparingOrders.filter((order) => Date.now() - new Date(order.createdAt).getTime() > 15 * 60_000);
  const orderComparisonAvailable = previousOrders.isSuccess;
  const retentionComparisonAvailable = previousRetention.isSuccess;
  const operationsError = forecast.isError || restocks.isError || liveOrderQueries.some((query) => query.isError);
  const operationsLoading = forecast.isPending || restocks.isPending || liveOrderQueries.some((query) => query.isPending);
  const liveOperationsError = operationsError || activeShifts.isError;
  const hasCoreError = locationsQuery.isError || currentOrders.isError || retention.isError;
  const coreLoading =
    locationsQuery.isPending || currentOrders.isPending || retention.isPending || previousOrders.isPending || previousRetention.isPending;
  const lastUpdated = Math.max(currentOrders.dataUpdatedAt, retention.dataUpdatedAt, topItems.dataUpdatedAt, hourly.dataUpdatedAt);
  const isOwner = role === 'franchise_owner' || role === 'super_admin';
  const attentionCount = criticalStock.length + urgentRestocks.length + stuckOrders.length;
  const isRefreshing =
    currentOrders.isFetching ||
    retention.isFetching ||
    forecast.isFetching ||
    restocks.isFetching ||
    activeShifts.isFetching ||
    liveOrderQueries.some((query) => query.isFetching);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const family = String(query.queryKey[0]);
        return (
          family.startsWith('analytics-') ||
          ['locations-accessible', 'inventory-forecast-dashboard', 'restock-requests', 'shifts-active', 'orders-live-dashboard'].includes(
            family,
          )
        );
      },
    });

  const header = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Live operations</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground md:text-[32px]">
            {mode === 'reports' ? 'Performance reports' : 'Operations overview'}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{selectedLocation?.name ?? 'All accessible locations'}</span>
            <span aria-hidden="true">·</span>
            <span>{dateWindow.label}</span>
            {lastUpdated > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Updated {new Date(lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
        </div>
      </div>

      {mode === 'dashboard' && (
        <section
          aria-label="Current operational status"
          className="relative overflow-hidden rounded-2xl bg-foreground px-5 py-4 text-background shadow-lg shadow-foreground/5"
        >
          <div className="pointer-events-none absolute -top-20 right-0 size-64 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
                  attentionCount > 0 ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success',
                )}
              >
                {attentionCount > 0 ? <AlertTriangle size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {operationsLoading
                    ? 'Checking the floor…'
                    : attentionCount > 0
                      ? `${attentionCount} ${attentionCount === 1 ? 'item needs' : 'items need'} attention`
                      : 'Everything is running smoothly'}
                </p>
                <p className="mt-1 text-xs text-background/65">
                  {operationsLoading
                    ? 'Live orders, stock, and restock requests are being updated.'
                    : attentionCount > 0
                      ? 'Review the prioritised exceptions below before they affect service.'
                      : 'No urgent stock, restock, or fulfilment exceptions in the selected scope.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-background/15 rounded-xl border border-background/10 bg-background/5">
              {[
                { label: 'Live orders', value: liveOrders },
                { label: 'On shift', value: visibleShifts.length },
                { label: 'Stock risks', value: criticalStock.length },
              ].map((item) => (
                <div key={item.label} className="min-w-22 px-3 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{operationsLoading ? '—' : item.value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-background/55">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );

  if (hasCoreError) {
    return (
      <PageLayout headerSlot={header}>
        <div className={panelClass}>
          <InlineError onRetry={() => void refresh()} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout headerSlot={header} className="space-y-5 pb-8">
      <section aria-label="Business pulse" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Net revenue"
          value={formatMoney(metrics.revenue)}
          hint="Cancelled orders excluded"
          change={orderComparisonAvailable ? percentageChange(metrics.revenue, previousMetrics.revenue) : undefined}
          comparisonLabel={dateWindow.comparisonLabel}
          icon={WalletCards}
          tone="bg-success/10 text-success"
          href={mode === 'reports' ? '/reports/revenue' : '/reports'}
          loading={coreLoading}
        />
        <MetricCard
          label="Orders"
          value={formatCompact(metrics.orders)}
          hint={`${liveOrders} currently in progress`}
          change={orderComparisonAvailable ? percentageChange(metrics.orders, previousMetrics.orders) : undefined}
          comparisonLabel={dateWindow.comparisonLabel}
          icon={ShoppingBag}
          tone="bg-info/10 text-info"
          href={mode === 'reports' ? '/reports/orders' : '/orders'}
          loading={coreLoading}
        />
        <MetricCard
          label="Average order"
          value={formatMoney(metrics.averageOrderValue, 2)}
          hint={`${metrics.cancelledOrders} cancelled · ${metrics.cancellationRate.toFixed(1)}% rate`}
          change={orderComparisonAvailable ? percentageChange(metrics.averageOrderValue, previousMetrics.averageOrderValue) : undefined}
          comparisonLabel={dateWindow.comparisonLabel}
          icon={ReceiptText}
          tone="bg-chart-5/10 text-chart-5"
          href={mode === 'reports' ? '/reports/average' : '/reports'}
          loading={coreLoading}
        />
        <MetricCard
          label="Returning customers"
          value={`${repeatRate.toFixed(1)}%`}
          hint={`${retention.data?.returningCustomers ?? 0} returning · ${retention.data?.newCustomers ?? 0} new`}
          change={retentionComparisonAvailable ? repeatRate - previousRepeatRate : undefined}
          comparisonLabel={dateWindow.comparisonLabel}
          icon={Users}
          tone="bg-primary/10 text-primary"
          href={mode === 'reports' ? '/reports/retention' : '/customers'}
          loading={coreLoading}
          points
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <div className={cn(panelClass, 'p-5')}>
          <PanelHeader
            title="Daily order value"
            description={`${dateWindow.label}, with the latest day highlighted`}
            href={mode === 'dashboard' ? '/reports' : undefined}
            hrefLabel="Open reports"
          />
          <RevenueChart rows={currentOrders.data?.daily ?? []} loading={currentOrders.isPending} />
        </div>
        <div className={cn(panelClass, 'p-5')}>
          <PanelHeader
            title="Top ordered items"
            description="Ranked by non-cancelled quantity"
            href={mode === 'reports' ? '/reports/top-items' : '/menu'}
            hrefLabel={mode === 'reports' ? 'Full report' : 'View menu'}
          />
          {topItems.isError ? (
            <InlineError onRetry={() => void topItems.refetch()} />
          ) : (
            <TopItems rows={topItems.data ?? []} loading={topItems.isPending} />
          )}
        </div>
      </section>

      {mode === 'dashboard' ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className={cn(panelClass, 'p-5')}>
            <PanelHeader title="What needs attention" description="Prioritised operational exceptions across the selected scope" />
            <div className="mt-5 space-y-2">
              {criticalStock.slice(0, 3).map((item) => (
                <Link
                  key={item.locationStockId}
                  href="/inventory"
                  className="flex items-center gap-3 rounded-xl border border-destructive/15 bg-destructive/5 p-3 hover:bg-destructive/10"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <Boxes size={16} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{item.stockItemName} may run out soon</p>
                    <p className="text-xs text-muted-foreground">
                      {item.locationName ?? 'Selected scope'} · {item.daysOfStockRemaining ?? 0} days remaining
                    </p>
                  </div>
                  <Badge variant="destructive">Critical</Badge>
                </Link>
              ))}
              {urgentRestocks.slice(0, 2).map((request) => (
                <Link
                  key={request.id}
                  href="/inventory/restock-requests"
                  className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 p-3 hover:bg-warning/10"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                    <PackagePlus size={16} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      Urgent restock: {request.stockItem?.name ?? 'stock item'}
                    </p>
                    <p className="text-xs text-muted-foreground">Quantity {request.requestedQty} · awaiting review</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" />
                </Link>
              ))}
              {stuckOrders.slice(0, 2).map((order) => (
                <Link
                  key={order.id}
                  href="/orders"
                  className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 p-3 hover:bg-warning/10"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                    <Clock3 size={16} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      Order #{order.id.slice(0, 8)} is taking longer than expected
                    </p>
                    <p className="text-xs text-muted-foreground">Preparing for more than 15 minutes</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" />
                </Link>
              ))}
              {operationsError && <InlineError onRetry={() => void refresh()} />}
              {!operationsLoading &&
                !operationsError &&
                criticalStock.length === 0 &&
                urgentRestocks.length === 0 &&
                stuckOrders.length === 0 && (
                  <div className="flex min-h-44 flex-col items-center justify-center text-center">
                    <CheckCircle2 size={28} className="text-success" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-foreground">No urgent actions</p>
                    <p className="mt-1 text-xs text-muted-foreground">Stock, restocks, and live orders look healthy.</p>
                  </div>
                )}
            </div>
          </div>

          <div className="space-y-4">
            <div className={cn(panelClass, 'p-5')}>
              <PanelHeader title="Live operations" description="Current activity in the selected scope" />
              {liveOperationsError ? (
                <InlineError onRetry={() => void refresh()} />
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Live orders', value: liveOrders, icon: ShoppingBag, href: '/orders', tone: 'text-info bg-info/10' },
                    {
                      label: 'Clocked in',
                      value: visibleShifts.length,
                      icon: Users,
                      // Team shift cover, not the viewer's own rota.
                      href: '/staff/shifts',
                      tone: 'text-success bg-success/10',
                    },
                    {
                      label: 'Pending restocks',
                      value: restocks.data?.total ?? 0,
                      icon: PackagePlus,
                      href: '/inventory/restock-requests',
                      tone: 'text-warning bg-warning/10',
                    },
                    {
                      label: 'Stockout risks',
                      value: criticalStock.length,
                      icon: AlertTriangle,
                      href: '/inventory',
                      tone: 'text-destructive bg-destructive/10',
                    },
                  ].map(({ label, value, icon: Icon, href, tone }) => (
                    <Link key={label} href={href} className="rounded-xl border border-border p-3 hover:bg-muted/50">
                      <div className={cn('flex size-8 items-center justify-center rounded-lg', tone)}>
                        <Icon size={14} aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className={cn(panelClass, 'p-5')}>
              <PanelHeader
                title="Customer mix"
                description={`${retention.data?.totalWithOrders ?? 0} known customers ordered`}
                href="/customers"
              />
              <div className="mt-5 flex items-center gap-5">
                <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-8 border-success/25 text-lg font-bold text-foreground">
                  {repeatRate.toFixed(0)}%
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-semibold text-foreground">{retention.data?.returningCustomers ?? 0}</span>{' '}
                    <span className="text-muted-foreground">returning</span>
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">{retention.data?.newCustomers ?? 0}</span>{' '}
                    <span className="text-muted-foreground">new</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className={cn(panelClass, 'p-5')}>
            <PanelHeader title="Demand by hour" description="Use peak periods to plan prep and staffing" />
            {hourly.isError ? (
              <InlineError onRetry={() => void hourly.refetch()} />
            ) : (
              <HourlyDemand rows={hourly.data ?? []} loading={hourly.isPending} />
            )}
          </div>
          <div className={cn(panelClass, 'p-5')}>
            <PanelHeader title="Channel and customer summary" description="How orders and customer visits are distributed" />
            <div className="mt-5 space-y-3">
              {(currentOrders.data?.bySource ?? []).map((row) => (
                <div key={row.source} className="flex items-center justify-between rounded-xl bg-muted/45 p-3">
                  <div className="flex items-center gap-2">
                    <Coffee size={15} className="text-primary" aria-hidden="true" />
                    <span className="text-sm font-medium capitalize text-foreground">{row.source}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{row.count} orders</span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-2xl font-bold tabular-nums">{retention.data?.newCustomers ?? 0}</p>
                  <p className="text-xs text-muted-foreground">New customers</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-2xl font-bold tabular-nums">{retention.data?.returningCustomers ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Returning customers</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {!activeLocationId && (isOwner || mode === 'reports') && (
        <section className={cn(panelClass, 'p-5')}>
          <PanelHeader
            title="Location performance"
            description="Compare order activity across accessible locations"
            href={isOwner ? '/workspaces' : undefined}
            hrefLabel="Manage locations"
          />
          {byLocation.isError ? (
            <InlineError onRetry={() => void byLocation.refetch()} />
          ) : (
            <LocationPerformance rows={byLocation.data ?? []} loading={byLocation.isPending} />
          )}
        </section>
      )}

      {mode === 'dashboard' && (
        <section className={cn(panelClass, 'p-5')}>
          <PanelHeader
            title="Demand by hour"
            description="Peak ordering times for the selected period"
            href="/reports"
            hrefLabel="Full analysis"
          />
          {hourly.isError ? (
            <InlineError onRetry={() => void hourly.refetch()} />
          ) : (
            <HourlyDemand rows={hourly.data ?? []} loading={hourly.isPending} />
          )}
        </section>
      )}
    </PageLayout>
  );
}
