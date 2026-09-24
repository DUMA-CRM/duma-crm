'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Gauge,
  Receipt,
  Store,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from '@/components/icons';
import { fmtDate, fmtMoney } from '@/components/people/shared';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { StatCard, StatCardGrid, comparisonDelta } from '@/components/shared/StatCard';

import { type StaffPerfWindowKey, getStaffPerformance } from '@/lib/modules/identity/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { divide, fmtMins, fmtPct, hasSlowTail, otherOrders, otherSources, performanceMetrics } from '@/lib/utils/staff-performance';

/* One person's attributed sales and throughput.
 *
 * This lived on the employee record until 2026-09-10. It is trading analysis,
 * not HR: Reports owns every other comparison in the product, and an HR record
 * is a poor place to keep 400 lines of order-pace arithmetic. It stays gated on
 * `staff:read` rather than the `analytics:read` the rest of Reports uses,
 * because that is what the API enforces on `GET /staff/:userId/performance` —
 * a Reports-standard gate here would show the link to roles the API refuses.
 */

// ── Performance (sales & throughput, per time window) ─────────────────────────

const PERF_WINDOWS: { value: StaffPerfWindowKey; label: string }[] = [
  { value: 'last7Days', label: '7 days' },
  { value: 'last30Days', label: '30 days' },
  { value: 'allTime', label: 'All time' },
];

const BASELINE_DELTA = { label: 'vs baseline' } as const;

