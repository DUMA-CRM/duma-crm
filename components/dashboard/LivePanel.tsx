'use client';

import Link from 'next/link';

import { ArrowRight, Clock3, Users } from '@/components/icons';
import { STATUS_META } from '@/components/orders/orderMeta';
import { MiniBar } from '@/components/shared/MiniBar';
import { Bone } from '@/components/shared/Skeleton';
import { StatusDot } from '@/components/shared/StatusDot';
import type { Tone } from '@/components/shared/tone';

import { cn } from '@/lib/utils/cn';
import type { TradingDay } from '@/lib/utils/trading-day';

/* The context workbench beside the board: what is happening on the floor right
   now. Band-tinted so it reads as attached to the board rather than as another
   floating card, per the material ladder. */

function Row({ href, label, value, total, tone }: { href: string; label: string; value: number; total: number; tone: Tone }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-md bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-background">
      <StatusDot tone={tone} label={label} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{label}</span>
        <MiniBar value={value} max={Math.max(total, 1)} tone={tone} label={`${value} of ${total} active orders`} className="mt-1.5 h-1" />
      </span>
      <span data-figure className={cn('text-sm font-semibold', tone === 'exception' && value > 0 ? 'text-exception' : 'text-foreground')}>
        {value}
      </span>
      <ArrowRight size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
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
}: {
  day: TradingDay;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  lateCount: number;
  clockedIn: number;
  labourOpenShifts: number;
  loading: boolean;
}) {
  const inService = day.state === 'trading';
  // Late orders are a subset of these three, so they share the same whole.
  const activeOrders = pendingOrders + preparingOrders + readyOrders;

  return (
    <aside className="rounded-lg border border-rule/65 bg-band/45 p-4 sm:p-5" aria-label="Live now">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-title text-foreground">Live now</h2>
        <StatusDot tone={inService ? 'success' : 'muted'} pulse={inService} label={inService ? 'In service' : 'Quiet'} />
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" role="status" aria-busy="true" aria-label="Loading live orders">
          {['w-16', 'w-20', 'w-32', 'w-10'].map((width) => (
            <div key={width} className="flex items-center gap-3 rounded-md bg-card px-3 py-2.5 shadow-sm" aria-hidden="true">
              <Bone className="size-2 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <Bone className={`h-3.5 ${width}`} />
                <Bone className="h-1 w-full rounded-full" />
              </span>
              <Bone className="h-3.5 w-5 shrink-0" />
              <span className="w-[13px] shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <Row href="/orders" label="Waiting" value={pendingOrders} total={activeOrders} tone={STATUS_META.pending.tone} />
          <Row href="/kds" label="Preparing" value={preparingOrders} total={activeOrders} tone={STATUS_META.preparing.tone} />
          <Row href="/orders" label="Ready to hand over" value={readyOrders} total={activeOrders} tone={STATUS_META.ready.tone} />
          <Row href="/kds" label="Late" value={lateCount} total={activeOrders} tone="exception" />
        </div>
      )}

      <div className="mt-4 border-t border-rule/50 pt-4">
        <Link href="/staff/shifts" className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-card/70">
          <Users size={15} className="shrink-0 text-momentum" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-sm text-foreground">
            <span data-figure className="font-semibold">
              {clockedIn}
            </span>{' '}
            clocked in
          </span>
          <ArrowRight size={13} className="text-muted-foreground" aria-hidden="true" />
        </Link>
        {labourOpenShifts > clockedIn && (
          <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Clock3 size={12} aria-hidden="true" />
            {labourOpenShifts} open shifts across all your locations
          </p>
        )}
      </div>
    </aside>
  );
}
