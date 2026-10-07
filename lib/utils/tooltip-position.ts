// Where a tooltip goes, as pure arithmetic so it can be tested without a DOM.
//
// The same pipeline Floating UI / Radix use, cut down to what a one-line label
// needs: place on the preferred side (offset), flip to the opposite side when
// that one has no room (flip), slide along the edge to stay on screen (shift),
// then point the arrow back at the trigger wherever the box ended up (arrow).

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
export type TooltipAlign = 'start' | 'center' | 'end';

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TooltipPlacement {
  /** The side actually used — the preferred one unless it was flipped. */
  side: TooltipSide;
  top: number;
  left: number;
  /** Arrow offset along the tooltip's edge, from its top (left/right) or left (top/bottom). */
  arrow: number;
}

const OPPOSITE: Record<TooltipSide, TooltipSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

const clamp = (value: number, min: number, max: number) => (max < min ? min : Math.min(Math.max(value, min), max));

export function placeTooltip({
  anchor,
  tooltip,
  viewport,
  side,
  align = 'center',
  offset = 8,
  padding = 8,
  arrowInset = 10,
}: {
  anchor: Rect;
  tooltip: { width: number; height: number };
  viewport: { width: number; height: number };
  side: TooltipSide;
  align?: TooltipAlign;
  /** Gap between the trigger and the tooltip. */
  offset?: number;
  /** The closest the tooltip may sit to the viewport edge. */
  padding?: number;
  /** Keeps the arrow off the tooltip's rounded corners. */
  arrowInset?: number;
}): TooltipPlacement {
  const vertical = (s: TooltipSide) => s === 'top' || s === 'bottom';

  // Room between the trigger and the viewport edge on each side, after the gap.
  const room: Record<TooltipSide, number> = {
    top: anchor.top - offset - padding,
    bottom: viewport.height - (anchor.top + anchor.height) - offset - padding,
    left: anchor.left - offset - padding,
    right: viewport.width - (anchor.left + anchor.width) - offset - padding,
  };
  const need = (s: TooltipSide) => (vertical(s) ? tooltip.height : tooltip.width);

  // Flip: keep the preferred side if it fits, else the opposite one if that
  // fits, else whichever has more room — a half-hidden label beats no label.
  const opposite = OPPOSITE[side];
  const placed =
    room[side] >= need(side) ? side : room[opposite] >= need(opposite) ? opposite : room[opposite] > room[side] ? opposite : side;

  let top: number;
  let left: number;
  if (vertical(placed)) {
    top = placed === 'top' ? anchor.top - offset - tooltip.height : anchor.top + anchor.height + offset;
    left =
      align === 'start'
        ? anchor.left
        : align === 'end'
          ? anchor.left + anchor.width - tooltip.width
          : anchor.left + anchor.width / 2 - tooltip.width / 2;
  } else {
    left = placed === 'left' ? anchor.left - offset - tooltip.width : anchor.left + anchor.width + offset;
    top =
      align === 'start'
        ? anchor.top
        : align === 'end'
          ? anchor.top + anchor.height - tooltip.height
          : anchor.top + anchor.height / 2 - tooltip.height / 2;
  }

  // Shift: hold the whole box inside the viewport on both axes.
  left = clamp(left, padding, viewport.width - tooltip.width - padding);
  top = clamp(top, padding, viewport.height - tooltip.height - padding);

  // Arrow: aim at the trigger's centre, measured from the box's own edge, kept
  // clear of the corners however far the box was shifted.
  const arrow = vertical(placed)
    ? clamp(anchor.left + anchor.width / 2 - left, arrowInset, tooltip.width - arrowInset)
    : clamp(anchor.top + anchor.height / 2 - top, arrowInset, tooltip.height - arrowInset);

  return { side: placed, top, left, arrow };
}
