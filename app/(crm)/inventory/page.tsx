'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bell, ClipboardList, Package, PackageMinus, TrendingUp, Truck } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/badge';

import { type DeliveryRecord, getDeliveryLog } from '@/lib/api/delivery.service';
import {
  type InventoryForecast,
  type LocationStock,
  type TenantStock,
  getInventoryForecast,
  getLocationStock,
  getLowStockAlerts,
  getTenantStock,
} from '@/lib/api/inventory.service';
import { type LossRecord, getLossLog } from '@/lib/api/loss.service';
import { type RestockRequest, type RestockRequestsResponse, decodeNotes, getRestockRequests } from '@/lib/api/restock.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { data?: T[] };
  if (Array.isArray(r.data)) return r.data;
  return Object.values(raw as object) as T[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 2) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function stockPct(qty: string, threshold: string): number {
  const q = parseFloat(qty);
  const t = parseFloat(threshold);
  if (t <= 0) return 100;
  return Math.min((q / t) * 100, 100);
}

const LOSS_REASON_LABELS: Record<string, string> = {
  waste: 'Waste', spoilage: 'Spoilage', theft: 'Theft',
  damage: 'Damage', expiry: 'Expiry', other: 'Other',
};

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label, value, sub, accent,
}: {
  label: string; value: string | number; sub?: string; accent?: 'red' | 'amber' | 'green' | 'blue';
}) {
  const valueClass = {
    red: 'text-destructive', amber: 'text-amber-500', green: 'text-success', blue: 'text-primary',
  }[accent ?? 'blue'];

  return (
    <div className="flex flex-col gap-0.5 px-5 py-4 rounded-xl border border-border bg-card">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', valueClass)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon, title, badge, href, linkLabel = 'View all', children, empty,
}: {
  icon: React.ElementType;
  title: string;
  badge?: number;
  href: string;
  linkLabel?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge !== undefined && badge > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5">{badge}</Badge>
          )}
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs text-primary hover:underline">
          {linkLabel} <ArrowRight size={11} />
        </Link>
      </div>
      <div className="px-5 flex-1">
        {empty ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nothing to show.</p>
        ) : children}
      </div>
    </section>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({ name, qty, threshold, unit, isCritical }: {
  name: string; qty: string; threshold: string; unit?: string; isCritical: boolean;
}) {
  const pct = stockPct(qty, threshold);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', isCritical ? 'bg-destructive' : 'bg-amber-400')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
            <div className={cn('h-full rounded-full', isCritical ? 'bg-destructive' : 'bg-amber-400')} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {parseFloat(qty)}{unit ? ` ${unit}` : ''} / {parseFloat(threshold)}{unit ? ` ${unit}` : ''}
          </span>
        </div>
      </div>
      <Badge variant={isCritical ? 'destructive' : 'amber'} className="shrink-0 text-[10px]">
        {isCritical ? 'Critical' : 'Low'}
      </Badge>
    </div>
  );
}

// ── Forecast row ──────────────────────────────────────────────────────────────

function ForecastRow({ item }: { item: InventoryForecast }) {
  const days = Math.round(item.daysOfStockRemaining);
  const color = days <= 7 ? 'text-destructive' : days <= 14 ? 'text-warning' : 'text-amber-500';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Package size={13} className={cn('shrink-0', item.isCritical ? 'text-destructive' : 'text-amber-500')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.stockItemName}</p>
        <p className="text-xs text-muted-foreground">
          {item.avgDailyConsumption.toFixed(1)} / day · reorder {item.recommendedReorderQuantity} {item.unit}
          {item.locationName && <span className="ml-1">· {item.locationName}</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-bold tabular-nums', color)}>{days}d</p>
        <p className="text-[11px] text-muted-foreground">left</p>
      </div>
    </div>
  );
}

// ── Delivery row ──────────────────────────────────────────────────────────────

function DeliveryRow({ delivery }: { delivery: DeliveryRecord }) {
  const variant =
    delivery.status === 'received' ? 'success' :
    delivery.status === 'pending' ? 'warning' :
    delivery.status === 'partial' ? 'primary' : 'muted';
  const itemCount = delivery.items?.length ?? 0;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Truck size={12} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{delivery.supplier?.name ?? 'Unknown supplier'}</p>
        <p className="text-xs text-muted-foreground truncate">
          {delivery.location?.name ?? '—'}
          {itemCount > 0 && <span className="ml-1">· {itemCount} {itemCount === 1 ? 'item' : 'items'}</span>}
        </p>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <div><Badge variant={variant} className="text-[10px]">{delivery.status}</Badge></div>
        <p className="text-[11px] text-muted-foreground">{formatDate(delivery.createdAt)}</p>
      </div>
    </div>
  );
}

