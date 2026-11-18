'use client';

import Link from 'next/link';
import { type ReactNode, createContext, useContext } from 'react';

import { ExceptionStrip, buildExceptions } from '@/components/dashboard/ExceptionStrip';
import { LivePanel } from '@/components/dashboard/LivePanel';
import { OrdersByHour } from '@/components/dashboard/OrdersByHour';
import { TakenTodayPanel } from '@/components/dashboard/TakenTodayPanel';
import { TodayFigure, isTodayFigure } from '@/components/dashboard/TodayFigure';
import { TopItemsToday } from '@/components/dashboard/TopItemsToday';
import { Widget } from '@/components/dashboard/widget/Widget';
import { AlertTriangle, ArrowRight, LineChart } from '@/components/icons';

import { widgetDefinition } from '@/lib/dashboard/widget-registry';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { type TodayDashboard, useTodayDashboard } from '@/lib/hooks/useTodayDashboard';
import { tradingDayLabel } from '@/lib/utils/trading-day';

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
