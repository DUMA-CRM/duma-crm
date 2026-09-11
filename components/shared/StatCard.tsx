'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';

import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from '@/components/icons';
import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';
import { percentageChange } from '@/lib/utils/dashboard';

/* ════════════════════════════════════════════════════════════════
   StatCard — the single stat / KPI / metric tile for the whole app.

   Replaces every bespoke Stat / MetricCard / SummaryCard / PerfTile /
   MiniStat / Metric tile that used to live inside feature files.
   ════════════════════════════════════════════════════════════════ */

// ── Accents ───────────────────────────────────────────────────────
export type StatAccent = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';

/**
 * Chip behind a leading icon: filled with the accent, edged in the same colour,
 * with the icon knocked out in the ground — warm white by day, charcoal at
 * night, so the glyph reads against a saturated fill in either theme.
 */
const ACCENT_CHIP: Record<StatAccent, string> = {
  primary: 'border border-foreground bg-foreground text-background',
  success: 'border border-momentum bg-momentum text-background',
  warning: 'border border-measured bg-measured text-background',
  danger: 'border border-exception bg-exception text-background',
  info: 'border border-reference bg-reference text-background',
  purple: 'border border-chart-5 bg-chart-5 text-background',
  neutral: 'border border-muted-foreground bg-muted-foreground text-background',
};

/** `currentColor` for the sparkline / bars / ring stroke. */
const ACCENT_INK: Record<StatAccent, string> = {
  primary: 'text-chart-1',
  success: 'text-chart-4',
  warning: 'text-chart-2',
  danger: 'text-destructive',
  info: 'text-chart-3',
  purple: 'text-chart-5',
  neutral: 'text-faint',
};

// ── Delta ─────────────────────────────────────────────────────────
export type StatTrend = 'up' | 'down' | 'flat';
export type StatTone = 'positive' | 'negative' | 'neutral';

export interface StatDelta {
  /**
   * Numbers are formatted as a signed percentage (`12` → `+12%`); pass a
   * string to render it verbatim (`'+4 pts'`).
   */
  value: number | string;
  /** Defaults to the sign of a numeric `value`. */
  trend?: StatTrend;
  /**
   * Colour of the badge. Defaults to the trend — set `lowerIsBetter` instead
   * of overriding this when a fall is the good outcome.
   */
  tone?: StatTone;
  /** Flips the default tone so a downward trend reads as positive. */
  lowerIsBetter?: boolean;
  /** Trailing muted text, e.g. `last week`. */
  label?: string;
}

const DELTA_TONE: Record<StatTone, { chip: string; text: string }> = {
  positive: { chip: 'border-momentum/60 bg-momentum/6 text-momentum', text: 'text-momentum' },
  negative: { chip: 'border-exception/60 bg-exception/6 text-exception', text: 'text-exception' },
  neutral: { chip: 'border-rule text-muted-foreground', text: 'text-muted-foreground' },
};

function resolveDelta({ value, trend, tone, lowerIsBetter }: StatDelta) {
  const numeric = typeof value === 'number' ? value : null;
  const resolvedTrend: StatTrend = trend ?? (numeric === null || numeric === 0 ? 'flat' : numeric > 0 ? 'up' : 'down');
  const good = lowerIsBetter ? 'down' : 'up';
  const bad = lowerIsBetter ? 'up' : 'down';
  const resolvedTone: StatTone = tone ?? (resolvedTrend === good ? 'positive' : resolvedTrend === bad ? 'negative' : 'neutral');
  const text = numeric === null ? value : `${numeric > 0 ? '+' : ''}${Number(numeric.toFixed(1))}%`;
  return { trend: resolvedTrend, tone: resolvedTone, text };
}

/**
 * Maps the app-wide "percentage change" convention onto a `StatDelta`:
 * `undefined` means there was nothing to compare against, `null` means the
 * metric is new in this period.
 */
