'use client';

import Link from 'next/link';
import { type ReactNode, createContext, useContext } from 'react';

import { ExceptionStrip, buildExceptions } from '@/components/dashboard/ExceptionStrip';
import { LivePanel } from '@/components/dashboard/LivePanel';
import { OrdersByHour } from '@/components/dashboard/OrdersByHour';
import { TakenTodayPanel } from '@/components/dashboard/TakenTodayPanel';
import { TodayKpiRow } from '@/components/dashboard/TodayKpiRow';
import { TopItemsToday } from '@/components/dashboard/TopItemsToday';
import { AlertTriangle, ArrowRight } from '@/components/icons';

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
export function TodayBanners({ canCompare }: { canCompare: boolean }) {
  const { selectedLocation, tradingDay } = useToday();
  return (
    <>
      {!selectedLocation && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rule/65 bg-card px-4 py-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Showing every location you can access.</span> Pick one to see its trading hours, pace and target.
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
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-measured/40 bg-card px-4 py-3">
          <AlertTriangle size={15} className="shrink-0 text-measured" aria-hidden="true" />
          <p className="text-sm text-foreground">
            No trading hours set for {selectedLocation.name}, so the day&rsquo;s shape is a guess. Set them — or mark it open 24/7 if it never
            closes.
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

/** Today's figures failed as a whole: one notice in place of the trading panels, with a retry. */
function TodayError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-rule/65 bg-card text-center" role="alert">
      <AlertTriangle size={22} className="text-exception" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-foreground">Today&rsquo;s figures could not be loaded</p>
        <p className="mt-1 text-xs text-muted-foreground">Check your connection, then try again.</p>
      </div>
      <button onClick={onRetry} className="rounded-sm border border-rule px-3 py-1.5 text-xs font-semibold hover:bg-band">
        Try again
      </button>
    </div>
  );
}

/**
 * One trading panel by its widget key. When today's core figures fail, the
 * first panel says so and the rest stand down, rather than six copies of it.
 */
export function TodayWidget({ widgetKey, first }: { widgetKey: string; first: boolean }) {
  const dashboard = useToday();
  const kitchenScreen = useModuleEnabled('kds');
  const { tradingDay, metrics, pace, target, baseline, labour, hourly, topItems, yesterdayMetrics, loading, errors, refresh } = dashboard;

  if (errors.core) return first ? <TodayError onRetry={() => void refresh()} /> : null;

  switch (widgetKey) {
    case 'analytics.exceptions':
      return (
        <ExceptionStrip
          items={buildExceptions({
            lateOrders: dashboard.lateOrders,
            criticalStock: dashboard.criticalStock,
            urgentRestocks: dashboard.urgentRestocks,
            coverGaps: dashboard.coverGaps,
            attendanceIssues: dashboard.attendanceIssues,
            now: dashboard.now.getTime(),
            lateness: dashboard.lateness,
            kitchenScreen,
          })}
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
          locationId={dashboard.activeLocationId}
          dailyTarget={dashboard.dailyTarget}
        />
      );
    case 'analytics.live':
      return (
        <LivePanel
          day={tradingDay}
          pendingOrders={dashboard.pendingOrders}
          preparingOrders={dashboard.preparingOrders}
          readyOrders={dashboard.readyOrders}
          lateCount={dashboard.lateOrders.length}
          clockedIn={dashboard.clockedIn.length}
          labourOpenShifts={labour?.openShifts ?? 0}
          loading={loading.operations}
          showStaff={dashboard.workforce}
          kitchenScreen={kitchenScreen}
          showLate={dashboard.lateness !== null}
        />
      );
    case 'analytics.kpis':
      return (
        <TodayKpiRow
          day={tradingDay}
          orders={metrics.orders}
          averageOrderValue={metrics.averageOrderValue}
          revenue={metrics.revenue}
          refundsIssuedToday={Number(dashboard.refundsIssuedToday)}
          refundsOnTodaysSales={Number(dashboard.refundsOnTodaysSales)}
          labour={labour}
          baseline={baseline}
          loading={loading.core}
          labourLoading={loading.labour}
          labourError={errors.labour}
          showLabour={dashboard.workforce}
        />
      );
    case 'analytics.orders-hourly':
      return <OrdersByHour day={tradingDay} hourly={hourly} baseline={baseline} loading={loading.hourly} />;
    case 'analytics.top-items':
      return <TopItemsToday rows={topItems} loading={loading.topItems} />;
    default:
      return null;
  }
}
