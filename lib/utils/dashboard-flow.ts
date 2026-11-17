/**
 * The dashboard as a bento with no empty gaps. Full-width widgets (12 of 12 —
 * the needs-attention strip, the figures, a launch strip) lead in their saved
 * order. Everything narrower stacks into two columns, each card placed in
 * whichever column is shorter so far, so a short card never leaves a hole
 * beside a tall one. On one column the saved order is kept as it is.
 */

/** Rough rendered height of each widget, in 40px steps — only used to balance the two columns. */
export const WIDGET_HEIGHT: Readonly<Record<string, number>> = {
  'analytics.trading': 10,
  'analytics.live': 5,
  'analytics.orders-hourly': 8,
  'analytics.top-items': 7,
  // Module cards: title, headline and status, then up to three 44px "needs you" lines.
  'inventory.stock-health': 7,
  'workforce.team-today': 5,
  'purchasing.overview': 5,
  'payments.tenders': 5,
  'customers.overview': 6,
  'cms.content': 6,
};

/** Launch cards and anything unlisted: about a strip's height. */
const DEFAULT_HEIGHT = 2;

export const isFullWidth = (width: number) => width >= 12;

export interface BoardLayout<T> {
  full: T[];
  columns: T[][];
}

export function boardLayout<T extends { widgetKey: string; width: number }>(
  placements: readonly T[],
  columnCount: 1 | 2,
  heightOf: (item: T) => number = (item) => WIDGET_HEIGHT[item.widgetKey] ?? DEFAULT_HEIGHT,
): BoardLayout<T> {
  const full = placements.filter((item) => isFullWidth(item.width));
  const rest = placements.filter((item) => !isFullWidth(item.width));
  if (columnCount === 1) return { full, columns: [rest] };

  const columns: [T[], T[]] = [[], []];
  const heights: [number, number] = [0, 0];
  for (const item of rest) {
    // Ties go left, so the first card leads the left column and the order still reads across.
    const target: 0 | 1 = heights[1] < heights[0] ? 1 : 0;
    columns[target].push(item);
    heights[target] += Math.max(1, heightOf(item));
  }
  return { full, columns };
}
