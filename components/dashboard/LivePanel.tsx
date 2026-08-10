'use client';

import Link from 'next/link';

import { ArrowRight, Clock3, Users } from '@/components/icons';

import { cn } from '@/lib/utils/cn';
import type { TradingDay } from '@/lib/utils/trading-day';

/* The context workbench beside the board: what is happening on the floor right
   now. Band-tinted so it reads as attached to the board rather than as another
   floating card, per the material ladder. */

function Row({ href, label, value, tone }: { href: string; label: string; value: number; tone?: 'exception' }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-background"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span data-figure className={cn('text-sm font-semibold', tone === 'exception' && value > 0 ? 'text-exception' : 'text-foreground')}>
          {value}
        </span>
        <ArrowRight size={13} className="text-muted-foreground" aria-hidden="true" />
      </span>
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

  return (
    <aside className="rounded-lg border border-rule/65 bg-band/45 p-4 sm:p-5" aria-label="Live now">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-title text-foreground">Live now</h2>
        <span className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground">
          {inService && (
            <span className="relative flex size-1.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-momentum opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-momentum" />
            </span>
          )}
          {inService ? 'In service' : 'Quiet'}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-md bg-card" />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <Row href="/orders" label="Waiting" value={pendingOrders} />
          <Row href="/kds" label="Preparing" value={preparingOrders} />
          <Row href="/orders" label="Ready to hand over" value={readyOrders} />
          <Row href="/kds" label="Late" value={lateCount} tone="exception" />
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
