'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';
import { placeTooltip, type TooltipAlign, type TooltipPlacement, type TooltipSide } from '@/lib/utils/tooltip-position';

// The entrance slides away from the trigger, so it follows the side the
// tooltip actually landed on, not the one asked for.
const SLIDE_IN: Record<TooltipSide, string> = {
  top: 'slide-in-from-bottom-1',
  bottom: 'slide-in-from-top-1',
  left: 'slide-in-from-right-1',
  right: 'slide-in-from-left-1',
};

/**
 * Hover/focus tooltip that renders to <body> so it escapes clipped/transformed
 * ancestors (e.g. the collapsed sidebar rail with `overflow-x-clip`). `right`
 * is the sidebar's; `top` is for an icon standing in for a word inside a row.
 *
 * `side` is a preference, not a promise: it flips to the opposite side when
 * there is no room and slides along the edge to stay on screen, with the
 * arrow still pointing at the trigger (lib/utils/tooltip-position.ts).
 */
export function Tooltip({
  label,
  children,
  side = 'right',
  className,
  style,
  align = 'center',
  wrap = false,
}: {
  label: string;
  children: React.ReactNode;
  side?: TooltipSide;
  /** `end` lines the tooltip's far edge up with the trigger's, for icons at a card's right edge. */
  align?: TooltipAlign;
  /** Let a sentence or two wrap instead of running on one line. */
  wrap?: boolean;
  className?: string;
  /** For a wrapper that must carry layout, e.g. a bar segment's width. */
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Measure before paint, so the first frame is already in the right place:
  // the tooltip renders hidden at the origin, gets sized, then is placed.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const anchor = ref.current?.getBoundingClientRect();
      const tip = tipRef.current;
      if (!anchor || !tip) return;
      setPlacement(
        placeTooltip({
          anchor,
          tooltip: { width: tip.offsetWidth, height: tip.offsetHeight },
          viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
          side,
          align,
        }),
      );
    };
    place();
    // Follow the trigger if anything scrolls under it or the window resizes.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isOpen, side, align, label]);

  const open = () => setIsOpen(true);
  const close = () => {
    setIsOpen(false);
    setPlacement(null);
  };

  // Escape dismisses without moving focus, per the WAI-ARIA tooltip pattern.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Touch has no hover: a tap shows the label for a moment instead, so an
  // icon standing in for a word on the till tablet can still be read.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peek = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    open();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(close, 1800);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const vertical = placement?.side === 'top' || placement?.side === 'bottom';

  return (
    // A span, so an icon in a row's inline text can carry one without nesting a block in a phrase.
    <span
      ref={ref}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      onPointerDown={peek}
      className={cn('inline-flex', className)}
      style={style}
    >
      {children}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={placement ? { top: placement.top, left: placement.left } : { top: 0, left: 0, visibility: 'hidden' }}
            // `transition-none`: `duration-150` alone leaves transition-property
            // at its default of `all`, so top/left would glide in from the
            // hidden measuring spot at 0,0 and lag behind the trigger on scroll.
            className={cn(
              'pointer-events-none fixed z-[60] transition-none',
              placement && cn('duration-150 animate-in fade-in', SLIDE_IN[placement.side]),
            )}
          >
            <div
              className={cn(
                'relative rounded-sm bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-lg',
                wrap
                  ? 'w-max max-w-[min(16rem,calc(100vw-1rem))] whitespace-normal leading-snug'
                  : 'max-w-[calc(100vw-1rem)] whitespace-nowrap',
              )}
            >
              {placement && (
                // Sits on the edge facing the trigger, half outside the box.
                <span
                  aria-hidden="true"
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground"
                  style={
                    vertical
                      ? { left: placement.arrow, top: placement.side === 'top' ? '100%' : 0 }
                      : { top: placement.arrow, left: placement.side === 'left' ? '100%' : 0 }
                  }
                />
              )}
              {/* Truncated inside, not on the box: overflow on the box would clip the arrow. */}
              {wrap ? label : <span className="block truncate">{label}</span>}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
