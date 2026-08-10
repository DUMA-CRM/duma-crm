'use client';

import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/* ════════════════════════════════════════════════════════════════
   TraceChart — the roast profile screen, doing the business's work.

   The world's thesis in one component: a measured trace read against its
   reference. Today is plotted in measured amber; the comparison period is
   ghosted underneath in reference blue; event flags drop at the moments that
   shaped the shift; a mono readout strip carries the figure, its delta and its
   rate of change; a phase bar splits the period into its segments.

   Scrubbing is the interaction. Dragging (or arrowing) the crosshair retimes
   the readout to that point, so "what did the shop look like at 08:40?" is one
   gesture rather than a report.

   Accessibility is not an afterthought here, because a chart is where it is
   usually dropped:
     · the plot is a real focusable control with arrow / Home / End scrubbing,
       so the crosshair is not mouse-only;
     · the current point is announced through a polite live region;
     · every event flag is a list item in an offscreen description, so the
       shape of the day is available without seeing it;
     · the whole series is exposed as a data table for screen readers rather
       than being summarised away.
   ════════════════════════════════════════════════════════════════ */

export interface TracePoint {
  /** Axis label — an hour ("08:00") or a date ("Tue 12"). */
  label: string;
  value: number;
}

export interface TraceEvent {
  /** Index into the measured series where the flag is dropped. */
  at: number;
  label: string;
  /** Exact time, printed under the label. */
  time?: string;
  /** Flags that mark trouble take the exception role. */
  tone?: 'neutral' | 'exception';
}

export interface TracePhase {
  label: string;
  /** Share of the period, 0–1. Values are normalised if they do not sum to 1. */
  weight: number;
}

export interface TraceChartProps {
  /** What actually happened. */
  series: TracePoint[];
  /** What it is read against — previous period, target, par. Ghosted beneath. */
  reference?: TracePoint[];
  referenceLabel?: string;
  /** Formats a value for the readout and the table. */
  format: (value: number) => string;
  title: string;
  /** Sits above the figure in the readout head, e.g. "Net revenue". */
  readoutLabel: string;
  events?: TraceEvent[];
  phases?: TracePhase[];
  /** Rendered in the readout head — the period picker, a primary action. */
  action?: ReactNode;
  loading?: boolean;
  className?: string;
}

const VIEW_W = 1000;
const VIEW_H = 260;
const PAD_TOP = 18;
const PAD_BOTTOM = 22;

