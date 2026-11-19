import assert from 'node:assert/strict';
import test from 'node:test';

import { teamLayoutFrom, tillSource } from '../../lib/utils/till-team.ts';

test('a till follows its location’s team layout until it arranges its own; arranging always edits its own copy', () => {
  assert.equal(tillSource({ hasTeam: true, own: false, arranging: false }), 'team');
  assert.equal(tillSource({ hasTeam: true, own: true, arranging: false }), 'device');
  assert.equal(tillSource({ hasTeam: true, own: false, arranging: true }), 'device');
  assert.equal(tillSource({ hasTeam: false, own: false, arranging: false }), 'device');
});

test('publishing takes this workspace’s keys and pins and the sell-screen settings — never the scanner or another workspace', () => {
  const device = {
    showSearch: true,
    showCategories: false,
    menuLayout: 'items',
    tileStyle: 'photo',
    favourites: 'pinned',
    topCount: 10,
    stockHighlight: false,
    swipeToRemove: true,
    scannerMode: 'external',
    pinned: { cafe: ['latte'], other: ['secret'] },
    keyLayouts: { cafe: { all: [{ id: 'latte', w: 2 as const, h: 2 as const }] }, other: { all: [] } },
  };
  const layout = teamLayoutFrom(device, 'cafe');
  assert.deepEqual(layout.pinned, ['latte']);
  assert.deepEqual(Object.keys(layout.keys), ['all']);
  assert.equal('scannerMode' in layout.settings, false);
  assert.equal(layout.settings.tileStyle, 'photo');
  assert.deepEqual(teamLayoutFrom(device, 'new-workspace').keys, {});
});
