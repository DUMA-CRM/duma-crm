// ─── Things on the floor that aren't tables ──────────────────────────────────
//
// Windows, the entrance, the bar, a pillar: their names, the size each starts
// at, and the geometry the editor uses to move, resize and turn anything on the
// plan within the API's limits (x 0–1200, y 0–800, width 4–1200, height 4–800,
// rotation 0–359). Free of React so it's tested.
// Relative, not aliased: node's type stripping resolves value imports for real.
import { CANVAS, type FixtureKind, GRID, snap } from './reservations.ts';

export const FIXTURE_KINDS: readonly FixtureKind[] = [
  'entrance',
  'door',
  'window',
  'wall',
  'bar',
  'counter',
  'kitchen',
  'toilets',
  'stairs',
  'pillar',
  'plant',
  'label',
];

export const FIXTURE_NAMES: Record<FixtureKind, string> = {
  window: 'Window',
  wall: 'Wall',
  entrance: 'Entrance',
  door: 'Door',
  bar: 'Bar',
  counter: 'Counter',
  kitchen: 'Kitchen',
  toilets: 'Toilets',
  stairs: 'Stairs',
  pillar: 'Pillar',
  plant: 'Plant',
  label: 'Label',
};

/** The size each kind starts at, in canvas units. */
export const FIXTURE_SIZE: Record<FixtureKind, { width: number; height: number }> = {
  window: { width: 160, height: 10 },
  wall: { width: 200, height: 10 },
  entrance: { width: 100, height: 10 },
  door: { width: 80, height: 10 },
  bar: { width: 260, height: 60 },
  counter: { width: 160, height: 50 },
  kitchen: { width: 240, height: 160 },
  toilets: { width: 120, height: 100 },
  stairs: { width: 100, height: 140 },
  pillar: { width: 30, height: 30 },
  plant: { width: 40, height: 40 },
  label: { width: 140, height: 30 },
};

/** Drawn as a line along their length rather than a block. */
export const isThinFixture = (kind: FixtureKind) => kind === 'window' || kind === 'wall' || kind === 'entrance' || kind === 'door';