function BreakdownBar({ rows }: { rows: { label: string; value: number; total: number; colour: string }[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const share = divide(row.value, row.total) * 100;
        return (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold tabular-nums">
                {row.value} <span className="text-xs font-normal text-muted-foreground">· {fmtPct(share)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full', row.colour)} style={{ width: `${Math.min(100, share)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Insight({ tone, children }: { tone: 'good' | 'watch' | 'neutral'; children: React.ReactNode }) {
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'watch' ? AlertTriangle : Target;
  return (
    <div className="flex gap-2.5 rounded-sm border border-rule bg-background p-3">
      <Icon
        size={15}
        className={cn('mt-0.5 shrink-0', tone === 'good' ? 'text-success' : tone === 'watch' ? 'text-warning' : 'text-primary')}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function StaffPerformancePanel({ userId }: { userId: string }) {
  const [win, setWin] = useState<StaffPerfWindowKey>('last30Days');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: moduleQueryKeys.analytics.key('staff-performance', userId),
    queryFn: () => getStaffPerformance(userId),
  });
  const w = data?.windows[win];

  if (isLoading) {
    return (
      <div className="bg-card border border-rule rounded-sm p-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-sm border border-rule bg-background animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !w || !data) {
    return (
      <div className="rounded-sm border border-rule bg-card">
        <ErrorState
          icon={TrendingUp}
          title="Performance stats couldn’t be loaded"
          description="Nothing was read, so this is not a record with no activity on it."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const metrics = performanceMetrics(w);
  const baselineKey: StaffPerfWindowKey = win === 'last7Days' ? 'last30Days' : 'allTime';
  const displayedBaseline = performanceMetrics(data.windows[baselineKey]);
  const comparisonWindow = win === 'allTime' ? data.windows.last30Days : w;
  const comparisonBase = win === 'allTime' ? w : data.windows[baselineKey];
  const compared = performanceMetrics(comparisonWindow);
  const comparison = performanceMetrics(comparisonBase);
  const comparisonLabel =
    win === 'last7Days'
      ? '7-day pace vs 30-day baseline'
      : win === 'last30Days'
        ? '30-day pace vs career baseline'
        : 'Recent 30-day pace vs career baseline';
  const other = otherOrders(w);
  const otherSource = otherSources(w);
  const comparisonPrepAvailable = comparisonWindow.prepTime.measuredOrders > 0 && comparisonBase.prepTime.measuredOrders > 0;
  const dateRange =
    w.firstOrderAt && w.lastOrderAt
      ? `${fmtDate(w.firstOrderAt)} – ${fmtDate(w.lastOrderAt)}`
      : `${metrics.spanDays} calendar ${metrics.spanDays === 1 ? 'day' : 'days'}`;
  const slowTail = hasSlowTail(w);
  const cancellationImproved = compared.cancellationRate < comparison.cancellationRate;
  const paceImproved = compared.ordersPerCalendarDay > comparison.ordersPerCalendarDay;

  return (
    <div className="space-y-4">
      <section className="bg-card border border-rule rounded-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-4 border-b border-rule flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Gauge size={17} className="text-primary" aria-hidden="true" />
              <h2 className="font-semibold">Operational performance</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dateRange} · {w.totalOrders} orders · {w.activeDays} active {w.activeDays === 1 ? 'day' : 'days'}
            </p>
          </div>
          <SegmentedControl options={PERF_WINDOWS} value={win} onChange={setWin} />
        </div>

        {w.totalOrders === 0 ? (
          <div className="p-10 text-center">
            <Receipt size={22} className="mx-auto mb-2 text-muted-foreground/40" aria-hidden="true" />
            <p className="font-medium">No orders in this window</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a wider period to see historical performance.</p>
          </div>
        ) : (
          <div className="p-4 md:p-5 space-y-5">
            <StatCardGrid columns={3}>
              <StatCard
                size="sm"
                icon={Receipt}
                accent="primary"
                label="Orders"
                value={w.totalOrders}
                hint={`${metrics.ordersPerCalendarDay.toFixed(1)} per calendar day`}
                delta={
                  win === 'allTime'
                    ? undefined
                    : comparisonDelta(metrics.ordersPerCalendarDay, displayedBaseline.ordersPerCalendarDay, BASELINE_DELTA)
                }
              />
              <StatCard
                size="sm"
                icon={CircleDollarSign}
                accent="success"
                label="Revenue"
                value={fmtMoney(w.totalRevenue)}
                hint={`${fmtMoney(metrics.revenuePerActiveDay)} per active day`}
                delta={
                  win === 'allTime'
                    ? undefined
                    : comparisonDelta(metrics.revenuePerCalendarDay, displayedBaseline.revenuePerCalendarDay, BASELINE_DELTA)
                }
              />
              <StatCard
                size="sm"
                icon={Store}
                accent="info"
                label="Average order"
                value={fmtMoney(w.avgOrderValue)}
                hint="Revenue excluding cancelled orders"
                delta={
                  win === 'allTime'
                    ? undefined
                    : comparisonDelta(metrics.revenuePerOrder, displayedBaseline.revenuePerOrder, BASELINE_DELTA)
                }
              />
              <StatCard
                size="sm"
                icon={Zap}
                accent="warning"
                label="Order velocity"
                value={w.avgOrdersPerActiveDay.toFixed(1)}
                hint="Orders per active day"
                delta={
                  win === 'allTime'
                    ? undefined
                    : comparisonDelta(metrics.ordersPerActiveDay, displayedBaseline.ordersPerActiveDay, BASELINE_DELTA)
                }
              />
              <StatCard
                size="sm"
                icon={CheckCircle2}
                accent="success"
                label="Completion"
                value={fmtPct(metrics.completionRate)}
                hint={`${w.completedOrders} completed`}
                delta={
                  win === 'allTime' ? undefined : comparisonDelta(metrics.completionRate, displayedBaseline.completionRate, BASELINE_DELTA)
                }
              />
              <StatCard
                size="sm"
                icon={Timer}
                accent="purple"
                label="Median prep"
                value={fmtMins(w.prepTime.measuredOrders, w.prepTime.medianMinutes)}
                hint={`${w.prepTime.measuredOrders} measured orders`}
                delta={
                  win === 'allTime' || !w.prepTime.measuredOrders || !data.windows[baselineKey].prepTime.measuredOrders
                    ? undefined
                    : comparisonDelta(w.prepTime.medianMinutes, data.windows[baselineKey].prepTime.medianMinutes, {
                        ...BASELINE_DELTA,
                        lowerIsBetter: true,
                      })
                }
              />
            </StatCardGrid>
          </div>
        )}
      </section>

      {w.totalOrders > 0 && (
        <>
          <section className="bg-card border border-rule rounded-sm p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Comparison</p>
                <p className="text-xs text-muted-foreground mt-1">{comparisonLabel}; volume is normalized per calendar day.</p>
              </div>
              <Activity size={18} className="text-primary" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {(
                [
                  {
                    label: 'Order pace',
                    value: compared.ordersPerCalendarDay,
                    baseline: comparison.ordersPerCalendarDay,
                    format: (value: number) => value.toFixed(1),
                    lowerIsBetter: false,
                  },
                  {
                    label: 'Revenue pace',
                    value: compared.revenuePerCalendarDay,
                    baseline: comparison.revenuePerCalendarDay,
                    format: fmtMoney,
                    lowerIsBetter: false,
                  },
                  {
                    label: 'Avg order',
                    value: compared.revenuePerOrder,
                    baseline: comparison.revenuePerOrder,
                    format: fmtMoney,
                    lowerIsBetter: false,
                  },
                  {
                    label: 'Cancellation',
                    value: compared.cancellationRate,
                    baseline: comparison.cancellationRate,
                    format: fmtPct,
                    lowerIsBetter: true,
                  },
                  {
                    label: 'Median prep',
                    value: comparisonPrepAvailable ? comparisonWindow.prepTime.medianMinutes : 0,
                    baseline: comparisonPrepAvailable ? comparisonBase.prepTime.medianMinutes : 0,
                    format: (value: number) => (comparisonPrepAvailable ? fmtMins(1, value) : '—'),
                    lowerIsBetter: true,
                  },
                ] as const
              ).map(({ label, value, baseline, format, lowerIsBetter }) => (
                <StatCard
                  key={label}
                  size="sm"
                  label={label}
                  value={format(value)}
                  caption={`Baseline ${format(baseline)}`}
                  delta={comparisonDelta(value, baseline, { label: '', lowerIsBetter })}
                />
              ))}
            </div>
          </section>

          <div className="grid xl:grid-cols-2 gap-4 items-start">
            <section className="bg-card border border-rule rounded-sm p-4 md:p-5">
              <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Order outcomes</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Completion quality and exceptions in the selected window.</p>
              <BreakdownBar
                rows={[
                  { label: 'Completed', value: w.completedOrders, total: w.totalOrders, colour: 'bg-success' },
                  { label: 'Cancelled', value: w.cancelledOrders, total: w.totalOrders, colour: 'bg-destructive' },
                  { label: 'Other / open', value: other, total: w.totalOrders, colour: 'bg-warning' },
                ]}
              />
            </section>

            <section className="bg-card border border-rule rounded-sm p-4 md:p-5">
              <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Sales channels</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Where attributed orders originated.</p>
              <BreakdownBar
                rows={[
                  // Order data, so these are the data roles in reading order —
                  // not the action colour and a raw Tailwind violet.
                  { label: 'POS', value: w.bySource.pos, total: w.totalOrders, colour: 'bg-measured' },
                  { label: 'Mobile', value: w.bySource.mobile, total: w.totalOrders, colour: 'bg-reference' },
                  { label: 'Other', value: otherSource, total: w.totalOrders, colour: 'bg-muted-foreground' },
                ]}
              />
            </section>
          </div>

          <div className="grid xl:grid-cols-2 gap-4 items-start">
            <section className="bg-card border border-rule rounded-sm p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Timer size={16} className="text-primary" />
                <div>
                  <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Fulfilment</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending-to-ready timing on completed orders with status history.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <DetailRow icon={Timer} label="Average" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.avgMinutes)} />
                <DetailRow icon={Clock} label="Median" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.medianMinutes)} />
                <DetailRow icon={ArrowDownRight} label="Fastest" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.minMinutes)} />
                <DetailRow icon={ArrowUpRight} label="Slowest" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.maxMinutes)} />
                <DetailRow icon={Target} label="Measured" value={`${w.prepTime.measuredOrders} orders`} />
                <DetailRow icon={Gauge} label="Coverage" value={fmtPct(Math.min(100, metrics.prepCoverage))} />
              </div>
              {w.prepTime.measuredOrders === 0 && (
                <p className="mt-4 rounded-sm border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                  No orders reached “ready” with measurable history, so prep-time statistics are unavailable.
                </p>
              )}
            </section>

            <section className="bg-card border border-rule rounded-sm p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays size={16} className="text-primary" />
                <div>
                  <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Activity & value</p>
                  <p className="text-xs text-muted-foreground mt-1">Work cadence and commercial contribution.</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <DetailRow icon={CalendarDays} label="Active days" value={`${w.activeDays} of ${metrics.spanDays}`} />
                <DetailRow icon={Activity} label="Activity coverage" value={fmtPct(metrics.activityCoverage)} />
                <DetailRow icon={Receipt} label="Orders / active day" value={metrics.ordersPerActiveDay.toFixed(1)} />
                <DetailRow icon={Receipt} label="Orders / calendar day" value={metrics.ordersPerCalendarDay.toFixed(1)} />
                <DetailRow icon={CircleDollarSign} label="Revenue / active day" value={fmtMoney(metrics.revenuePerActiveDay)} />
                <DetailRow icon={CircleDollarSign} label="Revenue / calendar day" value={fmtMoney(metrics.revenuePerCalendarDay)} />
                <DetailRow icon={Store} label="First order" value={w.firstOrderAt ? fmtDate(w.firstOrderAt) : '—'} />
                <DetailRow icon={Store} label="Last order" value={w.lastOrderAt ? fmtDate(w.lastOrderAt) : '—'} />
              </div>
            </section>
          </div>

          <section className="bg-card border border-rule rounded-sm p-4 md:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={16} className="text-primary" />
              <div>
                <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Insights</p>
                <p className="text-xs text-muted-foreground mt-1">Signals to investigate with the employee and operational context.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Insight tone={paceImproved ? 'good' : 'neutral'}>
                Order pace is <strong className="text-foreground">{paceImproved ? 'above' : 'below'} the comparison baseline</strong> at{' '}
                {compared.ordersPerCalendarDay.toFixed(1)} versus {comparison.ordersPerCalendarDay.toFixed(1)} orders per calendar day.
              </Insight>
              <Insight tone={cancellationImproved ? 'good' : compared.cancellationRate > comparison.cancellationRate ? 'watch' : 'neutral'}>
                Cancellation rate is <strong className="text-foreground">{fmtPct(compared.cancellationRate)}</strong>, compared with{' '}
                {fmtPct(comparison.cancellationRate)} in the baseline.
              </Insight>
              <Insight tone={slowTail ? 'watch' : 'good'}>
                {slowTail
                  ? 'Average prep is materially slower than the median, suggesting a tail of delayed orders worth reviewing.'
                  : 'Average and median prep are close, indicating relatively consistent measured fulfilment times.'}
              </Insight>
              <Insight tone={metrics.prepCoverage < 70 ? 'watch' : 'neutral'}>
                Prep timing covers <strong className="text-foreground">{fmtPct(Math.min(100, metrics.prepCoverage))}</strong> of completed
                orders.{' '}
                {metrics.prepCoverage < 70
                  ? 'Treat timing conclusions cautiously until coverage improves.'
                  : 'Coverage is sufficient for a useful operational signal.'}
              </Insight>
            </div>
            <p className="mt-4 text-label leading-relaxed text-muted-foreground">
              These are attributed operational metrics, not a standalone employee score. Review shift mix, staffing, location demand,
              equipment issues, refunds and customer context before making performance decisions.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule pb-2.5 last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon size={13} aria-hidden="true" />
        {label}
      </span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