export function changeDelta(
  change: number | null | undefined,
  { label, points, lowerIsBetter }: { label?: string; points?: boolean; lowerIsBetter?: boolean } = {},
): StatDelta {
  if (change === undefined) return { value: 'No comparison', trend: 'flat', tone: 'neutral' };
  if (change === null) return { value: label ? `New ${label}` : 'New', trend: 'flat', tone: 'neutral' };
  const rounded = Number(change.toFixed(1));
  return {
    value: points ? `${rounded > 0 ? '+' : ''}${rounded} pts` : rounded,
    trend: rounded === 0 ? 'flat' : rounded > 0 ? 'up' : 'down',
    lowerIsBetter,
    label,
  };
}

/**
 * Period-on-period delta from the two raw values, for the common case where a
 * caller has both figures to hand. Yields `undefined` when there is nothing to
 * compare, so the card simply drops the badge.
 */
export function comparisonDelta(
  current: number | undefined,
  previous: number | undefined,
  { label = 'vs previous period', lowerIsBetter }: { label?: string; lowerIsBetter?: boolean } = {},
): StatDelta | undefined {
  if (current === undefined || previous === undefined) return undefined;
  return changeDelta(percentageChange(current, previous), { label, lowerIsBetter });
}

/**
 * The delta pill from the design: a small rounded-square trend glyph followed
 * by the change and an optional comparison label.
 */
export function DeltaBadge({ delta, size = 'md', className }: { delta: StatDelta; size?: 'sm' | 'md'; className?: string }) {
  const { trend, tone, text } = resolveDelta(delta);
  const Glyph = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  const sm = size === 'sm';

  return (
    <span className={cn('flex items-center gap-1.5 leading-none', sm ? 'text-label' : 'text-sm', className)}>
      <span
        className={cn('flex shrink-0 items-center justify-center rounded-sm border', DELTA_TONE[tone].chip, sm ? 'size-4' : 'size-4.5')}
        aria-hidden="true"
      >
        {Glyph ? <Glyph size={sm ? 9 : 11} strokeWidth={2.75} /> : <span className="h-px w-2 rounded-full bg-current" />}
      </span>
      <span className={cn('font-semibold tabular-nums font-mono', DELTA_TONE[tone].text)}>{text}</span>
      {delta.label && <span className="truncate font-normal text-muted-foreground">{delta.label}</span>}
    </span>
  );
}

// ── Visuals ───────────────────────────────────────────────────────
export type StatVisual =
  | {
      type: 'sparkline';
      points: number[];
      /** Per-point text swapped into the value on hover. */
      labels?: string[];
      /** Per-point text swapped into the label on hover. */
      titleLabels?: string[];
      /** Text pinned above the highlighted point — defaults to the delta. */
      marker?: string;
    }
  | { type: 'bars'; values: number[]; labels?: string[]; titleLabels?: string[] }
  | { type: 'ring'; pct: number; display?: string; label?: string }
  | { type: 'progress'; pct: number; from?: string; to?: string };

/* ── Sparkline geometry ─────────────────────────────────────────── */
const SPARK_W = 160;
const SPARK_H = 64;
const SPARK_PAD = 8;

function sparkCoords(points: number[]) {
  if (points.length === 0) return [];
  const min = Math.min(...points);
  const range = Math.max(...points) - min || 1;
  const span = points.length > 1 ? points.length - 1 : 1;
  return points.map((p, i) => ({
    x: (i / span) * SPARK_W,
    y: SPARK_H - SPARK_PAD - ((p - min) / range) * (SPARK_H - SPARK_PAD * 2),
  }));
}

