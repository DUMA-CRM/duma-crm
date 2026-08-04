'use client';

import { type KeyboardEvent, type MouseEvent, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

const WIDTH = 760;
const HEIGHT = 224;
const MIN_LEFT = 48;
const RIGHT = 22;
const TOP = 16;
const BOTTOM = 32;

export type ReportChartTone = 'primary' | 'comparison' | 'success' | 'warning';

export interface ReportChartSeries {
  name: string;
  values: number[];
  tone?: ReportChartTone;
  dashed?: boolean;
}

const TONE = {
  primary: { ink: 'text-chart-1', dot: 'bg-chart-1', stroke: 'var(--chart-1)' },
  comparison: { ink: 'text-chart-5', dot: 'bg-chart-5', stroke: 'var(--chart-5)' },
  success: { ink: 'text-chart-2', dot: 'bg-chart-2', stroke: 'var(--chart-2)' },
  warning: { ink: 'text-chart-3', dot: 'bg-chart-3', stroke: 'var(--chart-3)' },
} as const;

function niceStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
}

function chartMaximum(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const step = niceStep(value / 3);
  return Math.max(step, Math.ceil(value / step) * step);
}

function coordinates(values: number[], count: number, max: number, width: number, left: number) {
  const innerWidth = width - left - RIGHT;
  const innerHeight = HEIGHT - TOP - BOTTOM;
  return values.map((value, index) => ({
    x: count <= 1 ? left + innerWidth / 2 : left + (index / (count - 1)) * innerWidth,
    y: TOP + (1 - value / max) * innerHeight,
  }));
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  return (
    points.reduce((path, point, index) => {
      if (index === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      const previous = points[index - 1];
      const midpoint = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
      return `${path} Q${previous.x.toFixed(1)},${previous.y.toFixed(1)} ${midpoint.x.toFixed(1)},${midpoint.y.toFixed(1)}`;
    }, '') + ` T${points.at(-1)!.x.toFixed(1)},${points.at(-1)!.y.toFixed(1)}`
  );
}

function labelIndexes(count: number) {
  if (count <= 1) return [0];
  if (count === 2) return [0, 1];
  return [0, Math.floor((count - 1) / 2), count - 1];
}

export function ReportTrendChart({
  series,
  labels,
  formatValue,
  formatAxis = formatValue,
  ariaLabel,
  insight,
  className,
}: {
  series: ReportChartSeries[];
  labels: string[];
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  ariaLabel: string;
  insight?: string;
  className?: string;
}) {
  const gradientId = useId().replaceAll(':', '');
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(WIDTH);
  const visible = series.filter((item) => item.values.length > 0);
  const count = Math.max(1, labels.length, ...visible.map((item) => item.values.length));
  const dataMax = Math.max(0, ...visible.flatMap((item) => item.values));
  const max = chartMaximum(dataMax);
  const axisPositions = [0, 1 / 3, 2 / 3, 1];
  const axisLabels = axisPositions.map((position) => formatAxis(max * (1 - position)));
  const left = Math.min(82, Math.max(MIN_LEFT, Math.max(...axisLabels.map((label) => label.length)) * 5.5 + 12));
  const [active, setActive] = useState<number | null>(null);
  const safeActive = Math.min(active ?? count - 1, count - 1);
  const plotted = visible.map((item) => ({ ...item, points: coordinates(item.values, count, max, chartWidth, left) }));
  const xAt = (index: number) =>
    left + (count <= 1 ? (chartWidth - left - RIGHT) / 2 : (index / (count - 1)) * (chartWidth - left - RIGHT));

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setChartWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const activeFromClientX = (clientX: number, rect: DOMRect) => {
    const viewX = ((clientX - rect.left) / rect.width) * chartWidth;
    const ratio = Math.max(0, Math.min(1, (viewX - left) / (chartWidth - left - RIGHT)));
    return Math.round(ratio * (count - 1));
  };
  const setFromPointer = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActive(activeFromClientX(event.clientX, rect));
  };
  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(count - 1);
    else setActive((current) => Math.max(0, Math.min(count - 1, (current ?? count - 1) + (event.key === 'ArrowLeft' ? -1 : 1))));
  };

  if (!visible.length) return <p className="py-14 text-center text-sm text-muted-foreground">No chart data in this period.</p>;

  return (
    <div
      className={cn('group/chart touch-pan-y outline-none', className)}
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Use left and right arrow keys to inspect values.`}
      onKeyDown={handleKeys}
    >
      <div className="flex min-h-10 flex-wrap items-start justify-between gap-3" aria-live="polite">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground group-focus-visible/chart:text-primary">
            {labels[safeActive] ?? 'Selected point'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {visible.map((item) => {
              const value = item.values[safeActive];
              if (value === undefined) return null;
              const tone = TONE[item.tone ?? 'primary'];
              return (
                <span key={item.name} className="inline-flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', tone.dot)} aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                  <span className={cn('text-sm font-bold tabular-nums', tone.ink)}>{formatValue(value)}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={chartRef} className="w-full">
        <svg
          viewBox={`0 0 ${chartWidth} ${HEIGHT}`}
          className="mt-1 h-48 w-full overflow-visible sm:h-52"
          role="img"
          aria-label={ariaLabel}
          onMouseMove={setFromPointer}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (!touch) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setActive(activeFromClientX(touch.clientX, rect));
          }}
        >
          <defs>
            <linearGradient id={`${gradientId}-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.2" />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {axisPositions.map((position, index) => {
            const y = TOP + position * (HEIGHT - TOP - BOTTOM);
            const value = max * (1 - position);
            return (
              <g key={position}>
                <line x1={left} x2={chartWidth - RIGHT} y1={y} y2={y} stroke="var(--border)" strokeOpacity="0.7" strokeDasharray="3 5" />
                <text x={left - 8} y={y + 3} textAnchor="end" fill="var(--muted-foreground)" fontSize="9">
                  {axisLabels[index] ?? formatAxis(value)}
                </text>
              </g>
            );
          })}

          {plotted[0]?.points.length > 1 && (
            <path
              d={`${smoothPath(plotted[0].points)} L${plotted[0].points.at(-1)!.x},${HEIGHT - BOTTOM} L${plotted[0].points[0].x},${HEIGHT - BOTTOM} Z`}
              fill={`url(#${gradientId}-area)`}
            />
          )}

          {plotted.map((item) => {
            const tone = TONE[item.tone ?? 'primary'];
            return (
              <path
                key={item.name}
                d={smoothPath(item.points)}
                fill="none"
                stroke={tone.stroke}
                strokeWidth={item.dashed ? 1.75 : 2.75}
                strokeDasharray={item.dashed ? '6 6' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          <line
            x1={xAt(safeActive)}
            x2={xAt(safeActive)}
            y1={TOP}
            y2={HEIGHT - BOTTOM}
            stroke="var(--foreground)"
            strokeOpacity="0.18"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {plotted.map((item) => {
            const point = item.points[safeActive];
            if (!point) return null;
            return (
              <circle
                key={item.name}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={TONE[item.tone ?? 'primary'].stroke}
                stroke="var(--card)"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {labelIndexes(count).map((index) => (
            <text
              key={index}
              x={xAt(index)}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
              fill="var(--muted-foreground)"
              fontSize="9"
            >
              {labels[index] ?? ''}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        {visible.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-1.5">
            <span
              className={cn('h-0.5 w-5', item.dashed ? 'border-t-2 border-dashed bg-transparent' : TONE[item.tone ?? 'primary'].dot)}
              style={item.dashed ? { borderColor: TONE[item.tone ?? 'primary'].stroke } : undefined}
              aria-hidden="true"
            />
            {item.name}
          </span>
        ))}
        {insight && <span className="sm:ml-auto">{insight}</span>}
      </div>
    </div>
  );
}
