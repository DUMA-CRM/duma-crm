'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

import { ArrowDown } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';
import { axisLabelIndexes, monotonePath, nearestIndex, niceTicks } from '@/lib/utils/report-chart';
import { delta } from '@/lib/utils/report-filters';
import {
  type FunnelRow,
  type Slice,
  type StackSeries,
  WEEKDAYS,
  arcPath,
  heatLevel,
  heatmapPeak,
  hourLabel,
  stepLabel,
} from '@/lib/utils/web-analytics';

import { ChangePill } from '../kit/parts';

/* The three charts the Website analytics report adds to the report kit: a
   ring, a weekday-by-hour heatmap and a funnel. Colour comes from the app's
   validated categorical order (--series-1…4, light and dark both checked)
   and a neutral slate for "Other"; the heatmap and funnel are one hue. Every
   slice and step carries its number in text, so nothing is read by colour. */

const SLOT_FILL = ['fill-chart-5', 'fill-series-1', 'fill-series-2', 'fill-series-3', 'fill-series-4'] as const;
const SLOT_SWATCH = ['bg-chart-5', 'bg-series-1', 'bg-series-2', 'bg-series-3', 'bg-series-4'] as const;
const EASE = [0.22, 1, 0.36, 1] as const;

// ── Donut ───────────────────────────────────────────────────────────────────

