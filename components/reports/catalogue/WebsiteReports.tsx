'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  Check,
  Clock,
  Copy,
  Eye,
  FileText,
  Funnel as FunnelIcon,
  Globe,
  type IconComponent,
  Link2,
  LogOut,
  MapPin,
  Monitor,
  Plug,
  Share2,
  Smartphone,
  Timer,
  Users,
  Zap,
} from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import {
  type BreakdownRow,
  type FunnelStep,
  type WebAnalyticsReport as Report,
  getAnalyticsConnection,
  getWebAnalyticsFunnel,
  getWebAnalyticsReport,
} from '@/lib/modules/analytics/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { findReport } from '@/lib/reports/catalogue';
import { toast } from '@/lib/toast';
import { formatRate, formatVisitDuration } from '@/lib/utils/analytics-connector';
import { cn } from '@/lib/utils/cn';
import {
  COMPARE_LABEL,
  type DateRange,
  comparisonDates,
  dayLabel,
  daysIn,
  delta,
  fillDays,
  rangeDates,
  rangeDays,
} from '@/lib/utils/report-filters';
import {
  ALL_WIDGETS,
  CHANNEL_GROUPS,
  DEFAULT_FUNNEL,
  DEVICE_GROUPS,
  HOURLY_BELOW_DAYS,
  WIDGET_BY_ID,
  type WidgetId,
  analyticsSnapshot,
  browserLabel,
  channelLabel,
  countryFlag,
  countryName,
  donutSlices,
  eventStack,
  fillHours,
  funnelRows,
  funnelSummary,
  hourKey,
  hoursIn,
  iconSite,
  normalizeFunnel,
  pagesPerVisit,
  sectionsFor,
  stepLabel,
} from '@/lib/utils/web-analytics';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ReportFrame } from '../kit/ReportFrame';
import { BarList, ChangePill, ReportBlock, ReportError, ReportLoading, ReportTable } from '../kit/parts';
import type { ReportFilterState } from '../kit/useReportFilters';
import { FunnelStepsDrawer } from '../website/FunnelStepsDrawer';
import { SiteIcon } from '../website/SiteIcon';
import {
  DonutChart,
  FunnelChart,
  Heatmap,
  MultiTrendChart,
  MultiTrendLegend,
  StackedColumnChart,
  type TrendSeries,
} from '../website/charts';

const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : Math.round(value).toLocaleString('en-GB');
const PROVIDER_NAME = { umami: 'Umami', posthog: 'PostHog' } as const;
const FUNNEL_KEY = 'duma:web-analytics-funnel';
/** Where the funnel lived before the dashboard's layout settings were removed (2026-10-23). */
const OLD_LAYOUT_KEY = 'duma:web-analytics-layout:v2';

/**
 * The funnel's steps, per device and workspace, like report favourites — a
 * view preference, not shared data. Steps saved with the old layout carry over.
 */
function useFunnelSteps(tenantId: string | null) {
  const key = `${FUNNEL_KEY}:${tenantId ?? 'none'}`;
  const [steps, setSteps] = useState<FunnelStep[]>(DEFAULT_FUNNEL);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key) ?? window.localStorage.getItem(`${OLD_LAYOUT_KEY}:${tenantId ?? 'none'}`);
      // Reading storage is the external-system sync an effect is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSteps(normalizeFunnel(JSON.parse(saved ?? 'null')));
    } catch {
      // Blocked or corrupt storage: the default funnel.
    }
  }, [key, tenantId]);
  const save = (next: FunnelStep[]) => {
    setSteps(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private mode: the steps last for this visit.
    }
  };
  return [steps, save] as const;
}

