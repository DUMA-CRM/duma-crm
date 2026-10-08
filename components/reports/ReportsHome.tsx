'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  Award,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock,
  type IconComponent,
  Search,
  Star,
  Store,
  Target,
  X,
} from '@/components/icons';
import { SOURCE_META } from '@/components/orders/orderMeta';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { EditorShell } from '@/components/shared/EditorShell';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone, LoadingState } from '@/components/shared/Skeleton';
import { useWorkspaceCurrency, useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Input } from '@/components/ui/input';

import type { DailyOrderAnalytics, OrderAnalyticsBreakdown, OrderAnalyticsSummary } from '@/lib/api/analytics.service';
import { hasAnyCapability, hasCapability } from '@/lib/auth/capabilities';
import { getHourlyVolume, getTopItems } from '@/lib/modules/analytics/client';
import { REPORTS, REPORT_CATEGORIES, type ReportDefinition, type ReportId, searchReports } from '@/lib/reports/catalogue';
import { type ReportContext, reportRelevance, splitReports } from '@/lib/reports/relevance';
import { cn } from '@/lib/utils/cn';
import { compactMoney } from '@/lib/utils/report-chart';
import {
  type DateRange,
  type Granularity,
  bucketAxisLabel,
  dayLabel,
  delta,
  fillDays,
  groupDays,
  rangeDates,
  rangeDays,
  suggestedGranularity,
} from '@/lib/utils/report-filters';
import { type PeriodTarget, periodTarget, primeCostBand, targetDays } from '@/lib/utils/report-profit';
import { workspaceDateKey } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

import { BAND_LOOK, ProfitBar, usePrimeCost } from './catalogue/ProfitReports';
import { useOrderAnalytics } from './catalogue/SalesReports';
import { ReportFilterBar } from './kit/ReportFilterBar';
import { DEFAULT_REPORT_ICON, REPORT_ICON } from './kit/ReportFrame';
import { ChangePill, ReportError, TrendChart, TrendLegend } from './kit/parts';
import { useRangeQuery } from './kit/useRangeQuery';
import { type ReportFilterState, useReportFilters } from './kit/useReportFilters';
import { useReportContext } from './kit/useReportRelevance';

const FAVOURITES_KEY = 'duma:report-favourites';
const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const pct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;

/** Starred reports, per device — a convenience, so browser storage is right for it. */
function useFavourites() {
  const [favourites, setFavourites] = useState<ReportId[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FAVOURITES_KEY) ?? '[]');
      // Reading storage is the external-system sync an effect is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setFavourites(saved.filter((id): id is ReportId => REPORTS.some((report) => report.id === id)));
    } catch {
      // Blocked or empty storage: no favourites, nothing broken.
    }
  }, []);
  const toggle = (id: ReportId) =>
    setFavourites((current) => {
      const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
      try {
        window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      } catch {
        // Private mode: the star lasts for this visit.
      }
      return next;
    });
  return { favourites, toggle };
}

/**
 * Reports: one filter bar in the header, then the period in three panels —
 * sales (the headline, with its counts and the target), what's worth knowing,
 * and profit — then every report as a compact list, with search and stars.
 *
 * Restructured 2026-10-05: the KPI tile row and the Highlights tiles folded
 * into the panels, so each figure appears once. Today's pace isn't here — it's
 * the dashboard's Taken today panel; Reports is the look back.
 */
