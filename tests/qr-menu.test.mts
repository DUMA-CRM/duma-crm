import assert from 'node:assert/strict';
import test from 'node:test';

const { groupQrMenu, MAX_FEATURED, toggleFeatured } = await import('../lib/utils/qr-menu.ts');

const categories = [
  { id: 'food', name: 'Food', isActive: true, sortOrder: 1 },
  { id: 'drinks', name: 'Drinks', isActive: true, sortOrder: 2 },
  { id: 'old', name: 'Old', isActive: false, sortOrder: 0 },
  { id: 'empty', name: 'Empty', isActive: true, sortOrder: 3 },
];
const items = [
  { id: 'a', categoryId: 'food', name: 'Toast', isAvailable: true },
  { id: 'b', categoryId: 'food', name: 'Bagel', isAvailable: true },
  { id: 'c', categoryId: 'drinks', name: 'Latte', isAvailable: false },
  { id: 'd', categoryId: 'old', name: 'Scone', isAvailable: true },
  { id: 'e', categoryId: 'gone', name: 'Muffin', isAvailable: true },
];

test('categories follow the configured order, then their own', () => {
  const groups = groupQrMenu(items, categories, { categoryOrder: ['drinks'], featuredItemIds: [] });
  assert.deepEqual(
    groups.map((group) => group.id),
    ['drinks', 'old', 'food', 'uncategorised'],
  );
});

test('inactive and unknown categories are marked as not reaching guests; empty ones drop', () => {
  const groups = groupQrMenu(items, categories, { categoryOrder: [], featuredItemIds: [] });
  assert.equal(groups.find((group) => group.id === 'old')?.reachesGuests, false);
  assert.equal(groups.find((group) => group.id === 'uncategorised')?.reachesGuests, false);
  assert.equal(
    groups.find((group) => group.id === 'empty'),
    undefined,
  );
});

test('featured items lead their category, the rest sort by name', () => {
  const food = groupQrMenu(items, categories, { categoryOrder: [], featuredItemIds: ['a'] }).find((group) => group.id === 'food');
  assert.deepEqual(
    food?.items.map((item) => item.name),
    ['Toast', 'Bagel'],
  );
});

test('featuring toggles and stops at the cap', () => {
  assert.deepEqual(toggleFeatured(['a'], 'a'), []);
  assert.deepEqual(toggleFeatured([], 'a'), ['a']);
  const full = Array.from({ length: MAX_FEATURED }, (_, index) => `x${index}`);
  assert.equal(toggleFeatured(full, 'new'), full);
});
