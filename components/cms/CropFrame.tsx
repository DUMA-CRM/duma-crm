'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';
import { type CropHandle, type CropRect, dragCrop } from '@/lib/utils/media-storage';

const CORNERS: Array<{ handle: Exclude<CropHandle, 'move'>; className: string; cursor: string }> = [
  { handle: 'nw', className: '-left-4 -top-4', cursor: 'cursor-nwse-resize' },
  { handle: 'ne', className: '-right-4 -top-4', cursor: 'cursor-nesw-resize' },
  { handle: 'sw', className: '-bottom-4 -left-4', cursor: 'cursor-nesw-resize' },
  { handle: 'se', className: '-bottom-4 -right-4', cursor: 'cursor-nwse-resize' },
];

/**
 * The image with a crop frame over it. Drag inside to move, drag a corner to
 * resize (holding `ratio` when set), arrow keys nudge — Shift for bigger steps.
 * Coordinates are the image's own pixels, so what is drawn is exactly what the
 * encoder cuts. `onChange` fires while dragging (for the frame) and
 * `onCommit` once on release (for the re-encode, which is the expensive part).
 */
export function CropFrame({
  src,
  alt,
  natural,
  crop,
  ratio,
  enabled,
  onChange,
  onCommit,
  onLoad,
}: {
  src: string;
  alt: string;
  natural: { width: number; height: number } | null;
  crop: CropRect | null;
  ratio: number | null;
  enabled: boolean;
  onChange: (crop: CropRect) => void;
  onCommit: (crop: CropRect) => void;
  onLoad: (size: { width: number; height: number }) => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ handle: CropHandle; startX: number; startY: number; start: CropRect; scale: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(crop);
  useEffect(() => {
    latest.current = crop;
  }, [crop]);

  const begin = (handle: CropHandle) => (event: React.PointerEvent) => {
    if (!crop || !natural || !imageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      start: crop,
      scale: imageRef.current.getBoundingClientRect().width / natural.width,
    };
    setDragging(true);
  };
  const move = (event: React.PointerEvent) => {
    const active = drag.current;
    if (!active || !natural) return;
    const dx = (event.clientX - active.startX) / active.scale;
    const dy = (event.clientY - active.startY) / active.scale;
    onChange(dragCrop(active.start, active.handle, dx, dy, natural, ratio));
  };
  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (latest.current) onCommit(latest.current);
  };

  const nudge = (event: React.KeyboardEvent) => {
    if (!crop || !natural) return;
    const step = Math.max(1, Math.round(natural.width * (event.shiftKey ? 0.05 : 0.01)));
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = dragCrop(crop, 'move', delta[0]!, delta[1]!, natural, ratio);
    onChange(next);
    onCommit(next);
  };

  const pct = (value: number, of: number) => `${(value / of) * 100}%`;

  return (
    <div
      className="relative inline-block max-w-full select-none overflow-hidden rounded-md"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL being cropped, not a remote image */}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => onLoad({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        className="block max-h-[min(56vh,32rem)] w-auto max-w-full"
      />
      {enabled && crop && natural && (
        <div
          role="group"
          tabIndex={0}
          aria-roledescription="crop area"
          aria-label={`Crop ${crop.width} by ${crop.height} pixels. Drag to move, or use the arrow keys; hold Shift for bigger steps.`}
          onKeyDown={nudge}
          onPointerDown={begin('move')}
          className={cn(
            'absolute cursor-move outline-none',
            // Everything outside the frame dims. Fixed neutrals, not theme ink: this sits over a photo in either theme.
            'shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]',
            'ring-1 ring-white/90 focus-visible:ring-2 focus-visible:ring-primary',
          )}
          style={{
            left: pct(crop.x, natural.width),
            top: pct(crop.y, natural.height),
            width: pct(crop.width, natural.width),
            height: pct(crop.height, natural.height),
          }}
        >
          {/* Thirds, only while dragging — a composition guide, not decoration. */}
          <div
            className={cn('pointer-events-none absolute inset-0 transition-opacity', dragging ? 'opacity-100' : 'opacity-0')}
            aria-hidden="true"
          >
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
          </div>
          {CORNERS.map(({ handle, className, cursor }) => (
            <span
              key={handle}
              aria-hidden="true"
              onPointerDown={begin(handle)}
              // A 32px target around a 12px mark, so a corner is easy to catch on a tablet.
              className={cn('absolute flex size-8 items-center justify-center', className, cursor)}
            >
              <span className="size-3 rounded-[2px] border border-black/30 bg-white shadow-sm" />
            </span>
          ))}
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-sm bg-black/65 px-1.5 py-0.5 text-[0.6875rem] text-white tabular-nums">
            {crop.width} × {crop.height}
          </span>
        </div>
      )}
    </div>
  );
}
