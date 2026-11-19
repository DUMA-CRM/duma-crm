'use client';

import Link from 'next/link';
import { type ReactNode, createContext, useContext } from 'react';

import { ExceptionStrip, buildExceptions } from '@/components/dashboard/ExceptionStrip';
import { LivePanel } from '@/components/dashboard/LivePanel';
import { OrdersByHour } from '@/components/dashboard/OrdersByHour';
import { TakenTodayPanel } from '@/components/dashboard/TakenTodayPanel';
import { TodayFigure, isTodayFigure } from '@/components/dashboard/TodayFigure';
import { TopItemsToday } from '@/components/dashboard/TopItemsToday';
import { Widget, isSlim, useFamily } from '@/components/dashboard/widget/Widget';
import { AlertTriangle, ArrowRight, LineChart } from '@/components/icons';
import { Bone } from '@/components/shared/Skeleton';
import { Sticker } from '@/components/shared/Sticker';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import { widgetDefinition } from '@/lib/dashboard/widget-registry';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { type TodayDashboard, useTodayDashboard } from '@/lib/hooks/useTodayDashboard';
import { type StickerId } from '@/lib/stickers';
import { type DayMood, dayMood, daySummary, dayWins } from '@/lib/utils/day-story';
import { MIN_BASELINE_SAMPLES } from '@/lib/utils/pace';
import { weekdayName } from '@/lib/utils/today-figures';
import { cn } from '@/lib/utils/cn';
import { tradingDayLabel } from '@/lib/utils/trading-day';
import { useAuthStore } from '@/stores/authStore';

/* The trading panels (Analytics' widgets) share one read of today: the same
 * trading day, the same pace, the same live orders. The provider mounts that
 * read only when the resolved layout holds at least one of them, so a
 * workspace without Analytics never asks for figures it would be refused.
 *
 * There is deliberately no date picker. Reports owns every other period; the
 * dashboard owns the current trading day.
 */

const TodayContext = createContext<TodayDashboard | null>(null);

export function TodayProvider({ children }: { children: ReactNode }) {
  const dashboard = useTodayDashboard();
  return <TodayContext.Provider value={dashboard}>{children}</TodayContext.Provider>;
}

function useToday(): TodayDashboard {
  const dashboard = useContext(TodayContext);
  if (!dashboard) throw new Error('A trading panel was rendered outside TodayProvider');
  return dashboard;
}

/** The header's "Thursday · 14:05" — read from the shop's trading day, after mount (it reads the clock). */
export function TodayMeta({ chartShowsNow }: { chartShowsNow: boolean }) {
  const { mounted, tradingDay } = useToday();
  if (!mounted) return null;
  // While trading, the chart's "now" marker already carries the time.
  const showTime = !(chartShowsNow && tradingDay.state === 'trading');
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{tradingDayLabel(tradingDay)}</span>
      {showTime && (
        <>
          <span aria-hidden="true">·</span>
          <span data-figure>{tradingDay.time}</span>
        </>
      )}
    </span>
  );
}

