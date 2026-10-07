'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  ArrowDown,
  ArrowUp,
  Banknote,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CreditCard,
  Gift,
  type IconComponent,
  Search,
  Tag,
  Wallet,
} from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { EmptyState, type EmptyStateKind } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone, FactsSkeleton, LoadingState } from '@/components/shared/Skeleton';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils/cn';
import { axisLabelIndexes, monotonePath, nearestIndex, niceTicks } from '@/lib/utils/report-chart';
import { type Delta, delta, formatDelta, share } from '@/lib/utils/report-filters';

/* The parts every report is built from, in the app's settings style:
   KPI tiles with their change, a trend chart, a bar list, a sortable table,
   and the four states. One set, so every report reads the same way. */

// ── KPI tiles ────────────────────────────────────────────────────────────────

export interface Kpi {
  label: string;
  icon: IconComponent;
  value: string;
  /** The raw numbers, for the change pill. */
  current?: number;
  previous?: number | null;
  /** Lower is better (refunds, labour %, waste) — flips the pill's colour. */
  inverse?: boolean;
  hint?: string;
}

export function KpiGrid({ kpis, loading = false }: { kpis: Kpi[]; loading?: boolean }) {
  return (
    <motion.dl
      variants={SECTION_RISE}
      aria-busy={loading || undefined}
      className={cn('grid gap-3 sm:grid-cols-2', kpis.length >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}
    >
      {kpis.map((kpi) => (
        <KpiTile key={kpi.label} kpi={kpi} loading={loading} />
      ))}
    </motion.dl>
  );
}

function KpiTile({ kpi, loading }: { kpi: Kpi; loading: boolean }) {
  const Icon = kpi.icon;
  const change = kpi.current !== undefined ? delta(kpi.current, kpi.previous) : null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-rule/60 bg-field px-3.5 py-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-label uppercase text-muted-foreground">{kpi.label}</dt>
        <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {loading ? (
            <Bone className="my-0.5 h-6 w-20 rounded-sm" />
          ) : (
            <span className="text-xl font-semibold tabular-nums tracking-headline text-foreground">{kpi.value}</span>
          )}
          {!loading && <ChangePill change={change} inverse={kpi.inverse} />}
        </dd>
        {kpi.hint && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{kpi.hint}</dd>}
      </div>
    </div>
  );
}

/** "+12%" in momentum green (or exception red when lower is better), with a glyph so colour is never alone. */
export function ChangePill({ change, inverse = false }: { change: Delta | null; inverse?: boolean }) {
  const text = formatDelta(change);
  if (!text || !change) return null;
  const up = change.change > 0;
  const flat = change.change === 0 || text === 'No change';
  const good = flat ? null : inverse ? !up : up;
  const Glyph = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-micro font-semibold tabular-nums',
        good === null ? 'bg-band text-muted-foreground' : good ? 'bg-momentum/10 text-momentum' : 'bg-exception/8 text-exception',
      )}
      title="Change against the comparison period"
    >
      {!flat && <Glyph size={10} aria-hidden="true" />}
      {text}
    </span>
  );
}

// ── Panels ───────────────────────────────────────────────────────────────────

/** A titled block of a report: heading row on the page, content in a porcelain panel. */
export function ReportBlock({
  title,
  description,
  actions,
  children,
  flush = false,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Content runs to the panel's edge (tables). */
  flush?: boolean;
  className?: string;
}) {
  return (
    <motion.section variants={SECTION_RISE} className={cn('min-w-0', className)}>
      <div className="mb-2 flex min-h-8 flex-wrap items-end gap-x-3 gap-y-1 px-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className={cn('overflow-hidden rounded-lg border border-rule/60 bg-field', !flush && 'p-4')}>{children}</div>
    </motion.section>
  );
}

// ── Trend chart ──────────────────────────────────────────────────────────────

export interface TrendPoint {
  /** Full label for the tooltip ("Sat 4 Oct"). */
  label: string;
  /** Short label for the axis ("4 Oct"); defaults to `label`. */
  axis?: string;
  value: number;
}

const TOP = 12;
const RIGHT = 8;
const BOTTOM = 26;
/** Room an axis label wants, in pixels: wide enough that labels never touch. */
const LABEL_SPACE = 76;

