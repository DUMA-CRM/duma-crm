// ─── Chairs round a table ─────────────────────────────────────────────────────
//
// Where a table's chairs are drawn on the floor plan. A table either leaves its
// chairs to us (`chairs: null` — one per seat, spread round the shape by
// `chairSpots`), or says how many go on each side of a square or long table, or
// how many round a round one, or places each chair by hand (`custom`, relative
// to the table's centre so they move and turn with it). Kept free of React so the live floor, the editor's
// preview and the tests all read the same geometry.
// Relative, not aliased: node's type stripping resolves value imports for real.
import { CHAIR, type DiningTableShape, type FloorChairs, type FloorSeat, type FloorTable, chairSpots } from './reservations.ts';

/** The most chairs a side of a square or long table may take, round a round one, and placed by hand (the API's limits). */
export const CHAIR_LIMITS = { side: 12, around: 16, custom: 20 } as const;
/** How far from the table's centre a chair placed by hand may go, either way on each axis (the API's limit). */
export const SEAT_REACH = 400;
/** Chairs placed by hand snap to this. */
export const SEAT_GRID = 5;

export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type ChairSide = (typeof SIDES)[number];
export type SideCounts = Record<ChairSide, number>;

/** A chair as drawn: its centre on the canvas, its size, and the way it faces (degrees, table rotation included). */
export interface ChairRect {
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number;
}

type ChairTable = Pick<FloorTable, 'shape' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'maxCovers'> & {
  chairs?: FloorChairs | null;
};

const clampCount = (value: number, max: number) => (Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0);

/** Whether a chair layout suits a shape: per side for square and long tables, a count round a round one, by hand on any. */
export const chairsFitShape = (shape: DiningTableShape, chairs: FloorChairs | null | undefined) =>
  !chairs || chairs.mode === 'custom' || (chairs.mode === 'around' ? shape === 'round' : shape !== 'round');

/** How many chairs a layout draws. */
export function chairTotal(table: Pick<ChairTable, 'shape' | 'maxCovers' | 'chairs'>): number {
  const { chairs } = table;
  if (!chairs) return Math.max(0, Math.min(50, Math.floor(table.maxCovers)));
  if (chairs.mode === 'around') return clampCount(chairs.count, CHAIR_LIMITS.around);
  if (chairs.mode === 'custom') return Math.min(CHAIR_LIMITS.custom, chairs.seats.length);
  return SIDES.reduce((sum, side) => sum + clampCount(chairs[side], CHAIR_LIMITS.side), 0);
}

const SIDE_BY_ANGLE: Record<number, ChairSide> = { 0: 'top', 90: 'right', 180: 'bottom', 270: 'left' };

/**
 * The automatic layout as per-side counts — where the editor's steppers start
 * when someone switches a square or long table from Auto to choosing.
 */
export function autoSides(table: Pick<ChairTable, 'shape' | 'x' | 'y' | 'width' | 'height' | 'maxCovers'>): SideCounts {
  const counts: SideCounts = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const spot of chairSpots({ ...table, shape: table.shape === 'round' ? 'square' : table.shape }, table.maxCovers)) {
    const side = SIDE_BY_ANGLE[spot.angle];
    if (side) counts[side] = Math.min(CHAIR_LIMITS.side, counts[side] + 1);
  }
  return counts;
}

