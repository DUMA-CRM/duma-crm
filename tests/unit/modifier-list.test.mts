import assert from 'node:assert/strict';
import test from 'node:test';

import { groupModifiers, narrowModifierSections } from '../../lib/utils/modifier-list.ts';

const groups = [
  { id: 'size', name: 'Size', sortOrder: 0, isSize: true },
  { id: 'milk', name: 'Milk', sortOrder: 1, isSize: false },
  { id: 'syrup', name: 'Syrup', sortOrder: 2, isSize: false },
];
const modifiers = [
  { id: 'r', label: 'Regular', groupId: 'size', isAvailable: true },
  { id: 'l', label: 'Large', groupId: 'size', isAvailable: true },
  { id: 'o', label: 'Oat', groupId: 'milk', isAvailable: false },
  { id: 'w', label: 'Whole', groupId: 'milk', isAvailable: true },
];
const sections = groupModifiers(modifiers, groups);

test('unavailable shows only the groups with something switched off', () => {
  const out = narrowModifierSections(sections, 'all', 'unavailable');
  assert.deepEqual(
    out.map((s) => [s.id, s.modifiers.map((m) => m.id)]),
    [['milk', ['o']]],
  );
});

test('one group stays shown even when it is empty, so it can be added to', () => {
  assert.deepEqual(
    narrowModifierSections(sections, 'syrup', 'any').map((s) => s.id),
    ['syrup'],
  );
  assert.deepEqual(narrowModifierSections(sections, 'syrup', 'available'), []);
});

test('no filter keeps every group, empty ones included, in the till’s order', () => {
  assert.deepEqual(
    narrowModifierSections(sections, 'all', 'any').map((s) => s.id),
    ['size', 'milk', 'syrup'],
  );
});
