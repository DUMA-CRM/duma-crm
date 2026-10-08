'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  FileEdit,
  FileText,
  Gift,
  Globe,
  type IconComponent,
  Mail,
  MapPin,
  Megaphone,
  ShieldCheck,
  ShoppingCart,
  Store,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  XCircle,
} from '@/components/icons';
import { EmptyState, type EmptyStateKind } from '@/components/shared/EmptyState';
import { MiniBar } from '@/components/shared/MiniBar';
import { Bone } from '@/components/shared/Skeleton';
import { StatusDot } from '@/components/shared/StatusDot';
import { Tooltip } from '@/components/shared/Tooltip';
import { TONE_FILL, TONE_INK, TONE_TINT, type Tone } from '@/components/shared/tone';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { getPaymentMethodSales } from '@/lib/modules/analytics/client';
import { getCmsOverview } from '@/lib/modules/cms/client';
import { getCustomers } from '@/lib/modules/customers/client';
import { getInventoryOverview } from '@/lib/modules/inventory/client';
import { getLocations } from '@/lib/modules/organization/client';
import { getPurchaseOrders } from '@/lib/modules/purchasing/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getActiveShifts, getScheduledShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { getDateWindow } from '@/lib/utils/dashboard';
import { stockHealthSummary, teamTodaySummary, tenderSegments } from '@/lib/utils/dashboard-cards';
import { resolvedTimeZone, workspaceDateKey, zonedToInstant } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* One card per module, so any combination of modules makes a dashboard. Each
 * reads only its own module's data, and only renders when the resolved layout
 * placed it — which the API does only while that module is enabled and the
 * viewer holds its capability. So a card never asks for something refused. */

// ── The card ─────────────────────────────────────────────────────────────────

interface Figure {
  label: string;
  value: ReactNode;
  /** Colours the dot: a figure that needs someone is not "info". */
  tone?: Tone;
  href?: string;
  detail?: string;
}

