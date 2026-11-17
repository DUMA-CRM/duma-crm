'use client';

import { type KeyboardEvent, type PointerEvent, useId, useRef } from 'react';

import { cn } from '@/lib/utils/cn';
import { chairRects, seatAt } from '@/lib/utils/floor-chairs';
import { type Box, FIXTURE_NAMES, type Handle, resizeBox } from '@/lib/utils/floor-fixtures';
import type { FloorState } from '@/lib/utils/floor-status';
import { CANVAS, CHAIR, type FloorFixture, type FloorSeat, type FloorTable, GRID } from '@/lib/utils/reservations';

import { FixtureShape } from './FixtureShape';

/** The seat modal's colouring (WaitlistPanel): which tables can be chosen. */
export type TableTone = 'free' | 'soon' | 'held' | 'seated' | 'muted' | 'chosen';

const TONE_CLASS: Record<TableTone, string> = {
  free: 'fill-card stroke-edge',
  soon: 'fill-reference/10 stroke-reference/70',
  held: 'fill-measured/12 stroke-measured/70',
  seated: 'fill-momentum/14 stroke-momentum/70',
  muted: 'fill-band stroke-border',
  chosen: 'fill-primary/15 stroke-primary',
};

/** How the live floor draws a table: its state, a second line, the party's covers as dots, the stay used, a "?". */
export interface TableFace {
  state: FloorState;
  caption?: string | null;
  covers?: number;
  progress?: number | null;
  attention?: boolean;
}

/*
 * The live floor in DUMA's own palette: a free table is porcelain on a soft
 * edge, a party due is a periwinkle (reference) outline over a faint wash,
 * seated is the brand's solid fill, and over time is saffron — the warning
 * colour. Chairs are a quiet band tint in every state, so tables stay the
 * subject; only a seated party's chairs pick up a little of the brand.
 */
const FACE_CLASS: Record<FloorState, { table: string; chair: string; label: string; caption: string; dot: string }> = {
  free: {
    table: 'fill-card stroke-edge',
    chair: 'fill-band stroke-edge',
    label: 'fill-heading',
    caption: 'fill-muted-foreground',
    dot: 'fill-muted-foreground',
  },
  upcoming: {
    table: 'fill-reference/8 stroke-reference/70',
    chair: 'fill-band stroke-reference/45',
    label: 'fill-heading',
    caption: 'fill-reference',
    dot: 'fill-reference',
  },
  seated: {
    table: 'stroke-transparent',
    chair: 'fill-primary/15 stroke-primary/45',
    label: 'fill-primary-foreground',
    caption: 'fill-primary-foreground/85',
    dot: 'fill-primary-foreground',
  },
  overdue: {
    table: 'fill-warning/14 stroke-warning',
    chair: 'fill-warning/12 stroke-warning/55',
    label: 'fill-heading',
    caption: 'fill-warning',
    dot: 'fill-warning',
  },
};
/** The brand's solid fill — navy under the ocean night theme, where the text-weight slate would be too pale. */
const SEATED_FILL = { fill: 'var(--brand-fill, var(--primary))' };

export type CanvasTarget = { type: 'table' | 'fixture'; id: string };
export type CanvasKeyAction = 'delete' | 'turn-right' | 'turn-left';

/** Editing the chairs placed by hand round one table: which is chosen, and what's done to them. */
export interface ChairEditing {
  tableId: string;
  selected: number | null;
  onSelect: (index: number | null) => void;
  /** Dragged to a new spot, in the table's own frame (snapped; see `seatAt`). */
  onMove: (index: number, seat: Pick<FloorSeat, 'x' | 'y'>) => void;
  onKeyAction: (index: number, action: CanvasKeyAction) => void;
}

/** Room round the canvas for chairs on a table pushed to the edge. */
const MARGIN = CHAIR.gap + CHAIR.depth + 4;
const HANDLE_HIT = 22;
/** A chair is small; its target isn't (32 across at least, for a finger). */
const CHAIR_HIT = 17;

const boxOf = (item: Box): Box => ({ x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation });

/** The corners of a turned box, for fitting the view round what's drawn. */
function extent(box: Box, pad: number) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const halfW = (box.width * cos + box.height * sin) / 2 + pad;
  const halfH = (box.width * sin + box.height * cos) / 2 + pad;
  return { minX: cx - halfW, minY: cy - halfH, maxX: cx + halfW, maxY: cy + halfH };
}

