'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import {
  Widget,
  WidgetBar,
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
import { BarChart3, FileText, Globe, type IconComponent, Plug, Radio, Share2 } from '@/components/icons';
import { DeltaBadge } from '@/components/shared/StatCard';
import { Tooltip } from '@/components/shared/Tooltip';

import { ApiError } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import { type Change, fortnightReading, todaySoFar, topRows, webWindows } from '@/lib/dashboard/website-widgets';
import { type ReportSection, type WebAnalyticsReport, getAnalyticsConnection, getWebAnalyticsReport } from '@/lib/modules/analytics/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { wholePercents } from '@/lib/utils/dashboard-cards';
import { dayLabel } from '@/lib/utils/report-filters';
import { barPercent } from '@/lib/utils/today-figures';
import { CHANNEL_GROUPS, channelLabel, donutSlices } from '@/lib/utils/web-analytics';
import { resolvedTimeZone } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* The website, read from the workspace's connected Umami or PostHog: who is on
 * it now, today against yesterday, the last fortnight, the pages people read
 * and where they came from. Every card asks the same endpoint as the Website
 * report, in the same key style, and the two seven-day cards share one read.
 * With nothing connected, each says so calmly and links to the connector. */

const REPORT = '/reports/web-analytics';
const CONNECT = '/settings/connectors?connector=analytics&mode=connect';

const count = (value: number) => Math.round(value).toLocaleString('en-GB');
const plural = (value: number, one: string, many: string) => `${count(value)} ${Math.round(value) === 1 ? one : many}`;
const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

// ── The shared read ─────────────────────────────────────────────────────────

/** The connector's own key, so connecting in Settings fills every card at once. */
function useConnection() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  return useQuery({
    queryKey: moduleQueryKeys.analytics.key('external-connection', tenantId),
    queryFn: () => getAnalyticsConnection(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
}

/**
 * One read of the report for a window, in the Website report's key style
 * (from, to, timezone, sorted sections) — so two cards asking for the same
 * window and sections share one request.
 */
function useWebReport(
  window: { from: string; to: string },
  sections: ReportSection[],
  { enabled, staleTime, refetchInterval }: { enabled: boolean; staleTime: number; refetchInterval?: number },
) {
  const timezone = resolvedTimeZone();
  const wanted = [...sections].sort();
  return useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', 'web', window.from, window.to, timezone, wanted.join(',')),
    queryFn: () => getWebAnalyticsReport({ ...window, timezone, sections: wanted }),
    enabled,
    // Provider calls are slow and rate-limited.
    staleTime,
    refetchInterval,
    retry: false,
  });
}

/** Whole days in the workspace's zone, fixed per mount like the other day cards. */
function useWindows() {
  const [now] = useState(() => new Date());
  return { ...webWindows(now, resolvedTimeZone()), now };
}

const notConnectedError = (error: unknown) => error instanceof ApiError && error.code === 'not_connected';

/** Where a card stands: the connection first, then its own reads. */
function useStatus(connection: ReturnType<typeof useConnection>, reads: UseQueryResult<unknown>[]) {
  const notConnected = (connection.isSuccess && !connection.data) || reads.some((read) => notConnectedError(read.error));
  const connected = Boolean(connection.data);
  return {
    notConnected,
    loading: !notConnected && (connection.isPending || (connected && reads.some((read) => read.isPending))),
    error: !notConnected && (connection.isError || reads.some((read) => read.isError)),
    retry: () => {
      if (connection.isError) void connection.refetch();
      reads.forEach((read) => read.isError && void read.refetch());
    },
  };
}

// ── The frame ───────────────────────────────────────────────────────────────

function WebWidget({
  title,
  icon,
  status,
  empty,
  accessory,
  children,
}: {
  title: string;
  icon: IconComponent;
  status: ReturnType<typeof useStatus>;
  empty?: { icon?: IconComponent; title: string; detail?: string };
  accessory?: ReactNode;
  children: ReactNode;
}) {
  if (status.notConnected) {
    return (
      <Widget title={title} icon={icon} tint="brand" surface="plain" href={CONNECT} hrefLabel="Connect your website analytics">
        <NotConnected />
      </Widget>
    );
  }
  return (
    <Widget
      title={title}
      icon={icon}
      tint="brand"
      surface="plain"
      href={REPORT}
      hrefLabel="Open the website report"
      accessory={accessory}
      loading={status.loading}
      error={status.error}
      onRetry={status.retry}
      empty={empty}
    >
      {children}
    </Widget>
  );
}

