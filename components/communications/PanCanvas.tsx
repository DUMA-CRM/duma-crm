'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Maximize, Minus, Plus } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';

import { DOT_GRID_STYLE } from './workflowNodes';

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.6;
const GRID = 16;

/** Pointer-downs that belong to the content — a step, its handle, a + on a line — never start a pan. */
const INTERACTIVE = 'button, a, input, textarea, select, [draggable="true"], [role="button"], [role="menu"], [data-no-pan]';

const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

/**
 * A canvas you can move around, as in a design tool: drag empty space (or
 * scroll) to pan, ⌘/Ctrl + scroll or the corner buttons to zoom about the
 * pointer, and "Centre" to bring the content back. It fills its parent, and the
 * dot grid moves with the view. The content keeps its own layout and its own
 * drag and drop — panning only starts on empty space.
 */
export function PanCanvas({ children, className }: { children: React.ReactNode; className?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ pointer: number; startX: number; startY: number; x: number; y: number } | null>(null);

  /** The content centred horizontally, a little below the top, at 100%. */
  const centre = useCallback(() => {
    const box = frame.current;
    const inner = content.current;
    if (!box || !inner) return;
    setView({ x: Math.max(24, (box.clientWidth - inner.offsetWidth) / 2), y: 24, scale: 1 });
  }, []);
  useLayoutEffect(() => centre(), [centre]);

  /** Zoom by `factor`, keeping the point under (px, py) — frame coordinates — where it is. */
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((current) => {
      const scale = clamp(current.scale * factor);
      const ratio = scale / current.scale;
      return { scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  }, []);

  // Wheel: pan, or zoom with ⌘/Ctrl (and trackpad pinch, which arrives as ctrl+wheel). Not passive, so the page doesn't scroll too.
  useEffect(() => {
    const box = frame.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = box.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * 0.0025), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        setView((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
      }
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const zoomButton = (factor: number) => {
    const box = frame.current;
    if (box) zoomAt(factor, box.clientWidth / 2, box.clientHeight / 2);
  };

  return (
    <div
      ref={frame}
      className={cn(
        'relative min-h-112 flex-1 touch-none overflow-hidden rounded-lg border border-rule/60 bg-card select-none',
        panning ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
      style={{
        ...DOT_GRID_STYLE,
        backgroundSize: `${GRID * view.scale}px ${GRID * view.scale}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest(INTERACTIVE)) return;
        drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: view.x, y: view.y };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPanning(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.pointer !== event.pointerId) return;
        setView((current) => ({ ...current, x: start.x + event.clientX - start.startX, y: start.y + event.clientY - start.startY }));
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointer !== event.pointerId) return;
        drag.current = null;
        setPanning(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setPanning(false);
      }}
    >
      <div
        ref={content}
        className="absolute left-0 top-0 cursor-auto select-text"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}
      >
        {children}
      </div>

      {/* The view's controls, out of the way in the corner. */}
      <div
        data-no-pan
        className="absolute bottom-3 right-3 flex cursor-auto items-center gap-0.5 rounded-lg border border-rule/70 bg-card p-1 shadow-sm"
      >
        <Tooltip side="top" label="Zoom out">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={view.scale <= MIN_SCALE}
            onClick={() => zoomButton(1 / 1.2)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground disabled:opacity-35"
          >
            <Minus size={14} aria-hidden="true" />
          </button>
        </Tooltip>
        <span className="w-11 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {Math.round(view.scale * 100)}%
        </span>
        <Tooltip side="top" label="Zoom in">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={view.scale >= MAX_SCALE}
            onClick={() => zoomButton(1.2)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground disabled:opacity-35"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </Tooltip>
        <span className="mx-0.5 h-4 w-px bg-rule/60" aria-hidden="true" />
        <Tooltip side="top" label="Centre the workflow">
          <button
            type="button"
            aria-label="Centre the workflow"
            onClick={centre}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
          >
            <Maximize size={14} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