/** Turn a point round a centre by `degrees`, clockwise on screen (SVG's y points down). */
function turn(x: number, y: number, cx: number, cy: number, degrees: number) {
  if (!degrees) return { x, y };
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

const tidy = (value: number) => Math.round(value * 100) / 100;

/**
 * Every chair round a table, on the canvas, with the table's turn applied.
 * `chairs: null` spreads one per seat (`maxCovers`). A layout that doesn't suit
 * the shape — sides on a round table, a count round a square one, as an older
 * save might hold — keeps its number of chairs and spreads them automatically.
 */
export function chairRects(table: ChairTable): ChairRect[] {
  const { x, y, width: w, height: h } = table;
  const offset = CHAIR.gap + CHAIR.depth / 2;
  const chairs = table.chairs ?? null;
  type Spot = { x: number; y: number; angle: number };
  let spots: Spot[];

  if (!chairs || !chairsFitShape(table.shape, chairs)) {
    spots = chairSpots(table, chairTotal(table));
  } else if (chairs.mode === 'custom') {
    spots = chairs.seats
      .slice(0, CHAIR_LIMITS.custom)
      .map((seat) => ({ x: x + w / 2 + seat.x, y: y + h / 2 + seat.y, angle: seat.rotation }));
  } else if (chairs.mode === 'around') {
    const n = clampCount(chairs.count, CHAIR_LIMITS.around);
    const rx = w / 2 + offset;
    const ry = h / 2 + offset;
    spots = Array.from({ length: n }, (_, i) => {
      const angle = -90 + (360 * i) / n;
      const radians = (angle * Math.PI) / 180;
      return { x: x + w / 2 + rx * Math.cos(radians), y: y + h / 2 + ry * Math.sin(radians), angle: angle + 90 };
    });
  } else {
    const count = (side: ChairSide) => clampCount(chairs[side], CHAIR_LIMITS.side);
    const along = (length: number, n: number, i: number) => (length * (i + 0.5)) / n;
    spots = [];
    for (let i = 0, n = count('top'); i < n; i += 1) spots.push({ x: x + along(w, n, i), y: y - offset, angle: 0 });
    for (let i = 0, n = count('right'); i < n; i += 1) spots.push({ x: x + w + offset, y: y + along(h, n, i), angle: 90 });
    for (let i = 0, n = count('bottom'); i < n; i += 1) spots.push({ x: x + w - along(w, n, i), y: y + h + offset, angle: 180 });
    for (let i = 0, n = count('left'); i < n; i += 1) spots.push({ x: x - offset, y: y + h - along(h, n, i), angle: 270 });
  }

  const cx = x + w / 2;
  const cy = y + h / 2;
  const rotation = table.rotation || 0;
  return spots.map((spot) => {
    const at = turn(spot.x, spot.y, cx, cy, rotation);
    return {
      cx: tidy(at.x),
      cy: tidy(at.y),
      width: CHAIR.width,
      height: CHAIR.depth,
      angle: (((spot.angle + rotation) % 360) + 360) % 360,
    };
  });
}

const turnTo = (degrees: number) => ((Math.round(degrees) % 360) + 360) % 360;
// `+ 0` turns a -0 into 0.
const snapSeat = (value: number) => Math.max(-SEAT_REACH, Math.min(SEAT_REACH, Math.round(value / SEAT_GRID) * SEAT_GRID)) + 0;

/**
 * The chairs as drawn now, as seats placed by hand — where Custom starts, so
 * switching to it changes nothing on the map. A table already custom keeps its own.
 */
export function seatsFrom(table: ChairTable): FloorSeat[] {
  if (table.chairs?.mode === 'custom') return table.chairs.seats.slice(0, CHAIR_LIMITS.custom);
  const cx = table.x + table.width / 2;
  const cy = table.y + table.height / 2;
  return chairRects({ ...table, rotation: 0 })
    .slice(0, CHAIR_LIMITS.custom)
    .map((chair) => ({ x: Math.round(chair.cx - cx), y: Math.round(chair.cy - cy), rotation: turnTo(chair.angle) }));
}

/**
 * A point on the canvas — where a chair was dragged to — as a seat position:
 * relative to the table's centre with the table's turn taken off, snapped to
 * `SEAT_GRID` and held within `SEAT_REACH`.
 */
export function seatAt(
  table: Pick<ChairTable, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  x: number,
  y: number,
): { x: number; y: number } {
  const cx = table.x + table.width / 2;
  const cy = table.y + table.height / 2;
  const back = turn(x, y, cx, cy, -(table.rotation || 0));
  return { x: snapSeat(back.x - cx), y: snapSeat(back.y - cy) };
}

/** Turn a seat by `step` degrees, kept in 0–359. */
export const turnSeat = (seat: FloorSeat, step: number): FloorSeat => ({ ...seat, rotation: turnTo(seat.rotation + step) });

/**
 * A new chair beside the table: the middle of the first clear side (right,
 * bottom, left, top), then further along the right. Null at the limit.
 */
export function addSeat(table: Pick<ChairTable, 'width' | 'height'>, seats: readonly FloorSeat[]): FloorSeat | null {
  if (seats.length >= CHAIR_LIMITS.custom) return null;
  const offset = CHAIR.gap + CHAIR.depth / 2;
  const across = table.width / 2 + offset;
  const down = table.height / 2 + offset;
  const candidates: FloorSeat[] = [
    { x: across, y: 0, rotation: 90 },
    { x: 0, y: down, rotation: 180 },
    { x: -across, y: 0, rotation: 270 },
    { x: 0, y: -down, rotation: 0 },
  ];
  for (let step = 1; step <= 12; step += 1) {
    candidates.push({ x: across, y: step * 30, rotation: 90 }, { x: across, y: -step * 30, rotation: 90 });
  }
  const spots = candidates.map((seat) => ({ ...seat, x: snapSeat(seat.x), y: snapSeat(seat.y) }));
  const clear = spots.find((spot) => seats.every((seat) => Math.hypot(seat.x - spot.x, seat.y - spot.y) >= CHAIR.width));
  return clear ?? spots[0]!;
}
