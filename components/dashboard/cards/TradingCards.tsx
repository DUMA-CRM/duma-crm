'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import {
  Widget,
  WidgetCaption,
  WidgetDot,
  WidgetFigure,
  WidgetRow,
  WidgetSlim,
  isSlim,
  useFamily,
  useRows,
} from '@/components/dashboard/widget/Widget';
import { WidgetFacts } from '@/components/dashboard/widget/parts';
import { BarChart3, CalendarDays, CheckCircle2, ChefHat, LineChart, MapPin, TrendingDown, TrendingUp } from '@/components/icons';
import { DEFAULT_REPORT_ICON, REPORT_ICON } from '@/components/reports/kit/ReportFrame';
import { useMinuteClock } from '@/components/reservations/useMinuteClock';
import { Bone } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { TONE_FILL } from '@/components/shared/tone';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { reportShortcuts } from '@/lib/dashboard/report-shortcuts';
import { type WeekSales, weekSales, weekWindows } from '@/lib/dashboard/week-sales';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { useMenuItemCosts } from '@/lib/hooks/useMenuItemCosts';
import { getOrderAnalytics } from '@/lib/modules/analytics/client';
import { getMenuItems } from '@/lib/modules/catalog/client';
import { getRecipeGaps } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getBookings } from '@/lib/modules/reservations/client';
import { REPORT_FAVOURITES_KEY } from '@/lib/reports/catalogue';
import { cn } from '@/lib/utils/cn';
import { type OverviewCost, averageMargin, lowestMargins } from '@/lib/utils/menu-overview';
import { type DayCovers, coversByDay, overviewRange } from '@/lib/utils/reservations-stats';
import type { FigureChange } from '@/lib/utils/today-figures';
import { formatCalendarDate, resolvedTimeZone, workspaceDateKey, workspaceTimeZone } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* Trading widgets that look past today: the week's sales, the week's
 * bookings, the menu's health, and a way into the reports. Same frame and
 * states as the module cards — loading, failed with a retry, empty in one calm
 * line — and each reads the cache of the screen that owns its data, so a
 * change made there shows here too. */

