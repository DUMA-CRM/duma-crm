'use client';

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  getCustomerRetention,
  getDayBaseline,
  getHourlyVolume,
  getLabourAnalytics,
  getOrderAnalytics,
  getTopItems,
} from '@/lib/api/analytics.service';
import { getInventoryForecast } from '@/lib/api/inventory.service';
import { getOrders } from '@/lib/api/orders.service';
import { decodeNotes, getRestockRequests } from '@/lib/api/restock.service';
import { getScheduledShifts } from '@/lib/api/scheduling.service';
import { getActiveShifts } from '@/lib/api/shifts.service';
import { getLocations } from '@/lib/api/workspace.service';
import { findAttendanceIssues, findCoverGaps } from '@/lib/utils/attendance';
import { getDateWindow, orderMetrics } from '@/lib/utils/dashboard';
import { isLate, stageSince } from '@/lib/utils/kitchen-age';
import { computePace, computeTargetProgress } from '@/lib/utils/pace';
import { resolveTradingDay } from '@/lib/utils/trading-day';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Lateness is not defined here. It comes from lib/utils/kitchen-age, the same
// rule that turns a KDS card red — otherwise a ticket can be red on the pass and
// missing from the manager's "needs you" strip at the same moment.

/** The clock only drives a marker and a couple of labels — twice a minute is plenty. */
const CLOCK_TICK_MS = 30_000;

/**
 * Everything the manager dashboard reads, in one place.
 *
 * The page is deliberately today-only and has no date picker: Reports owns every
 * other period. That single constraint is what lets this hook keep a live
 * refresh, a trading-day state machine and a pace baseline all in step.
 */