export function ReportsHome() {
  const filters = useReportFilters();
  const reduceMotion = useReducedMotion();
  const capabilities = useAuthStore((state) => state.capabilities);
  const [search, setSearch] = useState('');
  const { favourites, toggle } = useFavourites();

  const context = useReportContext(filters);
  // Who may open a report (capabilities), then whether it would say anything here (modules, sites, channels).
  const { shown: available, hidden } = useMemo(
    () =>
      splitReports(
        REPORTS.filter((report) => hasAnyCapability(capabilities, ...report.anyOf)),
        context,
      ),
    [capabilities, context],
  );
  const matches = searchReports(available, search);
  const hiddenMatches = search ? hidden.filter((entry) => searchReports([entry.report], search).length > 0) : [];
  const starred = available.filter((report) => favourites.includes(report.id));

  return (
    <EditorShell
      eyebrow="Analytics"
      title="Reports"
      icon={<BarChart3 size={20} aria-hidden="true" />}
      meta={<span className="hidden text-sm tabular-nums text-muted-foreground xl:inline">{rangeDates(filters.range)}</span>}
      actions={
        <div className="hidden md:block">
          <ReportFilterBar state={filters} layout="header" />
        </div>
      }
      subheader={
        <div className="border-b border-divider bg-card px-3 py-2 md:hidden">
          <ReportFilterBar state={filters} />
        </div>
      }
    >
      <motion.div
        className="space-y-8"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
      >
        {hasCapability(capabilities, 'analytics:read') && <Overview filters={filters} context={context} />}

        <motion.section variants={SECTION_RISE} aria-labelledby="report-library-title" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="report-library-title" className="flex-1 text-base font-semibold tracking-title text-foreground">
              All reports
            </h2>
            <div className="w-full sm:w-72">
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reports — VAT, waste, Z report…"
                aria-label="Search reports"
                leftIcon={<Search size={14} />}
                rightAction={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-band hover:text-foreground"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
            </div>
          </div>

          {search ? (
            matches.length ? (
              <ReportList reports={matches} query={filters.query} favourites={favourites} onToggle={toggle} />
            ) : (
              <p className="rounded-lg border border-dashed border-rule/60 px-4 py-6 text-center text-sm text-muted-foreground">
                {hiddenMatches.length > 0
                  ? hiddenMatches.map((entry) => `${entry.report.title} is hidden: ${entry.reason}.`).join(' ')
                  : `No report matches “${search}”.`}
              </p>
            )
          ) : (
            <div className="gap-x-6 md:columns-2 xl:columns-3">
              {starred.length > 0 && (
                <Category label="Favourites" reports={starred} query={filters.query} favourites={favourites} onToggle={toggle} />
              )}
              {REPORT_CATEGORIES.map((category) => {
                const reports = available.filter((report) => report.category === category.id);
                return reports.length ? (
                  <Category
                    key={category.id}
                    label={category.label}
                    reports={reports}
                    query={filters.query}
                    favourites={favourites}
                    onToggle={toggle}
                  />
                ) : null;
              })}
            </div>
          )}
          {!search && hidden.length > 0 && <HiddenReports hidden={hidden} />}
        </motion.section>
      </motion.div>
    </EditorShell>
  );
}

// ── The period ───────────────────────────────────────────────────────────────

function Overview({ filters, context }: { filters: ReportFilterState; context: ReportContext }) {
  const capabilities = useAuthStore((state) => state.capabilities);
  const sales = useOrderAnalytics(filters);
  const target = periodTarget(filters.locations, filters.filters.locationId);
  const days = sales.data ? fillDays(sales.data.daily, filters.range, (row) => num(row.revenue)) : [];
  // Profit needs recipe costs as well as sales; without `recipes:read` there's no food cost to show.
  // …and a kitchen with recipes, stock and a rota — the same test as the Prime cost report.
  const showProfit = hasCapability(capabilities, 'recipes:read') && reportRelevance('prime-cost', context).relevant;
  const showChannel = reportRelevance('sales-by-channel', context).relevant;

  if (sales.isError) return <ReportError what="Your sales" onRetry={sales.refetch} />;

  return (
    <>
      <SalesPanel
        filters={filters}
        loading={sales.isPending}
        daily={sales.data?.daily ?? []}
        previousDaily={filters.previous ? (sales.previous?.daily ?? null) : null}
        summary={sales.data?.summary}
        before={sales.previous?.summary}
        target={target}
      />
      <div className={cn('grid gap-6', showProfit && 'lg:grid-cols-2')}>
        <WorthKnowing
          filters={filters}
          daily={days}
          bySource={sales.data?.bySource ?? []}
          loading={sales.isPending}
          target={target}
          showChannel={showChannel}
        />
        {showProfit && <ProfitPanel filters={filters} />}
      </div>
    </>
  );
}

/**
 * The headline: net sales, its change, how it was made up and how it moved —
 * with the period's counts in one row under it, rather than a tile each, and
 * progress against the target. Day, week or month; the comparison dashed; the
 * target stepped.
 */
function SalesPanel({
  filters,
  loading,
  daily,
  previousDaily,
  summary,
  before,
  target,
}: {
  filters: ReportFilterState;
  loading: boolean;
  daily: DailyOrderAnalytics[];
  previousDaily: DailyOrderAnalytics[] | null;
  summary: OrderAnalyticsSummary | undefined;
  before: OrderAnalyticsSummary | undefined;
  target: PeriodTarget | null;
}) {
  const money = useWorkspaceMoney();
  const currency = useWorkspaceCurrency();
  const [chosen, setChosen] = useState<Granularity | null>(null);
  const by = chosen ?? suggestedGranularity(filters.range);

  const bucket = (rows: DailyOrderAnalytics[], range: DateRange) =>
    groupDays(
      fillDays(rows, range, (row) => num(row.revenue)),
      by,
      ['value'],
    );
  const buckets = bucket(daily, filters.range);
  const previousBuckets = previousDaily && filters.previous ? bucket(previousDaily, filters.previous) : null;

  const net = num(summary?.totalRevenue);
  const gross = num(summary?.grossRevenue);
  const refunds = num(summary?.refundsBySaleDate);
  const previousNet = before ? num(before.totalRevenue) : null;
  const comparisonLabel = filters.filters.compare === 'year' ? 'Last year' : 'Period before';

  // The target for the days that have happened, so a month in progress isn't judged on days to come.
  const todayKey = workspaceDateKey();
  const elapsed = fillDays([], filters.range, () => 0).filter((day) => day.date <= todayKey).length;
  const goal = target ? target.daily * elapsed : null;

  const stats: { label: string; value: string; change?: React.ReactNode }[] = [
    {
      label: 'Orders',
      value: (summary?.totalOrders ?? 0).toLocaleString('en-GB'),
      change: <ChangePill change={delta(summary?.totalOrders ?? 0, before?.totalOrders)} />,
    },
    {
      label: 'Average order',
      value: money(summary?.avgOrderValue),
      change: <ChangePill change={delta(num(summary?.avgOrderValue), before ? num(before.avgOrderValue) : null)} />,
    },
    {
      label: 'Refunds',
      value: money(refunds),
      change: <ChangePill change={delta(refunds, before ? num(before.refundsBySaleDate) : null)} inverse />,
    },
    { label: 'Average a day', value: money(net / rangeDays(filters.range)) },
  ];

  return (
    <motion.section variants={SECTION_RISE} aria-labelledby="net-sales-title" className="rounded-lg border border-rule/60 bg-field">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 pt-5">
        <div className="min-w-0">
          <h2 id="net-sales-title" className="text-sm font-semibold text-foreground">
            Net sales
          </h2>
          {loading ? (
            <div role="status" aria-busy="true" aria-label="Loading sales" className="mt-1 space-y-2">
              <Bone className="h-9 w-40" />
              <Bone className="h-3 w-56" />
            </div>
          ) : (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-2.5">
                <span className="text-3xl font-semibold tracking-title tabular-nums text-foreground">{money(net)}</span>
                <ChangePill change={delta(net, previousNet)} />
              </p>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {money(gross)} gross
                {previousNet !== null && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {money(previousNet)} {filters.filters.compare === 'year' ? 'last year' : 'the period before'}
                  </>
                )}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl<Granularity>
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            value={by}
            onChange={setChosen}
            ariaLabel="Group by"
          />
          <Link
            href={`/reports/sales-summary${filters.query ? `?${filters.query}` : ''}`}
            className="flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold text-primary hover:underline"
          >
            Sales summary
            <ChevronRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {target && goal !== null && goal > 0 && !loading && <TargetBar net={net} goal={goal} target={target} />}

      <div className="px-3 pt-4 pb-2 sm:px-4">
        {loading ? (
          // The chart's own height, so the panel doesn't jump when the line draws.
          <LoadingState label="Drawing the sales trend" className="h-64 py-0" />
        ) : (
          <TrendChart
            points={buckets.map((row) => ({ label: row.label, axis: bucketAxisLabel(row.key, by), value: row.value }))}
            previous={previousBuckets?.map((row) => row.value)}
            target={target ? buckets.map((row) => target.daily * row.days) : null}
            format={(value) => money(value)}
            axisFormat={(value) => compactMoney(value, currency)}
            variant={by === 'month' ? 'bars' : 'line'}
            ariaLabel={`Net sales by ${by}`}
            previousLabel={comparisonLabel}
          />
        )}
      </div>

      {/* The period's counts: one row, each with its change — they were four tiles. */}
      <dl className="grid grid-cols-2 border-t border-rule/50 sm:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              'min-w-0 px-5 py-3.5',
              index % 2 === 1 && 'border-l border-rule/50',
              index >= 2 && 'border-t border-rule/50 sm:border-t-0',
              index === 2 && 'sm:border-l',
            )}
          >
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2">
              {loading ? (
                <Bone className="my-0.5 h-5 w-16" />
              ) : (
                <span className="text-base font-semibold tabular-nums text-foreground">{stat.value}</span>
              )}
              {!loading && stat.change}
            </dd>
          </div>
        ))}
      </dl>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-rule/50 px-5 py-3">
        <TrendLegend
          comparison={!!previousBuckets}
          variant={by === 'month' ? 'bars' : 'line'}
          previousLabel={comparisonLabel}
          target={!!target}
        />
      </footer>
    </motion.section>
  );
}