const plural = (count: number, one: string, many: string) => `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;

/** The week as a bar a day: this week in the widget's colour beside last week's faint one, days to come a quiet trough. */
function WeekBars({
  days,
  bars,
  ghost,
  todayIndex,
  highlight,
  fill,
  labels,
  tips,
  label,
}: {
  days: readonly string[];
  bars: readonly number[];
  /** Last week's bars, drawn faint beside each day; omitted, each day is one bar. */
  ghost?: readonly number[];
  /** Days after this are still to come; -1 when every day counts. */
  todayIndex: number;
  /** One day drawn at full strength (the best or busiest); the rest a touch lighter. */
  highlight: number;
  fill: string;
  labels: boolean;
  tips: readonly string[];
  label: string;
}) {
  const max = Math.max(1, ...bars, ...(ghost ?? []));
  const height = (value: number) => `${Math.max(value > 0 ? 6 : 4, (value / max) * 100)}%`;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-end gap-1.5" role="img" aria-label={label}>
        {days.map((day, index) => {
          const toCome = todayIndex >= 0 && index > todayIndex;
          return (
            <Tooltip key={day} side="top" label={tips[index] ?? day} className="flex h-full min-w-0 flex-1 items-end gap-[2px]">
              {ghost && <span className="min-w-0 flex-1 rounded-t-[3px] bg-reference/30" style={{ height: height(ghost[index] ?? 0) }} />}
              <span
                className={cn(
                  'min-w-0 flex-1 rounded-t-[3px]',
                  toCome ? 'bg-band' : fill,
                  !toCome && highlight >= 0 && index !== highlight && 'opacity-70',
                )}
                style={{ height: toCome ? '4%' : height(bars[index] ?? 0) }}
              />
            </Tooltip>
          );
        })}
      </div>
      {labels && (
        <div className="mt-1.5 flex gap-1.5 text-[11px] leading-none text-muted-foreground" aria-hidden="true">
          {days.map((day, index) => (
            <span key={day} className={cn('min-w-0 flex-1 truncate text-center', index === todayIndex && 'font-semibold text-heading')}>
              {formatCalendarDate(day, { weekday: 'narrow' })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── This week ────────────────────────────────────────────────────────────────

const SALES_SUMMARY = '/reports/sales-summary?range=this-week';

export function WeekSalesCard() {
  const locationId = useWorkspaceStore((state) => state.locationId);
  const clock = useMinuteClock();
  // The comparison point moves in five-minute steps, so last week's query isn't a new request every tick.
  const step = Math.floor(clock.getTime() / 300_000) * 300_000;
  const timeZone = resolvedTimeZone();
  const windows = useMemo(() => weekWindows(new Date(step), timeZone), [step, timeZone]);
  const site = locationId ?? undefined;
  // The Reports page's own key for "This week" (useRangeQuery), so opening the report is instant.
  const current = useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', 'orders', windows.thisWeek.from, windows.thisWeek.to, locationId ?? 'all'),
    queryFn: () => getOrderAnalytics({ ...windows.thisWeek, ...(site ? { locationId: site } : {}) }),
    refetchInterval: 120_000,
  });
  const previous = useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', 'orders', windows.lastWeek.from, windows.lastWeek.to, locationId ?? 'all'),
    queryFn: () => getOrderAnalytics({ ...windows.lastWeek, ...(site ? { locationId: site } : {}) }),
    // Keep last week's figure on screen while the next five minutes of it load.
    placeholderData: keepPreviousData,
  });
  const reading = current.data ? weekSales(windows, current.data, previous.data ?? null) : null;

  return (
    <Widget
      title="This week"
      icon={LineChart}
      tint="money"
      surface="plain"
      href={SALES_SUMMARY}
      hrefLabel="Open the sales summary"
      loading={current.isPending}
      error={current.isError}
      onRetry={() => {
        void current.refetch();
        void previous.refetch();
      }}
      empty={
        reading && reading.orders === 0 && reading.net === 0 && !reading.lastWeek ? { title: 'Nothing taken this week yet' } : undefined
      }
    >
      {reading && <WeekSalesReading reading={reading} comparing={previous.isPending} days={windows.days} todayIndex={windows.todayIndex} />}
    </Widget>
  );
}

/** "+10% vs last week by now" — green up, amber down, a plain line when level or there's nothing to compare. */
function WeekChange({ change, comparing }: { change: FigureChange; comparing: boolean }) {
  if (comparing) return <span>Comparing with last week…</span>;
  if (change.percent === null) return <span>Nothing to compare from last week</span>;
  if (change.direction === 'flat') return <span>Level with last week by now</span>;
  const up = change.direction === 'up';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', up ? 'text-momentum' : 'text-measured')}>
        {up ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
        {up ? '+' : '−'}
        {Math.abs(change.percent)}%
      </span>
      vs last week by now
    </span>
  );
}

/**
 * Net sales from Monday, against the same stretch of last week, then the week
 * as a bar a day with last week's beside it. Large adds the figures behind it.
 */
function WeekSalesReading({
  reading,
  comparing,
  days,
  todayIndex,
}: {
  reading: WeekSales;
  comparing: boolean;
  days: string[];
  todayIndex: number;
}) {
  const family = useFamily();
  const money = useFormatMoney();
  const weekday = (index: number) => formatCalendarDate(days[index], { weekday: 'long' });
  const tips = days.map((_, index) =>
    index > todayIndex
      ? `${weekday(index)} · to come`
      : `${weekday(index)} · ${money(reading.bars[index] ?? 0)} · last week ${money(reading.lastBars[index] ?? 0)}`,
  );
  const bars = (labels: boolean) => (
    <WeekBars
      days={days}
      bars={reading.bars}
      ghost={reading.lastWeek === null ? undefined : reading.lastBars}
      todayIndex={todayIndex}
      highlight={reading.best}
      fill="bg-primary"
      labels={labels}
      tips={tips}
      label={`Net sales by day this week: ${days
        .slice(0, todayIndex + 1)
        .map((_, index) => `${weekday(index)} ${money(reading.bars[index] ?? 0)}`)
        .join(', ')}`}
    />
  );

  if (isSlim(family)) {
    return (
      <WidgetSlim value={money(reading.net)} caption={<WeekChange change={reading.change} comparing={comparing} />} visual={bars(false)} />
    );
  }

  const figure = (
    <div className="min-w-0">
      <WidgetFigure value={money(reading.net)} size={family === 'small' ? 'small' : family === 'medium' ? 'medium' : 'large'} />
      <WidgetCaption className="mt-1 text-xs">
        <WeekChange change={reading.change} comparing={comparing} />
      </WidgetCaption>
    </div>
  );

  if (family === 'small') {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3">
        {figure}
        <div className="h-10">{bars(false)}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {figure}
      <div className="min-h-16 flex-1">{bars(true)}</div>
      {family !== 'medium' && (
        <WidgetFacts
          facts={[
            { label: 'Orders', value: reading.orders.toLocaleString('en-GB') },
            { label: 'Average order', value: reading.orders > 0 ? money(reading.net / reading.orders, 2) : '—' },
            reading.lastWeek !== null && { label: 'Last week by now', value: money(reading.lastWeek) },
            reading.best >= 0 && { label: 'Best day', value: weekday(reading.best) },
          ]}
        />
      )}
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────

export function ReportShortcutsCard() {
  const capabilities = useAuthStore((state) => state.capabilities);
  const [starred, setStarred] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(REPORT_FAVOURITES_KEY) ?? '[]');
      // Reading storage is the external-system sync an effect is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setStarred(saved.filter((id): id is string => typeof id === 'string'));
    } catch {
      // Blocked or empty storage: the usual reports, nothing broken.
    }
  }, []);
  const family = useFamily();
  const rows = useRows(32);
  const shortcuts = reportShortcuts(capabilities, starred, isSlim(family) ? 1 : Math.min(6, rows));

  return (
    <Widget
      title="Reports"
      icon={BarChart3}
      tint="brand"
      surface="plain"
      href="/reports"
      hrefLabel="Open reports"
      empty={shortcuts.length === 0 ? { title: 'No reports open to you' } : undefined}
    >
      {isSlim(family) ? (
        <ul className="mt-auto min-w-0">
          {shortcuts.map((report) => (
            <WidgetRow key={report.id} href={`/reports/${report.id}`} title={report.title} />
          ))}
        </ul>
      ) : (
        <ul className="mt-auto min-w-0">
          {shortcuts.map((report) => {
            const Icon = REPORT_ICON[report.id] ?? DEFAULT_REPORT_ICON;
            return (
              <WidgetRow
                key={report.id}
                href={`/reports/${report.id}`}
                mark={<Icon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                title={report.title}
                detail={family === 'large' || family === 'extraLarge' ? report.description : undefined}
              />
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

// ── Bookings this week ───────────────────────────────────────────────────────

const RESERVATIONS = '/reservations';

export function BookingsWeekCard() {
  const locationId = useWorkspaceStore((state) => state.locationId);
  const [now] = useState(() => new Date());
  const timeZone = workspaceTimeZone();
  const today = workspaceDateKey(now, timeZone);
  const range = useMemo(() => overviewRange(today, timeZone), [today, timeZone]);
  // The Reservations overview's own call and key (30 days back to 7 ahead), so a booking made there shows here.
  const bookings = useQuery({
    queryKey: moduleQueryKeys.reservations.key('overview', locationId, range.from, range.to),
    queryFn: () => getBookings(locationId!, { from: range.from, to: range.to }),
    enabled: Boolean(locationId),
    refetchInterval: 60_000,
  });
  const days = coversByDay(bookings.data ?? [], range.ahead, 0, timeZone);
  const covers = days.reduce((sum, day) => sum + day.total, 0);

  return (
    <Widget
      title="Bookings this week"
      icon={CalendarDays}
      tint="orders"
      surface="plain"
      href={RESERVATIONS}
      hrefLabel="Open reservations"
      loading={Boolean(locationId) && bookings.isPending}
      error={bookings.isError}
      onRetry={() => void bookings.refetch()}
      empty={
        !locationId
          ? { icon: MapPin, title: 'Choose a location', detail: 'Bookings belong to one location.' }
          : bookings.isSuccess && covers === 0
            ? { title: 'No bookings in the next 7 days' }
            : undefined
      }
    >
      {covers > 0 && <BookingsWeekReading days={days} covers={covers} />}
    </Widget>
  );
}

/**
 * Covers over the next seven days as the figure, a bar a day with the busiest
 * flagged, then each day by name — at large, with its bookings and services.
 */
function BookingsWeekReading({ days, covers }: { days: DayCovers[]; covers: number }) {
  const family = useFamily();
  const capacity = useRows(32, 150);
  const bookings = days.reduce((sum, day) => sum + day.bookings, 0);
  const peakIndex = days.findIndex((day) => day.peak);
  const peak = days[peakIndex];
  const dayName = (date: string, index: number) => (index === 0 ? 'Today' : formatCalendarDate(date, { weekday: 'short' }));
  const longDay = (date: string, index: number) =>
    index === 0 ? 'Today' : formatCalendarDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
  const busiest = peak ? `Busiest ${dayName(peak.date, peakIndex)}, ${plural(peak.total, 'cover', 'covers')}` : null;
  const bars = (labels: boolean) => (
    <WeekBars
      days={days.map((day) => day.date)}
      bars={days.map((day) => day.total)}
      todayIndex={-1}
      highlight={peakIndex}
      fill="bg-measured"
      labels={labels}
      tips={days.map((day, index) => `${longDay(day.date, index)} · ${plural(day.total, 'cover', 'covers')}`)}
      label={`Covers booked: ${days.map((day, index) => `${longDay(day.date, index)} ${day.total}`).join(', ')}`}
    />
  );

  if (isSlim(family)) {
    return <WidgetSlim value={covers.toLocaleString('en-GB')} caption={busiest ?? 'covers'} visual={bars(false)} />;
  }

  const figure = (
    <div className="min-w-0">
      <WidgetFigure value={covers.toLocaleString('en-GB')} size={family === 'small' ? 'small' : family === 'medium' ? 'medium' : 'large'} />
      <WidgetCaption className="mt-1">{`${covers === 1 ? 'cover' : 'covers'} · ${plural(bookings, 'booking', 'bookings')}`}</WidgetCaption>
      {busiest && family !== 'small' && <WidgetCaption className="text-xs">{busiest}</WidgetCaption>}
    </div>
  );

  if (family === 'small') {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3">
        {figure}
        <div className="h-10">{bars(false)}</div>
      </div>
    );
  }

  if (family === 'medium') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {figure}
        <div className="min-h-16 flex-1">{bars(true)}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {figure}
      <div className="h-20 shrink-0">{bars(true)}</div>
      <ul className="mt-auto min-w-0">
        {days.slice(0, capacity).map((day, index) => (
          <WidgetRow
            key={day.date}
            href={RESERVATIONS}
            mark={
              <WidgetDot className={day.peak ? 'bg-measured' : 'bg-muted-foreground/40'} label={day.peak ? 'Busiest day' : undefined} />
            }
            title={longDay(day.date, index)}
            detail={
              day.bookings > 0
                ? [
                    plural(day.bookings, 'booking', 'bookings'),
                    day.lunch > 0 && `lunch ${day.lunch}`,
                    day.dinner > 0 && `dinner ${day.dinner}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'No bookings'
            }
            value={day.total}
            valueClassName={day.total === 0 ? 'font-normal text-muted-foreground' : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

// ── Menu health ──────────────────────────────────────────────────────────────

export function MenuHealthCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const { tools } = useCatalogWords();
  const kitchen = tools.kitchen;
  // The Menu overview's own queries and costing hook: same keys, same cache, same margins.
  const itemsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const gaps = useQuery({
    queryKey: moduleQueryKeys.inventory.key('recipe-gaps', tenantId),
    queryFn: () => getRecipeGaps(tenantId!),
    enabled: !!tenantId && kitchen,
  });
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const fullCosts = useMenuItemCosts(kitchen ? items : []);
  const costs = useMemo(
    () => new Map<string, OverviewCost>([...fullCosts].map(([id, cost]) => [id, { ...cost, marginPct: cost.costing?.marginPct ?? null }])),
    [fullCosts],
  );
  const costing = kitchen && items.some((item) => fullCosts.get(item.id)?.loading ?? true);

  return (
    <Widget
      title="Menu health"
      icon={ChefHat}
      tint="kitchen"
      surface="plain"
      href="/menu"
      hrefLabel="Open the menu"
      loading={!!tenantId && (itemsQuery.isPending || (kitchen && gaps.isPending))}
      error={itemsQuery.isError || gaps.isError}
      onRetry={() => {
        void itemsQuery.refetch();
        void gaps.refetch();
      }}
      empty={
        !kitchen
          ? { title: 'Margins come from recipes', detail: 'Products sold as they are have none to cost.' }
          : itemsQuery.isSuccess && items.length === 0
            ? { title: 'Nothing on the menu yet' }
            : undefined
      }
    >
      {itemsQuery.data && gaps.data && (
        <MenuHealthReading
          gaps={gaps.data}
          lowest={lowestMargins(items, costs, 8)}
          average={averageMargin(items, costs)}
          losses={items.filter((item) => item.isAvailable && (costs.get(item.id)?.marginPct ?? 0) < 0).length}
          costing={costing}
        />
      )}
    </Widget>
  );
}