/** Catmull-Rom → cubic bezier. A roast trace is smooth; a bar chart is not. */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)},${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)},${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export function TraceChart({
  series,
  reference,
  referenceLabel = 'previous period',
  format,
  title,
  readoutLabel,
  events = [],
  phases = [],
  action,
  loading,
  className,
}: TraceChartProps) {
  const gradientId = useId();
  const tableId = useId();
  const plotRef = useRef<SVGSVGElement>(null);
  // null = "no scrub yet", which reads as the latest point. A scrub is a
  // deliberate act, so the default view is always the newest reading.
  const [cursor, setCursor] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (series.length < 2) return null;
    const all = [...series.map((p) => p.value), ...(reference?.map((p) => p.value) ?? [])];
    const min = Math.min(...all, 0);
    const max = Math.max(...all);
    const span = max - min || 1;
    const toXY = (pts: TracePoint[]) =>
      pts.map((p, i) => ({
        x: (i / (pts.length - 1 || 1)) * VIEW_W,
        y: VIEW_H - PAD_BOTTOM - ((p.value - min) / span) * (VIEW_H - PAD_TOP - PAD_BOTTOM),
      }));
    return { measured: toXY(series), ghost: reference && reference.length > 1 ? toXY(reference) : null };
  }, [series, reference]);

  const index = cursor ?? series.length - 1;
  const point = series[index];
  const ghostPoint = reference?.[index];
  // Rate of change against the previous reading: the instrument's RoR line.
  const previous = series[index - 1];
  const rate = previous && previous.value !== 0 ? ((point.value - previous.value) / Math.abs(previous.value)) * 100 : null;
  const delta = ghostPoint && ghostPoint.value !== 0 ? ((point.value - ghostPoint.value) / Math.abs(ghostPoint.value)) * 100 : null;
  const deltaTone = delta === null ? 'neutral' : delta > 0 ? 'momentum' : delta < 0 ? 'exception' : 'neutral';

  const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0) || 1;

  function moveFromPointer(event: PointerEvent<SVGSVGElement>) {
    const svg = plotRef.current;
    if (!svg || series.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setCursor(Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1)))));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (series.length < 2) return;
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (step) {
      event.preventDefault();
      setCursor(Math.max(0, Math.min(series.length - 1, index + step)));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setCursor(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setCursor(series.length - 1);
    } else if (event.key === 'Escape' && cursor !== null) {
      event.preventDefault();
      setCursor(null);
    }
  }

  if (loading) {
    return (
      <section className={cn('border border-rule bg-card', className)} aria-busy="true">
        <div className="flex items-start justify-between gap-4 border-b border-rule px-4 py-3 md:px-5">
          <div className="h-9 w-40 animate-pulse bg-band" data-motion="progress" />
          <div className="h-8 w-32 animate-pulse bg-band" data-motion="progress" />
        </div>
        <div className="h-[220px] animate-pulse bg-band/40" data-motion="progress" />
        <span className="sr-only">Loading {title}</span>
      </section>
    );
  }

  return (
    <section className={cn('border border-rule bg-card', className)} aria-labelledby={`${tableId}-title`}>
      {/* ── Readout head: the label, the figure, what it is read against ── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-rule px-4 py-3 md:px-5">
        <div className="min-w-0">
          <h2
            id={`${tableId}-title`}
            className="text-label font-semibold uppercase tracking-label text-muted-foreground"
          >
            {readoutLabel}
            {cursor !== null && <span className="ml-2 normal-case tracking-normal text-measured">at {point.label}</span>}
          </h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p data-figure className="text-3xl font-semibold leading-none text-foreground md:text-metric">
              {format(point.value)}
            </p>
            {delta !== null && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 border px-1.5 py-px text-label font-semibold uppercase tracking-label',
                  deltaTone === 'momentum' && 'border-momentum/60 bg-momentum/6 text-momentum',
                  deltaTone === 'exception' && 'border-exception/60 bg-exception/6 text-exception',
                  deltaTone === 'neutral' && 'border-rule text-muted-foreground',
                )}
              >
                <span data-figure>
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)}%
                </span>
                <span className="font-normal normal-case tracking-normal opacity-80">vs {referenceLabel}</span>
              </span>
            )}
            {rate !== null && (
              <span className="text-label uppercase tracking-label text-muted-foreground">
                rate{' '}
                <span data-figure className="text-foreground">
                  {rate > 0 ? '+' : ''}
                  {rate.toFixed(1)}%
                </span>
              </span>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* ── The plot ── */}
      {geometry ? (
        <div className="relative">
          {/* Event labels need their own row. Positioning them above the plot
              pulled them into the readout header, where large figures and
              comparison chips can wrap underneath them. This rail reserves
              real layout space while keeping each label aligned to its flag. */}
          {events.length > 0 && (
            <div className="relative hidden h-8 border-b border-rule bg-band/40 md:block" aria-hidden="true">
              <ul className="pointer-events-none absolute inset-0">
                {events.map((event) => {
                  const ratio = Math.max(0, Math.min(1, event.at / Math.max(1, series.length - 1)));
                  return (
                    <li
                      key={`label-${event.label}-${event.at}`}
                      className="absolute inset-y-0 flex items-center"
                      style={{ left: `${ratio * 100}%`, transform: `translateX(${ratio > 0.86 ? '-100%' : ratio < 0.04 ? '0' : '-50%'})` }}
                    >
                      <span
                        className={cn(
                          'block whitespace-nowrap px-2 text-micro font-semibold uppercase tracking-micro',
                          event.tone === 'exception' ? 'text-exception' : 'text-muted-foreground',
                        )}
                      >
                        {event.label}
                        {event.time && (
                          <span data-figure className="ml-1 font-normal opacity-75">
                            {event.time}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <svg
            ref={plotRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="plot-field h-[200px] w-full cursor-crosshair border-0 md:h-[240px]"
            /* Scrubbing a crosshair along a series is a slider, so it gets
               slider semantics: assistive tech announces the position and the
               reading at it, and arrow keys are the expected input rather than
               a bespoke keymap. `role="application"` would suppress reading
               mode for the whole plot to buy nothing. */
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={series.length - 1}
            aria-valuenow={index}
            aria-valuetext={`${point.label}: ${format(point.value)}`}
            aria-label={`${title}. Scrub the trace to read any point.`}
            aria-describedby={`${tableId}-events`}
            onPointerDown={moveFromPointer}
            onPointerMove={(event) => event.buttons === 1 && moveFromPointer(event)}
            onPointerLeave={() => setCursor(null)}
            onKeyDown={onKeyDown}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--measured)" stopOpacity="0.22" />
                <stop offset="1" stopColor="var(--measured)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* The reference profile, ghosted underneath — never competing. */}
            {geometry.ghost && (
              <path
                d={smoothPath(geometry.ghost)}
                fill="none"
                stroke="var(--ghost)"
                strokeWidth="2"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Event flags: a rule at the moment, its label at the head. */}
            {events.map((event) => {
              const at = geometry.measured[Math.max(0, Math.min(series.length - 1, event.at))];
              if (!at) return null;
              const stroke = event.tone === 'exception' ? 'var(--exception)' : 'var(--rule)';
              return (
                <g key={`${event.label}-${event.at}`}>
                  <line
                    x1={at.x}
                    y1={PAD_TOP - 12}
                    x2={at.x}
                    y2={VIEW_H - PAD_BOTTOM}
                    stroke={stroke}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx={at.x} cy={PAD_TOP - 12} r="2.5" fill={stroke} />
                </g>
              );
            })}

            <path d={`${smoothPath(geometry.measured)} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`} fill={`url(#${gradientId})`} />
            <path
              d={smoothPath(geometry.measured)}
              fill="none"
              stroke="var(--measured)"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* The crosshair. */}
            {geometry.measured[index] && (
              <g>
                <line
                  x1={geometry.measured[index].x}
                  y1={0}
                  x2={geometry.measured[index].x}
                  y2={VIEW_H}
                  stroke="var(--foreground)"
                  strokeWidth="1"
                  strokeOpacity="0.45"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={geometry.measured[index].x}
                  cy={geometry.measured[index].y}
                  r="3.5"
                  fill="var(--measured)"
                  stroke="var(--card)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}
          </svg>
        </div>
      ) : (
        <p className="px-4 py-14 text-center text-sm text-muted-foreground md:px-5">
          Not enough readings in this period to plot a trace yet.
        </p>
      )}

      {/* ── Phase bar: which segment of the period this is ── */}
      {phases.length > 0 && (
        <div className="flex border-t border-rule" aria-label="Period phases">
          {phases.map((phase, i) => (
            <div
              key={phase.label}
              className={cn('min-w-0 px-2 py-1.5', i > 0 && 'border-l border-rule')}
              style={{ width: `${(phase.weight / totalWeight) * 100}%` }}
            >
              <span className="block truncate text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                {phase.label}
              </span>
              <span data-figure className="text-label text-foreground">
                {Math.round((phase.weight / totalWeight) * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Announce the scrubbed reading; polite so it never interrupts a task. */}
      <p className="sr-only" aria-live="polite">
        {readoutLabel} {format(point.value)} at {point.label}
        {delta !== null && `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)} percent against ${referenceLabel}`}
      </p>

      {/* The day's shape, and the series itself, without needing to see it. */}
      <div id={`${tableId}-events`} className="sr-only">
        {events.length > 0 && (
          <>
            <p>Events in this period:</p>
            <ul>
              {events.map((event) => (
                <li key={`sr-${event.label}-${event.at}`}>
                  {event.label}
                  {event.time ? ` at ${event.time}` : ''}
                  {series[event.at] ? `, ${format(series[event.at].value)}` : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {/* `display: table` can defeat Tailwind's 1px `sr-only` box and widen a
          narrow viewport to the table's intrinsic width. Hide a wrapper
          instead so the full data table remains available to screen readers
          without changing visual layout. */}
      <div className="sr-only">
        <table>
          <caption>
            {title} — {readoutLabel} by period, against {referenceLabel}
          </caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">{readoutLabel}</th>
              {reference && <th scope="col">{referenceLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {series.map((p, i) => (
              <tr key={p.label}>
                <th scope="row">{p.label}</th>
                <td>{format(p.value)}</td>
                {reference && <td>{reference[i] ? format(reference[i].value) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
