import assert from 'node:assert/strict';
import test from 'node:test';

import { addSeat, chairRects, chairTotal, chairsFitShape, seatAt, seatsFrom, turnSeat } from '../../lib/utils/floor-chairs.ts';
import { keepOnCanvas, moveBox, pastedBox, resizeBox, squareUp, turnFixture, turnTable } from '../../lib/utils/floor-fixtures.ts';
import { BAR_SEAT, copyLabel, nextBarSeatLabel } from '../../lib/utils/reservations.ts';

/** The shape as drawn — the box turned about its centre — for checking it sits on the 1200 × 800 canvas. */
function drawn(box: { x: number; y: number; width: number; height: number; rotation: number }) {
  const radians = (box.rotation * Math.PI) / 180;
  const halfX = (box.width * Math.abs(Math.cos(radians)) + box.height * Math.abs(Math.sin(radians))) / 2;
  const halfY = (box.width * Math.abs(Math.sin(radians)) + box.height * Math.abs(Math.cos(radians))) / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { left: round(cx - halfX), right: round(cx + halfX), top: round(cy - halfY), bottom: round(cy + halfY) };
}

test('a fixture turned to a right angle is stored straight: width and depth swap round the same centre', () => {
  const wall = { x: 300, y: 300, width: 600, height: 12, rotation: 0 };
  const upright = turnFixture(wall, 90);
  assert.deepEqual(upright, { x: 594, y: 6, width: 12, height: 600, rotation: 0 });
  // Same at 270, and 180 is just straight again.
  assert.deepEqual(turnFixture(wall, 270), upright);
  assert.deepEqual(turnFixture(wall, 180), wall);
  // Odd angles are left as they are.
  assert.equal(turnFixture(wall, 45).rotation, 45);
  // An old save at 90° squares up the same way.
  assert.deepEqual(squareUp({ ...wall, rotation: 90 }), upright);
});

test('an upright wall reaches both side edges, and never goes below 0', () => {
  const upright = turnFixture({ x: 300, y: 300, width: 600, height: 12, rotation: 0 }, 90);
  const left = moveBox(upright, -200, 100);
  assert.equal(left.x, 0);
  assert.equal(drawn(left).left, 0);
  const right = moveBox(upright, 5000, 100);
  assert.equal(drawn(right).right, 1200);
  // Squaring up a long wall near the top would push its corner above 0: it stays on.
  assert.ok(turnFixture({ x: 300, y: 0, width: 600, height: 12, rotation: 0 }, 90).y >= 0);
  // Too long to stand upright on an 800-deep canvas: held to 800.
  assert.equal(turnFixture({ x: 0, y: 0, width: 1200, height: 10, rotation: 0 }, 90).height, 800);
});

test('moves clamp by the shape as drawn, so a turned table stays on the canvas', () => {
  // A long table at 90° reaches the right and bottom edges as drawn, not as stored.
  const table = { x: 500, y: 300, width: 140, height: 80, rotation: 90 };
  const right = moveBox(table, 5000, 5000);
  assert.equal(drawn(right).right, 1200);
  assert.equal(drawn(right).bottom, 800);
  // At the left it stops at the API's x ≥ 0: the stored corner, 30 short of the edge as drawn.
  const left = moveBox(table, -500, 300);
  assert.equal(left.x, 0);
  assert.equal(drawn(left).left, 30);
  // At 45° nothing pokes off the top or the right.
  const turned = moveBox({ x: 500, y: 300, width: 200, height: 20, rotation: 45 }, 5000, -500);
  assert.ok(drawn(turned).right <= 1200);
  assert.ok(drawn(turned).top >= 0);
  assert.ok(turned.x >= 0 && turned.y >= 0);
  // Turning a table near the edge keeps it on the canvas, and keeps its angle.
  const turnedTable = turnTable({ x: 1060, y: 300, width: 140, height: 80, rotation: 0 }, 90);
  assert.equal(turnedTable.rotation, 90);
  assert.ok(drawn(turnedTable).right <= 1200);
});

test('resizing a turned box keeps the drawn shape on the canvas', () => {
  const upright = { x: 1000, y: 300, width: 100, height: 20, rotation: 90 };
  const grown = resizeBox(upright, 'e', 0, 900);
  assert.ok(drawn(grown).bottom <= 800);
  assert.ok(grown.y >= 0);
  assert.deepEqual(keepOnCanvas({ x: 0, y: 0, width: 260, height: 60, rotation: 0 }), { x: 0, y: 0, width: 260, height: 60, rotation: 0 });
});

