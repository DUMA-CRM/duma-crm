'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  FileText,
  type IconComponent,
  MapPin,
  Megaphone,
  ShieldCheck,
  ShoppingCart,
  Store,
  UserPlus,
  Users,
  XCircle,
} from '@/components/icons';
import { EmptyState, type EmptyStateKind } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { MiniBar } from '@/components/shared/MiniBar';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';
import { StatusDot } from '@/components/shared/StatusDot';
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
import {
  contentSummary,
  countNeeds,
  missingShifts,
  purchasingSummary,
  stockHealthSummary,
  teamTodaySummary,
  tenderSegments,
  topNeeds,
  wholePercents,
} from '@/lib/utils/dashboard-cards';
import {
  formatInstant,
  resolvedTimeZone,
  workspaceDateKey,
  zonedToInstant,
} from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* One card per module, so any combination of modules makes a dashboard. Each
 * reads only its own module's data, and only renders when the resolved layout
 * placed it — which the API does only while that module is enabled and the
 * viewer holds its capability. So a card never asks for something refused.
 *
 * Every module card is the same shape, as Shopify's home and Lightspeed's
 * overview tiles are: one headline figure with its status, then at most three
 * quiet lines for what needs someone, then "and N more" into the module. When
 * nothing needs anyone it says so in one line. Everything else — shelf value,
 * hours worked, every tender as a row — lives on the module's own page. */

// ── The card ─────────────────────────────────────────────────────────────────

/**
 * Every dashboard section, drawn one way: the title on the page with a small
 * outline link into the screen behind it, the content in the one card, the
 * note under it. Four states inside the card, so a failed section never
 * blanks the board.
 */
export function ModuleCard({
  id,
  title,
  footnote,
  href,
  linkLabel,
  hrefLabel,
  actions,
  loading,
  skeleton,
  error,
  onRetry,
  empty,
  children,
}: {
  /** Unique on the page, so a link can land on the section. */
  id: string;
  title: string;
  /** What the figures count, under the card. */
  footnote?: ReactNode;
  href?: string;
  /** The link's visible words — a short noun for the screen it opens. */
  linkLabel?: string;
  /** The link's accessible name. */
  hrefLabel?: string;
  /** Anything else for the title row, before the link (a target, a live dot). */
  actions?: ReactNode;
  loading: boolean;
  /** A placeholder shaped like the content; generic rows when omitted. */
  skeleton?: ReactNode;
  error: boolean;
  onRetry: () => void;
  /**
   * Shown instead of the figures — nothing to count yet, or something to pick
   * first. `quiet` draws it as one line with its glyph, no mascot: the module
   * cards' empty reading.
   */
  empty?: { icon: IconComponent; title: string; description?: string; kind?: EmptyStateKind; quiet?: boolean };
  children?: ReactNode;
}) {
  return (
    <RecordGroup
      card
      id={id}
      title={title}
      footnote={footnote}
      actions={
        (actions || href) && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {href && (
              <Button asChild variant="outline" size="sm">
                <Link href={href} aria-label={hrefLabel}>
                  {linkLabel ?? 'Open'}
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        )
      }
    >
      {loading ? (
        (skeleton ?? (
          <div className="space-y-3 py-1" role="status" aria-busy="true" aria-label={`Loading ${title.toLowerCase()}`}>
            <Bone className="h-7 w-32" />
            {['w-24', 'w-32', 'w-20'].map((width) => (
              <div key={width} className="flex items-center gap-3" aria-hidden="true">
                <Bone className="size-8 shrink-0" />
                <Bone className={`h-3.5 ${width}`} />
                <Bone className="ml-auto h-3.5 w-8" />
              </div>
            ))}
          </div>
        ))
      ) : error ? (
        <ErrorState title={`${title} couldn’t be loaded`} onRetry={onRetry} className="py-6" />
      ) : empty?.quiet ? (
        <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <empty.icon size={15} className="shrink-0" aria-hidden="true" />
          {empty.title}
        </p>
      ) : empty ? (
        <EmptyState icon={empty.icon} kind={empty.kind} title={empty.title} description={empty.description} compact className="py-4" />
      ) : (
        children
      )}
    </RecordGroup>
  );
}

// ── The module cards' one shape ──────────────────────────────────────────────

/** The headline: one figure, what it counts, and one line of status under it. */
function Headline({ value, label, status }: { value: ReactNode; label?: ReactNode; status?: ReactNode }) {
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span data-figure className="text-2xl font-semibold tracking-figure text-foreground">
          {value}
        </span>
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </p>
      {status && <p className="mt-1 truncate text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}

/** A status part that needs someone: its own ink, the rest of the line stays quiet. */
function Flag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn('font-semibold', TONE_INK[tone])}>{children}</span>;
}

/** Parts of a status line, joined by a middle dot, empties dropped. */
function Parts({ children }: { children: ReactNode[] }) {
  const parts = children.filter((part) => part !== null && part !== false && part !== undefined && part !== '');
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && ' · '}
          {part}
        </span>
      ))}
    </>
  );
}

