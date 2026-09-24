'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { ExceptionStrip, buildExceptions } from '@/components/dashboard/ExceptionStrip';
import { LivePanel } from '@/components/dashboard/LivePanel';
import { OrdersByHour } from '@/components/dashboard/OrdersByHour';
import { TakenTodayPanel } from '@/components/dashboard/TakenTodayPanel';
import { TodayKpiRow } from '@/components/dashboard/TodayKpiRow';
import { TopItemsToday } from '@/components/dashboard/TopItemsToday';
import { AlertTriangle, ArrowRight, LayoutDashboard } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';

import { useTodayDashboard } from '@/lib/hooks/useTodayDashboard';
import type { StaffRole } from '@/lib/modules/identity/client';
import { tradingDayLabel } from '@/lib/utils/trading-day';

/* The manager dashboard: today, live, and nothing else.
 *
 * There is deliberately no date picker here. Reports owns every other period,
 * every comparison and every export; this page owns the current trading day. That
 * boundary is what keeps it from becoming a second, worse Reports page — which is
 * what the previous version had drifted into, complete with a dead `mode="reports"`
 * branch that nothing could reach any more.
 */

export function TodayDashboard({
  role,
  widgetKeys,
  toolbar,
  supplemental,
}: {
  role: StaffRole;
  widgetKeys?: readonly string[];
  toolbar?: ReactNode;
  supplemental?: ReactNode;
}) {
  const dashboard = useTodayDashboard();
  const {
    mounted,
    tradingDay,
    selectedLocation,
    metrics,
    pace,
    target,
    baseline,
    labour,
    hourly,
    topItems,
    yesterdayMetrics,
    loading,
    errors,
    refresh,
  } = dashboard;

  const exceptions = buildExceptions({
    lateOrders: dashboard.lateOrders,
    criticalStock: dashboard.criticalStock,
    urgentRestocks: dashboard.urgentRestocks,
    coverGaps: dashboard.coverGaps,
    attendanceIssues: dashboard.attendanceIssues,
    now: dashboard.now.getTime(),
  });

  const isOwner = role === 'franchise_owner' || role === 'super_admin';
  const shows = (key: string) => !widgetKeys || widgetKeys.includes(key);

  if (errors.core) {
    return (
      <EditorShell title="Today" icon={<LayoutDashboard size={20} aria-hidden="true" />}>
        <div
          className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-rule/65 bg-card text-center"
          role="alert"
        >
          <AlertTriangle size={22} className="text-exception" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Today&rsquo;s figures could not be loaded</p>
            <p className="mt-1 text-xs text-muted-foreground">Check your connection, then try again.</p>
          </div>
          <button onClick={() => void refresh()} className="rounded-sm border border-rule px-3 py-1.5 text-xs font-semibold hover:bg-band">
            Try again
          </button>
        </div>
      </EditorShell>
    );
  }

  return (
    <EditorShell
      title={`Today at ${selectedLocation?.name ?? 'your business'}`}
      icon={<LayoutDashboard size={20} aria-hidden="true" />}
      meta={
        // Rendered only after mount: it reads the clock, and a server-rendered
        // time would hydrate into a different string.
        mounted ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{tradingDayLabel(tradingDay)}</span>
            <span aria-hidden="true">·</span>
            <span data-figure>{tradingDay.time}</span>
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {toolbar}
        {!selectedLocation && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rule/65 bg-card px-4 py-3">
            <p className="text-sm text-foreground">
              <span className="font-semibold">Showing every location you can access.</span> Pick one to see its trading hours, pace and
              target.
            </p>
            {isOwner && (
              <Link
                href="/reports/compare"
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
              No trading hours set for {selectedLocation.name}, so the day&rsquo;s shape is a guess.
            </p>
            <Link
              href="/settings/workspaces"
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Set hours <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        )}

        {shows('analytics.exceptions') && (
          <ExceptionStrip items={exceptions} loading={loading.operations} error={errors.operations} onRetry={() => void refresh()} />
        )}

        {(shows('analytics.trading') || shows('analytics.live')) && (
          <section
            className={
              shows('analytics.trading') && shows('analytics.live')
                ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'
                : 'grid gap-4'
            }
          >
            {shows('analytics.trading') && (
              <TakenTodayPanel
                day={tradingDay}
                takenSoFar={metrics.revenue}
                orderCount={metrics.orders}
                hourly={hourly}
                baseline={baseline}
                pace={pace}
                target={target}
                loading={loading.core}
                yesterdayRevenue={yesterdayMetrics ? yesterdayMetrics.revenue : null}
                locationId={dashboard.activeLocationId}
                dailyTarget={dashboard.dailyTarget}
              />
            )}
            {shows('analytics.live') && (
              <LivePanel
                day={tradingDay}
                pendingOrders={dashboard.pendingOrders}
                preparingOrders={dashboard.preparingOrders}
                readyOrders={dashboard.readyOrders}
                lateCount={dashboard.lateOrders.length}
                clockedIn={dashboard.clockedIn.length}
                labourOpenShifts={labour?.openShifts ?? 0}
                loading={loading.operations}
              />
            )}
          </section>
        )}

        {shows('analytics.kpis') && (
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
          />
        )}

        {(shows('analytics.orders-hourly') || shows('analytics.top-items')) && (
          <section
            className={
              shows('analytics.orders-hourly') && shows('analytics.top-items') ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'grid gap-4'
            }
          >
            {shows('analytics.orders-hourly') && (
              <OrdersByHour day={tradingDay} hourly={hourly} baseline={baseline} loading={loading.hourly} />
            )}
            {shows('analytics.top-items') && <TopItemsToday rows={topItems} loading={loading.topItems} />}
          </section>
        )}
        {supplemental}
      </div>
    </EditorShell>
  );
}