/** The funnel for the period — one cached query, shared by its widget and Copy JSON. */
function useFunnel(filters: ReportFilterState, steps: FunnelStep[], enabled: boolean, range: DateRange | null = filters.range) {
  const period = filters.params(range ?? filters.range);
  return useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', 'web-funnel', period.from, period.to, JSON.stringify(steps)),
    queryFn: () => getWebAnalyticsFunnel({ from: period.from, to: period.to, steps }),
    enabled: enabled && range !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Website analytics: the connected Umami or PostHog read for the report's
 * range, as a fixed dashboard of widgets. Each widget asks the API only for
 * what it draws; the comparison period is read only for totals, the trend's
 * comparison and event changes. The funnel's steps are the one setting.
 */
export function WebAnalyticsReport({ filters }: { filters: ReportFilterState }) {
  const report = findReport('web-analytics')!;
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [funnelSteps, setFunnelSteps] = useFunnelSteps(tenantId);
  const [editingFunnel, setEditingFunnel] = useState(false);

  const connection = useQuery({
    // The connector's own key, so connecting in Settings shows here at once.
    queryKey: moduleQueryKeys.analytics.key('external-connection', tenantId),
    queryFn: () => getAnalyticsConnection(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const connected = Boolean(connection.data);
  const provider = connection.data?.provider;

  const shown = ALL_WIDGETS;
  const hourly = rangeDays(filters.range) < HOURLY_BELOW_DAYS;
  const sections = sectionsFor(shown, 'current', { hourly });
  const previousSections = sectionsFor(shown, 'previous', { hourly });
  // Pinned per mount, like the report filters' own "now": today's hours stop here.
  const [now] = useState(() => new Date());
  const period = filters.params(filters.range);
  const previousWindow = filters.previous ? filters.params(filters.previous) : null;
  const read = (which: { from: string; to: string }, wanted: typeof sections) => ({
    queryKey: moduleQueryKeys.analytics.key('report', 'web', which.from, which.to, filters.timezone, wanted.join(',')),
    queryFn: () => getWebAnalyticsReport({ from: which.from, to: which.to, timezone: filters.timezone, sections: wanted }),
    // Provider calls are slow and rate-limited; a fetch a few minutes old is fine for a look back.
    staleTime: 5 * 60_000,
    retry: false,
  });
  const current = useQuery({ ...read(period, sections), enabled: connected && sections.length > 0 });
  const previous = useQuery({
    ...read(previousWindow ?? period, previousSections),
    enabled: connected && previousWindow !== null && previousSections.length > 0,
  });
  const data = current.data;
  const funnel = useFunnel(filters, funnelSteps, provider === 'umami');
  const notConnected =
    (connection.isSuccess && !connection.data) || (current.error instanceof ApiError && current.error.code === 'not_connected');

  return (
    <ReportFrame
      report={report}
      filters={filters}
      // A dashboard of live widgets doesn't print usefully; the CSV carries the figures.
      canPrint={false}
      action={
        <CopyJsonButton
          disabled={!data}
          build={() =>
            analyticsSnapshot({
              website: { name: connection.data?.displayName ?? '', provider: PROVIDER_NAME[provider!] },
              period: {
                label: filters.label,
                dates: rangeDates(filters.range),
                from: period.from,
                to: period.to,
                timezone: filters.timezone,
              },
              comparison: filters.previous
                ? { label: COMPARE_LABEL[filters.filters.compare], dates: comparisonDates(filters.range, filters.filters.compare) ?? '' }
                : null,
              current: data!,
              previous: previous.data,
              trend: {
                granularity: hourly ? 'hour' : 'day',
                rows: trendRows(data, filters.range, filters.timezone, hourly, now),
              },
              funnel: funnel.data,
              shown,
            })
          }
        />
      }
    >
      {connection.isError ? (
        <ReportError what="Your analytics connection" onRetry={() => void connection.refetch()} />
      ) : connection.isPending ? (
        <ReportLoading />
      ) : notConnected ? (
        <EmptyState
          icon={Globe}
          kind="start"
          title="Connect your website analytics"
          description="Connect Umami or PostHog and this report fills with your visitors, pages, sources and funnels — read live from your provider."
          action={
            hasCapability(capabilities, 'settings:write')
              ? { label: 'Connect analytics', href: '/settings/connectors?connector=analytics&mode=connect', icon: Plug }
              : undefined
          }
        />
      ) : (
        <>
          {current.isError ? (
            <ProviderError error={current.error} onRetry={() => void current.refetch()} />
          ) : sections.length > 0 && current.isPending ? (
            <ReportLoading />
          ) : (
            // items-start: each card is as tall as its content, not stretched to its neighbour.
            <div className="grid items-start gap-6 xl:grid-cols-2">
              {shown.map((id) => (
                <div key={id} className={cn('min-w-0', WIDGET_BY_ID.get(id)?.span === 'full' && 'xl:col-span-2')}>
                  <Widget
                    id={id}
                    data={data ?? { provider: provider!, breakdowns: {} }}
                    previous={previous.data}
                    filters={filters}
                    funnelSteps={funnelSteps}
                    onEditFunnel={() => setEditingFunnel(true)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {editingFunnel && (
        <FunnelStepsDrawer
          steps={funnelSteps}
          suggestions={{
            pages: (data?.breakdowns.pages ?? []).map((row) => row.key),
            events: (data?.breakdowns.events ?? []).map((row) => row.key),
          }}
          onSave={setFunnelSteps}
          onClose={() => setEditingFunnel(false)}
        />
      )}
    </ReportFrame>
  );
}

interface TrendRow {
  /** `YYYY-MM-DD` for a day, `YYYY-MM-DD HH` for an hour. */
  key: string;
  label: string;
  axis: string;
  visitors: number;
  pageviews: number;
}

/**
 * The trend's points for a range — by hour when it is short, by day otherwise
 * — with every bucket present, so a quiet hour reads as zero rather than as a
 * gap. The current period stops at the current hour; `now` is null for the
 * comparison, which is wholly past.
 */
function trendRows(report: Report | undefined, range: DateRange, timezone: string, hourly: boolean, now: Date | null): TrendRow[] {
  if (hourly) {
    const keys = hoursIn(daysIn(range), now ? hourKey(now, timezone) : undefined);
    const rows = report?.hourly ?? [];
    const visitors = fillHours(rows, keys, (row) => row.visitors);
    const pageviews = fillHours(rows, keys, (row) => row.pageviews);
    const manyDays = daysIn(range).length > 1;
    return keys.map((key, index) => {
      const [date, hour] = key.split(' ') as [string, string];
      return {
        key,
        label: `${dayLabel(date)}, ${hour}:00`,
        // Over two days, midnight names the day so the axis says where one ends.
        axis: manyDays && hour === '00' ? dayLabel(date).replace(/^\w+ /, '') : `${hour}:00`,
        visitors: visitors[index]!.value,
        pageviews: pageviews[index]!.value,
      };
    });
  }
  const visitors = fillDays(report?.daily ?? [], range, (row) => row.visitors);
  const pageviews = fillDays(report?.daily ?? [], range, (row) => row.pageviews);
  return visitors.map((day, index) => ({
    key: day.date,
    label: dayLabel(day.date),
    axis: dayLabel(day.date).replace(/^\w+ /, ''),
    visitors: day.value,
    pageviews: pageviews[index]!.value,
  }));
}

/** Copies the dashboard as JSON — ready to paste into any AI for a second look. */
function CopyJsonButton({ build, disabled }: { build: () => unknown; disabled: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      className="h-9 gap-1.5"
      disabled={disabled}
      aria-label="Copy this report as JSON"
      title="Copy as JSON — paste into any AI for analysis"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(build(), null, 2));
          setCopied(true);
          toast('success', 'Copied as JSON. Paste it into any AI to analyse.');
        } catch {
          toast('error', 'Couldn’t copy — your browser blocked the clipboard.');
        }
      }}
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
    </Button>
  );
}

function ProviderError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <ReportError what="Your website analytics" onRetry={onRetry} />
      {/* The provider's own reason — a rejected key, a renamed website — is the useful part. */}
      <p className="px-1 text-sm text-muted-foreground">
        {error.message}{' '}
        <a href="/settings/connectors?connector=analytics" className="font-medium text-primary underline-offset-4 hover:underline">
          Check the connection
        </a>
      </p>
    </div>
  );
}

// ── Widgets ─────────────────────────────────────────────────────────────────

interface WidgetProps {
  data: Report;
  previous: Report | undefined;
  filters: ReportFilterState;
}

function Widget({
  id,
  funnelSteps,
  onEditFunnel,
  ...props
}: WidgetProps & { id: WidgetId; funnelSteps: FunnelStep[]; onEditFunnel: () => void }) {
  switch (id) {
    case 'kpis':
      return <HeadlineFigures {...props} />;
    case 'trend':
      return <VisitorTrend {...props} />;
    case 'sources':
      return <TrafficSources {...props} />;
    case 'pages':
      return (
        <Toggled
          title="Top pages"
          icon={FileText}
          {...props}
          options={[
            ['pages', 'Viewed'],
            ['entries', 'Landed on'],
          ]}
          unit="views"
        />
      );
    case 'referrers':
      return (
        <Toggled
          title="Referrers & campaigns"
          icon={Link2}
          {...props}
          options={[
            ['referrers', 'Referrers'],
            ['campaigns', 'UTM campaigns'],
          ]}
          unit="visitors"
          unavailable={{ campaigns: 'UTM campaigns need Umami 3 or PostHog.' }}
          withIcons
        />
      );
    case 'countries':
      return (
        <Breakdown
          title="Countries"
          icon={MapPin}
          rows={props.data.breakdowns.countries}
          provider={props.data.provider}
          label={(key) => `${countryFlag(key)}  ${countryName(key)}`}
          unit="visitors"
        />
      );
    case 'devices':
      return <Devices {...props} />;
    case 'tech':
      return (
        <Toggled
          title="Browsers & systems"
          icon={Monitor}
          {...props}
          options={[
            ['browsers', 'Browsers'],
            ['os', 'Systems'],
          ]}
          label={{ browsers: browserLabel }}
          unit="visitors"
          withIcons
        />
      );
    case 'heatmap':
      return (
        <ReportBlock title="Visits by day and hour" description="When people are on your website.">
          {props.data.weekly ? (
            <Heatmap grid={props.data.weekly} format={count} timezone={props.filters.timezone} />
          ) : (
            <Unavailable icon={Clock} provider={props.data.provider} />
          )}
        </ReportBlock>
      );
    case 'events':
      return <CustomEvents {...props} />;
    case 'funnel':
      return <Funnel filters={props.filters} steps={funnelSteps} provider={props.data.provider} onEdit={onEditFunnel} />;
  }
}

/**
 * The four headline figures, in the same tile row as Communications and
 * Inventory (`Fact`, card surface). The change against the comparison leads
 * each tile's hint line, so every figure carries what it was measured against.
 */
function HeadlineFigures({ data, previous, filters }: WidgetProps) {
  const now = data.summary;
  const before = previous?.summary;
  const perVisit = pagesPerVisit(now);
  const unavailable = 'Not available from this provider';
  const hint = (detail: string, current: number | null | undefined, then: number | null | undefined, inverse = false) => {
    const change = filters.previous && current !== null && current !== undefined ? delta(current, then) : null;
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {change && <ChangePill change={change} inverse={inverse} />}
        <span>{detail}</span>
      </span>
    );
  };
  return (
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Fact
        surface="card"
        icon={Users}
        label="Visitors"
        value={count(now?.visitors)}
        hint={hint(
          now?.visits !== null && now?.visits !== undefined ? `${count(now.visits)} visits` : 'Unique visitors',
          now?.visitors,
          before?.visitors,
        )}
      />
      <Fact
        surface="card"
        icon={Eye}
        label="Pageviews"
        value={count(now?.pageviews)}
        hint={hint(perVisit !== null ? `${perVisit.toFixed(1)} pages a visit` : 'Pages viewed', now?.pageviews, before?.pageviews)}
      />
      <Fact
        surface="card"
        icon={LogOut}
        label="Bounce rate"
        value={formatRate(now?.bounceRate ?? null)}
        // Fewer people leaving after one page is the good direction.
        hint={now?.bounceRate === null ? unavailable : hint('Left after one page', now?.bounceRate, before?.bounceRate, true)}
      />
      <Fact
        surface="card"
        icon={Timer}
        label="Average visit"
        value={formatVisitDuration(now?.avgVisitSeconds ?? null)}
        hint={now?.avgVisitSeconds === null ? unavailable : hint('Time on the site', now?.avgVisitSeconds, before?.avgVisitSeconds)}
      />
    </dl>
  );
}

/**
 * Who's on the website right now — visitors in the last five minutes, per the
 * provider — read again every minute while the report is open. Quiet when the
 * count can't be read: it's a glance, not a figure the report depends on.
 */
function LiveNow({ filters }: { filters: ReportFilterState }) {
  const live = useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', 'web-active'),
    queryFn: () => getWebAnalyticsReport({ ...filters.params(filters.range), timezone: filters.timezone, sections: ['active'] }),
    refetchInterval: 60_000,
    retry: false,
  });
  const active = live.data?.active;
  if (active === undefined || active === null) return null;
  return (
    <Tooltip side="top" align="end" label="Visitors in the last five minutes, refreshed every minute">
      <p className="flex items-center gap-2 text-sm">
        <span className="relative flex size-2.5" aria-hidden="true">
          {active > 0 && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
          )}
          <span className={cn('relative inline-flex size-2.5 rounded-full', active > 0 ? 'bg-success' : 'bg-muted-foreground/40')} />
        </span>
        <span className="font-semibold tabular-nums text-foreground">{count(active)}</span>
        <span className="text-muted-foreground">live now</span>
      </p>
    </Tooltip>
  );
}

function VisitorTrend({ data, previous, filters }: WidgetProps) {
  const [now] = useState(() => new Date());
  const hourly = rangeDays(filters.range) < HOURLY_BELOW_DAYS;
  const rows = trendRows(data, filters.range, filters.timezone, hourly, now);
  const before = filters.previous && previous ? trendRows(previous, filters.previous, filters.timezone, hourly, null) : null;
  // Day 1 against day 1, hour 1 against hour 1 — what "against the previous period" means.
  const then = (key: 'visitors' | 'pageviews') => (before ? rows.map((_, index) => before[index]?.[key] ?? null) : null);
  // Blue and green: series slots 1 and 3, checked as a pair (light and dark) with the dataviz validator.
  const series: TrendSeries[] = [
    { key: 'visitors', label: 'Visitors', slot: 1, values: rows.map((row) => row.visitors), previous: then('visitors') },
    { key: 'pageviews', label: 'Pageviews', slot: 3, values: rows.map((row) => row.pageviews), previous: then('pageviews') },
  ];
  const unit = hourly ? 'an hour' : 'a day';
  return (
    <ReportBlock
      title={`Visitors and pageviews ${unit}`}
      actions={<LiveNow filters={filters} />}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <MultiTrendLegend series={series} />
          {hourly && <span>Times in {filters.timezone.replaceAll('_', ' ')}</span>}
        </span>
      }
    >
      <MultiTrendChart
        days={rows.map((row) => ({ label: row.label, axis: row.axis }))}
        series={series}
        format={count}
        previousLabel={COMPARE_LABEL[filters.filters.compare]}
        ariaLabel={`Visitors and pageviews ${unit}`}
      />
    </ReportBlock>
  );
}

function TrafficSources({ data }: WidgetProps) {
  const channels = data.breakdowns.channels;
  // Umami groups visits into channels; PostHog doesn't, so its referrers stand in.
  const slices = channels?.length
    ? donutSlices(channels, channelLabel, CHANNEL_GROUPS)
    : donutSlices(data.breakdowns.referrers ?? [], (key) => key);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <ReportBlock
      title="Traffic sources"
      description={channels?.length ? 'Where visits came from, by channel.' : 'The sites that sent visitors.'}
    >
      {slices.length ? (
        <DonutChart slices={slices} total={total} totalLabel="visits" format={count} ariaLabel="Visits by traffic source" />
      ) : (
        <Nothing icon={Share2} title="No visits in this period" />
      )}
    </ReportBlock>
  );
}