test('a copy lands 20 down and right in the same area, on the same spot in another, kept on the canvas', () => {
  const bar = { x: 100, y: 100, width: 260, height: 60, rotation: 0 };
  assert.deepEqual(pastedBox(bar, true), { ...bar, x: 120, y: 120 });
  assert.deepEqual(pastedBox(bar, false), bar);
  assert.deepEqual(pastedBox({ ...bar, x: 940, y: 740 }, true), { ...bar, x: 940, y: 740 });
});

test('a copied table takes the next free label', () => {
  assert.equal(copyLabel('T7', ['T7']), 'T8');
  assert.equal(copyLabel('T7', ['T7', 'T8', 't9']), 'T10');
  assert.equal(copyLabel('12', ['12']), '13');
  assert.equal(copyLabel('Booth', ['Booth']), 'Booth 2');
  assert.equal(copyLabel('Booth', ['Booth', 'Booth 2']), 'Booth 3');
  assert.equal(copyLabel('Booth 2', ['Booth', 'Booth 2']), 'Booth 3');
  assert.equal(copyLabel('T09', ['T09']), 'T10');
  assert.equal(copyLabel('T01', ['T01']), 'T02');
  // Never past the API's 20 characters.
  const long = copyLabel('Window table by door', ['Window table by door']);
  assert.ok(long.length <= 20);
  assert.ok(long.endsWith(' 2'));
});

const square = { shape: 'square' as const, x: 100, y: 100, width: 80, height: 80, rotation: 0, maxCovers: 4 };

test('chairs placed by hand fit any shape and draw where they were put, turning with the table', () => {
  const chairs = { mode: 'custom' as const, seats: [{ x: 0, y: -60, rotation: 0 }] };
  assert.equal(chairsFitShape('round', chairs), true);
  assert.equal(chairsFitShape('rectangle', chairs), true);
  assert.equal(chairTotal({ ...square, chairs }), 1);
  // The table's centre is (140, 140): the chair sits 60 above it.
  assert.deepEqual(chairRects({ ...square, chairs }), [{ cx: 140, cy: 80, width: 22, height: 14, angle: 0 }]);
  // Turned a quarter, it ends up 60 to the right, facing the table.
  assert.deepEqual(chairRects({ ...square, rotation: 90, chairs }), [{ cx: 200, cy: 140, width: 22, height: 14, angle: 90 }]);
  // Never more than 20 drawn.
  const many = { mode: 'custom' as const, seats: Array.from({ length: 30 }, () => ({ x: 0, y: 0, rotation: 0 })) };
  assert.equal(chairRects({ ...square, chairs: many }).length, 20);
});

test('switching to Custom starts from the chairs as drawn', () => {
  const sides = { mode: 'sides' as const, top: 1, right: 0, bottom: 1, left: 0 };
  const seats = seatsFrom({ ...square, rotation: 30, chairs: sides });
  assert.deepEqual(seats, [
    { x: 0, y: -53, rotation: 0 },
    { x: 0, y: 53, rotation: 180 },
  ]);
  // Drawn as Custom, they're where the per-side layout drew them.
  const table = { ...square, rotation: 30 };
  assert.deepEqual(chairRects({ ...table, chairs: { mode: 'custom', seats } }), chairRects({ ...table, chairs: sides }));
  assert.equal(seatsFrom({ ...square, chairs: null }).length, 4);
});

test('a seat round-trips: seat → drawn on the canvas → dragged back to the table’s own frame', () => {
  const table = { ...square, rotation: 135 };
  const seat = { x: 35, y: -55, rotation: 45 };
  const [chair] = chairRects({ ...table, chairs: { mode: 'custom', seats: [seat] } });
  assert.deepEqual(seatAt(table, chair!.cx, chair!.cy), { x: 35, y: -55 });
  // A drag snaps to 5 and stays within 400 of the centre.
  assert.deepEqual(seatAt(square, 140 + 33, 140 - 2), { x: 35, y: 0 });
  assert.deepEqual(seatAt(square, 5000, -5000), { x: 400, y: -400 });
  assert.deepEqual(turnSeat(seat, -60), { ...seat, rotation: 345 });
});

test('a new chair goes beside the table on the first clear side, and stops at 20', () => {
  const first = addSeat(square, [])!;
  assert.deepEqual(first, { x: 55, y: 0, rotation: 90 });
  assert.deepEqual(addSeat(square, [first]), { x: 0, y: 55, rotation: 180 });
  const full = Array.from({ length: 20 }, () => first);
  assert.equal(addSeat(square, full), null);
});

test('bar seats get their own B-number series, past the highest taken', () => {
  assert.equal(nextBarSeatLabel([]), 'B1');
  assert.equal(nextBarSeatLabel(['T1', 'T2', 'B1', 'b3', 'Booth']), 'B4');
  assert.equal(BAR_SEAT.covers, 1);
  assert.deepEqual(BAR_SEAT.chairs, { mode: 'around', count: 0 });
});