/** Progress against the sites' daily target, for the days so far. */
function TargetBar({ net, goal, target }: { net: number; goal: number; target: PeriodTarget }) {
  const money = useWorkspaceMoney();
  const progress = net / goal;
  const met = progress >= 1;
  return (
    <div className="mx-5 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-band/50 px-3.5 py-2.5">
      <Target size={15} className={cn('shrink-0', met ? 'text-momentum' : 'text-warning')} aria-hidden="true" />
      <div className="min-w-40 flex-1">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-rule/40">
          <span className={cn('rounded-full', met ? 'bg-momentum' : 'bg-warning')} style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        <span className={cn('font-semibold', met ? 'text-momentum' : 'text-foreground')}>{Math.round(progress * 100)}%</span> of{' '}
        {money(goal)} target
        {target.missing > 0 && ` · ${target.missing} ${target.missing === 1 ? 'site has' : 'sites have'} none`}
      </p>
    </div>
  );
}

// ── Worth knowing ────────────────────────────────────────────────────────────

// The orders screens' channel names, so the overview and the orders list agree.
const CHANNEL_LABEL: Partial<Record<string, string>> = Object.fromEntries(
  Object.entries(SOURCE_META).map(([source, meta]) => [source, meta.label]),
);

/**
 * The period in a few sentences — the strongest day, the target days, the
 * peak hour, the best seller and the leading channel — each opening the report
 * that explains it. A list, not tiles: they're read, not compared.
 */