function Devices({ data }: WidgetProps) {
  const rows = data.breakdowns.devices;
  const slices = donutSlices(rows ?? [], (key) => key, DEVICE_GROUPS);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <ReportBlock title="Devices" description="What visitors browsed on.">
      {rows === null ? (
        <Unavailable icon={Smartphone} provider={data.provider} />
      ) : slices.length ? (
        <DonutChart slices={slices} total={total} totalLabel="visitors" format={count} ariaLabel="Visitors by device" />
      ) : (
        <Nothing icon={Smartphone} title="No visitors in this period" />
      )}
    </ReportBlock>
  );
}

type ToggleKey = 'pages' | 'entries' | 'referrers' | 'campaigns' | 'browsers' | 'os';
const isSiteKind = (key: ToggleKey): key is 'referrers' | 'campaigns' | 'browsers' | 'os' => key !== 'pages' && key !== 'entries';

/** A ranked list with a switch between two related breakdowns. */
function Toggled({
  title,
  data,
  options,
  unit,
  label = {},
  unavailable = {},
  withIcons = false,
  icon,
}: WidgetProps & {
  title: string;
  options: [ToggleKey, string][];
  unit: string;
  label?: Partial<Record<ToggleKey, (key: string) => string>>;
  unavailable?: Partial<Record<ToggleKey, string>>;
  /** Site icons before each row (referrers, campaigns, browsers, systems). */
  withIcons?: boolean;
  /** The widget's glyph, for its empty state. */
  icon: IconComponent;
}) {
  const [which, setWhich] = useState<ToggleKey>(options[0]![0]);
  const rows = data.breakdowns[which];
  return (
    <Breakdown
      title={title}
      rows={rows}
      provider={data.provider}
      unit={unit}
      label={label[which]}
      icon={icon}
      leading={withIcons && isSiteKind(which) ? (key) => <SiteIcon domain={iconSite(which, key)} /> : undefined}
      unavailableText={unavailable[which]}
      actions={
        <SegmentedControl
          ariaLabel={`${title}: what to list`}
          options={options.map(([value, text]) => ({ value, label: text }))}
          value={which}
          onChange={setWhich}
        />
      }
    />
  );
}