export function DonutChart({
  slices,
  total,
  totalLabel,
  format,
  ariaLabel,
}: {
  slices: Slice[];
  total: number;
  /** Under the number in the hole: "visitors". */
  totalLabel: string;
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const size = 168;
  const outer = size / 2;
  const inner = outer - 22;
  // A 2px surface gap between slices, as an angle at the outer edge.
  const gap = slices.length > 1 ? 2 / (2 * Math.PI * outer) : 0;
  const arcs = slices.map((slice, index) => {
    const from = slices.slice(0, index).reduce((sum, before) => sum + before.share, 0);
    const to = from + slice.share;
    return { slice, from: from + gap / 2, to: Math.max(from + gap / 2, to - gap / 2) };
  });
  const focus = slices.find((slice) => slice.key === active);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={ariaLabel}>
          {arcs.map(({ slice, from, to }, index) => (
            <motion.path
              key={slice.key}
              d={arcPath(outer, outer, active === slice.key ? outer : outer - 2, inner, from, to)}
              className={cn(SLOT_FILL[slice.slot], 'transition-opacity')}
              opacity={active && active !== slice.key ? 0.4 : 1}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: active && active !== slice.key ? 0.4 : 1 }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.06, ease: EASE }}
              onPointerEnter={() => setActive(slice.key)}
              onPointerLeave={() => setActive(null)}
            >
              <title>{`${slice.label}: ${format(slice.value)} (${Math.round(slice.share * 100)}%)`}</title>
            </motion.path>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold tabular-nums tracking-headline text-foreground">
            {focus ? `${Math.round(focus.share * 100)}%` : format(total)}
          </span>
          <span className="max-w-24 truncate text-xs text-muted-foreground">{focus ? focus.label : totalLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {slices.map((slice) => (
          <li key={slice.key}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-band/60',
                active === slice.key && 'bg-band/60',
              )}
              onPointerEnter={() => setActive(slice.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(slice.key)}
              onBlur={() => setActive(null)}
            >
              <span className={cn('size-2.5 shrink-0 rounded-xs', SLOT_SWATCH[slice.slot])} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{slice.label}</span>
              <span className="tabular-nums text-foreground">{format(slice.value)}</span>
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(slice.share * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Heatmap ─────────────────────────────────────────────────────────────────

/** One hue, five steps by share of the busiest hour; empty hours stay the band colour. */
const HEAT = ['bg-band/70', 'bg-primary/15', 'bg-primary/30', 'bg-primary/50', 'bg-primary/72', 'bg-primary'] as const;

export function Heatmap({ grid, format, timezone }: { grid: number[][]; format: (value: number) => string; timezone: string }) {
  const [active, setActive] = useState<{ day: number; hour: number } | null>(null);
  const max = Math.max(0, ...grid.flat());
  const peak = heatmapPeak(grid);
  // "Sat 18:00–19:00 · 94 visits · busiest hour" — the reading for one cell.
  const cellLabel = (day: number, hour: number, value: number) =>
    [
      `${WEEKDAYS[day]} ${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`,
      value === 1 ? '1 visit' : `${format(value)} visits`,
      peak && value === peak.value ? 'busiest hour' : peak && value > 0 ? `${Math.round((value / peak.value) * 100)}% of the busiest` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    // `relative` anchors the sr-only table below; without it the table is placed against the
    // page itself, far below the shell, and the whole document scrolls past the app.
    <div className="relative space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p className="min-h-4">
          {peak ? (
            <>
              Busiest: <span className="font-semibold text-foreground">{WEEKDAYS[peak.day]} {hourLabel(peak.hour)}</span> · {format(peak.value)} visits ·
              times in {timezone.replaceAll('_', ' ')}
            </>
          ) : (
            'No visits in this period.'
          )}
        </p>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          Fewer
          {HEAT.slice(1).map((tone) => (
            <span key={tone} className={cn('size-3 rounded-xs', tone)} />
          ))}
          More
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[36rem] gap-[3px]" style={{ gridTemplateColumns: '2.25rem repeat(24, minmax(0, 1fr))' }} aria-hidden="true">
          {grid.map((hours, day) => (
            <div key={WEEKDAYS[day]} className="contents">
              <span className="flex items-center text-[11px] text-muted-foreground">{WEEKDAYS[day]}</span>
              {hours.map((value, hour) => (
                // The shared tooltip: portalled, so the scrolling grid can't clip it, and it flips when there's no room above.
                <Tooltip key={hour} side="top" label={cellLabel(day, hour, value)} className="block h-6">
                  <span
                    className={cn(
                      'block size-full rounded-[3px] transition-[box-shadow]',
                      HEAT[heatLevel(value, max)],
                      active?.day === day && active.hour === hour && 'ring-2 ring-foreground/60 ring-offset-1 ring-offset-field',
                    )}
                    onPointerEnter={() => setActive({ day, hour })}
                    onPointerLeave={() => setActive(null)}
                  />
                </Tooltip>
              ))}
            </div>
          ))}
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="pt-1 text-center text-[10px] tabular-nums text-muted-foreground">
              {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
            </span>
          ))}
        </div>
      </div>
      {/* The grid, as a table, for screen readers. */}
      <div className="sr-only">
        <table>
          <caption>Visits by weekday and hour</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {Array.from({ length: 24 }, (_, hour) => (
                <th key={hour} scope="col">
                  {hourLabel(hour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((hours, day) => (
              <tr key={WEEKDAYS[day]}>
                <th scope="row">{WEEKDAYS[day]}</th>
                {hours.map((value, hour) => (
                  <td key={hour}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────────────

/**
 * Funnel steps as bars on one scale — the first step is the full width, each
 * later one its share of it, over a light track that shows what was lost — so
 * proportions read true (a trapezoid flatters them). Between steps, a
 * connector says how many left and what share; the biggest drop is flagged.
 * Every number is printed: nothing needs a hover.
 */
export function FunnelChart({ rows, format, biggestDrop }: { rows: FunnelRow[]; format: (value: number) => string; biggestDrop: number | null }) {
  const reduceMotion = useReducedMotion();
  const pct = (value: number) => `${(Math.round(value * 1000) / 10).toLocaleString('en-GB')}%`;
  return (
    <ol>
      {rows.map((row, index) => (
        <li key={`${row.type}:${row.value}:${index}`}>
          {row.dropped !== null && (
            // The connector: a short rule from the step above, and who didn't make it.
            <div className="flex items-stretch gap-3 py-1" aria-label={`${format(row.dropped)} visitors left before this step`}>
              <span className="flex w-6 shrink-0 justify-center" aria-hidden="true">
                <span className="w-px bg-rule" />
              </span>
              <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 py-1 text-xs tabular-nums', index === biggestDrop ? 'text-exception' : 'text-muted-foreground')}>
                <ArrowDown size={12} aria-hidden="true" />
                <span>
                  <span className="font-semibold">{format(row.dropped)}</span> left · {pct(row.dropoff ?? 0)}
                </span>
                {index === biggestDrop && (
                  <span className="rounded-sm bg-exception/8 px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide">Biggest drop-off</span>
                )}
              </p>
            </div>
          )}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className={cn('text-sm font-medium text-foreground', row.type === 'page' && 'font-mono text-xs')}>{stepLabel(row)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{row.type === 'page' ? 'page' : 'event'}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  <span className="font-semibold text-foreground">{format(row.visitors)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{pct(row.ofFirst)}</span>
                </span>
              </div>
              {/* The bar against the first step's width; the track behind it is everyone who started. */}
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-band">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${Math.max(row.visitors > 0 ? 1.5 : 0, row.ofFirst * 100)}%` }}
                  transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.08, ease: EASE }}
                />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Two-series trend ────────────────────────────────────────────────────────

export interface TrendSeries {
  key: string;
  label: string;
  values: number[];
  /** The comparison period, day for day; null where it has no day. */
  previous?: (number | null)[] | null;
  /** 1–4: the validated series slot. */
  slot: 1 | 2 | 3 | 4;
}

const SLOT_STROKE = ['', 'stroke-series-1', 'stroke-series-2', 'stroke-series-3', 'stroke-series-4'] as const;
const SLOT_VAR = ['', 'var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)', 'var(--color-series-4)'] as const;
const PLOT = { top: 12, right: 10, bottom: 26 };

/** Tracks an element's content width, so the chart draws at real pixels and its text never scales. */
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
 * Several counts a day on one shared axis — visitors and pageviews — each a
 * smooth line over its own faint wash. One crosshair snaps to the nearest day
 * and one card lists every series there, with its change against the same day
 * of the comparison period. Arrow keys walk the days; the figures are also a
 * table for screen readers.
 */
export function MultiTrendChart({
  days,
  series,
  format,
  previousLabel,
  ariaLabel,
  height = 260,
}: {
  days: { label: string; axis: string }[];
  series: TrendSeries[];
  format: (value: number) => string;
  previousLabel: string;
  ariaLabel: string;
  height?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reduceMotion = useReducedMotion();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const count = days.length;
  const ticks = niceTicks(Math.max(0, ...series.flatMap((line) => line.values)));
  const top = ticks.at(-1) || 1;
  const left = Math.max(28, ...ticks.map((tick) => format(tick).length * 6.4)) + 12;
  const innerW = Math.max(0, width - left - PLOT.right);
  const innerH = height - PLOT.top - PLOT.bottom;
  const baseline = PLOT.top + innerH;
  const x = (index: number) => left + (count <= 1 ? innerW / 2 : (index / (count - 1)) * innerW);
  const y = (value: number) => PLOT.top + (1 - Math.max(0, value) / top) * innerH;
  const labels = axisLabelIndexes(count, innerW / 76);
  const signature = `${count}:${series.map((line) => line.values.reduce((sum, value) => sum + value, 0)).join(':')}`;

  if (count === 0) return <p className="py-12 text-center text-sm text-muted-foreground">Nothing to chart in this period.</p>;

  const pick = (clientX: number, target: Element) =>
    setActive(nearestIndex(clientX - target.getBoundingClientRect().left - left, count, innerW));

  return (
    <div
      ref={ref}
      // `relative` holds the card and the sr-only table inside the chart, not against the page.
      className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ height }}
      tabIndex={0}
      aria-label={`${ariaLabel}. Use the arrow keys to read each day.`}
      onFocus={() => setActive((index) => index ?? count - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={(event) => {
        const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
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
            {series.map((line) => (
              <linearGradient key={line.key} id={`wash-${uid}-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: SLOT_VAR[line.slot] }} stopOpacity={0.16} />
                <stop offset="100%" style={{ stopColor: SLOT_VAR[line.slot] }} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - PLOT.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? 'stroke-grid-major' : 'stroke-grid-minor'}
                strokeDasharray={tick === 0 ? undefined : '2 4'}
              />
              <text x={left - 10} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {format(tick)}
              </text>
            </g>
          ))}

          {series.map((line) => {
            const path = monotonePath(line.values.map((value, index) => ({ x: x(index), y: y(value) })));
            return (
              <g key={line.key}>
                {count > 1 && (
                  <motion.path
                    key={`area-${signature}`}
                    d={`${path}L${x(count - 1)},${baseline}L${x(0)},${baseline}Z`}
                    fill={`url(#wash-${uid}-${line.key})`}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  />
                )}
                <motion.path
                  key={`line-${signature}`}
                  d={path}
                  fill="none"
                  className={SLOT_STROKE[line.slot]}
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: EASE }}
                />
                {active === null && count > 0 && (
                  <circle cx={x(count - 1)} cy={y(line.values[count - 1] ?? 0)} r={3.5} className={cn(SLOT_FILL[line.slot], 'stroke-field')} strokeWidth={1.5} />
                )}
              </g>
            );
          })}

          {active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={PLOT.top} y2={baseline} className="stroke-foreground/20" />
              {series.map((line) => (
                <circle
                  key={line.key}
                  cx={x(active)}
                  cy={y(line.values[active] ?? 0)}
                  r={4.5}
                  className={cn(SLOT_FILL[line.slot], 'stroke-field')}
                  strokeWidth={2}
                />
              ))}
            </g>
          )}

          {labels.map((index) => (
            <text
              key={`axis-${index}`}
              x={x(index)}
              y={height - 7}
              textAnchor={count > 1 && index === 0 ? 'start' : count > 1 && index === count - 1 ? 'end' : 'middle'}
              className={cn('text-[11px] tabular-nums', index === active ? 'fill-foreground font-semibold' : 'fill-muted-foreground')}
            >
              {days[index]!.axis}
            </text>
          ))}
        </svg>
      )}

      {active !== null && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max min-w-52 rounded-lg border border-rule/60 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-sm"
          style={{ left: x(active), transform: `translateX(${x(active) > width / 2 ? 'calc(-100% - 14px)' : '14px'})` }}
        >
          <p className="text-xs font-semibold text-foreground">{days[active]!.label}</p>
          <dl className="mt-2 space-y-2 text-xs">
            {series.map((line) => {
              const value = line.values[active] ?? 0;
              const before = line.previous?.[active] ?? null;
              return (
                <div key={line.key}>
                  <div className="flex items-center justify-between gap-5">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      {/* A line key, as the mark is a line. */}
                      <span className="h-0.5 w-3 rounded-full" style={{ background: SLOT_VAR[line.slot] }} aria-hidden="true" />
                      {line.label}
                    </dt>
                    <dd className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold tabular-nums text-foreground">{format(value)}</span>
                      {before !== null && <ChangePill change={delta(value, before)} />}
                    </dd>
                  </div>
                  {before !== null && (
                    <p className="mt-0.5 text-right text-[11px] tabular-nums text-muted-foreground">
                      {format(before)} {previousLabel.toLowerCase()}
                    </p>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {active !== null ? `${days[active]!.label}: ${series.map((line) => `${line.label} ${format(line.values[active] ?? 0)}`).join(', ')}` : ''}
      </p>
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {series.map((line) => (
                <th key={line.key} scope="col">
                  {line.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => (
              <tr key={day.label}>
                <th scope="row">{day.label}</th>
                {series.map((line) => (
                  <td key={line.key}>{format(line.values[index] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The key for a multi-line chart: a short line per series, as the marks are lines. */
export function MultiTrendLegend({ series }: { series: Pick<TrendSeries, 'key' | 'label' | 'slot'>[] }) {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((line) => (
        <span key={line.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: SLOT_VAR[line.slot] }} aria-hidden="true" />
          {line.label}
        </span>
      ))}
    </span>
  );
}

// ── Stacked columns ─────────────────────────────────────────────────────────

/**
 * Counts per bucket, stacked by series — custom events by day or hour, as
 * Umami draws them, but in the validated slots: four named series and a slate
 * "Other". A 2px surface gap separates segments; the hovered column lifts and
 * a card lists every series there with the total. The figures are also a table.
 */
export function StackedColumnChart({
  buckets,
  series,
  format,
  ariaLabel,
  height = 220,
}: {
  buckets: { label: string; axis: string }[];
  series: StackSeries[];
  format: (value: number) => string;
  ariaLabel: string;
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const count = buckets.length;
  const totals = buckets.map((_, index) => series.reduce((sum, line) => sum + (line.values[index] ?? 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks.at(-1) || 1;
  const left = Math.max(24, ...ticks.map((tick) => format(tick).length * 6.4)) + 10;
  const innerW = Math.max(0, width - left - PLOT.right);
  const innerH = height - PLOT.top - PLOT.bottom;
  const baseline = PLOT.top + innerH;
  const slot = count ? innerW / count : innerW;
  // Bars take most of their slot — wide when there are few buckets — keeping at least a 2px gap between them.
  const barW = Math.max(2, Math.min(64, slot - Math.max(2, slot * 0.18)));
  const x = (index: number) => left + slot * (index + 0.5);
  const y = (value: number) => PLOT.top + (1 - value / top) * innerH;
  const labels = axisLabelIndexes(count, innerW / 64);
  const GAP = 2;
  const MIN_SEGMENT = 4;

  if (count === 0 || totals.every((total) => total === 0)) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No custom events in this period.</p>;
  }

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        // `relative` holds the card and the sr-only table inside the chart, not against the page.
        className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        style={{ height }}
        tabIndex={0}
        aria-label={`${ariaLabel}. Use the arrow keys to read each column.`}
        onFocus={() => setActive((index) => index ?? count - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(event) => {
          const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
          if (step) setActive((index) => Math.min(count - 1, Math.max(0, (index ?? count - 1) + step)));
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
            onPointerMove={(event) =>
              setActive(nearestIndex(event.clientX - event.currentTarget.getBoundingClientRect().left - left, count, innerW, true))
            }
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') setActive(null);
            }}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={left}
                  x2={width - PLOT.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className={tick === 0 ? 'stroke-grid-major' : 'stroke-grid-minor'}
                  strokeDasharray={tick === 0 ? undefined : '2 4'}
                />
                <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                  {format(tick)}
                </text>
              </g>
            ))}
            {active !== null && <rect x={x(active) - slot / 2} y={PLOT.top} width={slot} height={innerH} className="fill-band/70" />}
            {buckets.map((_, index) => {
              // Bottom up, in series order; each segment gives up 2px to the gap above it.
              let floor = baseline;
              return (
                <motion.g
                  key={index}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: active !== null && active !== index ? 0.55 : 1, y: 0 }}
                  transition={{ duration: 0.35, delay: reduceMotion ? 0 : Math.min(index * 0.015, 0.3), ease: EASE }}
                >
                  {series.map((line) => {
                    const value = line.values[index] ?? 0;
                    if (value <= 0) return null;
                    // Every event that happened stays visible: at least MIN_SEGMENT tall, whatever its share.
                    // The exact count is in the card and the table; the stack never climbs past the plot.
                    const drawn = Math.min(Math.max(MIN_SEGMENT, baseline - y(value) - GAP), Math.max(0, floor - GAP - PLOT.top));
                    if (drawn <= 0) return null;
                    const segment = (
                      <rect
                        key={line.key}
                        x={x(index) - barW / 2}
                        y={floor - drawn}
                        width={barW}
                        height={drawn}
                        rx={2}
                        className={SLOT_FILL[line.slot]}
                      >
                        <title>{`${line.label}: ${format(value)}`}</title>
                      </rect>
                    );
                    floor -= drawn + GAP;
                    return segment;
                  })}
                </motion.g>
              );
            })}
            {labels.map((index) => (
              <text
                key={`axis-${index}`}
                x={x(index)}
                y={height - 7}
                textAnchor="middle"
                className={cn('text-[11px] tabular-nums', index === active ? 'fill-foreground font-semibold' : 'fill-muted-foreground')}
              >
                {buckets[index]!.axis}
              </text>
            ))}
          </svg>
        )}

        {active !== null && width > 0 && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max min-w-44 rounded-lg border border-rule/60 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-sm"
            style={{ left: x(active), transform: `translateX(${x(active) > width / 2 ? 'calc(-100% - 14px)' : '14px'})` }}
          >
            <p className="text-xs font-semibold text-foreground">{buckets[active]!.label}</p>
            <dl className="mt-1.5 space-y-1 text-xs">
              {series
                .filter((line) => (line.values[active] ?? 0) > 0)
                .map((line) => (
                  <div key={line.key} className="flex items-center justify-between gap-5">
                    <dt className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                      <span className={cn('size-2 shrink-0 rounded-xs', SLOT_SWATCH[line.slot])} aria-hidden="true" />
                      <span className="truncate font-mono">{line.label}</span>
                    </dt>
                    <dd className="font-semibold tabular-nums text-foreground">{format(line.values[active] ?? 0)}</dd>
                  </div>
                ))}
            </dl>
            <div className="mt-1.5 flex justify-between gap-5 border-t border-rule/50 pt-1.5 text-xs">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums text-foreground">{format(totals[active] ?? 0)}</span>
            </div>
          </div>
        )}

        <div className="sr-only">
          <table>
            <caption>{ariaLabel}</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                {series.map((line) => (
                  <th key={line.key} scope="col">
                    {line.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket, index) => (
                <tr key={bucket.label}>
                  <th scope="row">{bucket.label}</th>
                  {series.map((line) => (
                    <td key={line.key}>{format(line.values[index] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* The key mirrors the mark: squares for bars. */}
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        {series.map((line) => (
          <li key={line.key} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-xs', SLOT_SWATCH[line.slot])} />
            <span className={cn(line.slot !== 0 && 'font-mono')}>{line.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