/** Nothing connected: one calm line, and the way to connect for whoever can. */
function NotConnected() {
  const slim = isSlim(useFamily());
  const canConnect = hasCapability(
    useAuthStore((state) => state.capabilities),
    'settings:write',
  );
  if (slim) {
    return (
      <Link
        href={CONNECT}
        className="mt-auto flex min-w-0 items-center gap-2 text-[13px] font-medium text-heading hover:text-primary"
      >
        <Plug size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">Connect your website analytics</span>
      </Link>
    );
  }
  return (
    <div className="mt-auto">
      <Plug size={18} className="text-muted-foreground" aria-hidden="true" />
      <p className="mt-1.5 text-[13px] leading-snug font-medium text-heading">Connect your website analytics</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
        {canConnect ? 'Read your visitors from Umami or PostHog.' : 'Ask someone who manages settings to connect Umami or PostHog.'}
      </p>
      {canConnect && (
        <Link href={CONNECT} className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline">
          Connect analytics
        </Link>
      )}
    </div>
  );
}

/** A change as the app's delta badge: a percentage, or "New" from nothing. */
function ChangeBadge({ change, label }: { change: Change | null; label: string }) {
  if (!change) return null;
  const value = change.ratio === null ? (change.change === 0 ? 'No change' : 'New') : Math.round(change.ratio * 100);
  return <DeltaBadge size="sm" className="min-w-0" delta={{ value, label }} />;
}

/** A provider that can't answer a section says so; `null` is not zero. */
const unavailable = (data: WebAnalyticsReport | undefined, what: string) =>
  ({ icon: Globe, title: `Not available from ${data?.provider === 'posthog' ? 'PostHog' : 'your provider'}`, detail: what }) as const;

// ── Online now ──────────────────────────────────────────────────────────────

/** Visitors in the last five minutes, read every 30 seconds. */
export function WebOnlineCard() {
  const connection = useConnection();
  const windows = useWindows();
  // The Website report's own live key, so the two never read twice at once.
  const live = useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', 'web-active'),
    queryFn: () => getWebAnalyticsReport({ ...windows.todayWindow, timezone: resolvedTimeZone(), sections: ['active'] }),
    enabled: Boolean(connection.data),
    refetchInterval: 30_000,
    retry: false,
  });
  const status = useStatus(connection, [live]);
  const active = live.data?.active;

  return (
    <WebWidget
      title="Online now"
      icon={Radio}
      status={status}
      empty={active === null ? unavailable(live.data, 'Your provider doesn’t report live visitors.') : undefined}
    >
      {typeof active === 'number' && <OnlineReading active={active} />}
    </WebWidget>
  );
}

function OnlineReading({ active }: { active: number }) {
  const family = useFamily();
  const dot = (
    <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
      {active > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />}
      <span className={cn('relative inline-flex size-2.5 rounded-full', active > 0 ? 'bg-success' : 'bg-muted-foreground/40')} />
    </span>
  );
  const caption = active === 1 ? 'visitor now' : 'visitors now';
  if (isSlim(family)) {
    return (
      <WidgetSlim
        value={
          <span className="flex items-center gap-2">
            {dot}
            {count(active)}
          </span>
        }
        caption={`${caption} · last five minutes`}
      />
    );
  }
  return (
    <div className="mt-auto min-w-0">
      <span className="flex items-center gap-2.5">
        {dot}
        <WidgetFigure value={count(active)} />
      </span>
      <WidgetCaption className="mt-1">{caption}</WidgetCaption>
      <WidgetCaption className="text-xs">In the last five minutes</WidgetCaption>
    </div>
  );
}

// ── Website today ───────────────────────────────────────────────────────────