const pctLabel = (value: number) => `${Math.round(value)}%`;

/**
 * The menu's average margin as the figure, what stops it being trusted — items
 * with no recipe, items at a loss — on the line under it, then the lowest
 * margins by name, each a way into its recipe.
 */
function MenuHealthReading({
  gaps,
  lowest,
  average,
  losses,
  costing,
}: {
  gaps: { id: string; name: string }[];
  lowest: ReturnType<typeof lowestMargins<{ id: string; name: string; isAvailable: boolean }>>;
  average: ReturnType<typeof averageMargin>;
  losses: number;
  costing: boolean;
}) {
  const family = useFamily();
  const capacity = useRows(32, 110);
  const status: ReactNode =
    gaps.length > 0 || losses > 0 ? (
      <span>
        {gaps.length > 0 && (
          <Link href="/menu/items?show=not-costed" className="font-semibold text-measured hover:underline">
            {plural(gaps.length, 'item', 'items')} without a recipe
          </Link>
        )}
        {gaps.length > 0 && losses > 0 && ' · '}
        {losses > 0 && (
          <Link href="/menu/items?show=loss" className="font-semibold text-exception hover:underline">
            {losses} at a loss
          </Link>
        )}
      </span>
    ) : costing ? (
      'Costing the menu…'
    ) : (
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 size={12} className="text-momentum" aria-hidden="true" />
        Every item has a recipe
      </span>
    );
  const figureValue = costing ? <Bone className="h-8 w-20 rounded-md" /> : average ? pctLabel(average.pct) : '—';
  const caption = costing ? 'average margin' : average ? `average margin · ${average.costed} costed` : 'no item fully costed yet';

  if (isSlim(family)) {
    return <WidgetSlim value={figureValue} caption={status} />;
  }

  const figure = (
    <div className="min-w-0">
      <WidgetFigure value={figureValue} size={family === 'small' ? 'small' : family === 'medium' ? 'medium' : 'large'} />
      <WidgetCaption className="mt-1">{caption}</WidgetCaption>
      <WidgetCaption className="text-xs">{status}</WidgetCaption>
    </div>
  );

  if (family === 'small') return <div className="flex min-h-0 flex-1 flex-col justify-end">{figure}</div>;

  const list = (count: number) =>
    costing ? (
      <div role="status" aria-busy="true" aria-label="Costing the menu" className="space-y-2">
        {Array.from({ length: Math.min(count, 3) }, (_, index) => (
          <Bone key={index} className="h-4 w-full rounded-md" />
        ))}
      </div>
    ) : lowest.length === 0 ? (
      <p className="text-[13px] text-muted-foreground">Add recipes with ingredient costs to see margins.</p>
    ) : (
      <ul className="min-w-0">
        {lowest.slice(0, count).map(({ item, marginPct }) => (
          <WidgetRow
            key={item.id}
            href={`/menu/items/${item.id}?tab=recipe`}
            mark={
              <WidgetDot className={marginPct < 0 ? TONE_FILL.exception : 'bg-reference'} label={marginPct < 0 ? 'At a loss' : undefined} />
            }
            title={item.name}
            value={pctLabel(marginPct)}
            valueClassName={marginPct < 0 ? 'text-exception' : undefined}
          />
        ))}
      </ul>
    );
  const title = <p className="pb-1 text-[11px] leading-4 text-muted-foreground">Lowest margins</p>;

  if (family === 'medium') {
    return (
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col justify-end">{figure}</div>
        <div className="flex w-[52%] min-w-0 shrink-0 flex-col justify-end">
          {title}
          {list(3)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {figure}
      <div className="mt-auto pt-3">
        {title}
        {list(capacity)}
      </div>
    </div>
  );
}