/** What a fixture shows: its own label, or its kind's name. Pillars and plants say nothing unless given a label. */
export function fixtureCaption(fixture: { kind: FixtureKind; label: string | null }): string | null {
  const own = fixture.label?.trim();
  if (own) return own;
  return fixture.kind === 'pillar' || fixture.kind === 'plant' || fixture.kind === 'wall' ? null : FIXTURE_NAMES[fixture.kind];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** Turn by `step` degrees (negative turns back), kept in 0–359. */
export const turnBy = (rotation: number, step: number) => ((Math.round(rotation + step) % 360) + 360) % 360;

/** Rounded off a hair, so 6e-17 from a cosine never tips a ceil or floor. */
const tidy = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Keep a box on the canvas, with its size within the limits. What stays inside
 * is the shape as drawn — the box turned about its centre — so a turned wall
 * reaches every edge it can. The API stores the unturned corner and refuses
 * x or y below 0, so a long box at an odd angle may stop short of the left or
 * top edge; at a right angle a fixture is squared up first (`squareUp`).
 */
export function keepOnCanvas<T extends Box>(box: T, min = GRID): T {
  const width = Math.min(CANVAS.width, Math.max(min, Math.round(box.width)));
  const height = Math.min(CANVAS.height, Math.max(min, Math.round(box.height)));
  const rotation = turnBy(box.rotation, 0);
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  // Half the drawn shape's width and height, beside half the unturned box's.
  const halfX = (width * cos + height * sin) / 2;
  const halfY = (width * sin + height * cos) / 2;
  const clamp = (value: number, low: number, high: number) => {
    const lowest = Math.max(0, Math.ceil(tidy(low)));
    return Math.min(Math.max(lowest, Math.round(value)), Math.max(lowest, Math.floor(tidy(high))));
  };
  return {
    ...box,
    width,
    height,
    x: clamp(box.x, halfX - width / 2, CANVAS.width - width / 2 - halfX),
    y: clamp(box.y, halfY - height / 2, CANVAS.height - height / 2 - halfY),
    rotation,
  };
}

/**
 * A fixture at a right angle, stored straight: at 90° or 270° its width and
 * depth swap round the same centre and the turn goes back to 0; at 180° the
 * turn just goes (every fixture looks the same upside down). So a wall turned
 * upright is an upright box — it moves, clamps and reaches the edges like any
 * other. Not for tables: their chairs are per side, and a side is top, right,
 * bottom or left of the table as it was drawn.
 */
export function squareUp<T extends Box>(box: T): T {
  const rotation = turnBy(box.rotation, 0);
  const min = Math.min(box.width, box.height);
  if (rotation === 180) return keepOnCanvas({ ...box, rotation: 0 }, min);
  if (rotation !== 90 && rotation !== 270) return keepOnCanvas({ ...box, rotation }, min);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return keepOnCanvas({ ...box, width: box.height, height: box.width, x: cx - box.height / 2, y: cy - box.width / 2, rotation: 0 }, min);
}

/** Turn a fixture to `rotation`, squared up at the right angles. */
export const turnFixture = <T extends Box>(box: T, rotation: number): T => squareUp({ ...box, rotation });

/** Turn a table to `rotation`, the drawn shape kept on the canvas. Tables keep their angle (see `squareUp`). */
export const turnTable = <T extends Box>(box: T, rotation: number): T =>
  keepOnCanvas({ ...box, rotation }, Math.min(box.width, box.height));

/**
 * Where a copy lands: 20 down and right of the original in the same area, or
 * on the same spot in another one — kept on the canvas either way.
 */
export const pastedBox = <T extends Box>(box: T, sameArea: boolean): T =>
  keepOnCanvas({ ...box, x: box.x + (sameArea ? 20 : 0), y: box.y + (sameArea ? 20 : 0) }, Math.min(box.width, box.height));

/** The edge a resize handle drags: north, east, south or west, in the box's own (turned) frame. */
export type Handle = 'n' | 'e' | 's' | 'w';

/**
 * Drag a resize handle by (dx, dy) on the canvas. The opposite edge stays where
 * it is on screen, even on a turned box; the new size snaps to the grid and
 * stays between `min` and `max` (tables stop at 600 in the API); the result is
 * kept on the canvas.
 */
export function resizeBox<T extends Box>(box: T, handle: Handle, dx: number, dy: number, min = GRID, max = Infinity): T {
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // The drag in the box's own frame.
  const along = dx * cos + dy * sin;
  const across = -dx * sin + dy * cos;
  const horizontal = handle === 'e' || handle === 'w';
  const pull = handle === 'e' ? along : handle === 'w' ? -along : handle === 's' ? across : -across;
  const before = horizontal ? box.width : box.height;
  const other = horizontal ? box.height : box.width;
  // The longest this side may grow with the shape, as drawn, still fitting the canvas.
  const fits = (room: number, share: number, rest: number) => (share > 1e-6 ? (room - rest) / share : Infinity);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  const drawnLimit = Math.min(
    fits(CANVAS.width, horizontal ? absCos : absSin, other * (horizontal ? absSin : absCos)),
    fits(CANVAS.height, horizontal ? absSin : absCos, other * (horizontal ? absCos : absSin)),
  );
  const limit = Math.min(horizontal ? CANVAS.width : CANVAS.height, Math.floor(drawnLimit / GRID) * GRID);
  const after = Math.min(limit, max, Math.max(min, snap(before + pull)));
  const grown = after - before;
  // Move the centre half the growth towards the dragged edge, in the turned frame.
  const sign = handle === 'e' || handle === 's' ? 1 : -1;
  const shiftX = horizontal ? (sign * grown * cos) / 2 : (-sign * grown * sin) / 2;
  const shiftY = horizontal ? (sign * grown * sin) / 2 : (sign * grown * cos) / 2;
  const cx = box.x + box.width / 2 + shiftX;
  const cy = box.y + box.height / 2 + shiftY;
  const width = horizontal ? after : box.width;
  const height = horizontal ? box.height : after;
  return keepOnCanvas({ ...box, width, height, x: cx - width / 2, y: cy - height / 2 }, Math.min(min, width, height));
}

/** Move a box so its corner sits at (x, y), snapped to the grid and kept on the canvas. */
export const moveBox = <T extends Box>(box: T, x: number, y: number): T =>
  keepOnCanvas({ ...box, x: snap(x), y: snap(y) }, Math.min(box.width, box.height));