interface Need {
  key: string;
  href: string;
  tone: Tone;
  /** The dot's word for a screen reader ("Out of stock"); the title says it when omitted. */
  toneLabel?: string;
  title: string;
  meta?: string;
  value?: ReactNode;
}

/**
 * What needs someone, at most three quiet rows — dot, what it is, a short
 * detail, the count — then "and N more" into the module. No rules between
 * rows; each row is a 44px target. With nothing to list, one calm line.
 */
function Needs({ items, more = 0, moreHref, clear }: { items: Need[]; more?: number; moreHref: string; clear: string }) {
  if (items.length === 0) {
    return (
      <p className="mt-3 flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 size={15} className="shrink-0 text-momentum" aria-hidden="true" />
        {clear}
      </p>
    );
  }
  return (
    <div className="mt-3">
      <ul className="-mx-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="group flex min-h-11 items-center gap-3 rounded-md px-2 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <StatusDot tone={item.tone} label={item.toneLabel ?? ''} />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.title}</span>
              {item.meta && <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>}
              {item.value !== undefined && (
                <span data-figure className="shrink-0 text-sm font-semibold text-foreground">
                  {item.value}
                </span>
              )}
              <ArrowRight
                size={13}
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link
          href={moreHref}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          and {more} more
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/** The card's own placeholder: a headline, its status, two rows. */
function SummarySkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <Bone className="h-7 w-28" />
      <Bone className="mt-2 h-3 w-40" />
      <div className="mt-3" aria-hidden="true">
        {['w-32', 'w-24'].map((width) => (
          <div key={width} className="flex min-h-11 items-center gap-3">
            <Bone className="size-2 shrink-0 rounded-full" />
            <Bone className={`h-3.5 ${width}`} />
            <Bone className="ml-auto h-3.5 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;

// ── Inventory ────────────────────────────────────────────────────────────────

/* Stock health keeps its stat-card form (user decision, 2026-11-17): the
   shelf value, the healthy / low / out bar, and a row per reading that needs
   someone. Only the house fixes apply — no footnote, no tinted trough, no
   shadowed rows inside the card. */

/** The whole in one bar with its legend: healthy, low, out. */
function SegmentBar({ segments, total }: { segments: Array<{ key: string; label: string; value: number; tone: Tone }>; total: number }) {
  return (
    <div>
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-band"
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
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        {segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', TONE_FILL[segment.tone])} />
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

/** One reading to act on: tinted tile, what it is, its share of the shelf, the count. Flat, 44px, no rules. */
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
      className="group -mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
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
  const segments = [
    { key: 'healthy', label: 'Healthy', value: healthy, tone: 'success' as Tone },
    { key: 'low', label: 'Low', value: summary.low, tone: 'warning' as Tone },
    { key: 'out', label: 'Out', value: summary.out, tone: 'exception' as Tone },
  ];

  return (
    <ModuleCard
      title="Stock health"
      id="dashboard-stock-health"
      href="/inventory"
      linkLabel="Inventory"
      hrefLabel="Open inventory"
      loading={!!locationId && overview.isPending}
      error={overview.isError}
      onRetry={() => void overview.refetch()}
      empty={
        !locationId
          ? { icon: MapPin, title: 'Pick a location to see its stock', quiet: true }
          : summary.items === 0
            ? { icon: Boxes, title: 'Nothing stocked here yet', quiet: true }
            : undefined
      }
    >
      <div className="space-y-4">
        {/* The headline: what the shelf is worth, each container at what it cost. */}
        <Headline value={formatMoney(summary.value)} label={`on the shelf · ${plural(summary.items, 'item', 'items')}`} />

        <SegmentBar segments={segments} total={summary.items} />

        {/* Only what needs someone; each row opens the stock list already filtered. */}
        {allGood ? (
          <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 size={15} className="shrink-0 text-momentum" aria-hidden="true" />
            Nothing out, low or expiring this week
          </p>
        ) : (
          <div>
            {summary.out > 0 && (
              <ShareRow href="/inventory?view=low" icon={XCircle} label="Out of stock" value={summary.out} total={summary.items} tone="exception" />
            )}
            {summary.low > 0 && (
              <ShareRow href="/inventory?view=low" icon={AlertTriangle} label="Low — at or under par" value={summary.low} total={summary.items} tone="warning" />
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
        {/* The value above is short by these, and setting their cost is the fix — a quiet row, not a tinted box. */}
        {summary.unvalued > 0 && (
          <Link
            href="/inventory"
            className="group -mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-band/50 hover:text-foreground"
          >
            <AlertTriangle size={15} className="shrink-0 text-measured" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {plural(summary.unvalued, 'item has', 'items have')} no cost yet, so {summary.unvalued === 1 ? 'it isn’t' : 'they aren’t'} in the value
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
  const input = { rota: (rota.data ?? []).filter(here), active: (active.data ?? []).filter(here), now };
  const summary = teamTodaySummary(input);
  const missing = topNeeds(missingShifts(input));

  return (
    <ModuleCard
      title="Team today"
      id="dashboard-team-today"
      href="/staff/shifts"
      linkLabel="Shifts"
      hrefLabel="Open shifts"
      loading={active.isPending || rota.isPending}
      skeleton={<SummarySkeleton label="Loading today’s team" />}
      error={active.isError || rota.isError}
      onRetry={() => {
        void active.refetch();
        void rota.refetch();
      }}
      empty={summary.rostered === 0 && summary.onShift === 0 ? { icon: Users, title: 'Nobody on today', quiet: true } : undefined}
    >
      <Headline
        value={summary.onShift}
        label="on shift"
        status={
          <Parts>
            {[
              summary.rostered > 0 && `${summary.rostered} rostered today`,
              summary.missing > 0 && <Flag tone="exception">{summary.missing} not in</Flag>,
            ]}
          </Parts>
        }
      />
      <Needs
        items={missing.shown.map((shift) => ({
          key: shift.id,
          href: '/staff/rota',
          tone: 'exception',
          toneLabel: 'Not clocked in',
          title: shift.name ?? 'Someone rostered',
          meta: `Due ${formatInstant(shift.startsAt, { hour: '2-digit', minute: '2-digit' })}`,
        }))}
        more={missing.more}
        moreHref="/staff/rota"
        clear="Nobody’s late"
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
  const [drafts, sent, partial] = all.map((query) => query.data?.total ?? 0) as [number, number, number];
  const summary = purchasingSummary({ drafts, sent, partial });

  return (
    <ModuleCard
      title="Purchasing"
      id="dashboard-purchasing"
      href="/inventory/purchasing"
      linkLabel="Purchase orders"
      hrefLabel="Open purchase orders"
      loading={all.some((query) => query.isPending)}
      skeleton={<SummarySkeleton label="Loading purchase orders" />}
      error={all.some((query) => query.isError)}
      onRetry={() => all.forEach((query) => void query.refetch())}
      empty={drafts + sent + partial === 0 ? { icon: ShoppingCart, title: 'No orders open', quiet: true } : undefined}
    >
      <Headline
        value={summary.awaiting}
        label={summary.awaiting === 1 ? 'delivery due' : 'deliveries due'}
        status={sent > 0 ? `${plural(sent, 'order', 'orders')} sent, nothing in yet` : undefined}
      />
      <Needs
        items={summary.needs.map((need) => ({
          key: need.key,
          href: '/inventory/purchasing',
          tone: 'warning',
          title: need.label,
          value: need.value,
        }))}
        moreHref="/inventory/purchasing"
        clear="Nothing to chase"
      />
    </ModuleCard>
  );
}

// ── Payments ─────────────────────────────────────────────────────────────────

// Categorical identity, not status: the validated series order, never warning or exception colours.
const TENDER_FILL = ['bg-series-1', 'bg-series-2', 'bg-series-3', 'bg-series-4'];

export function TendersCard() {
  const formatMoney = useFormatMoney();
  const locationId = useWorkspaceStore((state) => state.locationId);
  // The shop's day, not the browser's — the same rule as the trading panels.
  const locations = useQuery({ queryKey: moduleQueryKeys.organization.key('locations-accessible'), queryFn: getLocations });
  const timeZone = locations.data?.find((location) => location.id === locationId)?.timezone ?? resolvedTimeZone();
  const window = getDateWindow('today', timeZone);
  const tenders = useQuery({
    queryKey: moduleQueryKeys.analytics.key('today-tenders', window.from, locationId ?? 'all'),
    queryFn: () => getPaymentMethodSales({ from: window.from, to: new Date().toISOString(), ...(locationId ? { locationId } : {}) }),
    enabled: locations.isSuccess,
    refetchInterval: 120_000,
  });
  const segments = tenderSegments(tenders.data ?? []);
  const percents = wholePercents(segments.map((segment) => segment.revenue));
  const total = segments.reduce((sum, segment) => sum + segment.revenue, 0);
  const payments = segments.reduce((sum, segment) => sum + segment.orders, 0);

  return (
    <ModuleCard
      title="Takings by tender"
      id="dashboard-tenders"
      href="/reports/payment-methods"
      linkLabel="Payments"
      hrefLabel="Open the payments report"
      loading={locations.isPending || tenders.isPending}
      skeleton={<SummarySkeleton label="Loading today’s takings by tender" />}
      error={locations.isError || tenders.isError}
      onRetry={() => void tenders.refetch()}
      empty={segments.length === 0 ? { icon: CreditCard, title: 'Nothing taken yet today', quiet: true } : undefined}
    >
      <Headline
        value={formatMoney(total)}
        label="taken today"
        status={<Parts>{[payments > 0 && plural(payments, 'payment', 'payments'), 'net of refunds']}</Parts>}
      />
      {/* The split as one slim bar, a 2px gap between tenders, every share named in the legend. */}
      <div className="mt-4">
        <div
          className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-band"
          role="img"
          aria-label={segments.map((segment, index) => `${segment.label} ${percents[index]}%`).join(', ')}
        >
          {segments.map((segment, index) => (
            <span
              key={segment.key}
              className={cn('h-full first:rounded-l-full last:rounded-r-full', TENDER_FILL[index] ?? 'bg-series-4')}
              style={{ width: `${segment.share * 100}%` }}
            />
          ))}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
          {segments.map((segment, index) => (
            <li key={segment.key} className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', TENDER_FILL[index] ?? 'bg-series-4')} />
              {segment.label}
              <span data-figure className="font-semibold text-foreground">
                {percents[index]}%
              </span>
            </li>
          ))}
        </ul>
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
  const needs = countNeeds([
    { key: 'lapsed', label: 'Not seen in 60 days', value: lapsed },
    { key: 'emailable', label: 'Opted in to email', value: emailable },
  ]);
  const NEED: Record<string, { href: string; tone: Tone }> = {
    lapsed: { href: '/customers?lapsedDays=60', tone: 'warning' },
    emailable: { href: '/customers?marketing=opted_in', tone: 'info' },
  };

  return (
    <ModuleCard
      title="Customers"
      id="dashboard-customers"
      href="/customers"
      linkLabel="Customers"
      hrefLabel="Open customers"
      loading={all.some((query) => query.isPending)}
      skeleton={<SummarySkeleton label="Loading customers" />}
      error={all.some((query) => query.isError)}
      onRetry={() => all.forEach((query) => void query.refetch())}
      empty={everyone === 0 ? { icon: UserPlus, title: 'No customers yet', quiet: true } : undefined}
    >
      <Headline
        value={everyone.toLocaleString('en-GB')}
        label={everyone === 1 ? 'customer' : 'customers'}
        status={`${active.toLocaleString('en-GB')} in during the last 30 days`}
      />
      <Needs
        items={needs.map((need) => ({
          key: need.key,
          href: NEED[need.key]!.href,
          tone: NEED[need.key]!.tone,
          title: need.label,
          value: need.value.toLocaleString('en-GB'),
        }))}
        moreHref="/customers"
        clear="Nobody lapsed"
      />
    </ModuleCard>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

const CONTENT_TONE: Record<string, Tone> = { review: 'warning', changed: 'warning', draft: 'muted' };

export function ContentCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Content's own overview query, so the dashboard and the Content page share a cache.
  const overview = useQuery({
    queryKey: moduleQueryKeys.cms.key('overview', tenantId),
    queryFn: () => getCmsOverview(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const entries = overview.data?.entries;
  const summary = entries ? contentSummary(entries) : null;

  return (
    <ModuleCard
      title="Website content"
      id="dashboard-content"
      href="/content"
      linkLabel="Content"
      hrefLabel="Open content"
      loading={overview.isPending}
      skeleton={<SummarySkeleton label="Loading website content" />}
      error={overview.isError}
      onRetry={() => void overview.refetch()}
      empty={entries && entries.total === 0 ? { icon: FileText, title: 'No content yet', quiet: true } : undefined}
    >
      {summary && (
        <>
          <Headline
            value={summary.live}
            label="live"
            status={summary.scheduled > 0 ? `${summary.scheduled} scheduled to go live` : 'Nothing scheduled'}
          />
          <Needs
            items={summary.needs.map((need) => ({
              key: need.key,
              href: '/content?tab=entries',
              tone: CONTENT_TONE[need.key] ?? 'muted',
              title: need.label,
              value: need.value,
            }))}
            moreHref="/content?tab=entries"
            clear="Nothing waiting"
          />
        </>
      )}
    </ModuleCard>
  );
}

// ── Launch cards ─────────────────────────────────────────────────────────────

const LAUNCHES: Record<string, { href: string; label: string; icon: IconComponent }> = {
  'organization.readiness': {
    href: '/settings/workspaces',
    label: 'Workspace readiness',
    icon: ClipboardCheck,
  },
  'ordering.pos-launch': {
    href: '/pos',
    label: 'Take an order',
    icon: ShoppingCart,
  },
  'ordering.fulfilment-launch': {
    href: '/kds',
    label: 'Run fulfilment',
    icon: ChefHat,
  },
  'customers.relationships-launch': {
    href: '/customers',
    label: 'Customer relationships',
    icon: Store,
  },
  'communications.outreach-launch': {
    href: '/communications',
    label: 'Customer outreach',
    icon: Megaphone,
  },
  'compliance.audit-launch': {
    href: '/audit-log',
    label: 'Audit trail',
    icon: ShieldCheck,
  },
};

export const isLaunchWidget = (key: string) => key in LAUNCHES;

/** A doorway into a module with nothing to count: the module cards' card and padding, its name and an arrow. */
export function LaunchCard({ widgetKey }: { widgetKey: string }) {
  const launch = LAUNCHES[widgetKey];
  if (!launch) return null;
  const Icon = launch.icon;
  return (
    <Link
      href={launch.href}
      className="group flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{launch.label}</span>
      <ArrowRight
        size={16}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}