// ── Loss row ──────────────────────────────────────────────────────────────────

function LossRow({ loss }: { loss: LossRecord }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
        <PackageMinus size={12} className="text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{loss.stockItem?.name ?? '—'}</p>
        <p className="text-xs text-muted-foreground">
          {LOSS_REASON_LABELS[loss.type] ?? loss.type}
          {loss.location?.name && <span className="ml-1">· {loss.location.name}</span>}
          <span className="ml-1">· {timeAgo(loss.createdAt)}</span>
        </p>
      </div>
      <p className="text-sm font-semibold text-destructive tabular-nums shrink-0">
        -{Math.abs(loss.quantity)} {loss.stockItem?.unit ?? ''}
      </p>
    </div>
  );
}

// ── Restock row ───────────────────────────────────────────────────────────────

function RestockRow({ req }: { req: RestockRequest }) {
  const { priority } = decodeNotes(req.notes);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-md bg-warning/10 flex items-center justify-center shrink-0">
        <ClipboardList size={12} className="text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{req.stockItem?.name ?? req.stockItemId.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(req.createdAt)} · qty {req.requestedQty} {req.stockItem?.unit ?? ''}</p>
      </div>
      <Badge variant={priority === 'urgent' ? 'destructive' : 'warning'} className="shrink-0 text-[10px]">
        {priority === 'urgent' ? 'Urgent' : 'Standard'}
      </Badge>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryDashboard() {
  const { tenantId, locationId } = useWorkspaceStore();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: rawAlerts } = useQuery({
    queryKey: ['low-stock-alerts', locationId],
    queryFn: () => getLowStockAlerts(locationId ?? undefined),
  });

  const { data: rawLocationStock } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });

  const { data: rawTenantStock } = useQuery({
    queryKey: ['tenant-stock'],
    queryFn: getTenantStock,
    enabled: !locationId,
  });

  const { data: rawForecast } = useQuery({
    queryKey: ['inventory-forecast', locationId, 30],
    queryFn: () => getInventoryForecast(locationId ?? undefined, 30),
  });

  const { data: rawDeliveries } = useQuery({
    queryKey: ['delivery-log', locationId ?? tenantId],
    queryFn: () => getDeliveryLog({ ...(locationId ? { locationId } : { tenantId: tenantId! }), limit: 8 }),
    enabled: !!(locationId || tenantId),
  });

  const { data: rawLoss } = useQuery({
    queryKey: ['loss-log', locationId ?? tenantId],
    queryFn: () => getLossLog({ ...(locationId ? { locationId } : { tenantId: tenantId! }), limit: 6 }),
    enabled: !!(locationId || tenantId),
  });

  const { data: restockData } = useQuery({
    queryKey: ['restock-requests', 'pending', locationId],
    queryFn: () => getRestockRequests({ status: 'pending', ...(locationId ? { locationId } : {}), limit: 20 }),
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const alerts = useMemo(() => normaliseArray<{ id: string; stockItem?: { name: string; unit: string }; quantity: string; lowThreshold: string; isAvailable: boolean }>(rawAlerts), [rawAlerts]);
  const locationStock = useMemo(() => normaliseArray<LocationStock>(rawLocationStock), [rawLocationStock]);
  const tenantStock = useMemo(() => normaliseArray<TenantStock>(rawTenantStock), [rawTenantStock]);
  const forecast = useMemo(() => normaliseArray<InventoryForecast>(rawForecast), [rawForecast]);
  const deliveries = useMemo(() => normaliseArray<DeliveryRecord>(rawDeliveries), [rawDeliveries]);
  const lossEntries = useMemo(() => normaliseArray<LossRecord>(rawLoss), [rawLoss]);
  const pendingRestocks = useMemo<RestockRequest[]>(() => {
    const r = restockData as RestockRequestsResponse | RestockRequest[] | null | undefined;
    if (!r) return [];
    if (Array.isArray(r)) return r;
    return r.data ?? [];
  }, [restockData]);

  const stock = locationId ? locationStock : tenantStock;
  const totalItems = stock.length;
  const criticalAlerts = alerts.filter((a) => parseFloat(a.quantity) <= parseFloat(a.lowThreshold) * 0.5).length;
  const lowAlerts = alerts.length - criticalAlerts;
  const stockoutSoon = forecast.filter((f) => f.daysOfStockRemaining <= 7).length;
  const urgentRestocks = pendingRestocks.filter((r) => decodeNotes(r.notes).priority === 'urgent').length;
  const urgentForecast = [...forecast.filter((f) => f.isCritical), ...forecast.filter((f) => f.isLow && !f.isCritical)].slice(0, 6);

  // Deliveries this week
  const weekAgo = Date.now() - 7 * 86_400_000;
  const deliveriesThisWeek = deliveries.filter((d) => new Date(d.createdAt).getTime() > weekAgo).length;
  const pendingDeliveries = deliveries.filter((d) => d.status === 'pending').length;

  const scopeLabel = locationId ? 'This location' : 'All locations';

  return (
    <PageLayout eyebrow="Inventory" title="Overview" headerBorder={false}>
      {/* Scope indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
            locationId ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-offset border-border text-muted-foreground',
          )}
        >
          <div className={cn('w-1.5 h-1.5 rounded-full', locationId ? 'bg-primary' : 'bg-muted-foreground')} />
          {locationId ? 'Location view' : 'Tenant-wide view — select a location for details'}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        <StatTile label="Total Items" value={totalItems} sub={scopeLabel} accent="blue" />
        <StatTile
          label="Critical Stock"
          value={criticalAlerts}
          sub={criticalAlerts > 0 ? 'Needs action now' : 'All clear'}
          accent={criticalAlerts > 0 ? 'red' : 'green'}
        />
        <StatTile
          label="Low Stock"
          value={lowAlerts}
          sub={lowAlerts > 0 ? 'Below threshold' : 'All healthy'}
          accent={lowAlerts > 0 ? 'amber' : 'green'}
        />
        <StatTile
          label="Stockout ≤ 7 days"
          value={stockoutSoon}
          sub="Based on 30-day avg"
          accent={stockoutSoon > 0 ? 'red' : 'green'}
        />
        <StatTile
          label="Pending Restocks"
          value={pendingRestocks.length}
          sub={urgentRestocks > 0 ? `${urgentRestocks} urgent` : 'No urgent'}
          accent={urgentRestocks > 0 ? 'red' : pendingRestocks.length > 0 ? 'amber' : 'blue'}
        />
        <StatTile
          label="Deliveries this week"
          value={deliveriesThisWeek}
          sub={pendingDeliveries > 0 ? `${pendingDeliveries} pending` : 'All received'}
          accent={pendingDeliveries > 0 ? 'amber' : 'blue'}
        />
      </div>

      {/* Main sections */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Low stock alerts */}
        <SectionCard
          icon={Bell}
          title="Low Stock Alerts"
          badge={alerts.length}
          href="/inventory/low-stock-alerts"
          empty={alerts.length === 0}
        >
          {alerts.slice(0, 6).map((a) => (
            <AlertRow
              key={a.id}
              name={a.stockItem?.name ?? 'Unknown'}
              qty={a.quantity}
              threshold={a.lowThreshold}
              unit={a.stockItem?.unit}
              isCritical={parseFloat(a.quantity) <= parseFloat(a.lowThreshold) * 0.5}
            />
          ))}
        </SectionCard>

        {/* Demand forecast */}
        <SectionCard
          icon={TrendingUp}
          title="Running Low Soon"
          href="/inventory/demand-forecast"
          linkLabel="Full forecast"
          empty={urgentForecast.length === 0}
        >
          {urgentForecast.map((f) => <ForecastRow key={f.locationStockId} item={f} />)}
        </SectionCard>

        {/* Pending restock requests */}
        <SectionCard
          icon={ClipboardList}
          title="Pending Restocks"
          badge={urgentRestocks}
          href="/inventory/restock-requests"
          empty={pendingRestocks.length === 0}
        >
          {pendingRestocks.slice(0, 6).map((r) => <RestockRow key={r.id} req={r} />)}
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Recent deliveries */}
        <SectionCard
          icon={Truck}
          title="Recent Deliveries"
          href="/inventory/delivery-log"
          empty={deliveries.length === 0}
        >
          {deliveries.slice(0, 5).map((d) => <DeliveryRow key={d.id} delivery={d} />)}
        </SectionCard>

        {/* Recent losses */}
        <SectionCard
          icon={PackageMinus}
          title="Recent Losses"
          href="/inventory/loss-log"
          empty={lossEntries.length === 0}
        >
          {lossEntries.slice(0, 5).map((l) => <LossRow key={l.id} loss={l} />)}
        </SectionCard>
      </div>
    </PageLayout>
  );
}
