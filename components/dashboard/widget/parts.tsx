'use client';

import type { ReactNode } from 'react';


import { cn } from '@/lib/utils/cn';

import type { WidgetTint } from './Widget';

/* The pictures a widget draws, after the ones Apple's own widgets carry: the
 * Fitness ring, the Batteries gauge, the Stocks sparkline, the Weather
 * details grid. Each says one thing at a glance and is drawn only from real
 * figures. */

export const TINT_STROKE: Record<WidgetTint, string> = {
  brand: 'stroke-primary',
  orders: 'stroke-measured',
  kitchen: 'stroke-reference',
  stock: 'stroke-stock',
  team: 'stroke-success',
  money: 'stroke-primary',
  exception: 'stroke-exception',
};

/** A progress ring, the Fitness and Batteries gauge: a track, an arc for the share, a reading in the middle. */
export function WidgetRing({
  value,
  tint,
  size = 56,
  thickness = 7,
  label,
  children,
}: {
  /** 0–1; drawn capped at a full turn. */
  value: number;
  tint: WidgetTint;
  size?: number;
  thickness?: number;
  label: string;
  children?: ReactNode;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const share = Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className={cn(TINT_STROKE[tint], 'opacity-15')}
        />
        {share > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${circumference * share} ${circumference}`}
            className={TINT_STROKE[tint]}
          />
        )}
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center text-center">{children}</span>}
    </span>
  );
}

/**
 * A day as a curve on its real hours, the Stocks sparkline: today's running
 * line up to now with a soft area, a typical day dashed across the whole day,
 * a target as a rule. Nothing is drawn where there is no figure.
 */
export function WidgetCurve({
  today,
  typical = [],
  target = null,
  slots,
  tint,
  label,
  axis,
}: {
  today: number[];
  typical?: number[];
  target?: number | null;
  /** How many points the whole day has, so today's line ends where now is. */
  slots: number;
  tint: WidgetTint;
  label: string;
  /** First, middle and last hour labels under the curve. */
  axis?: string[];
}) {
  const count = Math.max(slots, 2);
  const max = Math.max(1, ...today, ...typical, target ?? 0) * 1.08;
  const x = (index: number) => (index / (count - 1)) * 100;
  const y = (value: number) => 100 - (value / max) * 100;
  const path = (values: number[]) => values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(value)}`).join(' ');
  const last = today.length - 1;
  const fill: Record<WidgetTint, string> = {
    brand: 'fill-primary/12',
    orders: 'fill-measured/12',
    kitchen: 'fill-reference/12',
    stock: 'fill-stock/14',
    team: 'fill-success/12',
    money: 'fill-primary/12',
    exception: 'fill-exception/12',
  };
  const dot: Record<WidgetTint, string> = {
    brand: 'bg-primary',
    orders: 'bg-measured',
    kitchen: 'bg-reference',
    stock: 'bg-stock',
    team: 'bg-success',
    money: 'bg-primary',
    exception: 'bg-exception',
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          role="img"
          aria-label={label}
        >
          {target !== null && target > 0 && (
            <line
              x1="0"
              x2="100"
              y1={y(target)}
              y2={y(target)}
              className="stroke-primary"
              strokeWidth="1.25"
              strokeDasharray="1 3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {typical.length > 1 && (
            <path
              d={path(typical)}
              fill="none"
              className="stroke-reference"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {today.length > 1 && (
            <>
              <path d={`${path(today)} L ${x(last)} 100 L 0 100 Z`} className={fill[tint]} />
              <path
                d={path(today)}
                fill="none"
                className={TINT_STROKE[tint]}
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
        {today.length > 0 && (
          <span
            className={cn('absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm', dot[tint])}
            style={{ left: `${x(last)}%`, top: `${y(today[last]!)}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      {axis && axis.length > 0 && (
        <div
          className="mt-1.5 flex justify-between text-[11px] leading-none font-medium text-muted-foreground tabular-nums"
          aria-hidden="true"
        >
          {axis.map((tick, index) => (
            <span key={`${tick}-${index}`}>{tick}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Labelled figures in a grid, the Weather details panel: a quiet label over each value. */
export function WidgetFacts({
  facts,
  columns = 2,
  tray = true,
  className,
}: {
  facts: Array<{ label: string; value: ReactNode; tone?: 'warning' | 'exception' | 'success' } | null | false>;
  columns?: 2 | 3 | 4;
  /** On a lighter inner panel, the way Apple's widgets group their details. */
  tray?: boolean;
  className?: string;
}) {
  const shown = facts.filter((fact): fact is { label: string; value: ReactNode; tone?: 'warning' | 'exception' | 'success' } => !!fact);
  if (shown.length === 0) return null;
  return (
    <dl
      className={cn(
        'grid gap-x-3 gap-y-2',
        columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-3' : 'grid-cols-4',
        tray && 'rounded-md bg-card/80 px-3 py-2.5 shadow-[0_0_0_0.5px_rgb(0_0_0/0.05)] dark:bg-card/55',
        className,
      )}
    >
      {shown.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="truncate text-[11px] leading-4 text-muted-foreground">{fact.label}</dt>
          <dd
            className={cn(
              'truncate text-[15px] leading-5 font-semibold tabular-nums',
              fact.tone === 'exception'
                ? 'text-exception'
                : fact.tone === 'warning'
                  ? 'text-measured'
                  : fact.tone === 'success'
                    ? 'text-momentum'
                    : 'text-heading',
            )}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Two horizontal bars, today against a typical day — the Screen Time comparison. */
export function WidgetCompare({
  today,
  typical,
  tint,
  todayLabel,
  typicalLabel,
}: {
  today: number;
  typical: number | null;
  tint: WidgetTint;
  todayLabel: ReactNode;
  typicalLabel: ReactNode;
}) {
  const max = Math.max(today, typical ?? 0, 1);
  const fill: Record<WidgetTint, string> = {
    brand: 'bg-primary',
    orders: 'bg-measured',
    kitchen: 'bg-reference',
    stock: 'bg-stock',
    team: 'bg-success',
    money: 'bg-primary',
    exception: 'bg-exception',
  };
  return (
    <div className="space-y-1.5">
      <div>
        <div className="flex justify-between text-[11px] leading-4 text-muted-foreground">
          <span>Today</span>
          <span className="font-semibold text-heading tabular-nums">{todayLabel}</span>
        </div>
        <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-band">
          <span className={cn('block h-full rounded-full', fill[tint])} style={{ width: `${(today / max) * 100}%` }} />
        </span>
      </div>
      {typical !== null && (
        <div>
          <div className="flex justify-between text-[11px] leading-4 text-muted-foreground">
            <span>Typical</span>
            <span className="font-semibold text-heading tabular-nums">{typicalLabel}</span>
          </div>
          <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-band">
            <span className="block h-full rounded-full bg-reference/60" style={{ width: `${(typical / max) * 100}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}