function Breakdown({
  title,
  rows,
  provider,
  unit,
  label = (key) => key,
  icon,
  leading,
  actions,
  unavailableText,
}: {
  title: string;
  rows: BreakdownRow[] | null | undefined;
  provider: Report['provider'];
  unit: string;
  label?: (key: string) => string;
  /** The widget's glyph, for its empty state. */
  icon: IconComponent;
  /** A mark before each row's label — a site icon. */
  leading?: (key: string) => React.ReactNode;
  actions?: React.ReactNode;
  unavailableText?: string;
}) {
  return (
    <ReportBlock title={title} description={`By ${unit}.`} actions={actions}>
      {rows === null ? (
        <Unavailable icon={icon} provider={provider} text={unavailableText} />
      ) : rows?.length ? (
        <BarList
          rows={rows
            .slice(0, 8)
            .map((row) => ({ key: row.key, label: label(row.key) || '(none)', value: row.value, leading: leading?.(row.key) }))}
          format={count}
        />
      ) : (
        <Nothing icon={icon} />
      )}
    </ReportBlock>
  );
}

function CustomEvents({ data, previous, filters }: WidgetProps) {
  const [now] = useState(() => new Date());
  const rows = data.breakdowns.events;
  const before = new Map((previous?.breakdowns.events ?? []).map((row) => [row.key, row.value]));
  const total = (rows ?? []).reduce((sum, row) => sum + row.value, 0);
  // The same buckets as the visitors chart: hours on a short range, days otherwise.
  const hourly = rangeDays(filters.range) < HOURLY_BELOW_DAYS;
  const buckets = trendRows(undefined, filters.range, filters.timezone, hourly, now);
  const stack = eventStack(
    data.eventSeries ?? [],
    buckets.map((bucket) => bucket.key),
  );
  // A table row wears its event's colour when the chart gives it one.
  const slotOf = new Map(stack.filter((line) => line.slot > 0).map((line) => [line.key, line.slot]));
  return (
    <ReportBlock title="Custom events" description="Actions your website tracks." flush={Boolean(rows?.length)}>
      {rows === null ? (
        <Unavailable icon={Zap} provider={data.provider} />
      ) : rows?.length ? (
        <>
          {data.eventSeries && data.eventSeries.length > 0 && (
            <div className="border-b border-rule/50 p-4">
              <StackedColumnChart
                buckets={buckets.map((bucket) => ({ label: bucket.label, axis: bucket.axis }))}
                series={stack}
                format={count}
                ariaLabel={`Custom events ${hourly ? 'an hour' : 'a day'}`}
              />
            </div>
          )}
          <ReportTable
            rows={rows}
            rowKey={(row) => row.key}
            defaultSort={{ key: 'count', direction: 'desc' }}
            limit={10}
            columns={[
              {
                key: 'event',
                header: 'Event',
                render: (row) => <span className="font-mono text-xs">{row.key}</span>,
                leading: (row) => <EventSwatch slot={slotOf.get(row.key) ?? 0} />,
                sort: (row) => row.key,
              },
              {
                key: 'count',
                header: 'Count',
                align: 'right',
                render: (row) => count(row.value),
                meter: (row) => (total ? row.value / total : 0),
                sort: (row) => row.value,
              },
              {
                key: 'change',
                header: 'Change',
                align: 'right',
                render: (row) => {
                  if (!previous) return <span className="text-muted-foreground">—</span>;
                  const then = before.get(row.key) ?? 0;
                  if (then === 0) return <span className="text-xs text-muted-foreground">New</span>;
                  const change = Math.round(((row.value - then) / then) * 100);
                  return (
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        change > 0 ? 'text-momentum' : change < 0 ? 'text-exception' : 'text-muted-foreground',
                      )}
                    >
                      {change > 0 ? '+' : change < 0 ? '−' : ''}
                      {Math.abs(change)}%
                    </span>
                  );
                },
              },
            ]}
          />
        </>
      ) : (
        <Nothing
          icon={Zap}
          title="No custom events in this period"
          description={`Track actions from your website with ${data.provider === 'umami' ? "umami.track('order_placed')" : "posthog.capture('order_placed')"}.`}
        />
      )}
    </ReportBlock>
  );
}

