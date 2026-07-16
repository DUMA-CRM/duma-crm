'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, ClipboardList, Monitor, ShoppingBag, Smartphone, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { MyDashboard } from '@/components/dashboard/MyDashboard';
import { PageLayout } from '@/components/layout/PageLayout';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';

import { getCustomers } from '@/lib/api/customers.service';
import { getLowStockAlerts } from '@/lib/api/inventory.service';
import { type Order, getOrders } from '@/lib/api/orders.service';
import { decodeNotes, getRestockRequests } from '@/lib/api/restock.service';
import { getStaff, roleAtLeast } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Customer } from '@/types/customers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtGbp(n: number) {
  return `£${n.toFixed(0)}`;
}

const TIER_STYLE: Record<string, string> = {
  vip: 'bg-primary/10 text-primary',
  gold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  silver: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  bronze: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const TIER_DOT: Record<string, string> = {
  vip: 'bg-primary',
  gold: 'bg-amber-400',
  silver: 'bg-slate-400',
  bronze: 'bg-orange-400',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, href, label = 'View all' }: { title: string; href: string; label?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
      <Link href={href} className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
        {label} <ArrowRight size={10} />
      </Link>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {order.source === 'pos' ? (
          <Monitor size={13} className="text-muted-foreground" />
        ) : (
          <Smartphone size={13} className="text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight font-mono">#{order.id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(order.createdAt)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums text-foreground">£{Number(order.totalAmount).toFixed(2)}</p>
        <p
          className={cn(
            'text-[10px] font-bold uppercase tracking-wide',
            order.status === 'done'
              ? 'text-success'
              : order.status === 'cancelled'
                ? 'text-destructive'
                : order.status === 'preparing'
                  ? 'text-warning'
                  : 'text-muted-foreground',
          )}
        >
          {order.status}
        </p>
      </div>
    </div>
  );
}

function CustomerRow({ customer }: { customer: Customer }) {
  const initials = `${customer.firstName[0]}${customer.lastName[0]}`.toUpperCase();
  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {customer.firstName} {customer.lastName}
        </p>
        <p className="text-xs text-muted-foreground">
          {customer.totalVisits} visits · £{Number(customer.totalSpent).toFixed(0)} spent
        </p>
      </div>
      <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md', TIER_STYLE[customer.tier])}>
        {customer.tier}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function StoreDashboard() {
  const { tenantId, locationId } = useWorkspaceStore();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: ordersData } = useQuery({
    queryKey: ['orders-all', locationId],
    queryFn: () => getOrders({ limit: 200, locationId: locationId ?? undefined }),
    refetchInterval: 60_000,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-recent', tenantId],
    queryFn: () => getCustomers({ limit: 100, tenantId: tenantId ?? undefined }),
    enabled: !!tenantId,
  });

  const { data: rawAlerts } = useQuery({
    queryKey: ['low-stock-alerts', locationId],
    queryFn: () => getLowStockAlerts(locationId ?? undefined),
  });

  const { data: restockData } = useQuery({
    queryKey: ['restock-requests', 'pending', locationId],
    queryFn: () => getRestockRequests({ status: 'pending', ...(locationId ? { locationId } : {}), limit: 10 }),
  });

  const { data: staffList } = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  // ── Derived: orders ────────────────────────────────────────────────────────
  const allOrders: Order[] = ordersData?.data ?? [];

  const todayStr = new Date().toDateString();
  const todayOrders = useMemo(() => allOrders.filter((o) => new Date(o.createdAt).toDateString() === todayStr), [allOrders, todayStr]);

  const revenueToday = todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const avgTicket = todayOrders.length ? revenueToday / todayOrders.length : 0;
  const pendingCount = allOrders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status)).length;
  const cancelledToday = todayOrders.filter((o) => o.status === 'cancelled').length;

  const recentOrders = useMemo(() => [...allOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [allOrders]);

  const week14 = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toDateString();
      const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
      const dayOrders = allOrders.filter((o) => new Date(o.createdAt).toDateString() === key);
      return {
        label,
        revenue: dayOrders.reduce((s, o) => s + Number(o.totalAmount), 0),
        count: dayOrders.length,
      };
    });
  }, [allOrders]);

  const week7 = week14.slice(7);
  const revenueBarMax = Math.max(...week14.map((d) => d.revenue), 1);

  // ── Derived: customers ─────────────────────────────────────────────────────
  const customers: Customer[] = customersData?.data ?? [];
  const totalCustomers = customersData?.total ?? 0;
  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000);
  const newThisWeek = useMemo(() => customers.filter((c) => new Date(c.createdAt).getTime() > weekAgo).length, [customers, weekAgo]);
  const topCustomers = useMemo(() => [...customers].sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent)).slice(0, 5), [customers]);
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { vip: 0, gold: 0, silver: 0, bronze: 0 };
    customers.forEach((c) => {
      if (c.tier in counts) counts[c.tier]++;
    });
    return counts;
  }, [customers]);

  // ── Derived: inventory ─────────────────────────────────────────────────────
  const alerts = Array.isArray(rawAlerts) ? rawAlerts : [];
  const criticalAlerts = alerts.filter(
    (a: { quantity: string; lowThreshold: string }) => parseFloat(a.quantity) <= parseFloat(a.lowThreshold) * 0.5,
  ).length;

  // ── Derived: restocks ──────────────────────────────────────────────────────
  const pendingRestocks = Array.isArray(restockData) ? restockData : ((restockData as { data?: unknown[] } | null)?.data ?? []);
  const urgentRestocks = (pendingRestocks as Array<{ notes?: string }>).filter((r) => decodeNotes(r.notes).priority === 'urgent').length;

  // ── Derived: staff ─────────────────────────────────────────────────────────
  const activeStaff = (staffList ?? []).filter((s) => s.isActive).length;

  return (
    <PageLayout eyebrow="At a Glance" title="Dashboard">
      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Revenue Today"
          value={fmtGbp(revenueToday)}
          icon="Wallet"
          iconVariant="primary"
          footer={{
            type: 'sparkline',
            points: week7.map((d) => d.revenue),
            labels: week7.map((d) => fmtGbp(d.revenue)),
            titleLabels: week7.map((d) => `Revenue (${d.label})`),
          }}
        />
        <StatCard
          label="Orders Today"
          value={String(todayOrders.length)}
          icon="ShoppingBag"
          iconVariant="info"
          delta={pendingCount > 0 ? `${pendingCount} live` : undefined}
          footer={{
            type: 'bars',
            values: week7.map((d) => d.count),
            labels: week7.map((d) => String(d.count)),
            titleLabels: week7.map((d) => `Orders (${d.label})`),
          }}
        />
        <StatCard
          label="Avg Ticket"
          value={fmtGbp(avgTicket)}
          icon="Tag"
          iconVariant="success"
          delta={cancelledToday > 0 ? `${cancelledToday} cancelled` : undefined}
          deltaDirection={cancelledToday > 0 ? 'down' : undefined}
        />
        <StatCard label="Total Customers" value={String(totalCustomers)} icon="Users" iconVariant="primary" />
        <StatCard label="New Customers" value={String(newThisWeek)} icon="UserPlus" iconVariant="gold" delta="this week" />
        <StatCard
          label="Stock Alerts"
          value={String(alerts.length)}
          icon="Tag"
          iconVariant={criticalAlerts > 0 ? 'gold' : 'success'}
          delta={criticalAlerts > 0 ? `${criticalAlerts} critical` : 'All healthy'}
          deltaDirection={criticalAlerts > 0 ? 'down' : undefined}
        />
      </div>

      {/* ── Revenue chart + recent orders ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        {/* 14-day revenue chart */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Revenue — Last 14 Days</p>
              <p className="text-3xl font-bold text-foreground tabular-nums mt-1">{fmtGbp(week14.reduce((s, d) => s + d.revenue, 0))}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Orders</p>
              <p className="text-xl font-bold text-foreground tabular-nums mt-1">{week14.reduce((s, d) => s + d.count, 0)}</p>
            </div>
          </div>

          <div className="flex items-end gap-1.5 h-40">
            {week14.map((d, i) => {
              const isToday = i === 13;
              const pct = revenueBarMax > 0 ? (d.revenue / revenueBarMax) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-opacity',
                      isToday ? 'bg-linear-to-t from-primary to-amber-400' : 'bg-surface-offset group-hover:bg-muted-foreground/30',
                    )}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-2">
            {week14.map((d, i) => (
              <div key={i} className="flex-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {i % 2 === 0 ? d.label : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionHeader title="Recent Orders" href="/orders" />
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {recentOrders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Top customers */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionHeader title="Top Customers" href="/customers" />
          {topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No customers yet.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {topCustomers.map((c) => (
                <CustomerRow key={c.id} customer={c} />
              ))}
            </div>
          )}
        </div>

        {/* Customer tiers + staff */}
        <div className="flex flex-col gap-4">
          {/* Tier breakdown */}
          <div className="bg-card border border-border rounded-2xl p-5 flex-1">
            <SectionHeader title="Customer Tiers" href="/customers" label="View all" />
            <div className="flex flex-col gap-2">
              {(['vip', 'gold', 'silver', 'bronze'] as const).map((tier) => {
                const count = tierCounts[tier];
                const pct = customers.length ? Math.round((count / customers.length) * 100) : 0;
                return (
                  <div key={tier} className="flex items-center gap-3">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', TIER_DOT[tier])} />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide w-12">{tier}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <div className={cn('h-full rounded-full', TIER_DOT[tier])} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Quick Stats</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Active Staff', value: activeStaff, icon: Users, color: 'text-primary' },
                {
                  label: 'Pending Restocks',
                  value: pendingRestocks.length,
                  icon: ClipboardList,
                  color: urgentRestocks > 0 ? 'text-destructive' : 'text-warning',
                },
                {
                  label: 'Stock Alerts',
                  value: alerts.length,
                  icon: AlertTriangle,
                  color: criticalAlerts > 0 ? 'text-destructive' : 'text-amber-500',
                },
                {
                  label: 'Cancelled Today',
                  value: cancelledToday,
                  icon: ShoppingBag,
                  color: cancelledToday > 0 ? 'text-destructive' : 'text-muted-foreground',
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon size={13} className={color} />
                  </div>
                  <div>
                    <p className="text-base font-bold tabular-nums text-foreground leading-none">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending restock requests */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionHeader title="Pending Restocks" href="/inventory/restock-requests" />
          {pendingRestocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending restocks.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {(
                pendingRestocks as Array<{
                  id: string;
                  notes?: string;
                  stockItem?: { name: string; unit: string };
                  requestedQty: number;
                  createdAt: string;
                }>
              )
                .slice(0, 6)
                .map((r) => {
                  const { priority } = decodeNotes(r.notes);
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      <div className="w-7 h-7 rounded-md bg-warning/10 flex items-center justify-center shrink-0">
                        <ClipboardList size={12} className="text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.stockItem?.name ?? r.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          qty {r.requestedQty} {r.stockItem?.unit ?? ''} · {timeAgo(r.createdAt)}
                        </p>
                      </div>
                      <Badge variant={priority === 'urgent' ? 'destructive' : 'warning'} className="text-[10px] shrink-0">
                        {priority}
                      </Badge>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

// Managers get the store overview; everyone else gets their personal day view.
export default function DashboardPage() {
  const isManager = roleAtLeast(
    useAuthStore((s) => s.role),
    'store_manager',
  );
  return isManager ? <StoreDashboard /> : <MyDashboard />;
}
