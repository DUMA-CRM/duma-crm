'use client';

import Link from 'next/link';

import { ModuleCard } from '@/components/dashboard/ModuleCards';
import { ArrowRight, Clock3, Users } from '@/components/icons';
import { STATUS_META } from '@/components/orders/orderMeta';
import { MiniBar } from '@/components/shared/MiniBar';
import { Bone } from '@/components/shared/Skeleton';
import { StatusDot } from '@/components/shared/StatusDot';
import type { Tone } from '@/components/shared/tone';

import { cn } from '@/lib/utils/cn';
import type { TradingDay } from '@/lib/utils/trading-day';

/* What is happening on the floor right now: the order lanes, each against
   every active order, and who is on the clock. Live, not today — the figures
   above count the day; this counts the moment. */

function Row({ href, label, value, total, tone }: { href: string; label: string; value: number; total: number; tone: Tone }) {
  return (
    <Link href={href} className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-band/50">
      <StatusDot tone={tone} label={label} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{label}</span>
        <MiniBar value={value} max={Math.max(total, 1)} tone={tone} label={`${value} of ${total} active orders`} className="mt-1.5 h-1" />
      </span>
      <span data-figure className={cn('w-8 text-right text-sm font-semibold', tone === 'exception' && value > 0 ? 'text-exception' : 'text-foreground')}>
        {value}
      </span>
      <ArrowRight
        size={13}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function LivePanel({
  day,
  pendingOrders,
  preparingOrders,
  readyOrders,
  lateCount,
  clockedIn,
  labourOpenShifts,
  loading,
  error = false,
  onRetry = () => undefined,
  showStaff = true,
  kitchenScreen = true,
  showLate = true,
}: {
  day: TradingDay;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  lateCount: number;
  clockedIn: number;
  labourOpenShifts: number;
  loading: boolean;
  /** The live reads failed — say so in place rather than showing zeros. */
  error?: boolean;
  onRetry?: () => void;
  /** The clocked-in row; off when the workspace runs no Workforce module. */
  showStaff?: boolean;
  /** The Kitchen display is on: its rows open it. Without one they open the Orders page. */
  kitchenScreen?: boolean;
  /** The Late row; off when the workspace doesn't flag late orders. */
  showLate?: boolean;
}) {
  const inService = day.state === 'trading';
  // Late orders are a subset of these three, so they share the same whole.
  const activeOrders = pendingOrders + preparingOrders + readyOrders;
  const rows = showLate ? 4 : 3;

  return (
    <ModuleCard
      id="dashboard-live"
      title="Live now"
      actions={
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot tone={inService ? 'success' : 'muted'} pulse={inService} label="" />
          {inService ? 'In service' : 'Quiet'}
        </span>
      }
      loading={loading}
      skeleton={
        <div className="space-y-1" role="status" aria-busy="true" aria-label="Loading live orders">
          {['w-16', 'w-20', 'w-32', 'w-10'].slice(0, rows).map((width) => (
            <div key={width} className="flex items-center gap-3 py-2" aria-hidden="true">
              <Bone className="size-2 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <Bone className={`h-3.5 ${width}`} />
                <Bone className="h-1 w-full rounded-full" />
              </span>
              <Bone className="h-3.5 w-5 shrink-0" />
            </div>
          ))}
        </div>
      }
      error={error}
      onRetry={onRetry}
    >
      <div className="-my-1">
        <Row href="/orders" label="Waiting" value={pendingOrders} total={activeOrders} tone={STATUS_META.pending.tone} />
        <Row
          href={kitchenScreen ? '/kds' : '/orders'}
          label="Preparing"
          value={preparingOrders}
          total={activeOrders}
          tone={STATUS_META.preparing.tone}
        />
        <Row href="/orders" label="Ready to hand over" value={readyOrders} total={activeOrders} tone={STATUS_META.ready.tone} />
        {showLate && <Row href={kitchenScreen ? '/kds' : '/orders'} label="Late" value={lateCount} total={activeOrders} tone="exception" />}

        {/* Who's on comes from Workforce; a workspace without it has no clock to read. */}
        {showStaff && (
          <Link
            href="/staff/shifts"
            className="group -mx-2 mt-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-band/50"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-success/10 text-success" aria-hidden="true">
              <Users size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-foreground">
                <span data-figure className="font-semibold">
                  {clockedIn}
                </span>{' '}
                clocked in
              </span>
              {labourOpenShifts > clockedIn && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 size={11} aria-hidden="true" />
                  {labourOpenShifts} open shifts across your locations
                </span>
              )}
            </span>
            <ArrowRight
              size={13}
              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        )}
      </div>
    </ModuleCard>
  );
}
