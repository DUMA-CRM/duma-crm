'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import {
  Widget,
  WidgetCaption,
  WidgetDot,
  WidgetFigure,
  WidgetRow,
  WidgetSlim,
  type WidgetTint,
  isSlim,
  useFamily,
  useRows,
} from '@/components/dashboard/widget/Widget';
import {
  Boxes,
  CheckCircle2,
  ChefHat,
  ChevronRight,
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
} from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';
import { TONE_FILL, type Tone } from '@/components/shared/tone';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { getPaymentMethodSales } from '@/lib/modules/analytics/client';
import { type CmsEntryStatus, type CmsOverview, getCmsOverview } from '@/lib/modules/cms/client';
import { getCustomers } from '@/lib/modules/customers/client';
import { type InventoryOverviewRow, getInventoryOverview } from '@/lib/modules/inventory/client';
import { getLocations } from '@/lib/modules/organization/client';
import { type PurchaseOrder, getPurchaseOrders } from '@/lib/modules/purchasing/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type ScheduledShift, type Shift, getActiveShifts, getScheduledShifts } from '@/lib/modules/workforce/client';
import { entryStatusMeta } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { getDateWindow } from '@/lib/utils/dashboard';
import {
  type StockAttentionReason,
  contentSummary,
  deliveriesDue,
  missingShifts,
  stockAttention,
  stockHealthSummary,
  teamTodaySummary,
  tenderSegments,
  wholePercents,
} from '@/lib/utils/dashboard-cards';
import { relativeTime } from '@/lib/utils/relative-time';
import { formatInstant, resolvedTimeZone, workspaceDateKey, zonedToInstant } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Customer } from '@/types/customers';

/* One widget per module, so any combination of modules makes a dashboard.
 * Each reads only its own module's data, and only renders when the resolved
 * layout placed it — which the API does only while that module is enabled and
 * the viewer holds its capability. So a widget never asks for something
 * refused.
 *
 * They share one shape, `ModuleReading`: the headline figure, the module as
 * one split bar (each colour says what it is on hover), then its rows by name
 * — the late, the low, the lapsed — as many as the widget holds. When there is
 * nothing to list it says so in one line. */

// ── The shared shape ─────────────────────────────────────────────────────────

/** A status part that needs someone: its own ink, the rest of the line stays quiet. */
function Flag({ tone, children }: { tone: Tone; children: ReactNode }) {
  const ink: Record<Tone, string> = {
    primary: 'text-primary',
    success: 'text-momentum',
    warning: 'text-measured',
    exception: 'text-exception',
    info: 'text-reference',
    muted: 'text-muted-foreground',
  };
  return <span className={cn('font-semibold', ink[tone])}>{children}</span>;
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

/** The rows that need someone, as many as fit, then "and N more"; one calm line when there are none. */
function NeedRows({
  items,
  more = 0,
  clear,
  capacity,
  detailed,
}: {
  items: Need[];
  more?: number;
  clear: string;
  capacity: number;
  detailed: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <CheckCircle2 size={14} className="shrink-0 text-momentum" aria-hidden="true" />
        <span className="truncate">{clear}</span>
      </p>
    );
  }
  const fits = items.length + (more > 0 ? 1 : 0) > capacity ? Math.max(1, capacity - 1) : items.length;
  const hidden = items.length - fits + more;
  return (
    <div className="min-w-0">
      <ul>
        {items.slice(0, fits).map((item) => (
          <WidgetRow
            key={item.key}
            href={item.href}
            mark={<WidgetDot className={TONE_FILL[item.tone]} label={item.toneLabel ?? item.title} />}
            title={item.title}
            detail={detailed ? item.meta : undefined}
            value={item.value ?? (detailed ? undefined : item.meta)}
            valueClassName={item.value === undefined ? 'font-normal text-muted-foreground' : undefined}
          />
        ))}
      </ul>
      {hidden > 0 && <p className="pt-0.5 text-[11px] text-muted-foreground">and {hidden} more</p>}
    </div>
  );
}

