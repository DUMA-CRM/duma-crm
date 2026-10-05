import assert from 'node:assert/strict';
import test from 'node:test';

const { groupModifiers } = await import('../lib/utils/modifier-list.ts');

const groups = [
  { id: 'milk', name: 'Milk', sortOrder: 1, isSize: false },
  { id: 'size', name: 'Size', sortOrder: 0, isSize: true },
  { id: 'extras', name: 'Extras', sortOrder: 2, isSize: false },
];
const m = (id: string, label: string, groupId: string | null, sortOrder = 0) => ({ id, label, groupId, sortOrder, isAvailable: true });

test('groups in set order, modifiers in theirs, unknown group last', () => {
  const sections = groupModifiers([m('1', 'Oat', 'milk', 1), m('2', 'Large', 'size', 2), m('3', 'Small', 'size', 0), m('4', 'Whole', 'milk', 0), m('5', 'Syrup', 'gone')], groups);
  assert.deepEqual(sections.map((s) => [s.name, s.modifiers.map((x) => x.label)]), [['Size', ['Small', 'Large']], ['Milk', ['Whole', 'Oat']], ['Extras', []], ['Other', ['Syrup']]]);
});

test('search drops empty groups', () => {
  const sections = groupModifiers([m('1', 'Oat', 'milk'), m('2', 'Large', 'size')], groups, 'oa');
  assert.deepEqual(sections.map((s) => s.name), ['Milk']);
});