function WorthKnowing({
  filters,
  daily,
  bySource,
  loading,
  target,
  showChannel,
}: {
  filters: ReportFilterState;
  daily: { date: string; value: number }[];
  bySource: OrderAnalyticsBreakdown[];
  loading: boolean;
  target: PeriodTarget | null;
  /** One channel leads nothing — the line goes with the report. */
  showChannel: boolean;
}) {
  const money = useWorkspaceMoney();
  const hourly = useRangeQuery(
    `hourly:${filters.timezone}`,
    (params) => getHourlyVolume({ ...params, timezone: filters.timezone }),
    filters,
    { compare: false },
  );
  const items = useRangeQuery('top-items:100', (params) => getTopItems(params, 100), filters);
  const link = (id: ReportId) => `/reports/${id}${filters.query ? `?${filters.query}` : ''}`;

  const total = daily.reduce((sum, day) => sum + day.value, 0);
  const bestDay = daily.reduce<{ date: string; value: number } | null>((best, day) => (day.value > (best?.value ?? 0) ? day : best), null);
  const peak = (hourly.data ?? []).reduce<{ hour: number; revenue: number } | null>((best, row) => {
    const revenue = num(row.totalRevenue);
    return revenue > (best?.revenue ?? 0) ? { hour: Number(row.hour), revenue } : best;
  }, null);
  const top = [...(items.data ?? [])].sort((a, b) => num(b.totalRevenue) - num(a.totalRevenue))[0];
  const channelTotal = bySource.reduce((sum, row) => sum + num(row.revenue), 0);
  const leading = [...bySource].sort((a, b) => num(b.revenue) - num(a.revenue))[0];
  const hit = target ? targetDays(daily, target.daily, workspaceDateKey()) : null;
  const hour = (value: number) => `${String(value).padStart(2, '0')}:00`;
  const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '');

  const rows: { icon: IconComponent; label: string; value: string; detail?: string; href: string; pending?: boolean }[] = [
    {
      icon: CalendarDays,
      label: 'Best day',
      value: bestDay ? dayLabel(bestDay.date) : '—',
      detail: bestDay ? `${money(bestDay.value)} · ${share(bestDay.value, total)} of the period` : undefined,
      href: link('sales-summary'),
      pending: loading,
    },
    ...(target && hit && hit.of > 0
      ? [
          {
            icon: Target,
            label: 'Days on target',
            value: `${hit.hit} of ${hit.of}`,
            detail: `${money(target.daily)} a day`,
            href: link('sales-summary'),
            pending: loading,
          },
        ]
      : []),
    {
      icon: Clock,
      label: 'Peak hour',
      value: peak ? `${hour(peak.hour)}–${hour(peak.hour + 1)}` : '—',
      detail: peak ? `${money(peak.revenue)} taken in that hour` : hourly.isError ? 'Couldn’t be loaded' : undefined,
      href: link('sales-by-hour'),
      pending: hourly.isPending,
    },
    {
      icon: Award,
      label: 'Best seller',
      value: top?.name ?? '—',
      detail: top
        ? `${money(top.totalRevenue)} · ${num(top.totalQuantity).toLocaleString('en-GB')} sold`
        : items.isError
          ? 'Couldn’t be loaded'
          : undefined,
      href: link('item-sales'),
      pending: items.isPending,
    },
    ...(showChannel
      ? [
          {
            icon: (SOURCE_META as Partial<Record<string, { icon: IconComponent }>>)[leading?.source ?? '']?.icon ?? Store,
            label: 'Leading channel',
            value: leading ? (CHANNEL_LABEL[leading.source ?? ''] ?? leading.source ?? '—') : '—',
            detail: leading ? `${share(num(leading.revenue), channelTotal)} of net sales` : undefined,
            href: link('sales-by-channel'),
            pending: loading,
          },
        ]
      : []),
  ];

  return (
    <motion.section variants={SECTION_RISE} aria-labelledby="worth-knowing-title" className="min-w-0">
      <h2 id="worth-knowing-title" className="mb-2 px-1 text-sm font-semibold text-foreground">
        Worth knowing
      </h2>
      {!loading && total === 0 ? (
        <p className="rounded-lg border border-dashed border-rule/60 px-4 py-8 text-center text-sm text-muted-foreground">
          No sales in these dates.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          {rows.map((row) => (
            <li key={row.label} className="border-b border-rule/45 last:border-b-0">
              <Link
                href={row.href}
                className="group flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary" aria-hidden="true">
                  <row.icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">{row.label}</span>
                  {row.pending ? (
                    <Bone className="my-0.5 h-4 w-24" />
                  ) : (
                    <span className="block truncate text-sm font-semibold text-foreground">{row.value}</span>
                  )}
                </span>
                {row.detail && !row.pending && (
                  <span className="hidden max-w-[45%] truncate text-right text-xs tabular-nums text-muted-foreground sm:block">
                    {row.detail}
                  </span>
                )}
                <ChevronRight
                  size={14}
                  className="shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

// ── Profit ───────────────────────────────────────────────────────────────────

/** Prime cost at a glance: the figure, its band, the split, and the way into the report. */
function ProfitPanel({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const { current, previous, costing, loading, isError, refetch } = usePrimeCost(filters);
  const band = current?.primeCostPct != null ? primeCostBand(current.primeCostPct) : null;
  const href = `/reports/prime-cost${filters.query ? `?${filters.query}` : ''}`;

  return (
    <motion.section variants={SECTION_RISE} aria-labelledby="profit-title" className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 id="profit-title" className="text-sm font-semibold text-foreground">
          Profit
        </h2>
        <Link href={href} className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
          Prime cost
          <ChevronRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <div className="rounded-lg border border-rule/60 bg-card px-4 py-4">
        {isError ? (
          <ReportError what="Profit" onRetry={refetch} />
        ) : loading ? (
          // The figure, its caption, the split bar, then the three shares.
          <div role="status" aria-busy="true" aria-label="Loading profit">
            <Bone className="h-9 w-24" />
            <Bone className="mt-1.5 h-3 w-64 max-w-full" />
            <Bone className="mt-4 h-3 w-full rounded-full" />
            <div className="mt-4 grid grid-cols-3 divide-x divide-rule/50 border-t border-rule/50 pt-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex flex-col items-center gap-1.5">
                  <Bone className="h-3 w-14" />
                  <Bone className="h-4 w-10" />
                </div>
              ))}
            </div>
          </div>
        ) : !current ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {costing.recipesError ? 'Recipe costs couldn’t be read.' : 'No costed recipes for these sales yet.'}{' '}
            <Link href="/menu" className="font-semibold text-primary hover:underline">
              Cost your menu
            </Link>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-3xl font-semibold tracking-title tabular-nums text-foreground">{pct(current.primeCostPct)}</span>
              {band && (
                <span className={cn('rounded-sm px-1.5 py-0.5 text-xs font-semibold', BAND_LOOK[band].pill)}>{BAND_LOOK[band].label}</span>
              )}
              <ChangePill change={current.primeCostPct !== null ? delta(current.primeCostPct, previous?.primeCostPct) : null} inverse />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Prime cost — food and labour as a share of sales without VAT.</p>
            <div className="mt-4">
              <ProfitBar summary={current} />
            </div>
            {/* The exact shares stay here: the bar clamps labour to what is left
                after food and rounds, so its legend can understate a bad week. */}
            <dl className="mt-4 grid grid-cols-3 divide-x divide-rule/50 border-t border-rule/50 pt-3 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Food cost</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{pct(current.foodCostPct)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Labour</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{pct(current.labourPct)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Gross profit</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{money(current.grossProfit)}</dd>
              </div>
            </dl>
            {current.coverage < 0.8 && (
              <p className="mt-3 text-xs text-muted-foreground">Estimated — {pct(current.coverage, 0)} of sales have a costed recipe.</p>
            )}
          </>
        )}
      </div>
    </motion.section>
  );
}

// ── Library ──────────────────────────────────────────────────────────────────

function Category({
  label,
  ...list
}: {
  label: string;
  reports: ReportDefinition[];
  query: string;
  favourites: ReportId[];
  onToggle: (id: ReportId) => void;
}) {
  return (
    // Columns, not a grid: each list sits right under the one above, with no
    // gap left by a taller neighbour.
    <section aria-label={label} className="mb-5 min-w-0 break-inside-avoid">
      <h3 className="mb-1.5 flex items-baseline justify-between px-1 text-sm font-semibold text-foreground">
        {label}
        <span className="text-xs font-normal tabular-nums text-muted-foreground">{list.reports.length}</span>
      </h3>
      <ReportList {...list} />
    </section>
  );
}

/**
 * The reports set aside because they'd say nothing here — named, with why, so
 * a missing report is never a mystery. Folded away: it's a footnote.
 */
function HiddenReports({ hidden }: { hidden: Array<{ report: ReportDefinition; reason: string }> }) {
  return (
    <details className="group px-1 text-sm text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight size={12} className="transition-transform group-open:rotate-90" aria-hidden="true" />
        {hidden.length} {hidden.length === 1 ? 'report doesn’t' : 'reports don’t'} apply to this workspace
      </summary>
      <ul className="mt-2 space-y-1 pl-[1.125rem] text-xs">
        {hidden.map(({ report, reason }) => (
          <li key={report.id}>
            <span className="font-medium text-foreground">{report.title}</span> — {reason}
          </li>
        ))}
      </ul>
      <p className="mt-2 pl-[1.125rem] text-xs">
        They come back on their own when that changes — a second site, or a module switched on in Settings.
      </p>
    </details>
  );
}

/** Reports as a hairline list — icon, title, one line of what it answers, a star. */
function ReportList({
  reports,
  query,
  favourites,
  onToggle,
}: {
  reports: ReportDefinition[];
  query: string;
  favourites: ReportId[];
  onToggle: (id: ReportId) => void;
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
      {reports.map((report) => {
        const Icon = REPORT_ICON[report.id] ?? DEFAULT_REPORT_ICON;
        const starred = favourites.includes(report.id);
        return (
          <li key={report.id} className="group/report relative border-b border-rule/45 last:border-b-0">
            <Link
              href={`/reports/${report.id}${query ? `?${query}` : ''}`}
              className="flex items-center gap-3 px-3.5 py-2.5 pr-11 transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary" aria-hidden="true">
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{report.title}</span>
                <span className="block truncate text-xs text-muted-foreground" title={report.description}>
                  {report.description}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => onToggle(report.id)}
              aria-pressed={starred}
              aria-label={starred ? `Remove ${report.title} from favourites` : `Add ${report.title} to favourites`}
              className={cn(
                'absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring',
                starred
                  ? 'text-stock'
                  : 'text-muted-foreground/60 opacity-0 group-hover/report:opacity-100 hover:bg-band hover:text-foreground [@media(hover:none)]:opacity-100',
              )}
            >
              <Star size={14} className={cn(starred && 'fill-current')} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
