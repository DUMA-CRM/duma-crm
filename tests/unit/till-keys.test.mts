import assert from 'node:assert/strict';
import test from 'node:test';

import { type KeyEntry, arrangeKeys, keyLayout, moveKey, nextKeySize } from '../../lib/utils/till-keys.ts';

const item = (id: string) => ({ id });
const ids = (arranged: ReadonlyArray<{ item: { id: string }; w: number; h: number }>) =>
  arranged.map(({ item: { id }, w, h }) => `${id}:${w}x${h}`);

test('an arranged page keeps its order and sizes; new items join the end, removed ones drop out', () => {
  const saved: KeyEntry[] = [
    { id: 'latte', w: 2, h: 2 },
    { id: 'gone', w: 1, h: 1 }, // taken off the menu since
    { id: 'tea', w: 1, h: 1 },
    { id: 'latte', w: 1, h: 1 }, // a duplicate never doubles a key
  ];
  const menu = ['tea', 'cake', 'latte', 'scone'].map(item);
  assert.deepEqual(ids(arrangeKeys(menu, saved)), ['latte:2x2', 'tea:1x1', 'cake:1x1', 'scone:1x1']);
  // Never arranged: the menu's own order, every key plain.
  assert.deepEqual(ids(arrangeKeys(menu, undefined)), ['tea:1x1', 'cake:1x1', 'latte:1x1', 'scone:1x1']);
});

test('a size the till does not know falls back to a plain key rather than breaking the grid', () => {
  const saved = [{ id: 'tea', w: 3, h: 1 }] as unknown as KeyEntry[];
  assert.deepEqual(ids(arrangeKeys([item('tea')], saved)), ['tea:1x1']);
});

test('dropping a key on another moves it there, either direction', () => {
  const layout = keyLayout(arrangeKeys(['a', 'b', 'c', 'd'].map(item), undefined));
  assert.deepEqual(moveKey(layout, 'a', 'c').map(({ id }) => id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveKey(layout, 'd', 'b').map(({ id }) => id), ['a', 'd', 'b', 'c']);
  assert.deepEqual(moveKey(layout, 'a', 'missing'), layout);
});

test('the size button steps key, wide, big, and back', () => {
  assert.deepEqual(nextKeySize({ w: 1, h: 1 }), { w: 2, h: 1 });
  assert.deepEqual(nextKeySize({ w: 2, h: 1 }), { w: 2, h: 2 });
  assert.deepEqual(nextKeySize({ w: 2, h: 2 }), { w: 1, h: 1 });
});
