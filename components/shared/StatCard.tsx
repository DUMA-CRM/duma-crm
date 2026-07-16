'use client';

import {
  CalendarDays,
  Coffee,
  Receipt,
  Repeat,
  ShoppingBag,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

// ── Icon name → component map (resolved client-side) ─────────────
const ICON_MAP = {
  Wallet,
  ShoppingBag,
  Tag,
  UserPlus,
  Star,
  CalendarDays,
  Repeat,
  Receipt,
  Users,
  Coffee,
} as const;

export type IconName = keyof typeof ICON_MAP;

// ── Icon variant ──────────────────────────────────────────────────
type IconVariant = 'primary' | 'gold' | 'success' | 'info';

const ICON_CLASS: Record<IconVariant, string> = {
  primary: 'bg-primary/10 text-primary',
  gold: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
  info: 'bg-info/10 text-info',
};

// ── Footer variants ───────────────────────────────────────────────
export type StatCardFooter =
  | { type: 'sparkline'; points: number[]; labels?: string[]; titleLabels?: string[] }
  | { type: 'bars'; values: number[]; labels?: string[]; titleLabels?: string[] }
  | { type: 'progress'; pct: number; from: string; to: string }
  | { type: 'ring'; pct: number; sub: string };

// ── Props ─────────────────────────────────────────────────────────
export interface StatCardProps {
  label: string;
  value: string;
  /** Small unit suffix rendered after the value, e.g. "/ month" or "pts". */
  unit?: string;
  icon?: IconName;
  iconVariant?: IconVariant;
  /** Badge text next to the label. */
  delta?: string;
  deltaDirection?: 'up' | 'down';
  footer?: StatCardFooter;
  className?: string;
}

// ── Sparkline path helper ─────────────────────────────────────────
const W = 200;
const H = 40;

function sparkCoords(points: number[]) {
  if (points.length < 2) return [];
  const min = Math.min(...points);
  const range = Math.max(...points) - min || 1;
  return points.map((p, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - ((p - min) / range) * (H - 6) - 3,
  }));
}

function sparkPaths(points: number[]) {
  const coords = sparkCoords(points);
  if (!coords.length) return { line: '', area: '', coords: [] };
  const line = coords.map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return { line, area: `${line} L${W},${H} L0,${H} Z`, coords };
}

// ── Ring constants ────────────────────────────────────────────────
const RING_R = 18;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 113.1