/** Catmull-Rom → cubic bezier, for the soft wave in the design. */
function smoothPath(coords: { x: number; y: number }[]) {
  if (coords.length < 2) return '';
  let d = `M${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

const RING_R = 15.5;
const RING_CIRC = 2 * Math.PI * RING_R;

/** Standalone donut — also used on its own for the secondary metric. */
export function StatRing({
  pct,
  accent = 'primary',
  size = 34,
  className,
}: {
  pct: number;
  accent?: StatAccent;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg
      viewBox="0 0 40 40"
      style={{ width: size, height: size }}
      className={cn('shrink-0 -rotate-90', ACCENT_INK[accent], className)}
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r={RING_R} fill="none" strokeWidth="5" className="stroke-band" />
      <circle
        cx="20"
        cy="20"
        r={RING_R}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={RING_CIRC}
        strokeDashoffset={RING_CIRC * (1 - clamped / 100)}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────
export interface StatCardProps {
  /** Primary title, e.g. `Productive Time`. */
  label: string;
  /** Muted suffix rendered after a slash, e.g. `Day` → `Productive Time / Day`. */
  qualifier?: string;
  /** Muted line under the label, e.g. a company's category. */
  sublabel?: string;
  value: ReactNode;
  /** Small suffix after the value, e.g. `hr` or `/ month`. */
  unit?: string;
  /** Muted line under the value, e.g. `Recurring Revenue`. */
  caption?: string;
  hint?: string;
  icon?: IconComponent;
  accent?: StatAccent;
  /** Replaces the icon chip — for logos, avatars or any custom leading media. */
  media?: ReactNode;
  delta?: StatDelta;
  /** `inline` sits the delta beside the value; defaults to inline when a caption is present. */
  deltaPlacement?: 'below' | 'inline';
  visual?: StatVisual;
  /** `side` floats the visual right of the value; `below` spans the card width. */
  visualPlacement?: 'side' | 'below';
  /** Secondary metric pinned to the right, as on the revenue cards. */
  secondary?: { value: ReactNode; label?: string; ring?: number };
  /** Rendered top-right — a button, badge or menu. */
  action?: ReactNode;
  href?: string;
  onSelect?: () => void;
  selected?: boolean;
  loading?: boolean;
  /**
   * The figure could not be read. Renders an em dash and says so, instead of
   * whatever a `?? 0` fallback would have shown.
   *
   * This exists because the mistake keeps being made — including twice in the
   * commit that added this prop. A tile reading "0" or "None set" is a claim,
   * and a failed request has not earned one.
   */
  error?: boolean;
  /** `sm` is the compact tile used inside panels and detail pages. */
  size?: 'sm' | 'md';
  className?: string;
  /** Escape hatch for colouring the figure itself, e.g. a days-of-stock warning. */
  valueClassName?: string;
}

const CARD_BASE = 'group relative flex flex-col rounded-sm border border-rule bg-card text-left';

// ── Component ─────────────────────────────────────────────────────
export function StatCard({
  label,
  qualifier,
  sublabel,
  value,
  unit,
  caption,
  hint,
  icon: Icon,
  accent = 'primary',
  media,
  delta,
  deltaPlacement,
  visual: visualProp,
  visualPlacement = 'side',
  secondary,
  action,
  href,
  onSelect,
  selected,
  loading,
  error,
  size = 'md',
  className,
  valueClassName,
}: StatCardProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradientId = useId();

  // Callers pass series straight from a query, so an empty period must not
  // leave a blank chart slot eating half the card.
  const visual =
    (visualProp?.type === 'sparkline' && visualProp.points.length < 2) || (visualProp?.type === 'bars' && visualProp.values.length === 0)
      ? undefined
      : visualProp;

  const sm = size === 'sm';
  const interactive = Boolean(href || onSelect);
  const inlineDelta = (deltaPlacement ?? (caption ? 'inline' : 'below')) === 'inline';

  // Hovering a data point swaps the headline value/label for that point's.
  const series = visual?.type === 'sparkline' ? visual.points : visual?.type === 'bars' ? visual.values : null;
  const active = series && hovered !== null ? hovered : null;
  const displayValue = active !== null && visual && 'labels' in visual ? (visual.labels?.[active] ?? String(series![active])) : value;
  const displayLabel = active !== null && visual && 'titleLabels' in visual ? (visual.titleLabels?.[active] ?? label) : label;

  function handleSparkMove(event: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || visual?.type !== 'sparkline' || visual.points.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const last = visual.points.length - 1;
    setHovered(Math.max(0, Math.min(last, Math.round(ratio * last))));
  }

  if (loading) return <StatCardSkeleton size={size} className={className} />;

  /* ── Unreadable ── */
  // Deliberately quiet: this is one tile failing, not the page. It states that
  // it does not know, which is the one thing a `?? 0` cannot say.
  const unreadable = error && !loading;

  /* ── Leading media ── */
  const leading =
    media ??
    (Icon ? (
      <span className={cn('flex shrink-0 items-center justify-center rounded-sm', ACCENT_CHIP[accent], sm ? 'size-8' : 'size-10')}>
        <Icon size={sm ? 15 : 18} strokeWidth={2} />
      </span>
    ) : null);

  /* ── Visual ── */
  let visualNode: ReactNode = null;

  if (visual?.type === 'sparkline') {
    const coords = sparkCoords(visual.points);
    const line = smoothPath(coords);
    const area = line ? `${line} L${SPARK_W},${SPARK_H} L0,${SPARK_H} Z` : '';
    const markerIndex = active ?? coords.length - 2;
    const marker = coords[markerIndex] ?? coords[coords.length - 1];
    const markerText = active !== null ? (visual.labels?.[active] ?? String(visual.points[active])) : (visual.marker ?? null);
    const full = visualPlacement === 'below';

    visualNode = (
      <div className={cn('relative', full ? 'w-full' : 'w-[46%] max-w-43 shrink-0')}>
        {markerText && marker && (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full pb-1 text-label font-semibold tabular-nums font-mono text-foreground"
            style={{
              // Clamped so the label never spills past the card edge.
              left: `${Math.min(92, Math.max(8, (marker.x / SPARK_W) * 100))}%`,
              top: `${(marker.y / SPARK_H) * 100}%`,
            }}
          >
            {markerText}
          </span>
        )}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
          preserveAspectRatio="none"
          className={cn('h-16 w-full cursor-crosshair', ACCENT_INK[accent])}
          role="img"
          aria-label={`${label} trend: ${visual.points.join(', ')}`}
          onMouseMove={handleSparkMove}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {area && <path d={area} fill={`url(#${gradientId})`} />}
          {marker && (
            <line
              x1={marker.x}
              y1={0}
              x2={marker.x}
              y2={SPARK_H}
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.25"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {marker && (
            <circle
              cx={marker.x}
              cy={marker.y}
              r="3"
              fill="currentColor"
              stroke="var(--card)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
    );
  }

  if (visual?.type === 'bars') {
    const max = Math.max(...visual.values, 1);
    const full = visualPlacement === 'below';
    visualNode = (
      <div className={cn('flex h-16 items-end gap-1', full ? 'w-full' : 'w-[46%] max-w-43 shrink-0')}>
        {visual.values.map((v, i) => {
          const on = hovered === i || (hovered === null && i === visual.values.length - 1);
          return (
            <button
              type="button"
              key={i}
              style={{ height: `${v === 0 ? 4 : Math.max(4, (v / max) * 100)}%` }}
              className={cn(
                'flex-1 rounded-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                on ? cn('bg-current', ACCENT_INK[accent]) : 'bg-band',
              )}
              aria-label={`${visual.titleLabels?.[i] ?? label}: ${visual.labels?.[i] ?? v}`}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>
    );
  }

  if (visual?.type === 'ring') {
    visualNode = (
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="flex items-center gap-2 border border-rule py-1 pr-3 pl-1">
          <StatRing pct={visual.pct} accent={accent} size={26} />
          <span className="text-sm font-semibold tabular-nums font-mono text-foreground">
            {visual.display ?? `${Math.round(visual.pct)}`}
          </span>
        </span>
        {visual.label && <span className="text-xs text-muted-foreground">{visual.label}</span>}
      </div>
    );
  }

  const progressNode = visual?.type === 'progress' && (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden bg-band">
        <div
          className={cn('h-full bg-current transition-[width] duration-500', ACCENT_INK[accent])}
          style={{ width: `${Math.max(0, Math.min(100, visual.pct))}%` }}
        />
      </div>
      {(visual.from || visual.to) && (
        <div className="mt-1.5 flex justify-between text-label text-muted-foreground">
          <span>{visual.from}</span>
          <span>{visual.to}</span>
        </div>
      )}
    </div>
  );

  const sideVisual = visualPlacement === 'side' ? visualNode : null;
  const belowVisual = visualPlacement === 'below' ? visualNode : null;

  /* ── Body ── */
  const body = (
    <>
      {(leading || label || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {leading}
            <div className="min-w-0">
              <p className={cn('truncate font-medium text-foreground', sm ? 'text-sm' : 'text-base')} title={displayLabel}>
                {displayLabel}
                {qualifier && <span className="font-normal text-muted-foreground"> / {qualifier}</span>}
              </p>
              {sublabel && <p className="truncate text-sm text-muted-foreground">{sublabel}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className={cn('flex items-end justify-between gap-4', sm ? 'mt-3' : 'mt-4')}>
        <div className="min-w-0 flex-1">
          <div className={cn('flex flex-wrap items-baseline gap-x-2.5 gap-y-1', inlineDelta && 'items-center')}>
            <p
              className={cn(
                'font-mono font-semibold tabular-nums tracking-figure',
                unreadable ? 'text-muted-foreground' : 'text-foreground',
                sm ? 'text-2xl' : 'text-metric',
                valueClassName,
              )}
            >
              {unreadable ? '—' : displayValue}
              {unit && !unreadable && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
            </p>
            {delta && inlineDelta && <DeltaBadge delta={delta} size="sm" />}
          </div>

          {delta && !inlineDelta && <DeltaBadge delta={delta} size={sm ? 'sm' : 'md'} className="mt-2.5" />}
          {(unreadable || caption) && (
            <p className="mt-1.5 truncate text-sm text-muted-foreground">{unreadable ? 'Couldn’t be loaded' : caption}</p>
          )}
          {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
        </div>

        {secondary ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="flex items-center gap-2">
              {secondary.ring !== undefined && <StatRing pct={secondary.ring} accent={accent} size={28} />}
              <span className="text-lg font-semibold tabular-nums font-mono text-foreground">{secondary.value}</span>
            </span>
            {secondary.label && <span className="text-sm text-muted-foreground">{secondary.label}</span>}
          </div>
        ) : (
          sideVisual
        )}
      </div>

      {belowVisual && <div className="mt-3">{belowVisual}</div>}
      {progressNode}
    </>
  );

  const classes = cn(
    CARD_BASE,
    sm ? 'p-4' : 'p-5',
    interactive &&
      'transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    selected && 'border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} aria-pressed={selected} className={classes}>
        {body}
      </button>
    );
  }

  return <div className={classes}>{body}</div>;
}

// ── Skeleton ──────────────────────────────────────────────────────
export function StatCardSkeleton({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  const sm = size === 'sm';
  return (
    <div className={cn(CARD_BASE, sm ? 'p-4' : 'p-5', className)} aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className={cn('animate-pulse rounded-sm bg-band', sm ? 'size-8' : 'size-10')} />
        <div className="h-3.5 w-28 animate-pulse bg-band" />
      </div>
      <div className={cn('animate-pulse bg-band', sm ? 'mt-3 h-7 w-24' : 'mt-4 h-9 w-32')} />
      <div className="mt-3 h-3 w-20 animate-pulse bg-band" />
    </div>
  );
}

// ── Grid ──────────────────────────────────────────────────────────
const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6',
};

/** Standard responsive row for a set of StatCards. */
export function StatCardGrid({ columns = 4, className, children, ...rest }: { columns?: 2 | 3 | 4 | 6 } & ComponentProps<'section'>) {
  return (
    <section className={cn('grid gap-3', GRID_COLS[columns], className)} {...rest}>
      {children}
    </section>
  );
}

/** Inline ▲/▼ change, for use in tables and rows where a full card is too much. */
export function DeltaText({ delta, className }: { delta: StatDelta; className?: string }) {
  const { trend, tone, text } = resolveDelta(delta);
  const Glyph = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : null;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums font-mono', DELTA_TONE[tone].text, className)}>
      {Glyph && <Glyph size={13} strokeWidth={2.5} />}
      {text}
    </span>
  );
}