/** Notes that change how the figures read: no site picked, or a site with no trading hours. */
export function TodayBanners() {
  const { locations, selectedLocation, tradingDay } = useToday();
  // Sales by location is the report for this, and it only means something with more than one site.
  const canCompare = locations.length > 1;
  return (
    <>
      {!selectedLocation && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Every location you can access.</span> Pick one to see its hours, pace and target.
          </p>
          {canCompare && (
            <Link
              href="/reports/sales-by-location"
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Compare locations <ArrowRight size={13} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
      {tradingDay.state === 'no-hours' && selectedLocation && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <AlertTriangle size={15} className="shrink-0 text-measured" aria-hidden="true" />
          <p className="text-sm text-foreground">
            No trading hours for {selectedLocation.name}, so the day&rsquo;s shape is a guess.
          </p>
          <Link
            href="/settings/workspaces"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
          >
            Set hours <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      )}
    </>
  );
}

/** The cat for each mood of the day: hello before open, at the laptop through service, studying a slow day, cheering a win, asleep when shut. A win after close says thanks instead. */
const MOOD_STICKER: Record<DayMood, StickerId> = {
  ready: 'welcome',
  steady: 'working',
  curious: 'analytics',
  proud: 'celebration',
  sleepy: 'sleeping',
};

/**
 * Your day, as a widget: hello, how today is going in one sentence, and the
 * day's small wins, with the DUMA cat to match. It reads the same
 * figures as the widgets around it and claims nothing they don't hold. A strip
 * across the board says it in a line; a medium card has room for the wins.
 */
export function TodayGreeting() {
  const dashboard = useToday();
  const money = useFormatMoney();
  const family = useFamily();
  const name = useAuthStore((state) => state.user?.name ?? null);
  const { mounted, tradingDay: day, metrics, pace, baseline, target, topItems, yesterdayMetrics, history } = dashboard;
  const strip = isSlim(family);
  const card = cn(
    'flex h-full min-h-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm',
    strip ? 'items-center gap-3.5 px-4 py-2' : 'flex-col p-4',
  );

  if (!mounted || dashboard.loading.core) {
    return (
      <section className={card} role="status" aria-busy="true" aria-label="Loading your day">
        <Bone className={cn('shrink-0 rounded-full', strip ? 'size-12' : 'size-20')} />
        <div className={cn('min-w-0 flex-1 space-y-2', !strip && 'mt-auto')}>
          <Bone className="h-5 w-48 rounded-md" />
          <Bone className="h-3.5 w-64 max-w-full rounded-md" />
        </div>
      </section>
    );
  }
  if (dashboard.errors.core) return <Widget title="Your day" icon={LineChart} error onRetry={() => void dashboard.refresh()} />;

  const weekday = weekdayName(day.weekday);
  const typicalDay =
    (baseline?.sampleCount ?? 0) >= MIN_BASELINE_SAMPLES && baseline!.dailyMedianRevenue > 0 ? baseline!.dailyMedianRevenue : null;
  const paceDelta = pace.available ? pace.delta : null;
  const wins = dayWins({ today: day.date, state: day.state, takenToday: metrics.revenue, history, target: target?.target ?? null, weekday });
  const { greeting, line } = daySummary({
    firstName: name?.split(' ')[0] ?? null,
    state: day.state,
    nowMinutes: day.nowMinutes,
    weekday,
    opensAt: day.hours?.open ?? null,
    takenToday: metrics.revenue,
    orders: metrics.orders,
    paceDelta,
    typicalDay,
    target: target?.target ?? null,
    topItem: topItems[0]?.name ?? null,
    yesterday: yesterdayMetrics?.revenue || null,
    money,
  });
  const mood = dayMood({
    state: day.state,
    takenToday: metrics.revenue,
    target: target?.target ?? null,
    paceDelta,
    typicalByNow: pace.available ? pace.expectedByNow : null,
    wins,
  });
  // A strip has room for the strongest win only.
  const shown = strip ? wins.slice(0, 1) : wins;

  return (
    <section aria-label="Your day" className={card}>
      <Sticker name={mood === 'proud' && day.state === 'after-close' ? 'thanks' : MOOD_STICKER[mood]} size={strip ? 64 : 88} className={strip ? '-my-2' : '-mt-1 -ml-1'} />
      <div className={cn('min-w-0 flex-1', !strip && 'mt-3')}>
        <h2 className={cn('truncate font-semibold tracking-[-0.015em] text-heading', strip ? 'text-[17px] leading-6' : 'text-xl leading-7')}>
          {greeting}
        </h2>
        <p className={cn('text-muted-foreground', strip ? 'truncate text-[13px] leading-[18px]' : 'mt-1 line-clamp-3 text-sm leading-5')}>
          {line}
        </p>
      </div>
      {shown.length > 0 && (
        <ul className={cn('flex gap-2', strip ? 'shrink-0' : 'mt-auto flex-wrap pt-3')} aria-label="Today’s wins">
          {shown.map((win) => (
            <li
              key={win.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-band px-3 py-1 text-[12px] font-medium whitespace-nowrap text-heading"
            >
              <span aria-hidden="true">{win.emoji}</span>
              {win.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** What needs someone right now, from today's operations read. */
const needsYouItems = (dashboard: TodayDashboard, kitchenScreen: boolean) =>
  buildExceptions({
    lateOrders: dashboard.lateOrders,
    criticalStock: dashboard.criticalStock,
    urgentRestocks: dashboard.urgentRestocks,
    coverGaps: dashboard.coverGaps,
    attendanceIssues: dashboard.attendanceIssues,
    now: dashboard.now.getTime(),
    lateness: dashboard.lateness,
    kitchenScreen,
  });

/**
 * Needs you as the board draws it: a full-width strip above the widgets, never
 * a cell, there only while something needs someone (or the checks failed). In
 * edit mode it is always drawn, as the preview you remove it from.
 */
export function NeedsYouStrip({ preview = false }: { preview?: boolean }) {
  const dashboard = useToday();
  const kitchenScreen = useModuleEnabled('kds');
  return (
    <ExceptionStrip
      preview={preview}
      items={needsYouItems(dashboard, kitchenScreen)}
      loading={dashboard.loading.operations}
      error={dashboard.errors.operations}
      onRetry={() => void dashboard.refresh()}
    />
  );
}

/**
 * One trading panel by its widget key. Each holds its own cell on the grid, so
 * when today's core figures fail every panel that reads them says so in place,
 * with a retry — a blank cell would read as a hole in the board.
 */
export function TodayWidget({
  widgetKey,
  netSalesOnBoard = false,
}: {
  widgetKey: string;
  /** The net sales tile is on the board, so the takings panel needn't repeat it. */
  netSalesOnBoard?: boolean;
}) {
  const dashboard = useToday();
  const kitchenScreen = useModuleEnabled('kds');
  const { tradingDay, metrics, pace, target, baseline, labour, hourly, topItems, yesterdayMetrics, loading, errors, refresh } = dashboard;

  if (isTodayFigure(widgetKey)) return <TodayFigure figure={widgetKey} dashboard={dashboard} />;

  // The needs-attention strip and the live panel read today's operations, not the core figures.
  if (errors.core && widgetKey !== 'analytics.exceptions' && widgetKey !== 'analytics.live') {
    const title = widgetDefinition(widgetKey)?.label ?? 'Today';
    return <Widget title={title} icon={LineChart} tint="orders" error onRetry={() => void refresh()} />;
  }

  switch (widgetKey) {
    case 'analytics.greeting':
      return <TodayGreeting />;
    case 'analytics.exceptions':
      return (
        <ExceptionStrip
          fill
          items={needsYouItems(dashboard, kitchenScreen)}
          loading={loading.operations}
          error={errors.operations}
          onRetry={() => void refresh()}
        />
      );
    case 'analytics.trading':
      return (
        <TakenTodayPanel
          day={tradingDay}
          takenSoFar={metrics.revenue}
          hourly={hourly}
          baseline={baseline}
          pace={pace}
          target={target}
          loading={loading.core}
          yesterdayRevenue={yesterdayMetrics ? yesterdayMetrics.revenue : null}
          lastWeekRevenue={dashboard.lastWeekMetrics ? dashboard.lastWeekMetrics.revenue : null}
          showHeadline={!netSalesOnBoard}
          locationId={dashboard.activeLocationId}
          dailyTarget={dashboard.dailyTarget}
        />
      );
    case 'analytics.live':
      return (
        <LivePanel
          day={tradingDay}
          now={dashboard.now}
          oldestActiveAt={dashboard.oldestActiveAt}
          pendingOrders={dashboard.pendingOrders}
          preparingOrders={dashboard.preparingOrders}
          readyOrders={dashboard.readyOrders}
          lateCount={dashboard.lateOrders.length}
          clockedIn={dashboard.clockedIn.length}
          labourOpenShifts={labour?.openShifts ?? 0}
          loading={loading.operations}
          error={errors.operations}
          onRetry={() => void refresh()}
          showStaff={dashboard.workforce}
          kitchenScreen={kitchenScreen}
          showLate={dashboard.lateness !== null}
        />
      );
    case 'analytics.orders-hourly':
      return (
        <OrdersByHour
          day={tradingDay}
          hourly={hourly}
          baseline={baseline}
          loading={loading.hourly}
          error={errors.hourly}
          onRetry={() => void refresh()}
        />
      );
    case 'analytics.top-items':
      return <TopItemsToday rows={topItems} loading={loading.topItems} error={errors.topItems} onRetry={() => void refresh()} />;
    default:
      return null;
  }
}