// ── Component ─────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  unit,
  icon: iconName,
  iconVariant = 'primary',
  delta,
  deltaDirection,
  footer,
  className,
}: StatCardProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredSpark, setHoveredSpark] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const Icon = iconName ? ICON_MAP[iconName] : null;
  const isRing = footer?.type === 'ring';

  const displayValue =
    footer?.type === 'sparkline' && hoveredSpark !== null
      ? (footer.labels?.[hoveredSpark] ?? String(footer.points[hoveredSpark]))
      : footer?.type === 'bars' && hoveredBar !== null
      ? (footer.labels?.[hoveredBar] ?? String(footer.values[hoveredBar]))
      : value;

  const displayLabel =
    footer?.type === 'sparkline' && hoveredSpark !== null && footer.titleLabels
      ? footer.titleLabels[hoveredSpark]
      : footer?.type === 'bars' && hoveredBar !== null && footer.titleLabels
      ? footer.titleLabels[hoveredBar]
      : label;

  function handleSparkMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const pts = (footer as { type: 'sparkline'; points: number[] }).points;
    const idx = Math.max(0, Math.min(pts.length - 1, Math.round(xPct * (pts.length - 1))));
    setHoveredSpark(idx);
  }

  return (
    <div
      className={cn(
        'flex-1 bg-card border border-border rounded-2xl p-4 flex flex-col gap-3',
        // In 2-col phone grids a badge crowds the label, so badged cards take the full row.
        delta && 'max-sm:col-span-2',
        className,
      )}
    >
      {/* ── Header: icon + label | delta badge ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0', ICON_CLASS[iconVariant])}>
              <Icon size={16} strokeWidth={2} />
            </span>
          )}
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none truncate" title={displayLabel}>
            {displayLabel}
          </p>
        </div>

        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0',
              deltaDirection === 'up' && 'bg-success/15 text-success',
              deltaDirection === 'down' && 'bg-destructive/10 text-destructive',
              !deltaDirection && 'bg-muted text-muted-foreground',
            )}
          >
            {deltaDirection === 'up' && <TrendingUp size={11} strokeWidth={2.5} />}
            {deltaDirection === 'down' && <TrendingDown size={11} strokeWidth={2.5} />}
            {delta}
          </span>
        )}
      </div>

      {/* ── Value ── */}
      {!isRing && (
        <p className="text-3xl font-bold text-foreground tabular-nums leading-tight tracking-tight transition-opacity duration-100">
          {displayValue}
          {unit && <span className="text-sm font-semibold text-muted-foreground ml-1">{unit}</span>}
        </p>
      )}

      {/* ── Sparkline ── */}
      {footer?.type === 'sparkline' &&
        (() => {
          const { line, area, coords } = sparkPaths(footer.points);
          const gradId = `spark-${label.replace(/[^a-zA-Z0-9]/g, '-')}`;
          const hov = hoveredSpark !== null ? coords[hoveredSpark] : null;
          return (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-10 text-primary cursor-crosshair"
              preserveAspectRatio="none"
              aria-hidden="true"
              onMouseMove={handleSparkMove}
              onMouseLeave={() => setHoveredSpark(null)}
            >
              <defs>
                <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#${gradId})`} />
              <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {hov && (
                <>
                  <line
                    x1={hov.x} y1={0} x2={hov.x} y2={H}
                    stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.4"
                  />
                  <circle cx={hov.x} cy={hov.y} r="3" fill="currentColor" />
                </>
              )}
            </svg>
          );
        })()}

      {/* ── Mini bars ── */}
      {footer?.type === 'bars' &&
        (() => {
          const max = Math.max(...footer.values);
          return (
            <div className="flex items-end gap-0.75 h-10">
              {footer.values.map((v, i) => {
                const isActive = hoveredBar === i;
                const isDefault = hoveredBar === null && i === footer.values.length - 1;
                return (
                  <div
                    key={i}
                    style={{ height: `${(v / max) * 100}%` }}
                    className={cn(
                      'flex-1 rounded-sm transition-colors duration-100 cursor-default',
                      isActive || isDefault ? 'bg-info' : 'bg-surface-offset',
                    )}
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                );
              })}
            </div>
          );
        })()}

      {/* ── Progress bar ── */}
      {footer?.type === 'progress' && (
        <div>
          <div className="h-1.5 rounded-full bg-surface-offset overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-warning to-amber-300 transition-[width] duration-500"
              style={{ width: `${footer.pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{footer.from}</span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{footer.to}</span>
          </div>
        </div>
      )}

      {/* ── Ring ── */}
      {footer?.type === 'ring' && (
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 44 44" className="w-14 h-14 shrink-0 -rotate-90" aria-hidden="true">
            <circle cx="22" cy="22" r={RING_R} fill="none" style={{ stroke: 'var(--color-surface-offset)' }} strokeWidth="5.5" />
            <circle
              cx="22"
              cy="22"
              r={RING_R}
              fill="none"
              style={{ stroke: 'var(--color-success)' }}
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={RING_CIRC * (1 - footer.pct / 100)}
            />
          </svg>
          <div>
            <p className="text-3xl font-bold text-foreground tabular-nums leading-tight tracking-tight">
              {value}
              {unit && <span className="text-sm font-semibold text-muted-foreground ml-1">{unit}</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{footer.sub}</p>
          </div>
        </div>
      )}
    </div>
  );
}
