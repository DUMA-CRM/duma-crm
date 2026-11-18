'use client';

import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useRef, useState } from 'react';

import { type Cell, type GridMetrics, type GridSpec, move, nearestSize, pointToCell, resize } from '@/lib/utils/widget-grid';

type Preview = { key: string; cells: Cell[]; mode: 'move' | 'resize' };

function scrollContainer(grid: HTMLElement): HTMLElement {
  let node = grid.parentElement;
  while (node) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
    node = node.parentElement;
  }
  return document.scrollingElement as HTMLElement;
}

export function useGridDrag({
  grid,
  width,
  enabled,
  layout,
  metrics,
  spec,
  onCommit,
}: {
  grid: RefObject<HTMLDivElement | null>;
  width: number;
  enabled: boolean;
  layout: Cell[];
  metrics: GridMetrics;
  spec: GridSpec;
  onCommit: (cells: Cell[]) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const stop = useRef<(() => void) | null>(null);

  // A new grid width (rotation, the sidebar, split view) or leaving edit mode drops a drag in progress.
  // Not on window `resize`: iOS fires that when Safari's toolbar collapses mid-scroll.
  useEffect(() => () => stop.current?.(), [enabled, width]);

  function start(event: ReactPointerEvent<HTMLElement>, cell: Cell, mode: Preview['mode']) {
    const board = grid.current;
    if (!enabled || !board || !event.isPrimary || event.button !== 0 || stop.current) return;
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const isTouch = event.pointerType === 'touch';
    const scroller = scrollContainer(board);
    const origin = { x: event.clientX, y: event.clientY };
    const gridTop = board.getBoundingClientRect().top;
    const gridLeft = board.getBoundingClientRect().left;
    let point = origin;
    let active = false;
    let frame = 0;
    let timer = 0;
    let target = '';
    let cells = layout;
    const lastRow = layout.reduce((end, item) => Math.max(end, item.y + item.h), 1);

    function update() {
      const bounds = board!.getBoundingClientRect();
      const dx = point.x - origin.x + gridLeft - bounds.left;
      const dy = point.y - origin.y + gridTop - bounds.top;
      const delta = pointToCell(dx, dy, metrics);
      if (mode === 'move') {
        const x = Math.max(1, Math.min(cell.x + delta.x - 1, spec.columns - cell.w + 1));
        const y = Math.max(1, Math.min(cell.y + delta.y - 1, lastRow));
        cells = updateOnce(x, y, moveCell);
        const placed = cells.find((item) => item.key === cell.key)!;
        handle.style.setProperty('--drag-x', `${dx - (placed.x - cell.x) * (metrics.column + metrics.gap)}px`);
        handle.style.setProperty('--drag-y', `${dy - (placed.y - cell.y) * (metrics.row + metrics.gap)}px`);
      } else {
        const size = nearestSize(spec.sizes(cell.key), cell.w + delta.x - 1, cell.h + delta.y - 1);
        if (size) cells = updateOnce(size.w, size.h, (w, h) => resize(layout, cell.key, { w, h }, spec.columns));
      }
    }

    function moveCell(x: number, y: number) {
      return move(layout, cell.key, x, y, spec.columns);
    }

    function updateOnce(x: number, y: number, calculate: (x: number, y: number) => Cell[]) {
      const next = `${x}:${y}`;
      if (next === target) return cells;
      target = next;
      const placed = calculate(x, y);
      setPreview({ key: cell.key, cells: placed, mode });
      return placed;
    }

    function autoScroll() {
      const page = document.scrollingElement;
      const bounds = scroller === page ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
      const edge = 64;
      const up = Math.max(0, Math.min(edge, bounds.top + edge - point.y));
      const down = Math.max(0, Math.min(edge, point.y - bounds.bottom + edge));
      const before = scroller.scrollTop;
      if (up || down) scroller.scrollTop += (down - up) / 4;
      if (before !== scroller.scrollTop) update();
      frame = requestAnimationFrame(autoScroll);
    }

    function activate() {
      active = true;
      handle.setPointerCapture(pointerId);
      update();
      frame = requestAnimationFrame(autoScroll);
    }

    function preventScroll(touch: TouchEvent) {
      if (active && touch.cancelable) touch.preventDefault();
    }

    function onMove(next: PointerEvent) {
      if (next.pointerId !== pointerId) return;
      point = { x: next.clientX, y: next.clientY };
      if (active) update();
      else if (Math.hypot(point.x - origin.x, point.y - origin.y) > 8) {
        if (isTouch) cleanup();
        else activate();
      }
    }

    function finish(next: PointerEvent) {
      if (next.pointerId !== pointerId) return;
      if (active && next.type === 'pointerup') {
        point = { x: next.clientX, y: next.clientY };
        update();
        onCommit(cells);
      }
      cleanup();
    }

    function escape(next: KeyboardEvent) {
      if (next.key === 'Escape') cleanup();
    }

    function cleanup() {
      stop.current = null;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('keydown', escape);
      handle.removeEventListener('lostpointercapture', finish);
      document.removeEventListener('touchmove', preventScroll, true);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      handle.style.removeProperty('--drag-x');
      handle.style.removeProperty('--drag-y');
      if (active) setPreview(null);
    }

    stop.current = cleanup;
    // Register before the browser decides whether this gesture is a scroll.
    if (isTouch) document.addEventListener('touchmove', preventScroll, { capture: true, passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('keydown', escape);
    handle.addEventListener('lostpointercapture', finish);
    if (mode === 'resize') activate();
    else if (isTouch) timer = window.setTimeout(activate, 200);
  }

  return { preview, start };
}
