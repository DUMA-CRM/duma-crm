'use client';

import { motion, useReducedMotion } from 'motion/react';
import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';
import { type Cell, type GridSize, move, reflow, resize } from '@/lib/utils/widget-grid';

import { WidgetCellContext } from './cell';
import { useGridDrag } from './useGridDrag';
import styles from './widget-grid.module.css';

/* A home screen of widgets. The board is four columns wide and its rows are
 * one stat tile tall (ROW_HEIGHT), so a single figure fills a row exactly and
 * nothing is forced square. Widgets come in families of rows: compact 1×1,
 * bar 2×1 and banner 4×1 for a figure on one line; small 1×2, medium 2×2,
 * large 2×4 and extra large 4×4 after Apple's. Columns stop growing at
 * MAX_CELL, so a wide monitor gets a centred board of widget-sized widgets
 * rather than stretched ones. Below a tablet's width the board reflows into
 * two columns, a phone's home screen, to read rather than arrange. */

export const BOARD_COLUMNS = 4;
const PHONE_COLUMNS = 2;
const MAX_CELL = 320;
/** DUMA's card corner (`--radius`, 10px) — every widget is a card like any other in the product. */
const CARD_RADIUS = 10;
/** One row: the height of DUMA's stat tile, the `Fact` on the page (12 + 65 + 12 px and its border). */
const ROW_HEIGHT = 92;

export interface BoardMetrics {
  columns: number;
  /** One column's width, in px. */
  cell: number;
  gap: number;
  /** The board's own width: the container, or less once cells hit MAX_CELL. */
  width: number;
  /** The card corner, for the resize arc and the drop slot. */
  radius: number;
  /** One row's height, fixed: a stat card's. */
  row: number;
}

export function boardMetrics(containerWidth: number): BoardMetrics {
  const columns = containerWidth >= 600 ? BOARD_COLUMNS : PHONE_COLUMNS;
  const gap = containerWidth >= 1024 ? 20 : 16;
  const fluid = (containerWidth - (columns - 1) * gap) / columns;
  const cell = Math.max(0, columns === BOARD_COLUMNS ? Math.min(MAX_CELL, fluid) : fluid);
  return { columns, cell, gap, width: columns * cell + (columns - 1) * gap, radius: CARD_RADIUS, row: ROW_HEIGHT };
}

/** A widget's pixel size on a board measured at `containerWidth` — what the gallery draws a preview at. */
export function cellPixels(size: GridSize, containerWidth: number) {
  const { cell, gap, radius, row } = boardMetrics(containerWidth);
  return { width: size.w * cell + (size.w - 1) * gap, height: size.h * row + (size.h - 1) * gap, radius };
}

/** The families by name, for labels and announcements. Heights are in half-rows. */
export function familyName({ w, h }: GridSize): string {
  if (w === 1 && h === 1) return 'Compact';
  if (w === 2 && h === 1) return 'Bar';
  if (w === 4 && h === 1) return 'Banner';
  if (w === 1 && h === 2) return 'Small';
  if (w === 2 && h === 2) return 'Medium';
  if (w === 2 && h === 4) return 'Large';
  if (w === 4 && h === 4) return 'Extra large';
  return `${w} by ${h / 2}`;
}

type Widget = {
  label: string;
  sizes: readonly GridSize[];
  render: () => ReactNode;
};

const position = (cell: Cell) => ({
  gridColumn: `${cell.x} / span ${cell.w}`,
  gridRow: `${cell.y} / span ${cell.h}`,
});

