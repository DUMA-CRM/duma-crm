import assert from 'node:assert/strict';
import test from 'node:test';

const { CURRENCIES, currencyLabel, currencySymbol, formatCurrency } = await import('../lib/utils/currencies.ts');

test('the hryvnia and the usual currencies are offered, each with its sign', () => {
  assert.ok(CURRENCIES.some((entry) => entry.code === 'UAH'));
  assert.equal(currencySymbol('UAH'), '₴');
  assert.equal(currencySymbol('GBP'), '£');
  assert.equal(currencySymbol('EUR'), '€');
  assert.equal(currencyLabel('UAH'), 'UAH — Ukrainian hryvnia (₴)');
  assert.equal(currencySymbol('XXZ'), 'XXZ', 'an unknown code falls back to itself');
});

test('a price reads in its own currency', () => {
  assert.equal(formatCurrency('1250.5', 'UAH'), '₴1,250.50');
  assert.equal(formatCurrency(45, 'GBP', 0), '£45');
  assert.equal(formatCurrency(3, 'NOPE'), '3.00 NOPE');
});
