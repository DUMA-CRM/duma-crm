'use client';

import { useRef } from 'react';

import { cn } from '@/lib/utils/cn';
import { CANVAS, CHAIR, type FloorTable, GRID, chairSpots } from '@/lib/utils/reservations';

export type TableTone = 'free' | 'soon' | 'held' | 'seated' | 'muted' | 'chosen';

const TONE_CLASS: Record<TableTone, string> = {
  free: 'fill-field stroke-rule',
  soon: 'fill-reference/12 stroke-reference',
  held: 'fill-measured/14 stroke-measured',
  seated: 'fill-momentum/16 stroke-momentum',
  muted: 'fill-band stroke-rule/70',
  chosen: 'fill-primary/15 stroke-primary',
};

/** Room round the canvas for chairs on a table pushed to the edge. */
const MARGIN = CHAIR.gap + CHAIR.depth + 4;

/**
 * A location's floor, drawn in the floor plan's own units (CANVAS) and scaled
 * to fit. Shared by the live floor and the editor: the live floor colours each
 * table by what it's doing; the editor lets tables be dragged (or nudged with
 * the arrow keys, a grid step at a time) and reports where they land. With
 * `showChairs`, each table's chairs (one per seat at most) are drawn round it
 * and turn with it.
 */
export function FloorCanvas({
  tables,
  toneFor,
  captionFor,
  selectedId,
  selectedIds,
  onSelect,
  onMove,
  showChairs = false,
  ariaLabel,
  className,
}: {
  tables: readonly FloorTable[];
  showChairs?: boolean;
  toneFor?: (table: FloorTable) => TableTone;
  /** A second line under the label — a guest's name, the covers. */
  captionFor?: (table: FloorTable) => string | null;
  selectedId?: string | null;
  /** More than one chosen at once — tables put together for a party. */
  selectedIds?: readonly string[];
  onSelect?: (id: string | null) => void;
  /** Editing: where a dragged or nudged table now sits (unsnapped; the caller places it). */
  onMove?: (id: string, x: number, y: number) => void;
  ariaLabel: string;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; pointerId: number } | null>(null);

  const toCanvas = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`${-MARGIN} ${-MARGIN} ${CANVAS.width + MARGIN * 2} ${CANVAS.height + MARGIN * 2}`}
      className={cn('block h-auto w-full touch-none select-none rounded-lg border border-rule/60 bg-field', className)}
      role="group"
      aria-label={ariaLabel}
      onPointerDown={(event) => {
        if (event.target === svgRef.current) onSelect?.(null);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId || !onMove) return;
        const point = toCanvas(event.clientX, event.clientY);
        onMove(current.id, point.x - current.dx, point.y - current.dy);
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      {onMove && (
        <>
          <defs>
            <pattern id="floor-grid" width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID * 4} 0 L 0 0 0 ${GRID * 4}`} className="fill-none stroke-rule/40" strokeWidth={1} />
            </pattern>
          </defs>
          <rect width={CANVAS.width} height={CANVAS.height} fill="url(#floor-grid)" pointerEvents="none" />
        </>
      )}
      {tables.map((table) => {
        const tone = toneFor?.(table) ?? 'free';
        const caption = captionFor?.(table) ?? null;
        const selected = table.id === selectedId || Boolean(selectedIds?.includes(table.id));
        const cx = table.x + table.width / 2;
        const cy = table.y + table.height / 2;
        return (
          <g
            key={table.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`Table ${table.label}, seats ${table.minCovers === table.maxCovers ? table.maxCovers : `${table.minCovers} to ${table.maxCovers}`}${caption ? `, ${caption}` : ''}`}
            className={cn('cursor-pointer outline-none', onMove && 'cursor-grab active:cursor-grabbing')}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect?.(table.id);
              if (!onMove) return;
              const point = toCanvas(event.clientX, event.clientY);
              drag.current = { id: table.id, dx: point.x - table.x, dy: point.y - table.y, pointerId: event.pointerId };
              svgRef.current?.setPointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.(table.id);
                return;
              }
              const step = event.shiftKey ? GRID * 4 : GRID;
              const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
              if (!delta || !onMove) return;
              event.preventDefault();
              onMove(table.id, table.x + delta[0]!, table.y + delta[1]!);
            }}
          >
            <g transform={table.rotation ? `rotate(${table.rotation} ${cx} ${cy})` : undefined}>
              {showChairs &&
                chairSpots(table, table.maxCovers).map((chair, index) => (
                  <rect
                    key={index}
                    x={-CHAIR.width / 2}
                    y={-CHAIR.depth / 2}
                    width={CHAIR.width}
                    height={CHAIR.depth}
                    rx={4}
                    transform={`translate(${chair.x} ${chair.y}) rotate(${chair.angle})`}
                    className={cn(TONE_CLASS[tone], 'opacity-80')}
                    strokeWidth={1.5}
                  />
                ))}
              {table.shape === 'round' ? (
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={table.width / 2}
                  ry={table.height / 2}
                  className={cn(TONE_CLASS[tone], selected && 'stroke-primary')}
                  strokeWidth={selected ? 4 : 2}
                />
              ) : (
                <rect
                  x={table.x}
                  y={table.y}
                  width={table.width}
                  height={table.height}
                  rx={10}
                  className={cn(TONE_CLASS[tone], selected && 'stroke-primary')}
                  strokeWidth={selected ? 4 : 2}
                />
              )}
            </g>
            <text
              x={cx}
              y={caption ? cy - 4 : cy + 6}
              textAnchor="middle"
              className="fill-foreground text-[18px] font-semibold"
              pointerEvents="none"
            >
              {table.label}
            </text>
            {caption && (
              <text x={cx} y={cy + 16} textAnchor="middle" className="fill-muted-foreground text-[13px]" pointerEvents="none">
                {caption.length > 14 ? `${caption.slice(0, 13)}…` : caption}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const TABLE_TONE_LEGEND: { tone: TableTone; label: string }[] = [
  { tone: 'free', label: 'Free' },
  { tone: 'soon', label: 'Booked within the hour' },
  { tone: 'held', label: 'Due, not seated' },
  { tone: 'seated', label: 'Seated' },
];

/** The legend swatch, in the same fills as the canvas. */
export function ToneSwatch({ tone }: { tone: TableTone }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden="true">
      <rect x={1} y={1} width={10} height={10} rx={3} className={TONE_CLASS[tone]} strokeWidth={1.5} />
    </svg>
  );
}