export function ModuleCard({
  title,
  subtitle,
  href,
  hrefLabel,
  loading,
  error,
  onRetry,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  href: string;
  hrefLabel: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Shown instead of the figures — nothing to count yet, or something to pick first. Same mascot as "No orders yet today". */
  empty?: { icon: IconComponent; title: string; description: string; kind?: EmptyStateKind };
  children?: ReactNode;
}) {
  return (
    <section className="flex h-full flex-col rounded-lg border border-rule/65 bg-card p-4 sm:p-5" aria-label={title}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-title text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Tooltip label={hrefLabel} side="top" className="shrink-0">
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
            <Link href={href} aria-label={hrefLabel}>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </Button>
        </Tooltip>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2.5" role="status" aria-busy="true" aria-label={`Loading ${title.toLowerCase()}`}>
          {['w-24', 'w-32', 'w-20', 'w-28'].map((width) => (
            <div key={width} className="flex items-center gap-3" aria-hidden="true">
              <Bone className="size-2 shrink-0 rounded-full" />
              <Bone className={`h-3.5 ${width}`} />
              <Bone className="ml-auto h-3.5 w-8" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center" role="alert">
          <AlertTriangle size={18} className="text-exception" aria-hidden="true" />
          <p className="text-sm text-foreground">{title} couldn&rsquo;t be loaded.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : empty ? (
        <EmptyState
          icon={empty.icon}
          kind={empty.kind}
          title={empty.title}
          description={empty.description}
          compact
          className="mt-4 flex-1 py-2"
        />
      ) : (
        <div className="mt-4 flex-1">{children}</div>
      )}
    </section>
  );
}

/** A ruled list of figures: dot, label, number — the Live panel's shape, so the board reads as one. */
function Figures({ items }: { items: Figure[] }) {
  return (
    <ul className="divide-y divide-rule/45">
      {items.map((item) => {
        const row = (
          <>
            <StatusDot tone={item.tone ?? 'muted'} label="" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{item.label}</span>
              {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
            </span>
            <span data-figure className="shrink-0 text-sm font-semibold text-foreground">
              {item.value}
            </span>
          </>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href} className="-mx-1 flex items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-band/50">
                {row}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-2">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The whole in one bar with its legend — Stock health's healthy/low/out, reused for every split. */
function SegmentBar({ segments, total }: { segments: Array<{ key: string; label: string; value: number; tone: Tone }>; total: number }) {
  return (
    <div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-band"
        role="img"
        aria-label={segments.map((segment) => `${segment.value} ${segment.label.toLowerCase()}`).join(', ')}
      >
        {segments.map((segment) =>
          segment.value > 0 ? (
            <span
              key={segment.key}
              className={cn('h-full first:rounded-l-full last:rounded-r-full', TONE_FILL[segment.tone])}
              style={{ width: `${(segment.value / Math.max(total, 1)) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', TONE_FILL[segment.tone])} aria-hidden="true" />
            <span data-figure className="font-semibold text-foreground">
              {segment.value}
            </span>
            {segment.label}
          </span>
        ))}
      </p>
    </div>
  );
}

/** The card's headline: one big figure and what it is. */
function Headline({ value, children }: { value: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-baseline gap-2">
      <span data-figure className="text-2xl font-semibold tracking-figure text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{children}</span>
    </p>
  );
}

// ── Inventory ────────────────────────────────────────────────────────────────

/** One thing to act on, as a row: tinted tile, what it is, its share of the whole, the count. */
function ShareRow({
  href,
  icon: Icon,
  label,
  value,
  total,
  tone,
}: {
  href: string;
  icon: IconComponent;
  label: string;
  value: number;
  total: number;
  tone: Tone;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-md bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-background"
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', TONE_TINT[tone])} aria-hidden="true">
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{label}</span>
        <MiniBar value={value} max={Math.max(total, 1)} tone={tone} label={`${value} of ${total}`} className="mt-1.5 h-1" />
      </span>
      <span data-figure className={cn('text-sm font-semibold', TONE_INK[tone])}>
        {value}
      </span>
      <ArrowRight
        size={13}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function StockHealthCard() {
  const formatMoney = useFormatMoney();
  const locationId = useWorkspaceStore((state) => state.locationId);
  const [now] = useState(() => new Date());
  // The Stock tab's own query: same key, same cache, invalidated by every stock change.
  const overview = useQuery({
    queryKey: moduleQueryKeys.inventory.key('inventory-overview', locationId),
    queryFn: () => getInventoryOverview(locationId!),
    enabled: !!locationId,
  });
  const summary = stockHealthSummary(overview.data ?? [], now);
  const healthy = Math.max(0, summary.items - summary.out - summary.low);
  const allGood = summary.out === 0 && summary.low === 0 && summary.expiring === 0;
  // The shelf in three: healthy, low, out — the stacked bar under the value.
  const segments = [
    { key: 'healthy', label: 'Healthy', value: healthy, tone: 'success' as Tone },
    { key: 'low', label: 'Low', value: summary.low, tone: 'warning' as Tone },
    { key: 'out', label: 'Out', value: summary.out, tone: 'exception' as Tone },
  ];

  return (
    <ModuleCard
      title="Stock health"
      subtitle={allGood ? 'Everything is stocked and in date' : 'What needs restocking or using first'}
      href="/inventory"
      hrefLabel="Open inventory"
      loading={!!locationId && overview.isPending}
      error={overview.isError}
      onRetry={() => void overview.refetch()}
      empty={
        !locationId
          ? { icon: MapPin, title: 'Pick a location', description: 'Stock is kept per location — choose one in the sidebar to see it.' }
          : summary.items === 0
            ? { icon: Boxes, title: 'Nothing stocked yet', description: 'Items appear here once this location starts tracking them.' }
            : undefined
      }
    >
      <div className="space-y-4">
        {/* The headline: what the shelf is worth, each container at what it cost. */}
        <div>
          <p className="flex items-baseline gap-2">
            <span data-figure className="text-2xl font-semibold tracking-figure text-foreground">
              {formatMoney(summary.value)}
            </span>
            <span className="text-xs text-muted-foreground">
              on the shelf · {summary.items} {summary.items === 1 ? 'item' : 'items'}
            </span>
          </p>
        </div>

        {/* Healthy / low / out as one bar, so the balance reads at a glance. */}
        <SegmentBar segments={segments} total={summary.items} />

        {/* What to do about it — only what needs someone; each row opens the stock list already filtered. */}
        {allGood ? (
          <p className="flex items-center gap-2 rounded-lg bg-success/6 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 size={15} aria-hidden="true" />
            Nothing out, low or expiring this week.
          </p>
        ) : (
          <div className="space-y-2 rounded-lg bg-band/50 p-2">
            {summary.out > 0 && (
              <ShareRow
                href="/inventory?view=low"
                icon={XCircle}
                label="Out of stock"
                value={summary.out}
                total={summary.items}
                tone="exception"
              />
            )}
            {summary.low > 0 && (
              <ShareRow
                href="/inventory?view=low"
                icon={AlertTriangle}
                label="Low — at or under par"
                value={summary.low}
                total={summary.items}
                tone="warning"
              />
            )}
            {summary.expiring > 0 && (
              <ShareRow
                href="/inventory?view=expiring"
                icon={CalendarClock}
                label="Expiring this week"
                value={summary.expiring}
                total={summary.items}
                tone="warning"
              />
            )}
          </div>
        )}
        {/* Last: the value above is short by these, and setting their cost is the fix. */}
        {summary.unvalued > 0 && (
          <Link
            href="/inventory"
            className="flex items-center gap-2 rounded-lg bg-measured/8 px-3 py-2.5 text-sm text-measured transition-colors hover:bg-measured/12"
          >
            <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {summary.unvalued} {summary.unvalued === 1 ? 'item has' : 'items have'} no cost yet — not counted in the value
            </span>
            <ArrowRight size={13} className="shrink-0" aria-hidden="true" />
          </Link>
        )}
      </div>
    </ModuleCard>
  );
}

// ── Workforce ────────────────────────────────────────────────────────────────

export function TeamTodayCard() {
  const locationId = useWorkspaceStore((state) => state.locationId);
  const [now] = useState(() => new Date());
  const active = useQuery({
    queryKey: moduleQueryKeys.workforce.key('shifts-active'),
    queryFn: getActiveShifts,
    refetchInterval: 60_000,
  });
  const rota = useQuery({
    queryKey: moduleQueryKeys.workforce.key('today-rota-card', workspaceDateKey(now), locationId ?? 'all'),
    queryFn: () => {
      // Today at the business, not on this device.
      const start = zonedToInstant(workspaceDateKey(now), '00:00') ?? now;
      const end = new Date(start.getTime() + 86_400_000);
      return getScheduledShifts({ from: start.toISOString(), to: end.toISOString(), ...(locationId ? { locationId } : {}) });
    },
  });
  const here = (shift: { locationId?: string | null }) => !locationId || shift.locationId === locationId;
  const summary = teamTodaySummary({
    rota: (rota.data ?? []).filter(here),
    active: (active.data ?? []).filter(here),
    now,
  });

  return (
    <ModuleCard
      title="Team today"
      subtitle="From the rota and the clock"
      href="/staff/shifts"
      hrefLabel="Open shifts"
      loading={active.isPending || rota.isPending}
      error={active.isError || rota.isError}
      onRetry={() => {
        void active.refetch();
        void rota.refetch();
      }}
      empty={
        summary.rostered === 0 && summary.onShift === 0
          ? { icon: Users, title: 'Nobody on today', description: 'Shifts appear here once someone is rostered or clocks in.' }
          : undefined
      }
    >
      <Figures
        items={[
          { label: 'Clocked in now', value: summary.onShift, tone: summary.onShift > 0 ? 'success' : 'muted', href: '/staff/shifts' },
          { label: 'Rostered today', value: summary.rostered, tone: 'info', href: '/staff/rota' },
          {
            label: 'Not in yet',
            detail: 'Their shift started, nobody clocked in',
            value: summary.missing,
            tone: summary.missing > 0 ? 'exception' : 'success',
            href: '/staff/rota',
          },
          { label: 'Hours worked so far', value: `${summary.hoursSoFar}h`, tone: 'muted' },
        ]}
      />
    </ModuleCard>
  );
}

// ── Purchasing ───────────────────────────────────────────────────────────────

export function PurchasingCard() {
  const locationId = useWorkspaceStore((state) => state.locationId);
  // Counts only: `total` of a one-row page per status.
  const all = useQueries({
    queries: (['draft', 'submitted', 'partially_received'] as const).map((status) => ({
      queryKey: moduleQueryKeys.purchasing.key('purchase-orders', 'dashboard-count', status, locationId ?? 'all'),
      queryFn: () => getPurchaseOrders({ status, limit: 1, ...(locationId ? { locationId } : {}) }),
    })),
  });
  const [drafts, sent, partial] = all as [(typeof all)[number], (typeof all)[number], (typeof all)[number]];
  const n = (query: (typeof all)[number]) => query.data?.total ?? 0;

  return (
    <ModuleCard
      title="Purchasing"
      subtitle="Orders with your suppliers"
      href="/inventory/purchasing"
      hrefLabel="Open purchase orders"
      loading={all.some((query) => query.isPending)}
      error={all.some((query) => query.isError)}
      onRetry={() => all.forEach((query) => void query.refetch())}
      empty={
        all.every((query) => n(query) === 0)
          ? { icon: ShoppingCart, kind: 'done', title: 'No orders open', description: 'Purchase orders waiting on a supplier appear here.' }
          : undefined
      }
    >
      <Figures
        items={[
          { label: 'Awaiting delivery', value: n(sent), tone: n(sent) > 0 ? 'info' : 'muted', href: '/inventory/purchasing' },
          {
            label: 'Part delivered',
            detail: 'Something still to come',
            value: n(partial),
            tone: n(partial) > 0 ? 'warning' : 'muted',
            href: '/inventory/purchasing',
          },
          { label: 'Drafts not sent', value: n(drafts), tone: n(drafts) > 0 ? 'warning' : 'muted', href: '/inventory/purchasing' },
        ]}
      />
    </ModuleCard>
  );
}

// ── Payments ─────────────────────────────────────────────────────────────────

/** A tender's tile: the thing in the customer's hand. */
const tenderIcon = (method: string): IconComponent =>
  /cash/i.test(method) ? Banknote : /gift|voucher/i.test(method) ? Gift : /web|online|stripe|paypal/i.test(method) ? Globe : CreditCard;

// Categorical, not status: no warning or exception colour for a way of paying.
const TENDER_TONES: Tone[] = ['primary', 'info', 'success', 'muted'];

export function TendersCard() {
  const formatMoney = useFormatMoney();
  const locationId = useWorkspaceStore((state) => state.locationId);
  // The shop's day, not the browser's — the same rule as the trading panels.
  const locations = useQuery({ queryKey: moduleQueryKeys.organization.key('locations-accessible'), queryFn: getLocations });
  const timeZone =
    locations.data?.find((location) => location.id === locationId)?.timezone ?? resolvedTimeZone();
  const window = getDateWindow('today', timeZone);
  const tenders = useQuery({
    queryKey: moduleQueryKeys.analytics.key('today-tenders', window.from, locationId ?? 'all'),
    queryFn: () => getPaymentMethodSales({ from: window.from, to: new Date().toISOString(), ...(locationId ? { locationId } : {}) }),
    enabled: locations.isSuccess,
    refetchInterval: 120_000,
  });
  const segments = tenderSegments(tenders.data ?? []).map((segment, index) => ({ ...segment, tone: TENDER_TONES[index] ?? 'muted' }));
  const total = segments.reduce((sum, segment) => sum + segment.revenue, 0);
  const orders = segments.reduce((sum, segment) => sum + segment.orders, 0);
  const lead = segments[0];

  return (
    <ModuleCard
      title="Takings by tender"
      subtitle={lead ? `${lead.label} leads — ${Math.round(lead.share * 100)}% of today` : 'How people paid today, net of refunds'}
      href="/reports/payment-methods"
      hrefLabel="Open the payments report"
      loading={locations.isPending || tenders.isPending}
      error={locations.isError || tenders.isError}
      onRetry={() => void tenders.refetch()}
      empty={
        segments.length === 0
          ? { icon: CreditCard, title: 'Nothing taken yet today', description: 'Each way people pay appears here as sales come in.' }
          : undefined
      }
    >
      <div className="space-y-4">
        {/* The headline: what came in, net of refunds. */}
        <p className="flex items-baseline gap-2">
          <span data-figure className="text-2xl font-semibold tracking-figure text-foreground">
            {formatMoney(total)}
          </span>
          <span className="text-xs text-muted-foreground">
            taken today{orders > 0 ? ` · ${orders} ${orders === 1 ? 'payment' : 'payments'}` : ''}
          </span>
        </p>

        {/* Every tender as one bar, so the mix reads at a glance. */}
        <div>
          <div
            className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-band"
            role="img"
            aria-label={segments.map((segment) => `${segment.label} ${Math.round(segment.share * 100)}%`).join(', ')}
          >
            {segments.map((segment) => (
              <span
                key={segment.key}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', TONE_FILL[segment.tone])}
                style={{ width: `${segment.share * 100}%` }}
              />
            ))}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {segments.map((segment) => (
              <span key={segment.key} className="flex items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', TONE_FILL[segment.tone])} aria-hidden="true" />
                <span data-figure className="font-semibold text-foreground">
                  {Math.round(segment.share * 100)}%
                </span>
                {segment.label}
              </span>
            ))}
          </p>
        </div>

        {/* Each tender as a row: its tile, its share, what it took. */}
        <div className="space-y-2 rounded-lg bg-band/50 p-2">
          {segments.map((segment) => {
            const Icon = segment.key === 'other' ? CreditCard : tenderIcon(segment.key);
            return (
              <div key={segment.key} className="flex items-center gap-3 rounded-md bg-card px-3 py-2.5 shadow-sm">
                <span
                  className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', TONE_TINT[segment.tone])}
                  aria-hidden="true"
                >
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm text-foreground">{segment.label}</span>
                    {segment.orders > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {segment.orders} {segment.orders === 1 ? 'payment' : 'payments'}
                      </span>
                    )}
                  </span>
                  <MiniBar
                    value={segment.revenue}
                    max={Math.max(total, 1)}
                    tone={segment.tone}
                    label={`${Math.round(segment.share * 100)}% of today’s takings`}
                    className="mt-1.5 h-1"
                  />
                </span>
                <span data-figure className="shrink-0 text-sm font-semibold text-foreground">
                  {formatMoney(segment.revenue)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ModuleCard>
  );
}

// ── Customers ────────────────────────────────────────────────────────────────

export function CustomersCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Totals only — a one-row page per question; the list's filters do the counting.
  const questions = [
    { name: 'all', filters: {} },
    { name: 'active-30', filters: { activeWithinDays: 30 } },
    { name: 'lapsed-60', filters: { lapsedDays: 60 } },
    { name: 'emailable', filters: { marketing: 'opted_in' as const } },
  ] as const;
  const all = useQueries({
    queries: questions.map((question) => ({
      queryKey: moduleQueryKeys.customers.key('customers', tenantId, 'dashboard', question.name),
      queryFn: () => getCustomers({ limit: 1, tenantId: tenantId ?? undefined, ...question.filters }),
      enabled: !!tenantId,
    })),
  });
  const [everyone, active, lapsed, emailable] = all.map((query) => query.data?.total ?? 0) as [number, number, number, number];
  // Seen this month, not seen for two months, and everyone between (or never seen) — they add up to the list.
  const quiet = Math.max(0, everyone - active - lapsed);
  const segments = [
    { key: 'active', label: 'Active', value: active, tone: 'success' as Tone },
    { key: 'quiet', label: 'Quiet', value: quiet, tone: 'muted' as Tone },
    { key: 'lapsed', label: 'Lapsed', value: lapsed, tone: 'warning' as Tone },
  ];

  return (
    <ModuleCard
      title="Customers"
      subtitle={everyone > 0 ? `${Math.round((active / everyone) * 100)}% came in during the last 30 days` : 'Your customer list'}
      href="/customers"
      hrefLabel="Open customers"
      loading={all.some((query) => query.isPending)}
      error={all.some((query) => query.isError)}
      onRetry={() => all.forEach((query) => void query.refetch())}
      empty={
        everyone === 0
          ? {
              icon: UserPlus,
              title: 'No customers yet',
              description: 'Everyone who orders, joins loyalty or is added by hand appears here.',
            }
          : undefined
      }
    >
      <div className="space-y-4">
        <Headline value={everyone.toLocaleString('en-GB')}>{everyone === 1 ? 'customer' : 'customers'} on your list</Headline>

        {/* Active / quiet / lapsed as one bar: how much of the list is still coming in. */}
        <SegmentBar segments={segments} total={everyone} />

        {/* Who to talk to — each row opens the list already filtered; a row with nobody in it isn't shown. */}
        {lapsed + emailable + active > 0 && (
          <div className="space-y-2 rounded-lg bg-band/50 p-2">
            {lapsed > 0 && (
              <ShareRow
                href="/customers?lapsedDays=60"
                icon={UserMinus}
                label="Not seen in 60 days — win them back"
                value={lapsed}
                total={everyone}
                tone="warning"
              />
            )}
            {emailable > 0 && (
              <ShareRow
                href="/customers?marketing=opted_in"
                icon={Mail}
                label="Happy to hear from you by email"
                value={emailable}
                total={everyone}
                tone="info"
              />
            )}
            {active > 0 && (
              <ShareRow
                href="/customers?activeWithinDays=30"
                icon={UserRound}
                label="In during the last 30 days"
                value={active}
                total={everyone}
                tone="success"
              />
            )}
          </div>
        )}
      </div>
    </ModuleCard>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

export function ContentCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Content's own overview query, so the dashboard and the Content page share a cache.
  const overview = useQuery({
    queryKey: moduleQueryKeys.cms.key('overview', tenantId),
    queryFn: () => getCmsOverview(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const entries = overview.data?.entries;
  // Archived entries are out of the picture; the rest is what the site has, or is about to.
  const current = entries ? entries.live + entries.scheduled + entries.review + entries.draft : 0;
  const segments = entries
    ? [
        { key: 'live', label: 'Live', value: entries.live, tone: 'success' as Tone },
        { key: 'scheduled', label: 'Scheduled', value: entries.scheduled, tone: 'info' as Tone },
        { key: 'review', label: 'In review', value: entries.review, tone: 'warning' as Tone },
        { key: 'draft', label: 'Drafts', value: entries.draft, tone: 'muted' as Tone },
      ]
    : [];
  const waiting = entries ? entries.review + entries.changed + entries.draft + entries.scheduled : 0;
  const latest = overview.data?.recentEntries[0];

  return (
    <ModuleCard
      title="Website content"
      subtitle={latest ? `Last edited: ${latest.title ?? latest.contentType.name}` : 'Entries across your content types'}
      href="/content"
      hrefLabel="Open content"
      loading={overview.isPending}
      error={overview.isError}
      onRetry={() => void overview.refetch()}
      empty={
        entries && entries.total === 0
          ? { icon: FileText, title: 'No content yet', description: 'Pages, posts and other entries appear here as you write them.' }
          : undefined
      }
    >
      {entries && (
        <div className="space-y-4">
          <Headline value={entries.live}>
            live on your website · {current} {current === 1 ? 'entry' : 'entries'}
          </Headline>

          {/* Live / scheduled / in review / drafts as one bar: how much is out, and how much is still with you. */}
          <SegmentBar segments={segments} total={current} />

          {/* What's waiting on someone; each row opens the entries. */}
          {waiting === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-success/6 px-3 py-2.5 text-sm text-success">
              <CheckCircle2 size={15} aria-hidden="true" />
              Everything is published — nothing waiting.
            </p>
          ) : (
            <div className="space-y-2 rounded-lg bg-band/50 p-2">
              {entries.review > 0 && (
                <ShareRow
                  href="/content?tab=entries"
                  icon={ClipboardCheck}
                  label="Waiting for review"
                  value={entries.review}
                  total={current}
                  tone="warning"
                />
              )}
              {entries.changed > 0 && (
                <ShareRow
                  href="/content?tab=entries"
                  icon={FileEdit}
                  label="Live, with unpublished changes"
                  value={entries.changed}
                  total={current}
                  tone="warning"
                />
              )}
              {entries.scheduled > 0 && (
                <ShareRow
                  href="/content?tab=entries"
                  icon={CalendarClock}
                  label="Scheduled to go live"
                  value={entries.scheduled}
                  total={current}
                  tone="info"
                />
              )}
              {entries.draft > 0 && (
                <ShareRow
                  href="/content?tab=entries"
                  icon={FileText}
                  label="Drafts not yet published"
                  value={entries.draft}
                  total={current}
                  tone="muted"
                />
              )}
            </div>
          )}
        </div>
      )}
    </ModuleCard>
  );
}

// ── Launch cards ─────────────────────────────────────────────────────────────

const LAUNCHES: Record<string, { href: string; label: string; description: string; icon: IconComponent }> = {
  'organization.readiness': {
    href: '/settings/workspaces',
    label: 'Workspace readiness',
    description: 'Finish the decisions that make this workspace ready for service.',
    icon: ClipboardCheck,
  },
  'ordering.pos-launch': {
    href: '/pos',
    label: 'Take an order',
    description: 'Open the till and start serving customers.',
    icon: ShoppingCart,
  },
  'ordering.fulfilment-launch': {
    href: '/kds',
    label: 'Run fulfilment',
    description: 'See the live queue and move orders through the kitchen.',
    icon: ChefHat,
  },
  'people.team-launch': {
    href: '/staff/team',
    label: 'People',
    description: 'Your team, roles and day-to-day people records.',
    icon: Users,
  },
  'customers.relationships-launch': {
    href: '/customers',
    label: 'Customer relationships',
    description: 'Understand returning guests and keep customer records useful.',
    icon: Store,
  },
  'communications.outreach-launch': {
    href: '/communications',
    label: 'Customer outreach',
    description: 'Prepare and send timely messages to your audience.',
    icon: Megaphone,
  },
  'compliance.audit-launch': {
    href: '/audit-log',
    label: 'Audit trail',
    description: 'Review important changes across the workspace.',
    icon: ShieldCheck,
  },
};

export const isLaunchWidget = (key: string) => key in LAUNCHES;

/** A doorway into a module with nothing to count on the dashboard. */
export function LaunchCard({ widgetKey }: { widgetKey: string }) {
  const launch = LAUNCHES[widgetKey];
  if (!launch) return null;
  const Icon = launch.icon;
  return (
    <Link
      href={launch.href}
      className="group flex h-full items-center gap-3 rounded-lg border border-rule/65 bg-card p-4 transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:outline-ring sm:p-5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{launch.label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{launch.description}</span>
      </span>
      <ArrowRight
        size={16}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}