/** The element's content width, tracked — so the chart draws at its real size and its text never scales. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The trend every report draws: the current period as a smooth line over a
 * soft wash (or as columns, when there are only a few buckets), the comparison
 * as a faded dashed ghost — Shopify's convention — on round-number gridlines.
 *
 * Drawn at its measured pixel width rather than a scaled viewBox, so labels
 * stay 11px at any size. Scrub it with a pointer, a finger or the arrow keys:
 * a guide and a card follow, with the value, the comparison and the change.
 * Points align by position — day 1 against day 1 — which is what "against the
 * previous period" means. Screen readers get the figures as a table.
 */
export function TrendChart({
  points,
  previous,
  format,
  axisFormat,
  height = 260,
  ariaLabel,
  seriesLabel = 'This period',
  previousLabel = 'Comparison',
  variant = 'line',
  target,
}: {
  points: TrendPoint[];
  previous?: number[] | null;
  format: (value: number) => string;
  /** Short form for the y-axis ("£1.2K"); defaults to `format`. */
  axisFormat?: (value: number) => string;
  height?: number;
  ariaLabel: string;
  seriesLabel?: string;
  previousLabel?: string;
  variant?: 'line' | 'bars';
  /** A target per point (null where there's none) — drawn as a dashed step, met or missed in the card. */
  target?: (number | null)[] | null;
}) {
  // React ids carry characters a url(#…) reference chokes on.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  const count = points.length;
  const bars = variant === 'bars';
  const comparison = previous?.length ? points.map((_, index) => previous[index] ?? null) : null;
  const goals = target?.some((value) => value !== null && value > 0) ? points.map((_, index) => target[index] ?? null) : null;
  const ticks = niceTicks(
    Math.max(
      0,
      ...points.map((point) => point.value),
      ...(comparison ?? []).map((value) => value ?? 0),
      ...(goals ?? []).map((value) => value ?? 0),
    ),
  );
  const top = ticks[ticks.length - 1] || 1;
  const yLabel = axisFormat ?? format;
  const left = Math.max(28, ...ticks.map((tick) => yLabel(tick).length * 6.4)) + 12;
  const innerW = Math.max(0, width - left - RIGHT);
  const innerH = height - TOP - BOTTOM;
  const slot = count ? innerW / count : innerW;
  const x = (index: number) => left + (bars || count <= 1 ? slot * (index + 0.5) : (index / (count - 1)) * innerW);
  const y = (value: number) => TOP + (1 - Math.max(0, value) / top) * innerH;
  const baseline = TOP + innerH;

  const line = monotonePath(points.map((point, index) => ({ x: x(index), y: y(point.value) })));
  const area = count > 1 ? `${line}L${x(count - 1)},${baseline}L${x(0)},${baseline}Z` : '';
  const ghost = comparison
    ? monotonePath(comparison.flatMap((value, index) => (value === null ? [] : [{ x: x(index), y: y(value) }])))
    : '';
  const labels = axisLabelIndexes(count, innerW / LABEL_SPACE);
  // Redraw when the data changes, not on every hover.
  const signature = `${count}:${points.reduce((sum, point) => sum + point.value, 0)}`;

  const current = active === null ? null : points[active];
  const currentPrevious = active === null || !comparison ? null : comparison[active];
  const currentGoal = active === null || !goals ? null : goals[active];
  const pick = (clientX: number, target: Element) => {
    const box = target.getBoundingClientRect();
    setActive(nearestIndex(clientX - box.left - left, count, innerW, bars));
  };

  if (count === 0) return <p className="py-12 text-center text-sm text-muted-foreground">Nothing to chart in this period.</p>;

  const barW = Math.max(2, Math.min(36, slot * (comparison ? 0.36 : 0.6)));

  return (
    <div
      ref={ref}
      className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ height }}
      tabIndex={0}
      aria-label={`${ariaLabel}. Use the arrow keys to read each point.`}
      onFocus={() => setActive((index) => index ?? count - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={(event) => {
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 }[event.key];
        if (step) setActive((index) => Math.min(count - 1, Math.max(0, (index ?? count - 1) + step)));
        else if (event.key === 'Home') setActive(0);
        else if (event.key === 'End') setActive(count - 1);
        else if (event.key === 'Escape') setActive(null);
        else return;
        event.preventDefault();
      }}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block touch-pan-y select-none"
          aria-hidden="true"
          onPointerMove={(event) => pick(event.clientX, event.currentTarget)}
          onPointerDown={(event) => pick(event.clientX, event.currentTarget)}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setActive(null);
          }}
        >
          <defs>
            <linearGradient id={`wash-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="[stop-color:var(--color-primary)]" stopOpacity={0.2} />
              <stop offset="100%" className="[stop-color:var(--color-primary)]" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Gridlines and the y-axis, on round numbers. */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - RIGHT}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? 'stroke-grid-major' : 'stroke-grid-minor'}
                strokeDasharray={tick === 0 ? undefined : '2 4'}
              />
              <text x={left - 10} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {yLabel(tick)}
              </text>
            </g>
          ))}

          {/* The target: a dashed step across each point's slot, since a week's target is seven days'. */}
          {goals?.map((goal, index) => {
            if (goal === null) return null;
            const half = bars || count <= 1 ? slot / 2 : count > 1 ? innerW / (count - 1) / 2 : innerW / 2;
            return (
              <line
                key={`goal-${index}`}
                x1={Math.max(left, x(index) - half)}
                x2={Math.min(width - RIGHT, x(index) + half)}
                y1={y(goal)}
                y2={y(goal)}
                className="stroke-warning"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            );
          })}

          {/* The column under the pointer. */}
          {active !== null && (
            <rect
              x={bars || count <= 1 ? x(active) - slot / 2 : x(active) - Math.min(slot, 24) / 2}
              y={TOP}
              width={bars || count <= 1 ? slot : Math.min(slot, 24)}
              height={innerH}
              className={bars ? 'fill-band/70' : 'fill-transparent'}
            />
          )}

          {bars ? (
            points.map((point, index) => {
              const ghostValue = comparison?.[index];
              const dim = active !== null && active !== index;
              return (
                <g key={`bar-${index}`} className="transition-opacity" opacity={dim ? 0.55 : 1}>
                  {ghostValue !== null && ghostValue !== undefined && (
                    <rect
                      x={x(index) - barW - 1}
                      y={y(ghostValue)}
                      width={barW}
                      height={Math.max(0, baseline - y(ghostValue))}
                      rx={2}
                      className="fill-muted-foreground/20"
                    />
                  )}
                  <motion.rect
                    key={signature}
                    x={comparison ? x(index) + 1 : x(index) - barW / 2}
                    width={barW}
                    rx={2}
                    className="fill-primary"
                    initial={reduceMotion ? false : { y: baseline, height: 0 }}
                    animate={{ y: y(point.value), height: Math.max(point.value > 0 ? 1 : 0, baseline - y(point.value)) }}
                    transition={{ duration: 0.45, delay: Math.min(index * 0.02, 0.3), ease: [0.22, 1, 0.36, 1] }}
                  />
                </g>
              );
            })
          ) : (
            <>
              {ghost && (
                <path
                  d={ghost}
                  fill="none"
                  className="stroke-muted-foreground/45"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              )}
              {area && (
                <motion.path
                  key={`area-${signature}`}
                  d={area}
                  fill={`url(#wash-${uid})`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                />
              )}
              {count > 1 ? (
                <motion.path
                  key={`line-${signature}`}
                  d={line}
                  fill="none"
                  className="stroke-primary"
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : (
                <circle cx={x(0)} cy={y(points[0].value)} r={4} className="fill-primary" />
              )}
              {active === null && count > 1 && (
                <g>
                  <circle cx={x(count - 1)} cy={y(points[count - 1].value)} r={7} className="fill-primary/15" />
                  <circle
                    cx={x(count - 1)}
                    cy={y(points[count - 1].value)}
                    r={3.5}
                    className="fill-primary stroke-field"
                    strokeWidth={1.5}
                  />
                </g>
              )}
              {active !== null && current && (
                <g pointerEvents="none">
                  <line x1={x(active)} x2={x(active)} y1={TOP} y2={baseline} className="stroke-foreground/20" />
                  {currentPrevious !== null && (
                    <circle
                      cx={x(active)}
                      cy={y(currentPrevious)}
                      r={3.5}
                      className="fill-field stroke-muted-foreground/60"
                      strokeWidth={1.5}
                    />
                  )}
                  <circle cx={x(active)} cy={y(current.value)} r={8} className="fill-primary/15" />
                  <circle cx={x(active)} cy={y(current.value)} r={4.5} className="fill-primary stroke-field" strokeWidth={2} />
                </g>
              )}
            </>
          )}

          {/* The x-axis: a few labels, spread out, first and last always. */}
          {labels.map((index) => (
            <text
              key={`axis-${index}`}
              x={x(index)}
              y={height - 7}
              textAnchor={!bars && count > 1 && index === 0 ? 'start' : !bars && count > 1 && index === count - 1 ? 'end' : 'middle'}
              className={cn('text-[11px] tabular-nums', index === active ? 'fill-foreground font-semibold' : 'fill-muted-foreground')}
            >
              {points[index].axis ?? points[index].label}
            </text>
          ))}
        </svg>
      )}

      {current && active !== null && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max min-w-44 rounded-lg border border-rule/60 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-sm"
          style={{
            left: x(active),
            transform: `translateX(${x(active) > width / 2 ? 'calc(-100% - 14px)' : '14px'})`,
          }}
        >
          <p className="text-xs font-semibold text-foreground">{current.label}</p>
          <dl className="mt-1.5 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-5">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn('bg-primary', bars ? 'size-2 rounded-xs' : 'h-0.5 w-3 rounded-full')} aria-hidden="true" />
                {seriesLabel}
              </dt>
              <dd className="font-semibold tabular-nums text-foreground">{format(current.value)}</dd>
            </div>
            {currentPrevious !== null && (
              <div className="flex items-center justify-between gap-5">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  {bars ? (
                    <span className="size-2 rounded-xs bg-muted-foreground/30" aria-hidden="true" />
                  ) : (
                    <span className="h-0 w-3 border-t-2 border-dashed border-muted-foreground/50" aria-hidden="true" />
                  )}
                  {previousLabel}
                </dt>
                <dd className="tabular-nums text-muted-foreground">{format(currentPrevious)}</dd>
              </div>
            )}
            {currentGoal !== null && (
              <div className="flex items-center justify-between gap-5">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-0 w-3 border-t-2 border-dashed border-warning" aria-hidden="true" />
                  Target
                </dt>
                <dd className={cn('tabular-nums', current.value >= currentGoal ? 'font-semibold text-momentum' : 'text-muted-foreground')}>
                  {format(currentGoal)} · {currentGoal > 0 ? Math.round((current.value / currentGoal) * 100) : 0}%
                </dd>
              </div>
            )}
          </dl>
          {currentPrevious !== null && (
            <div className="mt-2 flex justify-end border-t border-rule/50 pt-2">
              <ChangePill change={delta(current.value, currentPrevious)} />
            </div>
          )}
        </div>
      )}

      {/* What the arrow keys land on, read out; and the whole series as a table. */}
      <p className="sr-only" aria-live="polite">
        {current
          ? `${current.label}: ${format(current.value)}${currentPrevious !== null ? `, ${previousLabel.toLowerCase()} ${format(currentPrevious)}` : ''}`
          : ''}
      </p>
      {/* A caption clips with its wrapper, not with the table — so the wrapper is what hides it. */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">{seriesLabel}</th>
              {comparison && <th scope="col">{previousLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={`row-${index}`}>
                <th scope="row">{point.label}</th>
                <td>{format(point.value)}</td>
                {comparison && <td>{comparison[index] === null ? '—' : format(comparison[index] ?? 0)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The chart's key, for a card header. */
export function TrendLegend({
  comparison,
  seriesLabel = 'This period',
  previousLabel = 'Comparison',
  variant = 'line',
  target = false,
}: {
  comparison: boolean;
  seriesLabel?: string;
  previousLabel?: string;
  variant?: 'line' | 'bars';
  target?: boolean;
}) {
  const bars = variant === 'bars';
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
      <span className="flex items-center gap-1.5">
        <span className={cn('bg-primary', bars ? 'size-2.5 rounded-xs' : 'h-0.5 w-4 rounded-full')} />
        {seriesLabel}
      </span>
      {comparison && (
        <span className="flex items-center gap-1.5">
          {bars ? (
            <span className="size-2.5 rounded-xs bg-muted-foreground/25" />
          ) : (
            <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground/45" />
          )}
          {previousLabel}
        </span>
      )}
      {target && (
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-warning" />
          Target
        </span>
      )}
    </p>
  );
}

// ── Column chart (hours, weekdays) ───────────────────────────────────────────

export function ColumnChart({
  columns,
  format,
  ariaLabel,
  highlight,
}: {
  columns: { label: string; value: number; detail?: string }[];
  format: (value: number) => string;
  ariaLabel: string;
  /** Index to draw in full primary (the peak). */
  highlight?: number;
}) {
  const max = Math.max(1, ...columns.map((column) => column.value));
  return (
    <div className="flex h-52 items-end gap-1" role="img" aria-label={ariaLabel}>
      {columns.map((column, index) => (
        <div
          key={column.label}
          className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          title={`${column.label} · ${format(column.value)}${column.detail ? ` · ${column.detail}` : ''}`}
        >
          <div
            className={cn(
              'w-full rounded-t-sm transition-colors',
              index === highlight ? 'bg-primary' : 'bg-primary/35 group-hover:bg-primary/60',
            )}
            style={{ height: `${Math.max(column.value > 0 ? 2 : 0, (column.value / max) * 100)}%` }}
          />
          <span className="text-[10px] tabular-nums text-muted-foreground">{column.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Bar list ─────────────────────────────────────────────────────────────────

/** Ranked rows with a share bar — channels, methods, categories. */
export function BarList({
  rows,
  format,
}: {
  rows: { key: string; label: string; value: number; detail?: string; previous?: number | null; icon?: IconComponent }[];
  format: (value: number) => string;
}) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Nothing in this period.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const part = share(Math.max(0, row.value), total);
        const Icon = row.icon;
        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                {Icon && <Icon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className="truncate">{row.label}</span>
                {row.detail && <span className="truncate text-xs font-normal text-muted-foreground">{row.detail}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                <ChangePill change={delta(row.value, row.previous)} />
                <span className="font-semibold text-foreground">{format(row.value)}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">{Math.round(part * 100)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-band">
              <div className="h-full rounded-full bg-primary" style={{ width: `${part * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Tenders ──────────────────────────────────────────────────────────────────

const TENDER: Record<string, { label: string; icon: IconComponent }> = {
  card: { label: 'Card', icon: CreditCard },
  cash: { label: 'Cash', icon: Banknote },
  voucher: { label: 'Voucher', icon: Tag },
  gift_card: { label: 'Gift card', icon: Gift },
  unrecorded: { label: 'Not recorded', icon: CircleDashed },
};

/** How a payment method reads in every report: "Card", "Gift card". */
export const tenderLabel = (method: string) =>
  TENDER[method]?.label ?? method.charAt(0).toUpperCase() + method.slice(1).replaceAll('_', ' ');

/** The glyph before a tender's name. The name stays beside it — tenders vary
    by workspace, so the icon frames the word rather than replacing it. */
export const tenderIcon = (method: string | null | undefined): IconComponent => (method && TENDER[method]?.icon) || Wallet;

export function TenderIcon({ method }: { method: string | null | undefined }) {
  const Icon = (method && TENDER[method]?.icon) || Wallet;
  return <Icon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />;
}

// ── Table ────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
  /** A glyph or status dot before the value — a refund's kind, a delivery's state. */
  leading?: (row: T) => React.ReactNode;
  /** A quieter second line under the value — a category, a count, a date. */
  sub?: (row: T) => React.ReactNode;
  /** 0–1: a thin share bar under the value, so a column of percentages reads at a glance. */
  meter?: (row: T) => number;
  /** Makes the column sortable. */
  sort?: (row: T) => number | string;
  /** Shown in the totals row. */
  total?: React.ReactNode;
  className?: string;
}

type SortState = { key: string; direction: 'asc' | 'desc' };

/**
 * The breakdown table every report shares, in the audit log's manner: a
 * hairline list in a porcelain panel, quiet sentence-case headings, the first
 * column as the row's title (pinned while the rest scrolls on a phone), an
 * optional second line and share bar per cell, and a totals row that reads as
 * the sum it is. Sort by any heading that has an arrow; filter by name when
 * the list is long; open a row when it leads somewhere.
 */
export function ReportTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  onRowClick,
  activeKey,
  defaultSort,
  empty = 'Nothing in this period.',
  limit,
  ranked = false,
  search,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Each row opens this — the drill-down from a figure to what's behind it. */
  rowHref?: (row: T) => string | undefined;
  /** Each row opens a detail drawer instead of a page. */
  onRowClick?: (row: T) => void;
  /** The row whose drawer is open, highlighted. */
  activeKey?: string | null;
  defaultSort?: SortState;
  empty?: string;
  /** Show this many, with "Show all" below. */
  limit?: number;
  /** Number the rows in their current order. */
  ranked?: boolean;
  /** A filter box above the table: what to match and what to call the rows. */
  search?: { text: (row: T) => string; noun: [singular: string, plural: string] };
}) {
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return search && needle ? rows.filter((row) => search.text(row).toLowerCase().includes(needle)) : rows;
  }, [query, rows, search]);
  const sorted = useMemo(() => {
    const column = sort && columns.find((entry) => entry.key === sort.key);
    if (!sort || !column?.sort) return filtered;
    const by = column.sort;
    return [...filtered].sort((a, b) => {
      const left = by(a);
      const right = by(b);
      const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
      return sort.direction === 'asc' ? order : -order;
    });
  }, [columns, filtered, sort]);
  const shown = limit && !all ? sorted.slice(0, limit) : sorted;
  const hasTotals = columns.some((column) => column.total !== undefined);
  const opens = !!rowHref || !!onRowClick;
  const router = useRouter();

  if (rows.length === 0) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>;

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' },
    );
  const cell = (column: Column<T>, index: number) =>
    cn(
      'px-4 align-middle',
      column.align === 'right' ? 'text-right tabular-nums' : 'text-left',
      // The title column stays put while the figures scroll beside it.
      index === 0 && 'sticky left-0 z-[1] bg-inherit',
      column.className,
    );

  return (
    <div className="bg-field">
      {search && (
        <div className="flex flex-wrap items-center gap-3 border-b border-rule/45 px-4 py-2.5">
          <span className="flex-1 text-xs tabular-nums text-muted-foreground">
            {filtered.length === rows.length
              ? `${rows.length.toLocaleString('en-GB')} ${rows.length === 1 ? search.noun[0] : search.noun[1]}`
              : `${filtered.length.toLocaleString('en-GB')} of ${rows.length.toLocaleString('en-GB')}`}
          </span>
          <div className="w-full sm:w-60">
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Find ${search.noun[0]}…`}
              aria-label={`Find ${search.noun[0]}`}
              leftIcon={<Search size={14} />}
              className="h-8"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule/50 bg-field">
              {ranked && (
                <th scope="col" className="w-10 py-2.5 pr-0 pl-4 text-left text-xs font-medium text-muted-foreground" aria-label="Rank" />
              )}
              {columns.map((column, index) => {
                const active = sort?.key === column.key;
                const right = column.align === 'right';
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(cell(column, index), 'py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground')}
                  >
                    {column.sort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          'group/sort -mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-band hover:text-foreground',
                          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                          right && 'flex-row-reverse',
                          active && 'text-foreground',
                        )}
                      >
                        {column.header}
                        {active ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp size={12} className="text-primary" aria-hidden="true" />
                          ) : (
                            <ArrowDown size={12} className="text-primary" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowDown size={12} className="opacity-0 transition-opacity group-hover/sort:opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {opens && <th scope="col" className="w-8" aria-label="Open" />}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (ranked ? 1 : 0) + (opens ? 1 : 0)}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Nothing matches “{query}”.
                </td>
              </tr>
            ) : (
              shown.map((row, position) => {
                const href = rowHref?.(row);
                const key = rowKey(row);
                const clickable = !!href || !!onRowClick;
                return (
                  <tr
                    key={key}
                    // The whole row is the target. (An overlay stretched from the first
                    // cell can't do it: that cell is sticky, so the overlay stops at it.)
                    // The first cell keeps the real link or button, for the keyboard.
                    onClick={
                      clickable
                        ? (event) => {
                            if ((event.target as HTMLElement).closest('a, button, input, label')) return;
                            if (href) {
                              if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener');
                              else router.push(href);
                            } else onRowClick?.(row);
                          }
                        : undefined
                    }
                    className={cn(
                      'group/row border-b border-rule/45 transition-colors last:border-b-0 hover:bg-band',
                      activeKey === key ? 'bg-band' : 'bg-field',
                      clickable && 'cursor-pointer',
                    )}
                  >
                    {ranked && <td className="py-3 pr-0 pl-4 text-xs tabular-nums text-muted-foreground">{position + 1}</td>}
                    {columns.map((column, index) => {
                      const meter = column.meter?.(row);
                      const sub = column.sub?.(row);
                      const lead = column.leading?.(row);
                      const value = column.render(row);
                      const content = (
                        <>
                          <span
                            className={cn(
                              index === 0 ? 'font-medium text-foreground' : 'text-foreground',
                              lead ? cn('flex items-center gap-2', column.align === 'right' && 'justify-end') : 'block',
                            )}
                          >
                            {lead}
                            {lead ? <span className="min-w-0">{value}</span> : value}
                          </span>
                          {sub !== undefined && sub !== null && sub !== '' && (
                            <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{sub}</span>
                          )}
                          {meter !== undefined && (
                            // The share, readable: on hover, and by name for a screen reader.
                            <span
                              role="meter"
                              aria-valuenow={Math.round(meter * 100)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${Math.round(meter * 100)}% share`}
                              title={`${Math.round(meter * 100)}% share`}
                              className={cn(
                                'mt-1.5 flex h-1 w-full max-w-28 overflow-hidden rounded-full bg-band',
                                column.align === 'right' && 'ml-auto',
                              )}
                            >
                              <span
                                className="rounded-full bg-primary/70"
                                style={{ width: `${Math.min(100, Math.max(0, meter * 100))}%` }}
                              />
                            </span>
                          )}
                        </>
                      );
                      return (
                        <td key={column.key} className={cn(cell(column, index), 'py-3')}>
                          {href && index === 0 ? (
                            // The title is the link; the whole row is its target, so it stays one tab stop.
                            <Link href={href} className="outline-none focus-visible:underline">
                              {content}
                            </Link>
                          ) : onRowClick && index === 0 ? (
                            <button
                              type="button"
                              onClick={() => onRowClick(row)}
                              aria-haspopup="dialog"
                              className="text-left outline-none focus-visible:underline"
                            >
                              {content}
                            </button>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                    {opens && (
                      <td className="py-3 pr-3 text-right">
                        {clickable && (
                          <ChevronRight
                            size={14}
                            className="text-muted-foreground/50 transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          {hasTotals && filtered.length === rows.length && (
            <tfoot>
              <tr className="border-t border-rule/70 bg-band">
                {ranked && <td />}
                {columns.map((column, index) => (
                  <td key={column.key} className={cn(cell(column, index), 'py-3 font-semibold text-foreground')}>
                    {column.total ?? (index === 0 ? 'Total' : '')}
                  </td>
                ))}
                {opens && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {limit !== undefined && sorted.length > limit && (
        <button
          type="button"
          onClick={() => setAll((current) => !current)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-rule/45 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
        >
          {all ? 'Show fewer' : `Show all ${sorted.length.toLocaleString('en-GB')}`}
          <ChevronDown size={13} className={cn('transition-transform', all && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ── States ───────────────────────────────────────────────────────────────────

export function ReportLoading() {
  return (
    // KPI tiles have a known shape, so they skeleton; the chart and table below
    // don't until the figures arrive, so the mascot holds their place.
    <div className="space-y-5" aria-busy="true" aria-label="Loading the report">
      <FactsSkeleton count={4} label="Loading the figures" className="sm:grid-cols-2 xl:grid-cols-4" />
      <LoadingState label="Working out the report" />
    </div>
  );
}

export function ReportError({ onRetry, what = 'This report' }: { onRetry: () => void; what?: string }) {
  return (
    <div className="rounded-lg border border-rule/60 bg-field">
      <ErrorState
        title={`${what} couldn’t be loaded`}
        description="Check your connection and try again. Nothing here is a partial figure."
        onRetry={onRetry}
      />
    </div>
  );
}

export function ReportEmpty({
  icon,
  title,
  description,
  kind,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  kind?: EmptyStateKind;
}) {
  return <EmptyState icon={icon} title={title} description={description} kind={kind} />;
}
