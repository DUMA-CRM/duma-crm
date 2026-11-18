import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type Cell,
  compact,
  firstFreeSlot,
  isValidLayout,
  move,
  nearestSize,
  normalize,
  reflow,
  resize,
} from '../../lib/utils/widget-grid.ts';

const S = { w: 3, h: 2 };
const M = { w: 6, h: 2 };
const L = { w: 6, h: 4 };
const wide = { w: 12, h: 2 };
const sizes = () => [S, M, L];
const cell = (key: string, x: number, y: number, size = M): Cell => ({ key, x, y, ...size });

test('compaction closes vertical gaps and preserves precedence within intersecting columns', () => {
  const original = [cell('b', 7, 6), cell('wide', 1, 15, wide), cell('a', 1, 4, L), cell('c', 1, 20)];
  const packed = [cell('a', 1, 1, L), cell('b', 7, 1), cell('wide', 1, 5, wide), cell('c', 1, 7)];
  assert.deepEqual(compact(original), packed);
  assert.deepEqual(compact(packed), packed);
  assert.ok(isValidLayout(packed, 12));
  assert.equal(original[0]!.y, 6);
});

test('moving into occupied cells pushes the destination and its successors down', () => {
  const original = [cell('a', 1, 1), cell('b', 7, 1), cell('c', 7, 3)];
  const moved = move(original, 'a', 20, 1, 12);
  assert.deepEqual(moved, [cell('a', 7, 1), cell('b', 7, 3), cell('c', 7, 5)]);
  assert.deepEqual(move(moved, 'a', 7, 7, 12), [cell('b', 7, 1), cell('c', 7, 3), cell('a', 7, 5)]);
  assert.ok(isValidLayout(moved, 12));
});

test('resizing clamps to the right edge and cascades into lower rows', () => {
  const layout = [cell('a', 10, 1, S), cell('b', 7, 3), cell('c', 7, 5)];
  assert.deepEqual(resize(layout, 'a', L, 12), [cell('a', 7, 1, L), cell('b', 7, 5), cell('c', 7, 7)]);
  assert.deepEqual(nearestSize(sizes(), 6, 3.6), L);
  assert.equal(nearestSize([], 4, 2), undefined);
});

test('adding starts on the bottom occupied row when there is room', () => {
  assert.deepEqual(firstFreeSlot([], S, 12), { x: 1, y: 1 });
  assert.deepEqual(firstFreeSlot([cell('a', 1, 1, L), cell('b', 7, 3, S)], S, 12), { x: 10, y: 3 });
  assert.deepEqual(firstFreeSlot([cell('a', 1, 1, wide)], S, 12), { x: 1, y: 3 });
});

test('normalization repairs legacy sizes, bad coordinates and overlap, and is idempotent', () => {
  const saved = [cell('a', 19, 4, { w: 8, h: 6 }), cell('b', 7, 6), cell('missing', 0, 7), cell('b', 1, 9)];
  const spec = { columns: 12, sizes: (key: string) => (key === 'missing' ? [] : sizes()) };
  const repaired = [cell('a', 7, 1, L), cell('b', 7, 5)];
  assert.deepEqual(normalize(saved, spec), repaired);
  assert.deepEqual(normalize(repaired, spec), repaired);
});

test('narrow reflow preserves reading order and height using registered widths where possible', () => {
  const saved = [cell('a', 1, 1, wide), cell('b', 1, 3, L), cell('c', 7, 3, S), cell('d', 10, 3, S)];
  const allowed = (key: string) => (key === 'a' ? [wide] : sizes());
  const medium = reflow(saved, { columns: 6, sizes: allowed });
  const narrow = reflow(saved, { columns: 4, sizes: allowed });
  assert.deepEqual(medium, [cell('a', 1, 1), cell('b', 1, 3, L), cell('c', 1, 7, S), cell('d', 4, 7, S)]);
  assert.deepEqual(narrow, [cell('a', 1, 1, { w: 4, h: 2 }), cell('b', 1, 3, { w: 3, h: 4 }), cell('c', 1, 7, S), cell('d', 1, 9, S)]);
  assert.ok(isValidLayout(narrow, 4));
});

test('edge contact is valid, while out-of-bounds cells, duplicates and intersections are rejected', () => {
  const a = cell('a', 1, 1);
  assert.ok(isValidLayout([a, cell('b', 7, 1)], 12));
  assert.equal(isValidLayout([a, cell('b', 8, 1)], 12), false);
  assert.equal(isValidLayout([a, cell('a', 7, 1)], 12), false);
  assert.equal(isValidLayout([a, cell('b', 1, 2)], 12), false);
});

test('on the four-column dashboard a stat fills the first free tile and a stat-row hole stays one tile wide', () => {
  const tile = { w: 1, h: 1 };
  const board = [cell('sales', 1, 1, tile), cell('orders', 2, 1, tile), cell('aov', 3, 1, tile), cell('chart', 1, 2, { w: 4, h: 2 })];
  assert.deepEqual(firstFreeSlot(board, tile, 4), { x: 1, y: 4 });
  assert.deepEqual(firstFreeSlot(board.slice(0, 3), tile, 4), { x: 4, y: 1 });
  assert.deepEqual(
    resize(board, 'sales', { w: 2, h: 1 }, 4).map(({ key, x, y }) => [key, x, y]),
    [
      ['sales', 1, 1],
      ['aov', 3, 1],
      ['orders', 2, 2],
      ['chart', 1, 3],
    ],
  );
});
