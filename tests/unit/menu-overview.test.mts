import assert from 'node:assert/strict';
import test from 'node:test';

import { type OverviewCost, averageMargin, lowestMargins, menuAttention } from '../../lib/utils/menu-overview.ts';

const cost = (marginPct: number | null, extra: Partial<OverviewCost> = {}): OverviewCost => ({
  loading: false,
  hasRecipe: true,
  costComplete: marginPct != null,
  marginPct,
  ...extra,
});

test('a kitchen menu flags losses first, then recipe gaps, then empty sections and groups — never an item still costing', () => {
  const items = [
    { id: 'a', name: 'Latte', isAvailable: true },
    { id: 'b', name: 'Toastie', isAvailable: true },
    { id: 'c', name: 'Brownie', isAvailable: true },
    { id: 'd', name: 'Soup', isAvailable: true },
    { id: 'e', name: 'Scone', isAvailable: true },
  ];
  const costs = new Map<string, OverviewCost>([
    ['a', cost(72)],
    ['b', cost(-5)],
    ['c', cost(null, { hasRecipe: false })],
    ['d', cost(null)],
    ['e', cost(null, { loading: true, hasRecipe: false })],
  ]);
  const entries = menuAttention({
    items,
    costs,
    sections: [
      { id: 's1', name: 'Coffee', isActive: true, itemCount: 3 },
      { id: 's2', name: 'Specials', isActive: true, itemCount: 0 },
      { id: 's3', name: 'Winter', isActive: false, itemCount: 0 },
    ],
    groups: [
      { id: 'g1', name: 'Milk', optionCount: 3 },
      { id: 'g2', name: 'Syrups', optionCount: 0 },
    ],
    kitchen: true,
  });
  assert.deepEqual(
    entries.map((entry) => entry.key),
    ['loss:b', 'no-recipe:c', 'costs-missing:d', 'empty-section:s2', 'empty-group:g2'],
  );
});

test('a shop is judged on photos, not recipes, and has no modifier groups', () => {
  const entries = menuAttention({
    items: [
      { id: 'a', name: 'Tee', isAvailable: true, imageUrl: 'https://x/tee.jpg' },
      { id: 'b', name: 'Mug', isAvailable: true, imageUrl: null },
    ],
    costs: new Map(),
    sections: [],
    groups: [{ id: 'g', name: 'Unused', optionCount: 0 }],
    kitchen: false,
  });
  assert.deepEqual(
    entries.map((entry) => entry.key),
    ['no-photo:b'],
  );
});

test('margins count only costed items on the menu; nothing costed is no figure, not 100%', () => {
  const items = [
    { id: 'a', name: 'Latte', isAvailable: true },
    { id: 'b', name: 'Mocha', isAvailable: true },
    { id: 'c', name: 'Off', isAvailable: false },
    { id: 'd', name: 'Uncosted', isAvailable: true },
  ];
  const costs = new Map<string, OverviewCost>([
    ['a', cost(70)],
    ['b', cost(50)],
    ['c', cost(-20)],
    ['d', cost(null, { hasRecipe: false })],
  ]);
  assert.deepEqual(averageMargin(items, costs), { pct: 60, costed: 2 });
  assert.deepEqual(
    lowestMargins(items, costs).map((row) => row.item.id),
    ['b', 'a'],
  );
  assert.equal(averageMargin(items, new Map()), null);
});
