import assert from 'node:assert/strict';
import test from 'node:test';

const { soleLocationToSelect } = await import('../lib/utils/sole-location.ts');

const site = (id: string, isActive = true) => ({ id, isActive });

test('the only location is selected in place of all locations', () => {
  assert.equal(soleLocationToSelect([site('a')], null), 'a');
});

test('nothing to do once it is already selected', () => {
  assert.equal(soleLocationToSelect([site('a')], 'a'), null);
});

test('a stale selection moves to the one that is left', () => {
  assert.equal(soleLocationToSelect([site('a')], 'deleted'), 'a');
});

test('inactive locations do not count as a choice', () => {
  assert.equal(soleLocationToSelect([site('a'), site('b', false)], null), 'a');
});

test('several locations, or none, leave the choice to the person', () => {
  assert.equal(soleLocationToSelect([site('a'), site('b')], null), null);
  assert.equal(soleLocationToSelect([], null), null);
  assert.equal(soleLocationToSelect([site('a', false)], null), null);
});