export function WidgetGrid({
  widgets,
  layout,
  editing = false,
  onChange,
  onRemove,
  onMeasure,
}: {
  widgets: Readonly<Record<string, Widget>>;
  layout: Cell[];
  editing?: boolean;
  onChange?: (cells: Cell[]) => void;
  onRemove?: (key: string) => void;
  /** The space the board has, as it changes — the gallery draws its previews to this board's scale. */
  onMeasure?: (width: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [keyboard, setKeyboard] = useState<{ cell: Cell; cells: Cell[]; width: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const instructions = useId();
  const reducedMotion = useReducedMotion();
  const metrics = boardMetrics(width);
  const { columns, cell: side, gap, row } = metrics;
  const enabled = editing && columns === BOARD_COLUMNS;
  const spec = useMemo(() => ({ columns, sizes: (key: string) => widgets[key]?.sizes ?? [] }), [columns, widgets]);
  const lifted = enabled && keyboard?.width === width && keyboard ? keyboard : null;
  // The resize arc follows the widget's corner, inset so it sits just inside it.
  const arc = Math.min(32, Math.max(10, metrics.radius - 2));

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry!.contentRect.width;
      setWidth(next);
      onMeasure?.(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onMeasure]);

  const { preview, start } = useGridDrag({
    grid,
    width,
    enabled: enabled && !lifted,
    layout,
    metrics: { column: side, row, gap },
    spec,
    onCommit: (next) => onChange?.(next),
  });

  const narrow = useMemo(() => (columns === BOARD_COLUMNS ? layout : reflow(layout, spec)), [columns, layout, spec]);
  const board = enabled ? (preview?.cells ?? lifted?.cells ?? layout) : narrow;
  const activeKey = preview?.key ?? lifted?.cell.key;
  const placeholder = board.find(({ key }) => key === activeKey);
  // Preserve the active element and pointer target while visual positions change.
  const visual = preview || lifted ? layout.map(({ key }) => board.find((cell) => cell.key === key)!) : board;

  function onKeyDown(event: KeyboardEvent<HTMLElement>, cell: Cell) {
    if (event.target !== event.currentTarget || preview || (lifted && lifted.cell.key !== cell.key)) return;
    const label = widgets[cell.key]?.label ?? cell.key;
    // Shift + arrows step through the widget's families: right or down to the next larger, left or up to the smaller.
    if (event.shiftKey && !lifted && event.key.startsWith('Arrow')) {
      event.preventDefault();
      const sizes = widgets[cell.key]?.sizes ?? [];
      const index = sizes.findIndex(({ w, h }) => w === cell.w && h === cell.h);
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      const size = sizes[index + step];
      if (!size || size.w > columns) return;
      onChange?.(resize(layout, cell.key, size, columns));
      setAnnouncement(`${label} is now ${familyName(size).toLowerCase()}`);
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      if (event.repeat) return;
      if (lifted) {
        const focused = event.currentTarget;
        onChange?.(lifted.cells);
        setKeyboard(null);
        requestAnimationFrame(() => focused.focus({ preventScroll: true }));
        setAnnouncement(`${label} dropped, column ${cell.x}, row ${cell.y}`);
      } else {
        setKeyboard({ cell, cells: layout, width });
        setAnnouncement(`${label} lifted, column ${cell.x}, row ${cell.y}`);
      }
      return;
    }
    if (!lifted) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setKeyboard(null);
      setAnnouncement(`${label} moved back to its starting position`);
      return;
    }
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const x = Math.max(1, Math.min(columns - cell.w + 1, lifted.cell.x + direction[0]));
    const last = layout.reduce((end, item) => Math.max(end, item.y + item.h), 1);
    const y = Math.max(1, Math.min(last, lifted.cell.y + direction[1]));
    const cells = move(layout, cell.key, x, y, columns);
    const placed = cells.find(({ key }) => key === cell.key)!;
    setKeyboard({ cell: { ...lifted.cell, x, y }, cells, width });
    setAnnouncement(`${label}, column ${placed.x}, row ${placed.y}`);
  }

  return (
    <div ref={container} className="min-w-0">
      <p id={instructions} className="sr-only">
        Press Space to lift, use the arrow keys to move, then press Space to drop. Escape cancels the move. Shift and the arrow keys change
        the size.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {width > 0 && (
        <div
          ref={grid}
          tabIndex={enabled ? -1 : undefined}
          className={cn('relative mx-auto grid', enabled && styles.editing)}
          style={
            {
              width: metrics.width,
              gridTemplateColumns: `repeat(${columns}, ${side}px)`,
              gridAutoRows: row,
              gap,
              '--widget-radius': 'var(--radius)',
            } as CSSProperties
          }
          onContextMenu={enabled ? (event) => event.preventDefault() : undefined}
        >
          {placeholder && <div aria-hidden="true" className={styles.slot} style={position(placeholder)} />}
          {visual.map((cell) => {
            const widget = widgets[cell.key];
            if (!widget) return null;
            const active = activeKey === cell.key;
            const canResize = widget.sizes.length > 1;
            const interactive = enabled && !preview && !lifted;
            const pixels = { width: cell.w * side + (cell.w - 1) * gap, height: cell.h * row + (cell.h - 1) * gap };
            return (
              <motion.section
                key={cell.key}
                layout={enabled && !reducedMotion && !active ? 'position' : false}
                transition={{ layout: { type: 'spring', stiffness: 520, damping: 42 } }}
                className={cn(
                  'relative min-h-0 min-w-0 rounded-(--widget-radius) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
                  enabled && 'cursor-grab touch-manipulation',
                  active && 'z-10 cursor-grabbing',
                )}
                style={position(cell)}
                aria-label={widget.label}
                aria-describedby={enabled ? instructions : undefined}
                tabIndex={enabled ? 0 : undefined}
                onPointerDown={enabled ? (event) => start(event, cell, 'move') : undefined}
                onKeyDown={enabled ? (event) => onKeyDown(event, cell) : undefined}
              >
                <div
                  inert={enabled}
                  className={cn(
                    'h-full min-w-0',
                    enabled && !active && styles.editable,
                    active && preview?.mode === 'move' && styles.dragging,
                    active && styles.lifted,
                  )}
                >
                  <WidgetCellContext.Provider value={{ w: cell.w, h: cell.h, ...pixels }}>{widget.render()}</WidgetCellContext.Provider>
                </div>
                {enabled && (
                  <>
                    <button
                      type="button"
                      className={cn(styles.badge, 'top-0 left-0 -translate-x-[18px] -translate-y-[18px]')}
                      aria-label={`Remove ${widget.label}`}
                      disabled={!interactive}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove?.(cell.key);
                        const section = event.currentTarget.closest('section');
                        const next = section?.nextElementSibling ?? section?.previousElementSibling;
                        if (next instanceof HTMLElement) next.focus();
                        else grid.current?.focus();
                        setAnnouncement(`${widget.label} removed`);
                      }}
                    >
                      <span aria-hidden="true" />
                    </button>
                    {canResize && (
                      <button
                        type="button"
                        className={cn(styles.resize, 'right-0 bottom-0 cursor-nwse-resize touch-none')}
                        aria-label={`Resize ${widget.label}`}
                        disabled={!!lifted || (!!preview && preview.key !== cell.key)}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          start(event, cell, 'resize');
                        }}
                      >
                        {/* iOS's resize mark: a white arc hugging the widget's own corner. */}
                        <svg aria-hidden="true" viewBox="0 0 44 44">
                          <path d={`M 40 ${40 - arc} A ${arc} ${arc} 0 0 1 ${40 - arc} 40`} />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </motion.section>
            );
          })}
        </div>
      )}
    </div>
  );
}
