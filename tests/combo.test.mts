import assert from 'node:assert/strict';
import test from 'node:test';

const { ruleLabel, satisfied, toggleOption } = await import('../lib/utils/combo.ts');

const size = ['s', 'm', 'l'];
const milk = ['oat', 'soy', 'whole'];

test('choose one swaps; required cannot be emptied', () => {
  const required = { minSelections: 1, maxSelections: 1 };
  assert.deepEqual(toggleOption(['m'], 'l', size, required), ['l']);
  assert.deepEqual(toggleOption(['m'], 'm', size, required), ['m'], 'last required pick stays');
  assert.deepEqual(toggleOption(['m'], 'm', size, { minSelections: 0, maxSelections: 1 }), [], 'optional can be cleared');
});

test('choose many adds up to the max, then the earliest makes way', () => {
  const many = { minSelections: 0, maxSelections: null };
  assert.deepEqual(toggleOption(['m', 'oat'], 'soy', milk, many), ['m', 'oat', 'soy']);
  const upTo2 = { minSelections: 0, maxSelections: 2 };
  assert.deepEqual(toggleOption(['oat', 'soy'], 'whole', milk, upTo2), ['soy', 'whole']);
});

test('labels and satisfaction', () => {
  assert.equal(ruleLabel({ minSelections: 1, maxSelections: 1 }), 'Required · choose one');
  assert.equal(ruleLabel({ minSelections: 0, maxSelections: null }), 'Optional · choose any');
  assert.equal(ruleLabel({ minSelections: 0, maxSelections: 3 }), 'Optional · up to 3');
  assert.equal(satisfied([], size, { minSelections: 1, maxSelections: 1 }), false);
  assert.equal(satisfied(['s'], size, { minSelections: 1, maxSelections: 1 }), true);
});
