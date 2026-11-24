'use client';

import Link from 'next/link';

import { Widget, WidgetCaption, WidgetDot, WidgetFigure, WidgetRow, useFamily } from '@/components/dashboard/widget/Widget';
import { Activity, Users } from '@/components/icons';
import { STATUS_META } from '@/components/orders/orderMeta';
import { Bone } from '@/components/shared/Skeleton';
import { StatusDot } from '@/components/shared/StatusDot';
import { Tooltip } from '@/components/shared/Tooltip';
import { TONE_FILL } from '@/components/shared/tone';

import { cn } from '@/lib/utils/cn';
import { type TradingDay, tradingDayLabel } from '@/lib/utils/trading-day';

/* What is happening on the floor right now — live, not today. The count of
   orders in service leads, split across the lanes in one bar; the longest any
   order has been waiting says how far behind service is running. Medium names
   each lane as a row into its screen, and who is on the clock. */

/** "12m" / "1h 05m" — how long the oldest active order has been in. */
function waited(fromIso: string | null, now: number) {
  if (!fromIso) return null;
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export function LivePanel({
  day,
  now,
  pendingOrders,
  preparingOrders,
  readyOrders,
  lateCount,
  oldestActiveAt,
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
  now: Date;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  lateCount: number;
  /** When the longest-waiting active order came in; null with nothing in service. */
  oldestActiveAt: string | null;
  clockedIn: number;
  labourOpenShifts: number;
  loading: boolean;
  /** The live reads failed — say so in place rather than showing zeros. */
  error?: boolean;
  onRetry?: () => void;
  /** The clocked-in count; off when the workspace runs no Workforce module. */
  showStaff?: boolean;
  /** The Kitchen display is on: its lanes open it. Without one they open the Orders page. */
  kitchenScreen?: boolean;
  /** The late count; off when the workspace doesn't flag late orders. */
  showLate?: boolean;
}) {
  const family = useFamily();
  const inService = day.state === 'trading';
  // Late orders are a subset of these three, so they share the same whole.
  const active = pendingOrders + preparingOrders + readyOrders;
  const kitchen = kitchenScreen ? '/kds' : '/orders';
  const oldest = waited(oldestActiveAt, now.getTime());
  // Shut with nothing left in service: no lanes of zeros, just that it's quiet and when it opens.
  const calm = active === 0 && (day.state === 'before-open' || day.state === 'after-close' || day.state === 'closed-today');
  const lanes = [
    { key: 'pending', label: 'Waiting', value: pendingOrders, href: '/orders', fill: TONE_FILL[STATUS_META.pending.tone] },
    { key: 'preparing', label: 'Preparing', value: preparingOrders, href: kitchen, fill: TONE_FILL[STATUS_META.preparing.tone] },
    { key: 'ready', label: 'Ready', value: readyOrders, href: '/orders', fill: TONE_FILL[STATUS_META.ready.tone] },
  ];

  // The lanes as one bar, each its share of what's in service; an empty floor is an empty trough.
  const laneBar = (
    <div
      className="flex h-2 gap-[2px] rounded-full bg-band"
      role="img"
      aria-label={lanes.map((lane) => `${lane.value} ${lane.label.toLowerCase()}`).join(', ')}
    >
      {active > 0 &&
        lanes.map((lane) =>
          lane.value > 0 ? (
            // Each lane says what it is on hover; the hit area reaches past the 8px bar so it can be found.
            <Tooltip
              key={lane.key}
              side="top"
              label={`${lane.label} · ${lane.value} ${lane.value === 1 ? 'order' : 'orders'}`}
              className={cn(
                'relative h-full first:rounded-l-full last:rounded-r-full before:absolute before:inset-x-0 before:-inset-y-2 before:content-[""]',
                lane.fill,
              )}
              style={{ width: `${(lane.value / active) * 100}%` }}
            >
              {null}
            </Tooltip>
          ) : null,
        )}
    </div>
  );

  const caption =
    showLate && lateCount > 0 ? (
      <>
        <span className="font-semibold text-exception">{lateCount} late</span>
        {oldest && (
          <>
            {' · oldest '}
            <span className="font-semibold text-heading tabular-nums">{oldest}</span>
          </>
        )}
      </>
    ) : active === 0 ? (
      inService ? (
        'Nothing in the queue'
      ) : (
        'No orders in service'
      )
    ) : oldest ? (
      <>
        oldest in <span className="font-semibold text-heading tabular-nums">{oldest}</span>
      </>
    ) : (
      'in service'
    );

  const unit = active === 1 ? 'order' : 'orders';
  // The figure with its word on one line, the way the module widgets read.
  const figure = (size: 'bar' | 'small' | 'medium') => (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <WidgetFigure value={active} size={size} className="shrink-0" />
      <span className="truncate text-[13px] text-muted-foreground">{unit}</span>
    </span>
  );
  const staffLine = showStaff && (
    <Link href="/staff/rota" className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground hover:text-heading">
      <Users size={12} className="shrink-0 text-success" aria-hidden="true" />
      <span className="truncate">
        <span className="font-semibold text-heading tabular-nums">{clockedIn}</span> clocked in
        {labourOpenShifts > clockedIn && ` · ${labourOpenShifts - clockedIn} still to come`}
      </span>
    </Link>
  );

  return (
    <Widget
      title="Live"
      icon={Activity}
      tint="kitchen"
      surface="plain"
      href={kitchen}
      hrefLabel={kitchenScreen ? 'Open the kitchen display' : 'Open orders'}
      accessory={
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <StatusDot tone={inService ? 'success' : 'muted'} pulse={inService} label="" />
          {inService ? 'In service' : 'Quiet'}
        </span>
      }
      loading={loading}
      skeleton={
        <div className="mt-auto space-y-2" role="status" aria-busy="true" aria-label="Loading live orders">
          <Bone className="h-8 w-20 rounded-md" />
          <Bone className="h-3 w-28 rounded-md" />
          <Bone className="h-2 w-full rounded-full" />
        </div>
      }
      error={error}
      onRetry={onRetry}
    >
      {calm ? (
        <div className={cn('mt-auto flex min-w-0', family === 'bar' ? 'items-baseline gap-2.5' : 'flex-col gap-1')}>
          <p className="shrink-0 text-[17px] leading-6 font-semibold text-heading">
            {day.state === 'before-open' ? 'Getting ready' : 'All quiet'}
          </p>
          <WidgetCaption className="truncate">{tradingDayLabel(day)}</WidgetCaption>
          {/* Someone still on the clock after close is worth seeing. */}
          {family !== 'bar' && clockedIn > 0 && <span className="mt-2">{staffLine}</span>}
        </div>
      ) : family === 'bar' ? (
        // Half a square: figure and word on one line, the caption under the bar — stacked, they meet the header.
        <div className="mt-auto flex min-w-0 items-end gap-3">
          <div className="min-w-0 flex-1">{figure('bar')}</div>
          <div className="w-[44%] shrink-0">
            {laneBar}
            <p className="mt-1.5 truncate text-[11px] leading-4 text-muted-foreground">{caption}</p>
          </div>
        </div>
      ) : family === 'small' ? (
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3">
          <div className="min-w-0">
            {figure('small')}
            <WidgetCaption className="mt-1">{caption}</WidgetCaption>
          </div>
          {laneBar}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
            <div className="min-w-0">
              {figure('medium')}
              <WidgetCaption className="mt-1">{caption}</WidgetCaption>
            </div>
            {staffLine}
          </div>
          <div className="flex w-[52%] min-w-0 shrink-0 flex-col justify-end gap-2">
            {laneBar}
            <ul className="min-w-0">
              {lanes.map((lane) => (
                <WidgetRow
                  key={lane.key}
                  href={lane.href}
                  mark={<WidgetDot className={lane.fill} />}
                  title={lane.label}
                  value={lane.value}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </Widget>
  );
}