/** A whole split as one bar with its legend — the shelf's health, the day's tenders. */
function ShareBar({
  segments,
  legend = true,
}: {
  segments: Array<{
    key: string;
    label: string;
    value: number;
    share: number;
    fill: string;
    legend: string | number;
    /** What hovering the segment says; "Label: legend" when omitted. */
    tip?: string;
  }>;
  /** Off where half a square has no room for it; the bar keeps its spoken label. */
  legend?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className="flex h-2 gap-[2px] rounded-full bg-band"
        role="img"
        aria-label={segments.map((segment) => `${segment.label} ${segment.value}`).join(', ')}
      >
        {segments.map((segment) =>
          segment.share > 0 ? (
            // Each colour says what it is on hover; the hit area reaches past the 8px bar so it can be found.
            <Tooltip
              key={segment.key}
              side="top"
              label={segment.tip ?? `${segment.label}: ${segment.legend}`}
              className={cn(
                'relative h-full first:rounded-l-full last:rounded-r-full before:absolute before:inset-x-0 before:-inset-y-2 before:content-[""]',
                segment.fill,
              )}
              style={{ width: `${segment.share * 100}%` }}
            >
              {null}
            </Tooltip>
          ) : null,
        )}
      </div>
      {legend && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground" aria-hidden="true">
          {segments.map((segment) => (
            <li key={segment.key} className="flex min-w-0 items-center gap-1">
              <span className={cn('size-1.5 shrink-0 rounded-full', segment.fill)} />
              <span className="truncate">{segment.label}</span>
              <span className="font-semibold text-heading tabular-nums">{segment.legend}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Segment = Parameters<typeof ShareBar>[0]['segments'][number];

/**
 * A module widget read as a split and a list, the Website content and Stock
 * health shape. Bar: the figure with its word on one line, beside the bare
 * split and one line. Small: the figure over the bare split and one line. Medium: figure,
 * status and split beside the first rows of the list. Large: the same, then as
 * many rows as the cell holds, each with its detail.
 */
function ModuleReading({
  value,
  unit,
  caption,
  status,
  slimStatus,
  segments: rawSegments,
  noun,
  listTitle,
  list,
}: {
  value: ReactNode;
  /** The figure's word on a half-height bar, beside it ("live", "on the shelf"). */
  unit: string;
  caption: ReactNode;
  status: ReactNode;
  /** The one line under the bar at half height; shortest wording. */
  slimStatus: ReactNode;
  segments: Segment[];
  /** What the split counts ("item", "items"), for each colour's tooltip: "Low · 5 items · 12%". */
  noun?: [one: string, many: string];
  listTitle: string;
  list: (count: number, detailed: boolean) => ReactNode;
}) {
  const family = useFamily();
  const segments = noun
    ? rawSegments.map((segment) => ({
        ...segment,
        tip: segment.tip ?? `${segment.label} · ${plural(segment.value, ...noun)} · ${Math.round(segment.share * 100)}%`,
      }))
    : rawSegments;
  // The figure, its captions and the split take ~120px; each row 40px.
  const capacity = useRows(40, 120);

  if (isSlim(family)) {
    return (
      <WidgetSlim
        // The word beside the figure, not under it: stacked, the two outgrow half a square and meet the header.
        value={
          <span className="flex items-baseline gap-1.5">
            {value}
            <span className="truncate text-[13px] font-normal tracking-normal text-muted-foreground">{unit}</span>
          </span>
        }
        visual={
          <div className="min-w-0">
            <ShareBar segments={segments} legend={false} />
            <p className="mt-1.5 truncate text-[11px] leading-4 text-muted-foreground">{slimStatus}</p>
          </div>
        }
      />
    );
  }

  const reading = (
    <div className="min-w-0">
      <WidgetFigure value={value} size={family === 'small' ? 'small' : family === 'medium' ? 'medium' : 'large'} />
      <WidgetCaption className="mt-1">{caption}</WidgetCaption>
    </div>
  );

  if (family === 'small') {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3">
        {reading}
        <ShareBar segments={segments} legend={false} />
        <WidgetCaption className="-mt-1.5 text-xs">{slimStatus}</WidgetCaption>
      </div>
    );
  }

  const title = <p className="pb-1 text-[11px] leading-4 text-muted-foreground">{listTitle}</p>;

  if (family === 'medium') {
    return (
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
          <div className="min-w-0">
            {reading}
            <WidgetCaption className="text-xs">{status}</WidgetCaption>
          </div>
          <ShareBar segments={segments} />
        </div>
        <div className="flex w-[52%] min-w-0 shrink-0 flex-col justify-end">
          {title}
          {list(3, false)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-w-0">
        {reading}
        <WidgetCaption className="text-xs">{status}</WidgetCaption>
      </div>
      <div className="mt-3">
        <ShareBar segments={segments} />
      </div>
      <div className="mt-auto pt-3">
        {title}
        {list(capacity, true)}
      </div>
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;

// ── Inventory ────────────────────────────────────────────────────────────────

const ATTENTION: Record<StockAttentionReason, { tone: Tone; label: string; view: string }> = {
  out: { tone: 'exception', label: 'Out of stock', view: 'low' },
  low: { tone: 'warning', label: 'Low', view: 'low' },
  expiring: { tone: 'info', label: 'Expiring this week', view: 'expiring' },
};

export function StockHealthCard() {
  const locationId = useWorkspaceStore((state) => state.locationId);
  // The Stock tab's own query: same key, same cache, invalidated by every stock change.
  const overview = useQuery({
    queryKey: moduleQueryKeys.inventory.key('inventory-overview', locationId),
    queryFn: () => getInventoryOverview(locationId!),
    enabled: !!locationId,
  });

  return (
    <Widget
      title="Stock health"
      icon={Boxes}
      tint="stock"
      surface="plain"
      href="/inventory"
      hrefLabel="Open inventory"
      loading={!!locationId && overview.isPending}
      error={overview.isError}
      onRetry={() => void overview.refetch()}
      empty={
        !locationId
          ? { icon: MapPin, title: 'Pick a location to see its stock' }
          : overview.data?.length === 0
            ? { title: 'Nothing stocked here yet' }
            : undefined
      }
    >
      {overview.data && overview.data.length > 0 && <StockReading rows={overview.data} />}
    </Widget>
  );
}

/**
 * The shelf as its worth, its health as one split, then the items to act on by
 * name — out first, then the emptiest against par, then what expires soonest.
 */
function StockReading({ rows }: { rows: InventoryOverviewRow[] }) {
  const formatMoney = useFormatMoney();
  const [now] = useState(() => new Date());
  const summary = stockHealthSummary(rows, now);
  const attention = stockAttention(rows, now);
  const healthy = Math.max(0, summary.items - summary.out - summary.low);
  const share = (value: number) => value / Math.max(summary.items, 1);
  const quantity = (value: string, unit: string) => `${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${unit}`;
  const flags = [
    summary.out > 0 && <Flag tone="exception">{summary.out} out</Flag>,
    summary.low > 0 && <Flag tone="warning">{summary.low} low</Flag>,
  ];

  return (
    <ModuleReading
      value={formatMoney(summary.value)}
      unit="on the shelf"
      noun={['item', 'items']}
      caption={`on the shelf · ${plural(summary.items, 'item', 'items')}`}
      status={
        summary.out + summary.low > 0 ? (
          <Parts>{[...flags, summary.expiring > 0 && `${summary.expiring} expiring`]}</Parts>
        ) : summary.expiring > 0 ? (
          `${plural(summary.expiring, 'item expires', 'items expire')} this week`
        ) : (
          'Everything stocked'
        )
      }
      slimStatus={summary.out + summary.low > 0 ? <Parts>{flags}</Parts> : 'All healthy'}
      segments={[
        { key: 'healthy', label: 'Healthy', value: healthy, share: share(healthy), fill: 'bg-momentum', legend: healthy },
        { key: 'low', label: 'Low', value: summary.low, share: share(summary.low), fill: 'bg-measured', legend: summary.low },
        { key: 'out', label: 'Out', value: summary.out, share: share(summary.out), fill: 'bg-exception', legend: summary.out },
      ]}
      listTitle="To restock"
      list={(count, detailed) => {
        const fits = attention.length > count ? Math.max(1, count - 1) : attention.length;
        const hidden = attention.length - fits;
        if (attention.length === 0)
          return <NeedRows items={[]} clear="Nothing out, low or expiring this week" capacity={1} detailed={false} />;
        return (
          <div className="min-w-0">
            <ul>
              {attention.slice(0, fits).map(({ row, reason }) => (
                <WidgetRow
                  key={row.stockItemId}
                  href={`/inventory?view=${ATTENTION[reason].view}`}
                  mark={<WidgetDot className={TONE_FILL[ATTENTION[reason].tone]} label={ATTENTION[reason].label} />}
                  title={row.name}
                  detail={
                    detailed ? (reason === 'low' ? `Par ${quantity(row.reorderLevel, row.unit)}` : ATTENTION[reason].label) : undefined
                  }
                  value={
                    reason === 'out' ? (
                      <Flag tone="exception">Out</Flag>
                    ) : reason === 'low' ? (
                      quantity(row.totalOnHand, row.unit)
                    ) : (
                      relativeTime(row.earliestExpiryDate, now.getTime())
                    )
                  }
                  valueClassName={reason === 'low' ? undefined : 'font-normal text-muted-foreground'}
                />
              ))}
            </ul>
            {hidden > 0 && <p className="pt-0.5 text-[11px] text-muted-foreground">and {hidden} more</p>}
          </div>
        );
      }}
    />
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

  return (
    <Widget
      title="Team today"
      icon={Users}
      tint="team"
      surface="plain"
      href="/staff/rota"
      hrefLabel="Open shifts"
      loading={active.isPending || rota.isPending}
      error={active.isError || rota.isError}
      onRetry={() => {
        void active.refetch();
        void rota.refetch();
      }}
      empty={summary.rostered === 0 && summary.onShift === 0 ? { title: 'Nobody on today' } : undefined}
    >
      <TeamReading input={input} summary={summary} />
    </Widget>
  );
}

/** "45m" / "2h 05m" on the clock. */
const onClock = (fromIso: string, now: number) => {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
};

/**
 * Who is in against who was rostered, as one split — in, not in, still to
 * come — then the team by name: anyone late first, then who is on the clock,
 * longest in first.
 */
function TeamReading({
  input,
  summary,
}: {
  input: { rota: ScheduledShift[]; active: Shift[]; now: Date };
  summary: ReturnType<typeof teamTodaySummary>;
}) {
  const now = input.now.getTime();
  const missing = missingShifts(input);
  const later = Math.max(0, summary.rostered - summary.onShift - summary.missing);
  const total = Math.max(summary.onShift + summary.missing + later, 1);
  const clock = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });
  const onShift = [...input.active].sort((a, b) => a.clockedIn.localeCompare(b.clockedIn));
  const people = [
    ...missing.map((shift) => ({
      key: `missing-${shift.id}`,
      href: '/staff/rota',
      dot: TONE_FILL.exception,
      dotLabel: 'Not clocked in',
      name: shift.name ?? 'Someone rostered',
      detail: `Due ${clock(shift.startsAt)}`,
      value: <Flag tone="exception">Not in</Flag>,
      brief: <Flag tone="exception">Not in</Flag>,
    })),
    ...onShift.map((shift) => ({
      key: `in-${shift.id}`,
      href: '/staff/rota',
      dot: TONE_FILL.success,
      dotLabel: 'On shift',
      name: shift.staff?.name ?? shift.staff?.user?.name ?? 'Someone',
      detail: `In since ${clock(shift.clockedIn)}`,
      value: onClock(shift.clockedIn, now),
      brief: `since ${clock(shift.clockedIn)}`,
    })),
  ];

  return (
    <ModuleReading
      value={summary.rostered > 0 ? `${summary.onShift}/${summary.rostered}` : summary.onShift}
      unit={summary.rostered > 0 ? 'in' : 'on shift'}
      noun={['person', 'people']}
      caption={summary.rostered > 0 ? 'in of those rostered' : 'on shift'}
      status={
        summary.missing > 0 ? (
          <Parts>
            {[
              <Flag key="missing" tone="exception">
                {summary.missing} not in
              </Flag>,
              later > 0 && `${later} still to come`,
            ]}
          </Parts>
        ) : (
          <Parts>{[`${summary.hoursSoFar.toFixed(1)}h worked so far`, later > 0 && `${later} still to come`]}</Parts>
        )
      }
      slimStatus={
        summary.missing > 0 ? (
          <Flag tone="exception">{summary.missing} not in</Flag>
        ) : later > 0 ? (
          `${later} still to come`
        ) : (
          'Everyone’s in'
        )
      }
      segments={[
        { key: 'in', label: 'In', value: summary.onShift, share: summary.onShift / total, fill: 'bg-momentum', legend: summary.onShift },
        {
          key: 'missing',
          label: 'Not in',
          value: summary.missing,
          share: summary.missing / total,
          fill: 'bg-exception',
          legend: summary.missing,
        },
        { key: 'later', label: 'Later', value: later, share: later / total, fill: 'bg-muted-foreground/40', legend: later },
      ]}
      listTitle={summary.missing > 0 ? 'Not in, then on shift' : 'On shift'}
      list={(count, detailed) => {
        if (people.length === 0) return <NeedRows items={[]} clear="Nobody on the clock yet" capacity={1} detailed={false} />;
        const fits = people.length > count ? Math.max(1, count - 1) : people.length;
        const hidden = people.length - fits;
        return (
          <div className="min-w-0">
            <ul>
              {people.slice(0, fits).map((person) => (
                <WidgetRow
                  key={person.key}
                  href={person.href}
                  mark={<WidgetDot className={person.dot} label={person.dotLabel} />}
                  title={person.name}
                  detail={detailed ? person.detail : undefined}
                  value={detailed ? person.value : person.brief}
                  valueClassName="font-normal text-muted-foreground"
                />
              ))}
            </ul>
            {hidden > 0 && <p className="pt-0.5 text-[11px] text-muted-foreground">and {hidden} more</p>}
          </div>
        );
      }}
    />
  );
}

// ── Purchasing ───────────────────────────────────────────────────────────────

export function PurchasingCard() {
  const locationId = useWorkspaceStore((state) => state.locationId);
  // A page per status: `total` is the count, and the open ones bring back their first orders to name.
  const all = useQueries({
    queries: (['draft', 'submitted', 'partially_received'] as const).map((status) => ({
      queryKey: moduleQueryKeys.purchasing.key('purchase-orders', 'dashboard', status, locationId ?? 'all'),
      queryFn: () => getPurchaseOrders({ status, limit: status === 'draft' ? 1 : 6, ...(locationId ? { locationId } : {}) }),
    })),
  });
  const [drafts, sent, partial] = all.map((query) => query.data?.total ?? 0) as [number, number, number];

  return (
    <Widget
      title="Purchasing"
      icon={ShoppingCart}
      tint="stock"
      surface="plain"
      href="/inventory?tab=demand"
      hrefLabel="Open purchase orders"
      loading={all.some((query) => query.isPending)}
      error={all.some((query) => query.isError)}
      onRetry={() => all.forEach((query) => void query.refetch())}
      empty={drafts + sent + partial === 0 ? { title: 'No orders open' } : undefined}
    >
      <PurchasingReading counts={{ drafts, sent, partial }} open={[...(all[2].data?.data ?? []), ...(all[1].data?.data ?? [])]} />
    </Widget>
  );
}

/**
 * Deliveries due as the figure, the open orders as one split — sent, part
 * delivered, drafts — then each delivery by supplier, late ones first.
 */
function PurchasingReading({
  counts: { drafts, sent, partial },
  open,
}: {
  counts: { drafts: number; sent: number; partial: number };
  open: PurchaseOrder[];
}) {
  const formatMoney = useFormatMoney();
  const [now] = useState(() => new Date());
  const due = deliveriesDue(open, now);
  const awaiting = sent + partial;
  const late = due.filter((delivery) => delivery.lateDays > 0).length;
  const total = Math.max(drafts + sent + partial, 1);
  const day = (iso: string) => formatInstant(iso, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <ModuleReading
      value={awaiting}
      unit="due"
      noun={['order', 'orders']}
      caption={awaiting === 1 ? 'delivery due' : 'deliveries due'}
      status={
        <Parts>
          {[
            late > 0 && (
              <Flag key="late" tone="exception">
                {late} late
              </Flag>
            ),
            partial > 0 && (
              <Flag key="partial" tone="warning">
                {partial} part delivered
              </Flag>
            ),
            drafts > 0 && `${plural(drafts, 'draft', 'drafts')} not sent`,
            late === 0 && partial === 0 && drafts === 0 && 'Nothing to chase',
          ]}
        </Parts>
      }
      slimStatus={
        late > 0 ? (
          <Flag tone="exception">{late} late</Flag>
        ) : drafts > 0 ? (
          `${plural(drafts, 'draft', 'drafts')} not sent`
        ) : (
          'Nothing to chase'
        )
      }
      segments={[
        { key: 'sent', label: 'Sent', value: sent, share: sent / total, fill: 'bg-stock', legend: sent },
        { key: 'partial', label: 'Part delivered', value: partial, share: partial / total, fill: 'bg-measured', legend: partial },
        { key: 'drafts', label: 'Drafts', value: drafts, share: drafts / total, fill: 'bg-muted-foreground/40', legend: drafts },
      ]}
      listTitle={late > 0 ? 'Deliveries due, late first' : 'Deliveries due'}
      list={(rows, detailed) => {
        if (due.length === 0)
          return <NeedRows items={[]} clear={drafts > 0 ? 'Nothing sent yet' : 'Nothing on its way'} capacity={1} detailed={false} />;
        const fits = awaiting > rows ? Math.max(1, rows - 1) : Math.min(rows, due.length);
        const hidden = awaiting - fits;
        return (
          <div className="min-w-0">
            <ul>
              {due.slice(0, fits).map(({ order, lateDays }) => (
                <WidgetRow
                  key={order.id}
                  href="/inventory?tab=demand"
                  mark={
                    <WidgetDot
                      className={lateDays > 0 ? TONE_FILL.exception : order.status === 'partially_received' ? 'bg-measured' : 'bg-stock'}
                      label={lateDays > 0 ? 'Late' : order.status === 'partially_received' ? 'Part delivered' : 'Sent'}
                    />
                  }
                  title={order.supplier?.name ?? order.reference}
                  detail={
                    detailed
                      ? [
                          order.reference,
                          order.status === 'partially_received' && 'part delivered',
                          order.summary && formatMoney(Number(order.summary.totalCost)),
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : undefined
                  }
                  value={
                    lateDays > 0 ? <Flag tone="exception">{lateDays}d late</Flag> : order.expectedAt ? day(order.expectedAt) : 'No date'
                  }
                  valueClassName="font-normal text-muted-foreground"
                />
              ))}
            </ul>
            {hidden > 0 && (
              <Link href="/inventory?tab=demand" className="pt-0.5 text-[11px] text-muted-foreground hover:text-heading">
                and {hidden} more
              </Link>
            )}
          </div>
        );
      }}
    />
  );
}

// ── Payments ─────────────────────────────────────────────────────────────────

// Categorical identity, not status: the validated series order, never warning or exception colours.
const TENDER_FILL = ['bg-series-1', 'bg-series-2', 'bg-series-3', 'bg-series-4'];

export function TendersCard() {
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

  return (
    <Widget
      title="Takings by tender"
      icon={CreditCard}
      tint="money"
      surface="plain"
      href="/reports/payment-methods"
      hrefLabel="Open the payments report"
      loading={locations.isPending || tenders.isPending}
      error={locations.isError || tenders.isError}
      onRetry={() => void tenders.refetch()}
      empty={segments.length === 0 ? { title: 'Nothing taken yet today' } : undefined}
    >
      {segments.length > 0 && <TendersReading segments={segments} />}
    </Widget>
  );
}

/** The day's takings, how they were paid as one split, then each tender with what it took. */
function TendersReading({ segments }: { segments: ReturnType<typeof tenderSegments> }) {
  const formatMoney = useFormatMoney();
  const percents = wholePercents(segments.map((segment) => segment.revenue));
  const total = segments.reduce((sum, segment) => sum + segment.revenue, 0);
  const payments = segments.reduce((sum, segment) => sum + segment.orders, 0);
  const [top] = segments;

  return (
    <ModuleReading
      value={formatMoney(total)}
      unit="taken"
      caption="taken today"
      status={<Parts>{[payments > 0 && plural(payments, 'payment', 'payments'), 'net of refunds']}</Parts>}
      slimStatus={`${top!.label} ${percents[0]}%${payments > 0 ? ` · ${plural(payments, 'payment', 'payments')}` : ''}`}
      segments={segments.map((segment, index) => ({
        key: segment.key,
        label: segment.label,
        value: segment.revenue,
        share: segment.share,
        fill: TENDER_FILL[index] ?? 'bg-series-4',
        legend: `${percents[index]}%`,
        tip: [
          segment.label,
          formatMoney(segment.revenue),
          `${percents[index]}%`,
          segment.orders > 0 && plural(segment.orders, 'payment', 'payments'),
        ]
          .filter(Boolean)
          .join(' · '),
      }))}
      listTitle="By tender"
      list={(rows, detailed) => (
        <ul className="min-w-0">
          {segments.slice(0, rows).map((segment, index) => (
            <WidgetRow
              key={segment.key}
              href="/reports/payment-methods"
              mark={<WidgetDot className={TENDER_FILL[index] ?? 'bg-series-4'} label={segment.label} />}
              title={
                <>
                  {segment.label} <span className="text-muted-foreground tabular-nums">{percents[index]}%</span>
                </>
              }
              detail={detailed && segment.orders > 0 ? plural(segment.orders, 'payment', 'payments') : undefined}
              value={formatMoney(segment.revenue)}
            />
          ))}
        </ul>
      )}
    />
  );
}

// ── Customers ────────────────────────────────────────────────────────────────

export function CustomersCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Totals from a one-row page per question; the lapsed one also brings back its biggest spenders, by name.
  const questions = [
    { name: 'all', filters: {}, limit: 1 },
    { name: 'active-30', filters: { activeWithinDays: 30 }, limit: 1 },
    { name: 'lapsed-60-top', filters: { lapsedDays: 60, sort: 'spend' as const, direction: 'desc' as const }, limit: 8 },
    { name: 'emailable', filters: { marketing: 'opted_in' as const }, limit: 1 },
  ] as const;
  const all = useQueries({
    queries: questions.map((question) => ({
      queryKey: moduleQueryKeys.customers.key('customers', tenantId, 'dashboard', question.name),
      queryFn: () => getCustomers({ limit: question.limit, tenantId: tenantId ?? undefined, ...question.filters }),
      enabled: !!tenantId,
    })),
  });
  const [everyone, active, lapsed, emailable] = all.map((query) => query.data?.total ?? 0) as [number, number, number, number];

  return (
    <Widget
      title="Customers"
      icon={Store}
      tint="kitchen"
      surface="plain"
      href="/customers"
      hrefLabel="Open customers"
      loading={all.some((query) => query.isPending)}
      error={all.some((query) => query.isError)}
      onRetry={() => all.forEach((query) => void query.refetch())}
      empty={everyone === 0 ? { icon: UserPlus, title: 'No customers yet' } : undefined}
    >
      <CustomersReading counts={{ everyone, active, lapsed, emailable }} lapsedTop={(all[2].data?.data ?? []) as Customer[]} />
    </Widget>
  );
}

/**
 * The customer base as one split — in this month, quiet, lapsed — then the
 * lapsed by name, biggest spenders first: the ones worth winning back.
 */
function CustomersReading({
  counts: { everyone, active, lapsed, emailable },
  lapsedTop,
}: {
  counts: { everyone: number; active: number; lapsed: number; emailable: number };
  lapsedTop: Customer[];
}) {
  const formatMoney = useFormatMoney();
  const [now] = useState(() => Date.now());
  const quiet = Math.max(0, everyone - active - lapsed);
  const total = Math.max(everyone, 1);
  const count = (value: number) => value.toLocaleString('en-GB');
  const optIn = everyone > 0 ? Math.round((emailable / everyone) * 100) : 0;

  return (
    <ModuleReading
      value={count(everyone)}
      unit={everyone === 1 ? 'customer' : 'customers'}
      noun={['customer', 'customers']}
      caption={`${everyone === 1 ? 'customer' : 'customers'} · ${optIn}% opted in to email`}
      status={
        <Parts>
          {[
            `${count(active)} in during the last 30 days`,
            lapsed > 0 && (
              <Flag key="lapsed" tone="warning">
                {count(lapsed)} lapsed
              </Flag>
            ),
          ]}
        </Parts>
      }
      slimStatus={lapsed > 0 ? <Flag tone="warning">{count(lapsed)} lapsed</Flag> : `${count(active)} in this month`}
      segments={[
        { key: 'active', label: 'Last 30 days', value: active, share: active / total, fill: 'bg-momentum', legend: count(active) },
        { key: 'quiet', label: 'Quiet', value: quiet, share: quiet / total, fill: 'bg-muted-foreground/40', legend: count(quiet) },
        { key: 'lapsed', label: 'Lapsed 60 days', value: lapsed, share: lapsed / total, fill: 'bg-measured', legend: count(lapsed) },
      ]}
      listTitle="Lapsed, biggest spenders first"
      list={(rows, detailed) => {
        if (lapsedTop.length === 0) return <NeedRows items={[]} clear="Nobody lapsed" capacity={1} detailed={false} />;
        const fits = lapsed > rows ? Math.max(1, rows - 1) : Math.min(rows, lapsedTop.length);
        const hidden = lapsed - fits;
        return (
          <div className="min-w-0">
            <ul>
              {lapsedTop.slice(0, fits).map((customer) => (
                <WidgetRow
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  mark={<WidgetDot className="bg-measured" />}
                  title={`${customer.firstName} ${customer.lastName}`.trim() || 'Unnamed customer'}
                  detail={detailed && customer.lastVisitAt ? `Last in ${relativeTime(customer.lastVisitAt, now)}` : undefined}
                  value={formatMoney(customer.totalSpent)}
                />
              ))}
            </ul>
            {hidden > 0 && (
              <Link href="/customers?lapsedDays=60" className="pt-0.5 text-[11px] text-muted-foreground hover:text-heading">
                and {count(hidden)} more
              </Link>
            )}
          </div>
        );
      }}
    />
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

// The CMS page's own status colours, so a dot here reads the same as a chip there.
const ENTRY_DOT: Record<CmsEntryStatus, string> = {
  published: 'bg-momentum',
  changed: 'bg-measured',
  draft: 'bg-reference',
  archived: 'bg-muted-foreground/50',
};

export function ContentCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Content's own overview query, so the dashboard and the Content page share a cache.
  const overview = useQuery({
    queryKey: moduleQueryKeys.cms.key('overview', tenantId),
    queryFn: () => getCmsOverview(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const entries = overview.data?.entries;

  return (
    <Widget
      title="Website content"
      icon={FileText}
      tint="brand"
      surface="plain"
      href="/content"
      hrefLabel="Open content"
      loading={overview.isPending}
      error={overview.isError}
      onRetry={() => void overview.refetch()}
      empty={entries && entries.total === 0 ? { title: 'No content yet' } : undefined}
    >
      {overview.data && <ContentReading overview={overview.data} />}
    </Widget>
  );
}

/**
 * The site as a pipeline and a desk rather than a tally: what is live, one bar
 * from draft through review to live, then the pages last touched — each a way
 * straight back into its editor.
 */
function ContentReading({ overview }: { overview: CmsOverview }) {
  const [now] = useState(() => Date.now());
  const { entries, recentEntries } = overview;
  const summary = contentSummary(entries);
  const waiting = entries.review + entries.changed;
  const pipeline = [
    { key: 'live', label: 'Live', value: entries.live, fill: 'bg-momentum' },
    { key: 'scheduled', label: 'Scheduled', value: entries.scheduled, fill: 'bg-reference' },
    { key: 'waiting', label: 'In review', value: waiting, fill: 'bg-measured' },
    { key: 'draft', label: 'Drafts', value: entries.draft, fill: 'bg-muted-foreground/40' },
  ];
  const total = Math.max(
    pipeline.reduce((sum, stage) => sum + stage.value, 0),
    1,
  );

  return (
    <ModuleReading
      value={summary.live}
      unit="live"
      noun={['entry', 'entries']}
      caption="live on your site"
      status={
        waiting > 0 ? (
          <Flag tone="warning">{plural(waiting, 'page waits', 'pages wait')} to go live</Flag>
        ) : summary.scheduled > 0 ? (
          `${summary.scheduled} scheduled to go live`
        ) : (
          'Everything published'
        )
      }
      slimStatus={
        waiting > 0 ? (
          <Flag tone="warning">{waiting} waiting</Flag>
        ) : summary.scheduled > 0 ? (
          `${summary.scheduled} scheduled`
        ) : (
          'All published'
        )
      }
      segments={pipeline.map((stage) => ({ ...stage, share: stage.value / total, legend: stage.value }))}
      listTitle="Recently edited"
      list={(count, detailed) =>
        recentEntries.length === 0 ? (
          <NeedRows items={[]} clear="Nothing edited yet" capacity={1} detailed={false} />
        ) : (
          <ul className="min-w-0">
            {recentEntries.slice(0, count).map((entry) => (
              <WidgetRow
                key={entry.id}
                href={`/content?entry=${encodeURIComponent(entry.id)}`}
                mark={<WidgetDot className={ENTRY_DOT[entry.status]} label={entryStatusMeta(entry.status).label} />}
                title={entry.title || 'Untitled'}
                detail={detailed ? entry.contentType.name : undefined}
                value={relativeTime(entry.updatedAt, now)}
                valueClassName="font-normal text-muted-foreground"
              />
            ))}
          </ul>
        )
      }
    />
  );
}

// ── Launch widgets ───────────────────────────────────────────────────────────

const LAUNCHES: Record<string, { href: string; label: string; detail: string; icon: IconComponent; tint: WidgetTint }> = {
  'organization.readiness': {
    href: '/settings/workspaces',
    label: 'Workspace readiness',
    detail: 'Finish setting up',
    icon: ClipboardCheck,
    tint: 'brand',
  },
  'ordering.pos-launch': { href: '/pos', label: 'Take an order', detail: 'Open the till', icon: ShoppingCart, tint: 'brand' },
  'ordering.fulfilment-launch': {
    href: '/kds',
    label: 'Run fulfilment',
    detail: 'Open the kitchen display',
    icon: ChefHat,
    tint: 'kitchen',
  },
  'customers.relationships-launch': {
    href: '/customers',
    label: 'Customers',
    detail: 'Profiles and loyalty',
    icon: Store,
    tint: 'kitchen',
  },
  'communications.outreach-launch': {
    href: '/communications',
    label: 'Customer outreach',
    detail: 'Email and automations',
    icon: Megaphone,
    tint: 'orders',
  },
  'compliance.audit-launch': { href: '/audit-log', label: 'Audit trail', detail: 'Who changed what', icon: ShieldCheck, tint: 'brand' },
};

const LAUNCH_FILL: Record<WidgetTint, string> = {
  brand: 'bg-primary text-on-fill',
  orders: 'bg-measured text-on-fill',
  kitchen: 'bg-reference text-on-fill',
  stock: 'bg-stock text-on-fill',
  team: 'bg-success text-on-fill',
  money: 'bg-primary text-on-fill',
  exception: 'bg-exception text-on-fill',
};

export const isLaunchWidget = (key: string) => key in LAUNCHES;

/**
 * A doorway into a module with nothing to count, drawn the way a Shortcuts
 * widget is: the whole tile in the module's colour, its glyph at the top, its
 * name at the bottom.
 */
export function LaunchCard({ widgetKey }: { widgetKey: string }) {
  const family = useFamily();
  const launch = LAUNCHES[widgetKey];
  if (!launch) return null;
  const Icon = launch.icon;
  return (
    <Link
      href={launch.href}
      className={cn(
        'group/launch flex h-full flex-col justify-between rounded-lg p-4 transition-colors hover:brightness-[1.04]',
        'shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_24px_-14px_rgb(0_0_0/0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        LAUNCH_FILL[launch.tint],
      )}
    >
      <span className="flex items-start justify-between">
        <Icon size={family === 'small' ? 26 : 24} strokeWidth={1.9} aria-hidden="true" />
        <ChevronRight size={16} className="opacity-70 transition-transform group-hover/launch:translate-x-0.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] leading-5 font-semibold">{launch.label}</span>
        {family !== 'small' && <span className="block truncate text-[12px] leading-4 opacity-80">{launch.detail}</span>}
      </span>
    </Link>
  );
}
