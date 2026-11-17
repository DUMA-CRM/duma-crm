import assert from 'node:assert/strict';
import test from 'node:test';

import {
  displayPrice,
  formatPriceChange,
  matchesSearch,
  menuItemErrors,
  offeredSummary,
  priceChangeWords,
  ruleKey,
  ruleWords,
} from '../../lib/utils/menu-editor.ts';

const draft = { name: 'Flat white', categoryId: 'c1', price: '3.20', imageUrl: '', slug: '' };

test('a complete menu item has no errors', () => {
  assert.deepEqual(menuItemErrors(draft, 'Choose a section'), {});
});

test('prices take at most two decimal places and no currency sign', () => {
  for (const price of ['3', '3.2', '3.20', '0.00']) assert.equal(menuItemErrors({ ...draft, price }, 'x').price, undefined, price);
  for (const price of ['', '3.205', '£3.20', '-1', '3,20', '.50']) assert.ok(menuItemErrors({ ...draft, price }, 'x').price, price);
});

test('name, section, image link and web address are checked as the API expects', () => {
  const errors = menuItemErrors({ name: 'F', categoryId: '', price: '1', imageUrl: 'ftp://x', slug: 'Bad Slug' }, 'Choose a section');
  assert.equal(errors.name, 'At least two characters.');
  assert.equal(errors.category, 'Choose a section.');
  assert.ok(errors.image);
  assert.ok(errors.slug);
  assert.equal(menuItemErrors({ ...draft, imageUrl: '/v1/menu-items/images/abc', slug: 'oat-latte-2' }, 'x').image, undefined);
});

test('a price is displayed as typed, padded to pence, never re-rounded', () => {
  assert.equal(displayPrice('3.2'), '3.20');
  assert.equal(displayPrice('3'), '3.00');
  assert.equal(displayPrice('12.05'), '12.05');
  assert.equal(displayPrice('3.205'), null);
  assert.equal(displayPrice(''), null);
});

test('a price change reads with its sign, and none reads as no charge', () => {
  assert.equal(formatPriceChange('0.5', '£'), '+£0.50');
  assert.equal(formatPriceChange('-0.20', '£'), '−£0.20');
  assert.equal(formatPriceChange('0', '£'), '');
  assert.equal(formatPriceChange(null, '£'), '');
  assert.equal(priceChangeWords('0'), 'No charge');
  assert.equal(priceChangeWords('-0.2'), 'Takes money off');
  assert.equal(priceChangeWords('0.5'), 'Added to the item’s price');
});

test('group rules round-trip through the select’s keys', () => {
  assert.equal(ruleKey({ minSelections: 1, maxSelections: 1 }), '1:1');
  assert.equal(ruleKey({ minSelections: 0, maxSelections: null }), '0:many');
  assert.equal(ruleWords({ minSelections: 1, maxSelections: null }), 'Required · choose many');
  assert.equal(ruleWords({ minSelections: 2, maxSelections: 3 }), null);
});

test('offered options are named whole, then counted', () => {
  assert.equal(offeredSummary([]), '');
  assert.equal(offeredSummary(['Oat', 'Soy']), 'Oat · Soy');
  assert.equal(offeredSummary(['Oat', 'Soy', 'Almond', 'Coconut', 'Hazelnut']), 'Oat · Soy · Almond +2');
});

test('search ignores case and accents, and a blank search keeps everything', () => {
  assert.ok(matchesSearch('Crème brûlée syrup', 'creme'));
  assert.ok(matchesSearch('Oat milk', ''));
  assert.ok(!matchesSearch('Oat milk', 'soy'));
});
