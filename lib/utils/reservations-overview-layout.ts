import { type Cell, type GridSize, isValidLayout, normalize } from './widget-grid.ts';

/**
 * The Reservations overview as a grid of cards, arranged like the dashboard:
 * today's figures as stat tiles a row tall, the week, the busiest hours,
 * service quality and guests as tall cards. A person's arrangement is kept per
 * workspace in their browser; anything unreadable in it falls back to this.
 */

export const OVERVIEW_COLUMNS = 4;

const TILE: GridSize[] = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
];
const CARD: GridSize[] = [
  { w: 2, h: 4 },
  { w: 4, h: 4 },
];

export const OVERVIEW_CARDS = {
  covers: { label: 'Covers', sizes: TILE },
  'to-come': { label: 'Still to come', sizes: TILE },
  'walk-ins': { label: 'Walk-ins', sizes: TILE },
  'no-shows': { label: 'No-shows', sizes: TILE },
  waitlist: { label: 'Waitlist now', sizes: TILE },
  'tables-free': { label: 'Tables free now', sizes: TILE },
  week: { label: 'Next 7 days', sizes: CARD },
  hours: { label: 'Busiest hours', sizes: CARD },
  quality: { label: 'Service quality', sizes: CARD },
  guests: { label: 'Guests', sizes: CARD },
} as const satisfies Record<string, { label: string; sizes: readonly GridSize[] }>;

export type OverviewCardKey = keyof typeof OVERVIEW_CARDS;

export const overviewSizes = (key: string): readonly GridSize[] =>
  (OVERVIEW_CARDS as Record<string, { sizes: readonly GridSize[] }>)[key]?.sizes ?? [];

/** Today's figures across the top, the week beside the busiest hours, quality beside guests. */
export const DEFAULT_OVERVIEW_LAYOUT: Cell[] = [
  { key: 'covers', x: 1, y: 1, w: 1, h: 1 },
  { key: 'to-come', x: 2, y: 1, w: 1, h: 1 },
  { key: 'walk-ins', x: 3, y: 1, w: 1, h: 1 },
  { key: 'no-shows', x: 4, y: 1, w: 1, h: 1 },
  { key: 'waitlist', x: 1, y: 2, w: 2, h: 1 },
  { key: 'tables-free', x: 3, y: 2, w: 2, h: 1 },
  { key: 'week', x: 1, y: 3, w: 2, h: 4 },
  { key: 'hours', x: 3, y: 3, w: 2, h: 4 },
  { key: 'quality', x: 1, y: 7, w: 2, h: 4 },
  { key: 'guests', x: 3, y: 7, w: 2, h: 4 },
];

/**
 * A saved arrangement as stored text, made safe to draw: unknown cards and sizes dropped, overlaps packed.
 * Null when there is nothing usable, so the caller shows the default.
 */
export function readOverviewLayout(stored: string | null): Cell[] | null {
  if (!stored) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const cells = parsed.filter(
    (cell): cell is Cell =>
      !!cell &&
      typeof cell === 'object' &&
      typeof (cell as Cell).key === 'string' &&
      ['x', 'y', 'w', 'h'].every((field) => typeof (cell as Record<string, unknown>)[field] === 'number'),
  );
  const layout = normalize(cells, { columns: OVERVIEW_COLUMNS, sizes: overviewSizes });
  return isValidLayout(layout, OVERVIEW_COLUMNS) ? layout : null;
}
