import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_OVERVIEW_LAYOUT,
  OVERVIEW_CARDS,
  OVERVIEW_COLUMNS,
  overviewSizes,
  readOverviewLayout,
} from '../../lib/utils/reservations-overview-layout.ts';
import { isValidLayout } from '../../lib/utils/widget-grid.ts';

test('the default overview places every card once, at a size it comes in, without overlaps', () => {
  assert.ok(isValidLayout(DEFAULT_OVERVIEW_LAYOUT, OVERVIEW_COLUMNS));
  assert.deepEqual(DEFAULT_OVERVIEW_LAYOUT.map(({ key }) => key).sort(), Object.keys(OVERVIEW_CARDS).sort());
  for (const cell of DEFAULT_OVERVIEW_LAYOUT) {
    assert.ok(
      overviewSizes(cell.key).some(({ w, h }) => w === cell.w && h === cell.h),
      cell.key,
    );
  }
});

test('a saved arrangement is kept; junk, unknown cards and impossible sizes are not', () => {
  const saved = [
    { key: 'week', x: 1, y: 1, w: 4, h: 4 },
    { key: 'covers', x: 1, y: 5, w: 2, h: 1 },
    { key: 'retired-card', x: 3, y: 5, w: 1, h: 1 },
  ];
  const layout = readOverviewLayout(JSON.stringify(saved))!;
  assert.deepEqual(
    layout.map(({ key, w, h }) => `${key}:${w}x${h}`),
    ['week:4x4', 'covers:2x1'],
  );
  // A tile asked to be a tall card snaps to the nearest size it has.
  assert.deepEqual(
    readOverviewLayout(JSON.stringify([{ key: 'covers', x: 1, y: 1, w: 2, h: 4 }]))!.map(({ w, h }) => [w, h]),
    [[2, 1]],
  );
  assert.equal(readOverviewLayout('not json'), null);
  assert.equal(readOverviewLayout('{"key":"week"}'), null);
  assert.equal(readOverviewLayout(null), null);
});
