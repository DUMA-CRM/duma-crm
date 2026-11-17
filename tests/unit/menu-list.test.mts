import assert from 'node:assert/strict';
import test from 'node:test';

import { type ShowCost, countMenuShow, inMenuShow, parseMenuShow } from '../../lib/utils/menu-list.ts';

const item = (id: string, extra: { isAvailable?: boolean; imageUrl?: string | null } = {}) => ({
  id,
  name: id,
  categoryId: 'c',
  isAvailable: extra.isAvailable ?? true,
  imageUrl: extra.imageUrl ?? null,
});
const cost = (marginPct: number | null, extra: Partial<ShowCost> = {}): ShowCost => ({
  loading: false,
  hasRecipe: true,
  costComplete: marginPct != null,
  marginPct,
  ...extra,
});

test('Not costed and At a loss never count an item that is still costing', () => {
  const items = [item('latte'), item('toastie'), item('brownie'), item('soup'), item('scone')];
  const costs = new Map<string, ShowCost>([
    ['latte', cost(72)],
    ['toastie', cost(-5)],
    ['brownie', cost(null, { hasRecipe: false })],
    ['soup', cost(null)],
    ['scone', cost(null, { loading: true, hasRecipe: false })],
  ]);
  assert.equal(countMenuShow(items, costs, 'loss'), 1);
  assert.equal(countMenuShow(items, costs, 'not-costed'), 2);
  assert.equal(inMenuShow(items[4], costs.get('scone'), 'not-costed'), false);
  // No cost entry at all (a shop, or not requested yet) is not "not costed" either.
  assert.equal(inMenuShow(items[0], undefined, 'not-costed'), false);
});

test('a margin of exactly zero is not a loss', () => {
  assert.equal(inMenuShow(item('tea'), cost(0), 'loss'), false);
  assert.equal(inMenuShow(item('tea'), cost(-0.4), 'loss'), true);
});

test('on, off and no photo read the item alone', () => {
  const items = [item('a'), item('b', { isAvailable: false }), item('c', { imageUrl: 'https://x/c.jpg' })];
  const none = new Map<string, ShowCost>();
  assert.equal(countMenuShow(items, none, 'all'), 3);
  assert.equal(countMenuShow(items, none, 'on'), 2);
  assert.equal(countMenuShow(items, none, 'off'), 1);
  assert.equal(countMenuShow(items, none, 'no-photo'), 2);
});

test('a ?show= value the workspace has no use for falls back to everything', () => {
  assert.equal(parseMenuShow('loss', true), 'loss');
  assert.equal(parseMenuShow('loss', false), 'all');
  assert.equal(parseMenuShow('no-photo', false), 'no-photo');
  assert.equal(parseMenuShow('no-photo', true), 'all');
  assert.equal(parseMenuShow(null, true), 'all');
  assert.equal(parseMenuShow('anything', true), 'all');
});