/**
 * The funnel card, laid out the way PostHog, Mixpanel and Amplitude lay theirs:
 * the answer first — how many got all the way through, against the comparison
 * — then each step as a bar on one scale, with what was lost between steps on
 * the connector and the worst drop flagged, so the step to fix is obvious.
 */
function Funnel({
  filters,
  steps,
  provider,
  onEdit,
}: {
  filters: ReportFilterState;
  steps: FunnelStep[];
  provider: Report['provider'];
  onEdit: () => void;
}) {
  const funnel = useFunnel(filters, steps, provider === 'umami');
  const before = useFunnel(filters, steps, provider === 'umami', filters.previous);
  const rows = funnel.data ? funnelRows(funnel.data) : [];
  const summary = funnelSummary(rows, before.data ? funnelRows(before.data) : null);
  const first = rows[0];
  const last = rows.at(-1);
  return (
    <ReportBlock
      title="Funnel"
      description={`${steps.length} steps · within an hour`}
      actions={
        <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
          Edit steps
        </Button>
      }
    >
      {provider !== 'umami' ? (
        <Unavailable
          icon={FunnelIcon}
          provider={provider}
          text="Funnels are available with Umami. In PostHog, build them under Product analytics → Funnels."
        />
      ) : funnel.isError ? (
        <div className="py-4 text-center text-sm">
          <p className="text-muted-foreground">{funnel.error.message}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void funnel.refetch()}>
            Try again
          </Button>
        </div>
      ) : funnel.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading the funnel">
          <div className="h-12 w-40 animate-pulse rounded-md bg-band/70" />
          {steps.map((step) => (
            <div key={`${step.type}:${step.value}`} className="h-10 animate-pulse rounded-md bg-band/70" />
          ))}
        </div>
      ) : first?.visitors && last ? (
        <div className="space-y-5">
          {/* The answer, before the detail. */}
          <div>
            <p className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums tracking-headline text-foreground">
                {summary.conversion === null ? '—' : `${(Math.round(summary.conversion * 1000) / 10).toLocaleString('en-GB')}%`}
              </span>
              <span className="text-sm text-muted-foreground">converted</span>
              {summary.conversion !== null && summary.previousConversion !== null && (
                <ChangePill change={delta(summary.conversion, summary.previousConversion)} />
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{count(summary.completed)}</span> of{' '}
              <span className="tabular-nums">{count(summary.started)}</span> visitors went from{' '}
              <span className="font-medium text-foreground">{stepLabel(first)}</span> to{' '}
              <span className="font-medium text-foreground">{stepLabel(last)}</span>.
            </p>
          </div>
          <FunnelChart rows={rows} format={count} biggestDrop={summary.biggestDrop} />
        </div>
      ) : (
        // The steps are the likely culprit, so the way out is editing them.
        <EmptyState
          icon={FunnelIcon}
          kind="start"
          compact
          title="Nobody reached the first step"
          description="Check the steps match your page paths and event names."
          action={{ label: 'Edit steps', onClick: onEdit }}
        />
      )}
    </ReportBlock>
  );
}