function contentViewBox(tables: readonly FloorTable[], fixtures: readonly FloorFixture[], showChairs: boolean): FloorViewBox | null {
  // Chairs placed by hand may sit further out than the margin allows for.
  const placed = showChairs
    ? tables
        .filter((table) => table.chairs?.mode === 'custom')
        .flatMap((table) => chairRects(table).map((chair) => extent({ x: chair.cx, y: chair.cy, width: 0, height: 0, rotation: 0 }, 14)))
    : [];
  const boxes = [...tables.map((table) => extent(table, MARGIN)), ...fixtures.map((fixture) => extent(fixture, 12)), ...placed];
  if (boxes.length === 0) return null;
  const pad = 24;
  let minX = Math.min(...boxes.map((box) => box.minX)) - pad;
  let maxX = Math.max(...boxes.map((box) => box.maxX)) + pad;
  const minY = Math.min(...boxes.map((box) => box.minY)) - pad;
  const maxY = Math.max(...boxes.map((box) => box.maxY)) + pad;
  // Never zoomed so far in that one table fills the screen.
  const minWidth = 480;
  if (maxX - minX < minWidth) {
    const grow = (minWidth - (maxX - minX)) / 2;
    minX -= grow;
    maxX += grow;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export interface FloorViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The part of the floor plan the canvas shows, in plan units: the whole canvas
 * (and a margin for chairs), or — `fit="content"` — just what's drawn on it.
 * Exported so a caller can pin something over a table (the live floor's
 * free-table sheet) by where the table sits in this box.
 */
export function floorViewBox(
  tables: readonly FloorTable[],
  fixtures: readonly FloorFixture[],
  showChairs: boolean,
  fit: 'canvas' | 'content',
): FloorViewBox {
  return (
    (fit === 'content' && contentViewBox(tables, fixtures, showChairs)) || {
      x: -MARGIN,
      y: -MARGIN,
      width: CANVAS.width + MARGIN * 2,
      height: CANVAS.height + MARGIN * 2,
    }
  );
}

/**
 * A location's floor, drawn in the floor plan's own units (CANVAS) and scaled
 * to the width it's given. Shared by the live floor, the editor and the
 * waitlist's seat modal:
 * - the live floor passes `faceFor` (state, time, covers, stay used, "?") and
 *   `fit="content"`, which frames what's drawn rather than the whole canvas;
 * - the seat modal passes `toneFor` / `captionFor`;
 * - the editor passes `onMove` (and the fixture and resize handlers): tables
 *   and fixtures drag, resize from their handles, nudge with the arrow keys a
 *   grid step at a time (Shift for four), turn with R, and go with Delete.
 * Chairs come from `chairRects`: the table's own layout, or one per seat.
 * With `chairEditing`, the chairs placed by hand round that table drag, and
 * a chosen one turns with R and goes with Delete.
 */
export function FloorCanvas({
  tables,
  fixtures = [],
  toneFor,
  captionFor,
  faceFor,
  joins = [],
  selectedId,
  selectedIds,
  onSelect,
  onMove,
  selectedFixtureId,
  onSelectFixture,
  onMoveFixture,
  onResize,
  onKeyAction,
  chairEditing,
  showChairs = false,
  fit = 'canvas',
  ariaLabel,
  className,
}: {
  tables: readonly FloorTable[];
  /** Windows, the entrance, the bar… drawn under the tables. */
  fixtures?: readonly FloorFixture[];
  showChairs?: boolean;
  toneFor?: (table: FloorTable) => TableTone;
  /** A second line under the label — a guest's name, the covers. */
  captionFor?: (table: FloorTable) => string | null;
  /** The live floor's drawing of a table; wins over `toneFor` / `captionFor`. */
  faceFor?: (table: FloorTable) => TableFace;
  /** Tables put together for one party, drawn joined. */
  joins?: readonly { from: string; to: string; state: FloorState }[];
  selectedId?: string | null;
  /** More than one chosen at once — tables put together for a party. */
  selectedIds?: readonly string[];
  onSelect?: (id: string | null) => void;
  /** Editing: where a dragged or nudged table now sits (unsnapped; the caller places it). */
  onMove?: (id: string, x: number, y: number) => void;
  selectedFixtureId?: string | null;
  onSelectFixture?: (id: string | null) => void;
  /** Editing: where a dragged or nudged fixture now sits (unsnapped; the caller places it). */
  onMoveFixture?: (id: string, x: number, y: number) => void;
  /** Editing: a handle dragged — the new box, snapped and kept on the canvas. */
  onResize?: (target: CanvasTarget, box: Box) => void;
  /** Editing: Delete, or R to turn (Shift+R back). */
  onKeyAction?: (target: CanvasTarget, action: CanvasKeyAction) => void;
  /** Editing: one table's chairs placed by hand, drawn on top and draggable. */
  chairEditing?: ChairEditing | null;
  /** `canvas` shows the whole floor plan; `content` frames what's on it. */
  fit?: 'canvas' | 'content';
  ariaLabel: string;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    target: CanvasTarget;
    /** A number: the index of a chair placed by hand being dragged. */
    mode: 'move' | Handle | number;
    start: Box;
    origin: { x: number; y: number };
    pointerId: number;
    /** Past the jitter of a tap: until then nothing moves, so a tap never snaps an off-grid item. */
    moving: boolean;
  } | null>(null);
  const gridId = `floor-grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const editing = Boolean(onMove || onMoveFixture);

  const toCanvas = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  const find = (target: CanvasTarget): Box | undefined =>
    target.type === 'table' ? tables.find((table) => table.id === target.id) : fixtures.find((fixture) => fixture.id === target.id);
  const moveTo = (target: CanvasTarget, x: number, y: number) =>
    target.type === 'table' ? onMove?.(target.id, x, y) : onMoveFixture?.(target.id, x, y);
  const select = (target: CanvasTarget | null) => {
    if (!target || target.type === 'table') onSelectFixture?.(null);
    if (!target || target.type === 'fixture') onSelect?.(null);
    if (target?.type === 'table') onSelect?.(target.id);
    if (target?.type === 'fixture') onSelectFixture?.(target.id);
  };

  const begin = (event: PointerEvent, target: CanvasTarget, mode: 'move' | Handle) => {
    event.stopPropagation();
    if (mode === 'move') select(target);
    const item = find(target);
    if (!editing || !item) return;
    drag.current = {
      target,
      mode,
      start: boxOf(item),
      origin: toCanvas(event.clientX, event.clientY),
      pointerId: event.pointerId,
      moving: false,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  /** Pick up a chair placed by hand; `start` holds its centre on the canvas. */
  const beginChair = (event: PointerEvent<SVGGElement>, table: FloorTable, index: number, at: { x: number; y: number }) => {
    event.stopPropagation();
    event.currentTarget.focus();
    chairEditing?.onSelect(index);
    drag.current = {
      target: { type: 'table', id: table.id },
      mode: index,
      start: { x: at.x, y: at.y, width: 0, height: 0, rotation: 0 },
      origin: toCanvas(event.clientX, event.clientY),
      pointerId: event.pointerId,
      moving: false,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const chairKeyDown = (event: KeyboardEvent, index: number) => {
    if (!chairEditing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      chairEditing.onKeyAction(index, 'delete');
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      chairEditing.onKeyAction(index, event.shiftKey ? 'turn-left' : 'turn-right');
    } else if (event.key === 'Escape') {
      chairEditing.onSelect(null);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chairEditing.onSelect(index);
    }
  };

  const keyDown = (event: KeyboardEvent, target: CanvasTarget) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(target);
      return;
    }
    if (event.key === 'Escape') {
      select(null);
      return;
    }
    // ⌘/Ctrl shortcuts (copy, paste, reload…) aren't the canvas's.
    if (!editing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onKeyAction?.(target, 'delete');
      return;
    }
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      onKeyAction?.(target, event.shiftKey ? 'turn-left' : 'turn-right');
      return;
    }
    const step = event.shiftKey ? GRID * 4 : GRID;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    const item = find(target);
    if (!delta || !item) return;
    event.preventDefault();
    moveTo(target, item.x + delta[0]!, item.y + delta[1]!);
  };

  /** The four edge handles of a selected item, in its own turned frame. */
  const handles = (target: CanvasTarget, box: Box) => {
    if (!onResize) return null;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const spots: { handle: Handle; x: number; y: number; show: boolean }[] = [
      { handle: 'n', x: cx, y: box.y, show: box.height >= 24 },
      { handle: 's', x: cx, y: box.y + box.height, show: box.height >= 24 },
      { handle: 'w', x: box.x, y: cy, show: box.width >= 24 },
      { handle: 'e', x: box.x + box.width, y: cy, show: box.width >= 24 },
    ];
    return spots
      .filter((spot) => spot.show)
      .map((spot) => (
        <g
          key={spot.handle}
          className={spot.handle === 'n' || spot.handle === 's' ? 'cursor-ns-resize' : 'cursor-ew-resize'}
          onPointerDown={(event) => begin(event, target, spot.handle)}
        >
          <circle cx={spot.x} cy={spot.y} r={HANDLE_HIT} className="fill-transparent" />
          <circle cx={spot.x} cy={spot.y} r={7} className="fill-card stroke-primary" strokeWidth={2.5} />
        </g>
      ));
  };

  // The table whose chairs placed by hand are being edited: drawn above every table, so they catch the pointer.
  const editedChairs =
    editing && chairEditing ? (tables.find((table) => table.id === chairEditing.tableId && table.chairs?.mode === 'custom') ?? null) : null;

  const box = floorViewBox(tables, fixtures, showChairs, fit);
  const viewBox = `${box.x} ${box.y} ${box.width} ${box.height}`;
  const centre = (id: string) => {
    const table = tables.find((candidate) => candidate.id === id);
    return table ? { x: table.x + table.width / 2, y: table.y + table.height / 2 } : null;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className={cn('block h-auto w-full touch-none select-none rounded-lg border border-border bg-card', className)}
      role="group"
      aria-label={ariaLabel}
      onPointerDown={(event) => {
        if (event.target === svgRef.current || (event.target as Element).getAttribute('data-floor') === 'ground') select(null);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const point = toCanvas(event.clientX, event.clientY);
        const dx = point.x - current.origin.x;
        const dy = point.y - current.origin.y;
        if (!current.moving && Math.hypot(dx, dy) < 4) return;
        current.moving = true;
        if (typeof current.mode === 'number') {
          const table = tables.find((candidate) => candidate.id === current.target.id);
          if (table) chairEditing?.onMove(current.mode, seatAt(table, current.start.x + dx, current.start.y + dy));
        } else if (current.mode === 'move') moveTo(current.target, current.start.x + dx, current.start.y + dy);
        else
          onResize?.(
            current.target,
            current.target.type === 'table'
              ? resizeBox(current.start, current.mode, dx, dy, 20, 600)
              : resizeBox(current.start, current.mode, dx, dy),
          );
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      {editing && (
        <>
          <defs>
            <pattern id={gridId} width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID * 4} 0 L 0 0 0 ${GRID * 4}`} className="fill-none stroke-rule/30" strokeWidth={1} />
            </pattern>
          </defs>
          <rect data-floor="ground" width={CANVAS.width} height={CANVAS.height} fill={`url(#${gridId})`} />
        </>
      )}

      {fixtures.map((fixture) => {
        const target: CanvasTarget = { type: 'fixture', id: fixture.id };
        const selected = editing && fixture.id === selectedFixtureId;
        if (!editing) {
          return (
            <g key={fixture.id} pointerEvents="none" aria-hidden="true">
              <FixtureShape fixture={fixture} />
            </g>
          );
        }
        const cx = fixture.x + fixture.width / 2;
        const cy = fixture.y + fixture.height / 2;
        const hit = Math.max(fixture.height, 40);
        return (
          <g
            key={fixture.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${FIXTURE_NAMES[fixture.kind]}${fixture.label ? `, ${fixture.label}` : ''}`}
            className="cursor-grab outline-none active:cursor-grabbing"
            onPointerDown={(event) => begin(event, target, 'move')}
            onKeyDown={(event) => keyDown(event, target)}
          >
            <FixtureShape fixture={fixture} selected={selected} />
            <g transform={fixture.rotation ? `rotate(${fixture.rotation} ${cx} ${cy})` : undefined}>
              {/* A thin window or door is easier to catch than it looks. */}
              <rect x={fixture.x} y={cy - hit / 2} width={fixture.width} height={hit} className="fill-transparent" />
              {selected && handles(target, fixture)}
            </g>
          </g>
        );
      })}

      {joins.map((join) => {
        const from = centre(join.from);
        const to = centre(join.to);
        if (!from || !to) return null;
        return (
          <line
            key={`${join.from}-${join.to}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            pointerEvents="none"
            className={cn(
              join.state === 'seated' ? 'stroke-primary/25' : join.state === 'overdue' ? 'stroke-warning/25' : 'stroke-reference/20',
            )}
            strokeWidth={18}
            strokeLinecap="round"
          />
        );
      })}

      {tables.map((table) => {
        const target: CanvasTarget = { type: 'table', id: table.id };
        const face = faceFor?.(table);
        const tone = toneFor?.(table) ?? 'free';
        const look = face ? FACE_CLASS[face.state] : null;
        // A small table (a bar seat) shows only its label; its state is in its colour, the rest in the host panel.
        const compact = Math.min(table.width, table.height) < 56;
        const caption = compact ? null : face ? (face.caption ?? null) : (captionFor?.(table) ?? null);
        const selected = table.id === selectedId || Boolean(selectedIds?.includes(table.id));
        const cx = table.x + table.width / 2;
        const cy = table.y + table.height / 2;
        const fill = face?.state === 'seated' ? SEATED_FILL : undefined;
        const covers = !compact && face?.state === 'upcoming' ? Math.min(12, face.covers ?? 0) : 0;
        const progress = !compact && face && (face.state === 'seated' || face.state === 'overdue') ? (face.progress ?? null) : null;
        const extra = covers > 0 || progress !== null;
        const labelY = compact ? cy + 4.5 : caption ? (extra ? cy - 11 : cy - 4) : extra ? cy - 2 : cy + 8;
        const barWidth = Math.min(table.width, table.height) * 0.6;
        return (
          <g
            key={table.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`Table ${table.label}, seats ${table.minCovers === table.maxCovers ? table.maxCovers : `${table.minCovers} to ${table.maxCovers}`}${caption ? `, ${caption}` : ''}${face?.attention ? ', needs a look' : ''}`}
            className={cn(
              'cursor-pointer outline-none focus-visible:[&>g>.table-top]:stroke-ring',
              editing && 'cursor-grab active:cursor-grabbing',
            )}
            onPointerDown={(event) => begin(event, target, 'move')}
            onKeyDown={(event) => keyDown(event, target)}
          >
            {showChairs &&
              table.id !== editedChairs?.id &&
              chairRects(table).map((chair, index) => (
                <ChairShape
                  key={index}
                  chair={chair}
                  className={selected ? 'fill-primary/30 stroke-primary' : look ? look.chair : cn(TONE_CLASS[tone], 'opacity-80')}
                />
              ))}
            <g transform={table.rotation ? `rotate(${table.rotation} ${cx} ${cy})` : undefined}>
              {table.shape === 'round' ? (
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={table.width / 2}
                  ry={table.height / 2}
                  className={cn(
                    'table-top',
                    look ? look.table : TONE_CLASS[tone],
                    selected && 'stroke-primary',
                    selected && face?.state !== 'seated' && 'fill-primary/10',
                  )}
                  style={fill}
                  strokeWidth={selected ? 2.5 : 1.5}
                />
              ) : (
                <rect
                  x={table.x}
                  y={table.y}
                  width={table.width}
                  height={table.height}
                  rx={8}
                  className={cn(
                    'table-top',
                    look ? look.table : TONE_CLASS[tone],
                    selected && 'stroke-primary',
                    selected && face?.state !== 'seated' && 'fill-primary/10',
                  )}
                  style={fill}
                  strokeWidth={selected ? 2.5 : 1.5}
                />
              )}
              {selected && editing && handles(target, table)}
            </g>
            <g pointerEvents="none">
              <text
                x={cx}
                y={labelY}
                textAnchor="middle"
                className={cn(
                  compact ? 'text-[13px]' : 'text-[22px]',
                  'font-semibold tracking-tight',
                  look ? look.label : 'fill-foreground',
                )}
              >
                {table.label}
              </text>
              {caption && (
                <text
                  x={cx}
                  y={labelY + 19}
                  textAnchor="middle"
                  className={cn('text-[15px] font-semibold tabular-nums', look ? look.caption : 'fill-muted-foreground')}
                >
                  {caption.length > 11 ? `${caption.slice(0, 10)}…` : caption}
                </text>
              )}
              {covers > 0 &&
                Array.from({ length: covers }, (_, index) => (
                  <circle
                    key={index}
                    cx={cx + (index - (covers - 1) / 2) * Math.min(9, (table.width - 16) / covers)}
                    cy={labelY + (caption ? 33 : 18)}
                    r={3}
                    className={look?.dot}
                  />
                ))}
              {progress !== null && (
                <>
                  <rect
                    x={cx - barWidth / 2}
                    y={labelY + (caption ? 29 : 14)}
                    width={barWidth}
                    height={4}
                    rx={2}
                    className={face?.state === 'overdue' ? 'fill-warning/25' : 'fill-primary-foreground/30'}
                  />
                  <rect
                    x={cx - barWidth / 2}
                    y={labelY + (caption ? 29 : 14)}
                    width={barWidth * Math.min(1, Math.max(0, progress))}
                    height={4}
                    rx={2}
                    className={face?.state === 'overdue' ? 'fill-warning' : 'fill-primary-foreground'}
                  />
                </>
              )}
              {face?.attention && (
                <>
                  <circle
                    cx={cx + table.width / 2 - 2}
                    cy={cy - table.height / 2 + 2}
                    r={11}
                    className="fill-measured stroke-card"
                    strokeWidth={2.5}
                  />
                  <text
                    x={cx + table.width / 2 - 2}
                    y={cy - table.height / 2 + 7}
                    textAnchor="middle"
                    className="fill-card text-[14px] font-bold"
                  >
                    ?
                  </text>
                </>
              )}
            </g>
          </g>
        );
      })}

      {editedChairs && chairEditing && (
        <g aria-label={`Table ${editedChairs.label}: chairs`} role="group">
          {chairRects(editedChairs).map((chair, index) => {
            const chosen = index === chairEditing.selected;
            return (
              <g
                key={index}
                role="button"
                tabIndex={0}
                aria-pressed={chosen}
                aria-label={`Chair ${index + 1}, facing ${Math.round(chair.angle)}°`}
                className="cursor-grab outline-none active:cursor-grabbing focus-visible:[&>.chair]:stroke-ring"
                onPointerDown={(event) => beginChair(event, editedChairs, index, { x: chair.cx, y: chair.cy })}
                onKeyDown={(event) => chairKeyDown(event, index)}
              >
                <circle cx={chair.cx} cy={chair.cy} r={CHAIR_HIT} className="fill-transparent" />
                <ChairShape
                  chair={chair}
                  className={cn('chair', chosen ? 'fill-primary/25 stroke-primary' : 'fill-card stroke-primary/60')}
                  strokeWidth={chosen ? 2 : 1.25}
                />
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

/** The legend swatch, in the same fills as the canvas. */
export function ToneSwatch({ tone }: { tone: TableTone }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden="true">
      <rect x={1} y={1} width={10} height={10} rx={3} className={TONE_CLASS[tone]} strokeWidth={1.5} />
    </svg>
  );
}

/** A state swatch for the live floor's key. */
export function FaceSwatch({ state }: { state: FloorState }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden="true">
      <rect
        x={1}
        y={1}
        width={10}
        height={10}
        rx={3}
        className={FACE_CLASS[state].table}
        style={state === 'seated' ? SEATED_FILL : undefined}
        strokeWidth={1.5}
      />
    </svg>
  );
}

/**
 * A chair seen from above: a backrest bar on the side away from the table, a
 * small gap, then the seat — both a soft fill with a darker edge. In the chair's
 * own frame the table is below it (angle 0 is a chair above the table).
 */
function ChairShape({
  chair,
  className,
  strokeWidth = 1.25,
}: {
  chair: { cx: number; cy: number; width: number; height: number; angle: number };
  className?: string;
  strokeWidth?: number;
}) {
  const w = chair.width;
  const h = chair.height;
  const back = h * 0.3;
  const gap = h * 0.1;
  const inset = w * 0.07;
  return (
    <g transform={`translate(${chair.cx} ${chair.cy}) rotate(${chair.angle})`} className={className} strokeWidth={strokeWidth}>
      <rect x={-w / 2} y={-h / 2} width={w} height={back} rx={back / 2} />
      <rect x={-w / 2 + inset} y={-h / 2 + back + gap} width={w - inset * 2} height={h - back - gap} rx={3} />
    </g>
  );
}
