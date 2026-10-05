import assert from 'node:assert/strict';
import test from 'node:test';

const { filterMenuItems, groupByCategory, setupGaps } = await import('../lib/utils/menu-list.ts');

const item = (id: string, name: string, categoryId: string, extra: Record<string, unknown> = {}) => ({ id, name, categoryId, isAvailable: true, ...extra });

test('filters by search and category, A to Z', () => {
  const items = [item('1', 'Oat latte', 'c1'), item('2', 'Croissant', 'c2', { description: 'Butter pastry' }), item('3', 'Americano', 'c1')];
  assert.deepEqual(filterMenuItems(items, '', 'c1').map((i) => i.name), ['Americano', 'Oat latte']);
  assert.deepEqual(filterMenuItems(items, 'pastry', 'all').map((i) => i.id), ['2']);
});

test('groups follow menu order, unknown last, with availability counts', () => {
  const groups = groupByCategory([item('1', 'A', 'x'), item('2', 'B', 'c2', { isAvailable: false }), item('3', 'C', 'c1')], [
    { id: 'c1', name: 'Coffee', sortOrder: 0 },
    { id: 'c2', name: 'Bakery', sortOrder: 1 },
  ]);
  assert.deepEqual(groups.map((g) => [g.name, g.items.length, g.available]), [['Coffee', 1, 1], ['Bakery', 1, 0], ['Uncategorised', 1, 1]]);
});

test('setup gaps', () => {
  assert.deepEqual(setupGaps(item('1', 'A', 'c'), undefined), ['No recipe', 'No image']);
  assert.deepEqual(setupGaps(item('1', 'A', 'c', { imageUrl: 'x' }), { hasRecipe: true, costComplete: false }), ['Ingredient costs missing']);
  assert.deepEqual(setupGaps(item('1', 'A', 'c', { imageUrl: 'x' }), { hasRecipe: true, costComplete: true }), []);
});
