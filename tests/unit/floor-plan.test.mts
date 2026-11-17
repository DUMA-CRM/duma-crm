import assert from 'node:assert/strict';
import test from 'node:test';

import { autoSides, chairRects, chairTotal, chairsFitShape } from '../../lib/utils/floor-chairs.ts';
import { keepOnCanvas, moveBox, resizeBox, turnBy } from '../../lib/utils/floor-fixtures.ts';

const square = { shape: 'square' as const, x: 100, y: 100, width: 80, height: 80, rotation: 0, maxCovers: 4 };
const long = { shape: 'rectangle' as const, x: 100, y: 100, width: 160, height: 80, rotation: 0, maxCovers: 6 };
const round = { shape: 'round' as const, x: 100, y: 100, width: 80, height: 80, rotation: 0, maxCovers: 4 };

const sideOf = (chair: { cx: number; cy: number }, table: { x: number; y: number; width: number; height: number }) =>
  chair.cy < table.y ? 'top' : chair.cy > table.y + table.height ? 'bottom' : chair.cx < table.x ? 'left' : 'right';

test('auto chairs: one per seat, spread round the table', () => {
  const chairs = chairRects({ ...square, chairs: null });
  assert.equal(chairs.length, 4);
  assert.deepEqual(chairs.map((chair) => sideOf(chair, square)).sort(), ['bottom', 'left', 'right', 'top']);
  // A long table fills its long sides first.
  const longChairs = chairRects({ ...long, chairs: null });
  assert.equal(longChairs.filter((chair) => sideOf(chair, long) === 'top').length, 3);
  assert.equal(longChairs.filter((chair) => sideOf(chair, long) === 'bottom').length, 3);
});

test('per-side chairs go where they are told, centred along each side', () => {
  const table = { ...long, chairs: { mode: 'sides' as const, top: 2, right: 1, bottom: 0, left: 0 } };
  const chairs = chairRects(table);
  assert.equal(chairs.length, 3);
  const top = chairs.filter((chair) => sideOf(chair, long) === 'top');
  assert.deepEqual(
    top.map((chair) => chair.cx),
    [140, 220],
  );
  const right = chairs.find((chair) => sideOf(chair, long) === 'right')!;
  assert.equal(right.cy, 140);
  assert.equal(right.angle, 90);
  assert.equal(chairTotal(table), 3);
});

test('chairs round a round table start at twelve o’clock and space evenly', () => {
  const chairs = chairRects({ ...round, chairs: { mode: 'around', count: 4 } });
  assert.equal(chairs.length, 4);
  assert.equal(chairs[0]!.cx, 140);
  assert.ok(chairs[0]!.cy < 100);
  assert.deepEqual(
    chairs.map((chair) => Math.round(chair.angle)),
    [0, 90, 180, 270],
  );
});

test('chairs turn with the table', () => {
  // Turned a quarter, the one chair on top ends up on the right.
  const chairs = chairRects({ ...square, rotation: 90, chairs: { mode: 'sides', top: 1, right: 0, bottom: 0, left: 0 } });
  assert.equal(chairs.length, 1);
  assert.equal(sideOf(chairs[0]!, square), 'right');
  assert.equal(chairs[0]!.cy, 140);
  assert.equal(chairs[0]!.angle, 90);
});

test('counts are held to the API’s limits, and a layout that doesn’t suit the shape keeps its count', () => {
  assert.equal(chairTotal({ ...square, chairs: { mode: 'sides', top: 40, right: -2, bottom: 0, left: 0 } }), 12);
  assert.equal(chairTotal({ ...round, chairs: { mode: 'around', count: 30 } }), 16);
  assert.equal(chairsFitShape('round', { mode: 'sides', top: 1, right: 1, bottom: 1, left: 1 }), false);
  assert.equal(chairsFitShape('square', { mode: 'around', count: 3 }), false);
  assert.equal(chairsFitShape('round', null), true);
  assert.equal(chairRects({ ...round, chairs: { mode: 'sides', top: 2, right: 1, bottom: 2, left: 1 } }).length, 6);
});

test('auto layout as per-side counts — where the steppers start', () => {
  assert.deepEqual(autoSides(long), { top: 3, right: 0, bottom: 3, left: 0 });
  assert.deepEqual(autoSides(square), { top: 1, right: 1, bottom: 1, left: 1 });
});

test('resizing keeps the opposite edge still and the size on the grid', () => {
  const window = { x: 100, y: 100, width: 160, height: 10, rotation: 0 };
  assert.deepEqual(resizeBox(window, 'e', 43, 0), { ...window, width: 200 });
  assert.deepEqual(resizeBox(window, 'w', -40, 0), { ...window, x: 60, width: 200 });
  // Never thinner than the minimum.
  assert.equal(resizeBox(window, 'e', -500, 0).width, 10);
  // Turned a quarter, dragging the east handle down the screen lengthens it.
  const turned = { x: 100, y: 100, width: 100, height: 20, rotation: 90 };
  const grown = resizeBox(turned, 'e', 0, 40);
  assert.equal(grown.width, 140);
  // Its west end (the top on screen, at centre y − width/2) stays put.
  assert.equal(grown.y + grown.height / 2 - grown.width / 2, turned.y + turned.height / 2 - turned.width / 2);
});

test('moves snap to the grid and stay on the canvas, inside the API’s limits', () => {
  const bar = { x: 0, y: 0, width: 260, height: 60, rotation: 0 };
  assert.deepEqual(moveBox(bar, 123, 47), { ...bar, x: 120, y: 50 });
  assert.deepEqual(moveBox(bar, 2000, -30), { ...bar, x: 940, y: 0 });
  assert.equal(keepOnCanvas({ ...bar, width: 5000 }).width, 1200);
  assert.equal(turnBy(350, 15), 5);
  assert.equal(turnBy(0, -15), 345);
});

test('a table stops at the API’s 600 when resized', () => {
  const table = { x: 0, y: 0, width: 580, height: 80, rotation: 0 };
  assert.equal(resizeBox(table, 'e', 200, 0, 20, 600).width, 600);
});