const SWATCH = ['bg-chart-5', 'bg-series-1', 'bg-series-2', 'bg-series-3', 'bg-series-4'] as const;

/** The dot that ties a table row to its colour in the events chart ("Other" for the rest). */
function EventSwatch({ slot }: { slot: number }) {
  return <span className={cn('size-2 shrink-0 rounded-full', SWATCH[slot])} aria-hidden="true" />;
}

/**
 * A widget the provider can't fill: the shared empty state, compact as the
 * dashboard's cards use it, with the widget's own glyph. Every empty card in
 * this report wears the same calm face (owner's call, 2026-10-23) — the words
 * say which kind of empty it is.
 */
function Unavailable({ icon, provider, text }: { icon: IconComponent; provider: Report['provider']; text?: string }) {
  return (
    <EmptyState
      icon={icon}
      kind="start"
      compact
      title={`Not available from ${PROVIDER_NAME[provider]}`}
      description={text ?? `${PROVIDER_NAME[provider]} doesn’t report this.`}
    />
  );
}

/** A widget with nothing in the period — a normal reading, not an error: the shared empty state, compact. */
function Nothing({ icon, title = 'Nothing in this period', description }: { icon: IconComponent; title?: string; description?: string }) {
  return <EmptyState icon={icon} kind="start" compact title={title} description={description ?? 'Try a longer date range.'} />;
}