/** Visitors and page views so far today against yesterday up to the same time. */
export function WebTodayCard() {
  const connection = useConnection();
  const windows = useWindows();
  const connected = Boolean(connection.data);
  const today = useWebReport(windows.todayWindow, ['hourly', 'summary'], { enabled: connected, staleTime: 60_000, refetchInterval: 60_000 });
  // Yesterday is over: one read holds for a good while.
  const yesterday = useWebReport(windows.yesterdayWindow, ['hourly', 'summary'], { enabled: connected, staleTime: 30 * 60_000 });
  // A failed yesterday only costs the comparison; today is the card.
  const status = useStatus(connection, [today]);

  const reading = todaySoFar({
    todayRows: today.data?.hourly,
    yesterdayRows: yesterday.data?.hourly,
    yesterdayTotal: yesterday.data?.summary,
    today: windows.today,
    yesterday: windows.yesterday,
    // The comparison runs to when today was read, not to when the card mounted.
    now: new Date(today.dataUpdatedAt || windows.now.getTime()),
    timeZone: resolvedTimeZone(),
  });
  // The day's unique visitors where the provider counts them; the hours summed otherwise.
  const visitors = today.data?.summary?.visitors ?? reading.visitors;
  const pageviews = today.data?.summary?.pageviews ?? reading.pageviews;

  return (
    <WebWidget
      title="Website today"
      icon={Globe}
      status={status}
      empty={
        today.data && !today.data.hourly && !today.data.summary
          ? unavailable(today.data, 'Your provider doesn’t report today’s visits.')
          : undefined
      }
    >
      <TodayReading
        visitors={visitors}
        pageviews={pageviews}
        reading={yesterday.isPending ? { ...reading, compared: 'none' } : reading}
      />
    </WebWidget>
  );
}

function TodayReading({
  visitors,
  pageviews,
  reading,
}: {
  visitors: number;
  pageviews: number;
  reading: ReturnType<typeof todaySoFar>;
}) {
  const family = useFamily();
  const against = reading.compared === 'same-time' ? 'vs this time yesterday' : 'vs all of yesterday';
  const badge = reading.compared === 'none' ? null : <ChangeBadge change={reading.visitorsChange} label={against} />;
  const bars = (axis: boolean) => <HourBars hours={reading.hours} currentHour={reading.currentHour} axis={axis} />;

  if (isSlim(family)) {
    return <WidgetSlim value={count(visitors)} caption={badge ?? (visitors === 1 ? 'visitor today' : 'visitors today')} visual={bars(false)} />;
  }

  const head = (
    <div className="min-w-0">
      <WidgetFigure value={count(visitors)} size={family === 'small' ? 'small' : family === 'medium' ? 'medium' : 'large'} />
      <WidgetCaption className="mt-1">
        {visitors === 1 ? 'visitor' : 'visitors'} · {plural(pageviews, 'page view', 'page views')}
      </WidgetCaption>
      {badge && <WidgetCaption className="mt-0.5 flex items-center">{badge}</WidgetCaption>}
    </div>
  );

  if (family === 'small') return <div className="mt-auto">{head}</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {head}
      {(family === 'large' || family === 'extraLarge') && reading.compared !== 'none' && (
        <WidgetFacts
          columns={2}
          tray={false}
          className="border-t border-border/60 pt-3"
          facts={[
            {
              label: reading.compared === 'same-time' ? 'Visitors yesterday by now' : 'Visitors all yesterday',
              value: count(reading.then.visitors ?? 0),
            },
            {
              label: reading.compared === 'same-time' ? 'Page views yesterday by now' : 'Page views all yesterday',
              value: count(reading.then.pageviews ?? 0),
            },
          ]}
        />
      )}
      <div className="min-h-12 flex-1">{bars(true)}</div>
    </div>
  );
}

