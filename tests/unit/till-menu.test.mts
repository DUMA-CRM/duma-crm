import assert from 'node:assert/strict';
import test from 'node:test';

import { FALLBACK_RULE, ruleLabel, satisfied, toggleOption } from '../../lib/utils/combo.ts';
import {
  buildOptionGroups,
  cartItemTotal,
  decimalLineMinor,
  decimalLineTotal,
  defaultSelection,
  menuStockStatus,
  missingGroups,
  quickCash,
  ruleHint,
  toggleInGroup,
} from '../../lib/utils/pos.ts';

const option = (id: string, extra: Record<string, unknown> = {}) => ({ id, label: id, price: 0, ...extra });

test('a line total is the item plus each option, times the quantity — pence and decimals alike', () => {
  assert.equal(cartItemTotal({ item: { price: 320 }, selected: [{ price: 45 }, { price: 50 }], quantity: 3 }), 1245);
  // 3.20 + 0.45 is 3.6500000000000004 in floats.
  assert.equal(decimalLineTotal('3.20', ['0.45']), 3.65);
  assert.equal(decimalLineTotal('0.10', [], 3), 0.3);
  assert.equal(decimalLineMinor('1.10', ['0.20', null, ''], 2), 260);
  // A basket of three 0.10 lines meets a 0.30 minimum, where a float sum came to 0.30000000000000004.
  const basket = [decimalLineMinor('0.10', []), decimalLineMinor('0.10', []), decimalLineMinor('0.10', [])];
  assert.equal(basket.reduce((sum, minor) => sum + minor, 0) / 100 >= 0.3, true);
});

test('quick cash offers the exact amount, the next pound and the notes that cover it', () => {
  assert.deepEqual(quickCash(2340), [2340, 2400, 2500, 3000]);
  assert.deepEqual(quickCash(2000), [2000, 5000]);
  assert.deepEqual(quickCash(150, 'USD'), [150, 200, 500, 1000]);
  assert.deepEqual(quickCash(0), []);
  assert.deepEqual(quickCash(-100), []);
  // An unlisted currency falls back to 5/10/20/50/100.
  assert.deepEqual(quickCash(730, 'CHF'), [730, 800, 1000, 2000]);
});

test('menu stock status: out beats low, size lines defer to the default recipe, untracked is not out', () => {
  const recipes = {
    latte: [
      { stockItemId: 'milk', sizeModifierId: null, stockItem: { name: 'Milk' } },
      { stockItemId: 'beans', sizeModifierId: null, stockItem: { name: 'Beans' } },
      { stockItemId: 'cream', sizeModifierId: 'large' },
    ],
    scone: [{ stockItemId: 'flour' }],
    tea: [{ stockItemId: 'leaves' }],
    cake: [{ stockItemId: 'sponge' }],
  };
  const stock = [
    { stockItemId: 'milk', quantity: '2', lowThreshold: '3' },
    { stockItemId: 'beans', quantity: '0', lowThreshold: '1' },
    { stockItemId: 'cream', quantity: '0', lowThreshold: '1' },
    { stockItemId: 'leaves', quantity: '5', lowThreshold: '1' },
    { stockItemId: 'sponge', quantity: '9', lowThreshold: '1', isAvailable: false, stockItem: { name: 'Sponge' } },
  ];
  assert.deepEqual(menuStockStatus(recipes, stock), {
    latte: { level: 'out', ingredient: 'Beans' },
    cake: { level: 'out', ingredient: 'Sponge' },
  });
  assert.deepEqual(menuStockStatus({ latte: recipes.latte }, [stock[0]!]), { latte: { level: 'low', ingredient: 'Milk' } });
});

test('option groups follow the configured order; loose options fall into category groups and Extras', () => {
  const groups = buildOptionGroups(
    [
      option('whole', { groupId: 'milk', sortOrder: 2, isDefault: true }),
      option('oat', { groupId: 'milk', sortOrder: 1 }),
      option('small', { groupId: 'size', isDefault: true }),
      option('shot', {}),
      option('syrup', { category: 'Flavour', isDefault: true }),
      option('caramel', { category: 'Flavour', isDefault: true }),
      option('orphan', { groupId: 'deleted' }),
    ],
    [
      { id: 'milk', name: 'Milk', minSelections: 1, maxSelections: 1, sortOrder: 2 },
      { id: 'size', name: 'Size', minSelections: 1, maxSelections: 1, sortOrder: 1 },
      { id: 'empty', name: 'Empty', minSelections: 1, maxSelections: 1, sortOrder: 0 },
    ],
  );
  assert.deepEqual(
    groups.map((group) => [group.name, group.options.map((o) => o.id)]),
    [
      ['Size', ['small']],
      ['Milk', ['oat', 'whole']],
      ['Extras', ['shot', 'orphan']],
      ['Flavour', ['syrup', 'caramel']],
    ],
  );
  assert.equal(groups[2]!.maxSelections, null);
  // Defaults are capped to the group's maximum, so a pre-selection is never one the API refuses.
  assert.deepEqual(defaultSelection(groups), ['small', 'whole', 'syrup']);
});

test('tapping options: choose-one swaps, a full group drops its earliest pick, a required pick can be cleared', () => {
  const milk = { id: 'milk', name: 'Milk', minSelections: 1, maxSelections: 1, options: [option('whole'), option('oat')] };
  assert.deepEqual(toggleInGroup(['whole'], 'oat', milk), ['oat']);
  // The cashier can empty a required group to change their mind; missingGroups then holds the Add button.
  assert.deepEqual(toggleInGroup(['whole'], 'whole', milk), []);
  assert.deepEqual(missingGroups([milk], []), [milk]);
  assert.deepEqual(missingGroups([milk], ['oat']), []);

  const toppings = ['a', 'b', 'c'];
  assert.deepEqual(toggleOption(['a', 'b'], 'c', toppings, { minSelections: 0, maxSelections: 2 }), ['b', 'c']);
  assert.deepEqual(toggleOption(['a'], 'b', toppings, { minSelections: 0, maxSelections: null }), ['a', 'b']);
  const pinned = ['a'];
  assert.equal(toggleOption(pinned, 'a', toppings, { minSelections: 1, maxSelections: null }), pinned);
  assert.deepEqual(toggleOption(['x', 'a'], 'b', toppings), ['x', 'b']);
  assert.equal(satisfied(['x'], toppings, { minSelections: 1, maxSelections: 2 }), false);
  assert.equal(satisfied([], toppings, FALLBACK_RULE), true);
});

test('group rules read as people say them', () => {
  assert.equal(ruleHint({ minSelections: 1, maxSelections: 1 }), 'Choose one');
  assert.equal(ruleHint({ minSelections: 0, maxSelections: 1 }), 'Optional');
  assert.equal(ruleHint({ minSelections: 2, maxSelections: null }), 'Choose at least 2');
  assert.equal(ruleHint({ minSelections: 0, maxSelections: null }), 'Optional · any');
  assert.equal(ruleHint({ minSelections: 1, maxSelections: 3 }), 'Choose 1–3');
  // An exact count is "Choose 2", not "Choose 2–2".
  assert.equal(ruleHint({ minSelections: 2, maxSelections: 2 }), 'Choose 2');
  assert.equal(ruleHint({ minSelections: 0, maxSelections: 3 }), 'Optional · up to 3');
  assert.equal(ruleLabel({ minSelections: 1, maxSelections: 1 }), 'Required · choose one');
  assert.equal(ruleLabel({ minSelections: 0, maxSelections: null }), 'Optional · choose any');
});