export function useTodayDashboard() {
  const queryClient = useQueryClient();
  const { locationId } = useWorkspaceStore();

  // The clock must not tick during SSR or the first client render, or the "now"
  // marker hydrates at a different position than it rendered at.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const locationsQuery = useQuery({ queryKey: ['locations-accessible'], queryFn: getLocations });
  const locations = locationsQuery.data ?? [];
  const selectedLocation = locations.find((location) => location.id === locationId) ?? null;
  const activeLocationId = selectedLocation?.id ?? null;
  const scopeKey = activeLocationId ?? 'all';

  // Secondary panels wait for an idle moment so the figures and the exception
  // strip paint first. Same deferral the previous dashboard used.
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setSecondaryEnabled(true), { timeout: 1_200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(() => setSecondaryEnabled(true), 700);
    return () => globalThis.clearTimeout(id);
  }, []);

  // No manual memo: the compiler handles it, and hand-memoizing on `now` made it
  // bail out of optimizing this hook entirely.
  const tradingDay = resolveTradingDay(selectedLocation, now);
  const timeZone = tradingDay.timeZone;

  // Window keys stay coarse (the local date, not the ticking clock) so a tick
  // doesn't invalidate every query. The request itself uses a fresh `to`.
  const dateKey = tradingDay.date;
  const currentParams = () => {
    const window = getDateWindow('today', timeZone);
    return { from: window.from, to: window.to, ...(activeLocationId ? { locationId: activeLocationId } : {}) };
  };

  const ready = locationsQuery.isSuccess;

  const orders = useQuery({
    queryKey: ['today-orders', dateKey, scopeKey, timeZone],
    queryFn: () => getOrderAnalytics(currentParams()),
    enabled: ready,
    refetchInterval: 60_000,
  });

  const baseline = useQuery({
    queryKey: ['today-baseline', tradingDay.weekday, scopeKey, timeZone],
    queryFn: () => getDayBaseline({ weekday: tradingDay.weekday, timezone: timeZone, ...(activeLocationId ? { locationId: activeLocationId } : {}) }),
    enabled: ready,
    // Eight weeks of history doesn't move during a shift.
    staleTime: 30 * 60_000,
  });

  const labour = useQuery({
    queryKey: ['today-labour', dateKey, scopeKey, timeZone],
    queryFn: () => getLabourAnalytics(currentParams()),
    enabled: ready,
    refetchInterval: 60_000,
  });

  const hourly = useQuery({
    queryKey: ['today-hourly', dateKey, scopeKey, timeZone],
    queryFn: () => getHourlyVolume({ ...currentParams(), timezone: timeZone }),
    enabled: ready,
    refetchInterval: 120_000,
  });

  const topItems = useQuery({
    queryKey: ['today-top-items', dateKey, scopeKey, timeZone],
    queryFn: () => getTopItems(currentParams(), 5),
    enabled: ready && secondaryEnabled,
  });

  const retention = useQuery({
    queryKey: ['today-retention', dateKey, scopeKey, timeZone],
    queryFn: () => getCustomerRetention(currentParams()),
    enabled: ready && secondaryEnabled,
  });

  // Only fetched on a day the site is shut, where today's own figures say nothing.
  const yesterday = useQuery({
    queryKey: ['today-yesterday', dateKey, scopeKey, timeZone],
    queryFn: () => {
      const window = getDateWindow('today', timeZone);
      return getOrderAnalytics({
        from: window.previousFrom,
        to: window.from,
        ...(activeLocationId ? { locationId: activeLocationId } : {}),
      });
    },
    enabled: ready && tradingDay.state === 'closed-today',
  });

  const forecast = useQuery({
    queryKey: ['today-forecast', scopeKey],
    queryFn: () => getInventoryForecast(activeLocationId ?? undefined),
    enabled: ready,
  });

  const restocks = useQuery({
    queryKey: ['restock-requests', 'pending', scopeKey, 'today-dashboard'],
    queryFn: () => getRestockRequests({ status: 'pending', ...(activeLocationId ? { locationId: activeLocationId } : {}), limit: 6 }),
    enabled: ready,
  });

  const activeShifts = useQuery({ queryKey: ['shifts-active'], queryFn: getActiveShifts, refetchInterval: 60_000 });

  // Rostered shifts for the rest of today, so a gap in cover is visible before
  // it becomes a problem on the floor.
  const rota = useQuery({
    queryKey: ['today-rota', dateKey, scopeKey],
    queryFn: () => {
      const window = getDateWindow('today', timeZone);
      const end = new Date(new Date(window.from).getTime() + 24 * 60 * 60 * 1000);
      return getScheduledShifts({
        from: window.from,
        to: end.toISOString(),
        ...(activeLocationId ? { locationId: activeLocationId } : {}),
      });
    },
    enabled: ready,
  });

  const liveOrderQueries = useQueries({
    queries: (['pending', 'preparing', 'ready'] as const).map((status) => ({
      queryKey: ['today-live-orders', status, scopeKey],
      // The list comes back newest-first, so a small page drops the OLDEST
      // tickets — precisely the ones that are late. 100 covers any real lane;
      // the headline counts come from `total` regardless of the page size.
      queryFn: () => getOrders({ status, limit: 100, locationId: activeLocationId ?? undefined }),
      enabled: ready,
      refetchInterval: 30_000,
    })),
  });

  const metrics = orderMetrics(orders.data);

  // Every live lane, not just preparing: a ticket sitting unstarted in New or
  // uncollected in Ready goes red on KDS too, and those are just as much the
  // manager's problem as a slow prep.
  const lateOrders = liveOrderQueries
    .flatMap((query) => query.data?.data ?? [])
    .filter((order) => isLate(order, now.getTime()))
    .sort((a, b) => new Date(stageSince(a)).getTime() - new Date(stageSince(b)).getTime());
  const criticalStock = (forecast.data ?? []).filter((item) => item.isCritical);
  const urgentRestocks = (restocks.data?.data ?? []).filter((request) => decodeNotes(request.notes).priority === 'urgent');
  const visibleShifts = (activeShifts.data ?? []).filter((shift) => !activeLocationId || shift.locationId === activeLocationId);

  // A rostered slot that should be covered right now but nobody is clocked in for.
  // Shifts nobody has turned up for. Grace-windowed, so this means "somebody is
  // late" rather than "a shift just started".
  const coverGaps = findCoverGaps({ rota: rota.data ?? [], activeShifts: visibleShifts, now });

  // The mirror of coverGaps: nobody on a shift above, somebody on the clock who
  // should not be here. Both are cover problems and both cost money.
  const attendanceIssues = findAttendanceIssues({
    activeShifts: visibleShifts,
    rota: rota.data ?? [],
    day: tradingDay,
    now,
  });

  const dailyTarget = selectedLocation?.dailyRevenueTarget != null ? Number(selectedLocation.dailyRevenueTarget) : null;

  const pace = computePace({ takenSoFar: metrics.revenue, baseline: baseline.data, nowMinutes: tradingDay.nowMinutes });
  const target = computeTargetProgress({
    target: dailyTarget,
    takenSoFar: metrics.revenue,
    baseline: baseline.data,
    nowMinutes: tradingDay.nowMinutes,
    openMinutes: tradingDay.openMinutes,
    closeMinutes: tradingDay.closeMinutes,
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const family = String(query.queryKey[0]);
        return family.startsWith('today-') || ['restock-requests', 'shifts-active', 'locations-accessible'].includes(family);
      },
    });

  const isRefreshing =
    orders.isFetching || labour.isFetching || forecast.isFetching || restocks.isFetching || activeShifts.isFetching || liveOrderQueries.some((query) => query.isFetching);

  return {
    mounted,
    now,
    tradingDay,
    locations,
    selectedLocation,
    activeLocationId,

    // Figures
    metrics,
    pace,
    target,
    dailyTarget,
    baseline: baseline.data,
    labour: labour.data,
    hourly: hourly.data ?? [],
    topItems: topItems.data ?? [],
    retention: retention.data,
    yesterdayMetrics: tradingDay.state === 'closed-today' ? orderMetrics(yesterday.data) : null,

    // Two different questions: what was paid out today, and how much of today's
    // own takings came back. Both matter, and they are rarely the same number.
    refundsIssuedToday: Number(orders.data?.summary.refundsByRefundDate ?? 0),
    refundsOnTodaysSales: Number(orders.data?.summary.refundsBySaleDate ?? 0),

    // Live operations
    pendingOrders: liveOrderQueries[0]?.data?.total ?? 0,
    preparingOrders: liveOrderQueries[1]?.data?.total ?? 0,
    readyOrders: liveOrderQueries[2]?.data?.total ?? 0,
    lateOrders,
    criticalStock,
    urgentRestocks,
    pendingRestockCount: restocks.data?.total ?? 0,
    clockedIn: visibleShifts,
    coverGaps,
    attendanceIssues,

    // Status
    loading: {
      core: locationsQuery.isPending || orders.isPending,
      baseline: baseline.isPending,
      labour: labour.isPending,
      hourly: hourly.isPending,
      topItems: topItems.isPending,
      operations: forecast.isPending || restocks.isPending || liveOrderQueries.some((query) => query.isPending),
    },
    errors: {
      core: locationsQuery.isError || orders.isError,
      baseline: baseline.isError,
      labour: labour.isError,
      hourly: hourly.isError,
      topItems: topItems.isError,
      operations: forecast.isError || restocks.isError || activeShifts.isError || liveOrderQueries.some((query) => query.isError),
    },
    isRefreshing,
    refresh,
  };
}

export type TodayDashboard = ReturnType<typeof useTodayDashboard>;