/** Today's hours as slim bars; hours still to come are left as a faint stub. */
function HourBars({ hours, currentHour, axis }: { hours: ReturnType<typeof todaySoFar>['hours']; currentHour: number; axis: boolean }) {
  const max = Math.max(1, ...hours.map((entry) => entry.visitors));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-end gap-[2px]" role="img" aria-label="Visitors by hour today">
        {hours.map((entry) => (
          <Tooltip
            key={entry.hour}
            side="top"
            label={entry.future ? `${clock(entry.hour)}: still to come` : `${clock(entry.hour)}: ${plural(entry.visitors, 'visitor', 'visitors')}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className={cn(
                'block w-full rounded-t-[3px]',
                entry.future || entry.visitors === 0 ? 'bg-band' : entry.hour === currentHour ? 'bg-primary' : 'bg-primary/55',
              )}
              style={{ height: entry.visitors && !entry.future ? `${barPercent(entry.visitors, max)}%` : '3px' }}
            />
          </Tooltip>
        ))}
      </div>
      {axis && (
        <div className="mt-1.5 flex justify-between text-[11px] leading-none font-medium text-muted-foreground tabular-nums" aria-hidden="true">
          <span>00:00</span>
          <span>12:00</span>
          <span>23:00</span>
        </div>
      )}
    </div>
  );
}

// ── Visits per day ──────────────────────────────────────────────────────────

/** The last fourteen whole days, visitors and page views, against the fourteen before. */
export function WebVisitsCard() {
  const connection = useConnection();
  const windows = useWindows();
  // Past days only: they don't change under a dashboard left open.
  const report = useWebReport(windows.fortnight.window, ['daily'], { enabled: Boolean(connection.data), staleTime: 30 * 60_000 });
  const status = useStatus(connection, [report]);
  const reading = fortnightReading(report.data?.daily, windows.fortnight.current, windows.fortnight.previous);

  return (
    <WebWidget
      title="Visits per day"
      icon={BarChart3}
      status={status}
      empty={
        report.data && !report.data.daily
          ? unavailable(report.data, 'Your provider doesn’t report daily visits.')
          : report.data && reading.empty
            ? { icon: Globe, title: 'No visits in the last 14 days' }
            : undefined
      }
    >
      <VisitsReading reading={reading} />
    </WebWidget>
  );
}

function VisitsReading({ reading }: { reading: ReturnType<typeof fortnightReading> }) {
  const family = useFamily();
  const perDay = Math.round(reading.perDay);
  const badge = <ChangeBadge change={reading.perDayChange} label="vs the 14 days before" />;
  const bars = (axis: boolean) => <DayBars days={reading.days} axis={axis} />;

  if (isSlim(family)) {
    return <WidgetSlim value={count(perDay)} caption={reading.perDayChange ? badge : 'visitors a day'} visual={bars(false)} />;
  }

  const head = (
    <div className="min-w-0">
      <WidgetFigure value={count(perDay)} size={family === 'small' ? 'small' : family === 'medium' ? 'medium' : 'large'} />
      <WidgetCaption className="mt-1">
        visitors a day · {plural(reading.pageviews, 'page view', 'page views')}
      </WidgetCaption>
      {reading.perDayChange && <WidgetCaption className="mt-0.5 flex items-center">{badge}</WidgetCaption>}
    </div>
  );

  if (family === 'small') return <div className="mt-auto">{head}</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {head}
      <div className="min-h-12 flex-1">{bars(true)}</div>
      {(family === 'large' || family === 'extraLarge') && (
        <ul className="flex gap-3 text-[11px] leading-4 text-muted-foreground" aria-hidden="true">
          <li className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-series-1" />
            Visitors
          </li>
          <li className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-series-3/45" />
            Page views
          </li>
        </ul>
      )}
    </div>
  );
}

/** One column a day: page views behind as a soft bar, visitors in front. */
function DayBars({ days, axis }: { days: ReturnType<typeof fortnightReading>['days']; axis: boolean }) {
  const max = Math.max(1, ...days.map((day) => Math.max(day.visitors, day.pageviews)));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-end gap-[3px]" role="img" aria-label="Visitors and page views a day, last 14 days">
        {days.map((day) => (
          <Tooltip
            key={day.date}
            side="top"
            label={`${dayLabel(day.date)}: ${plural(day.visitors, 'visitor', 'visitors')}, ${plural(day.pageviews, 'page view', 'page views')}`}
            className="relative flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className={cn('absolute inset-x-0 bottom-0 rounded-t-[3px]', day.pageviews ? 'bg-series-3/45' : 'bg-band')}
              style={{ height: day.pageviews ? `${barPercent(day.pageviews, max)}%` : '3px' }}
            />
            {day.visitors > 0 && (
              <span className="relative block w-full rounded-t-[3px] bg-series-1" style={{ height: `${barPercent(day.visitors, max)}%` }} />
            )}
          </Tooltip>
        ))}
      </div>
      {axis && days.length > 0 && (
        <div className="mt-1.5 flex justify-between text-[11px] leading-none font-medium text-muted-foreground tabular-nums" aria-hidden="true">
          <span>{dayLabel(days[0]!.date).replace(/^\w+ /, '')}</span>
          <span>{dayLabel(days.at(-1)!.date).replace(/^\w+ /, '')}</span>
        </div>
      )}
    </div>
  );
}

// ── Top pages and traffic sources ───────────────────────────────────────────

/** The last seven days' pages, channels and referrers — one read for both cards. */
function useWeek() {
  const connection = useConnection();
  const windows = useWindows();
  const report = useWebReport(windows.week.window, ['channels', 'pages', 'referrers'], {
    enabled: Boolean(connection.data),
    staleTime: 5 * 60_000,
  });
  return { report, status: useStatus(connection, [report]) };
}

interface RankRow {
  key: string;
  label: string;
  value: number;
  ofMax: number;
  percent: number;
  fill: string;
}

/**
 * A ranked list: each row its name, its count and a thin bar against the
 * biggest; as many as the cell holds. Half a square holds the first alone.
 */
function RankReading({ rows, more, noun, total }: { rows: RankRow[]; more: number; noun: [string, string]; total: number }) {
  const family = useFamily();
  // The caption takes ~24px; each row with its bar ~40px.
  const capacity = useRows(40, 24);
  const [first] = rows;

  if (isSlim(family) && first) {
    return <WidgetSlim value={`${first.percent}%`} caption={first.label} />;
  }

  const fits = Math.min(rows.length, capacity);
  const hidden = rows.length - fits + more;
  return (
    <div className="mt-auto min-w-0">
      <p className="pb-1 text-[11px] leading-4 text-muted-foreground">
        {plural(total, ...noun)} · last 7 days
      </p>
      <ul>
        {rows.slice(0, fits).map((row) => (
          <WidgetRow
            key={row.key}
            href={REPORT}
            mark={<WidgetDot className={row.fill} />}
            title={<span title={row.label}>{row.label}</span>}
            detail={<WidgetBar value={row.ofMax} max={1} className={row.fill} />}
            value={
              <>
                {count(row.value)} <span className="font-normal text-muted-foreground">{row.percent}%</span>
              </>
            }
          />
        ))}
      </ul>
      {hidden > 0 && (
        <Link href={REPORT} className="pt-0.5 text-[11px] text-muted-foreground hover:text-heading">
          and {count(hidden)} more
        </Link>
      )}
    </div>
  );
}

/** The pages people viewed most in the last seven days. */
export function WebPagesCard() {
  const { report, status } = useWeek();
  const pages = report.data?.breakdowns.pages;
  // Twelve is more than the tallest cell holds; the rest fold into "and N more".
  const top = topRows(pages, 12);
  const percents = wholePercents(top.rows.map((row) => row.value));

  return (
    <WebWidget
      title="Top pages"
      icon={FileText}
      status={status}
      empty={
        report.data && pages === null
          ? unavailable(report.data, 'Your provider doesn’t report pages.')
          : report.data && top.rows.length === 0
            ? { icon: FileText, title: 'No page views in the last 7 days' }
            : undefined
      }
    >
      <RankReading
        total={top.total}
        noun={['page view', 'page views']}
        more={top.more}
        rows={top.rows.map((row, index) => ({
          key: row.key,
          label: row.key || '/',
          value: row.value,
          ofMax: row.ofMax,
          percent: percents[index] ?? 0,
          fill: 'bg-primary',
        }))}
      />
    </WebWidget>
  );
}

const SLOT_FILL = ['bg-muted-foreground/40', 'bg-series-1', 'bg-series-2', 'bg-series-3', 'bg-series-4'];

/** Where the last seven days' visits came from: channels, or referring sites where the provider has no channels. */
export function WebSourcesCard() {
  const { report, status } = useWeek();
  const channels = report.data?.breakdowns.channels;
  const referrers = report.data?.breakdowns.referrers;
  // Umami groups visits into channels; PostHog doesn't, so its referrers stand in — as on the report.
  const slices = channels?.length ? donutSlices(channels, channelLabel, CHANNEL_GROUPS) : donutSlices(referrers ?? [], (key) => key || 'Direct');
  const sorted = [...slices].sort((a, b) => (a.slot === 0 ? 1 : b.slot === 0 ? -1 : b.value - a.value));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const max = Math.max(1, ...slices.map((slice) => slice.value));
  const percents = wholePercents(sorted.map((slice) => slice.value));

  return (
    <WebWidget
      title="Traffic sources"
      icon={Share2}
      status={status}
      empty={
        report.data && channels === null && referrers === null
          ? unavailable(report.data, 'Your provider doesn’t report where visits come from.')
          : report.data && slices.length === 0
            ? { icon: Share2, title: 'No visits in the last 7 days' }
            : undefined
      }
    >
      <RankReading
        total={total}
        noun={['visit', 'visits']}
        more={0}
        rows={sorted.map((slice, index) => ({
          key: slice.key,
          label: slice.label,
          value: slice.value,
          ofMax: slice.value / max,
          percent: percents[index] ?? 0,
          fill: SLOT_FILL[slice.slot] ?? 'bg-series-4',
        }))}
      />
    </WebWidget>
  );
}
