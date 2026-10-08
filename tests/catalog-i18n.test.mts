import assert from 'node:assert/strict';
import test from 'node:test';

const { extraCurrencies, fromPrice, pricedIn, translationProgress } = await import('../lib/utils/catalog-i18n.ts');

const hoodie = (overrides: Record<string, unknown> = {}) => ({
  item: { description: 'Heavy cotton.' },
  options: [{ id: 'size', values: [{ id: 's' }, { id: 'm' }] }],
  variants: [{ id: 'v-s' }, { id: 'v-m' }],
  translations: { item: [], options: [] },
  prices: [],
  ...overrides,
});

test('the currencies offered: languages first, then what is priced, then what was added — never the base twice', () => {
  const locales = [
    { code: 'en', isDefault: true, currency: null },
    { code: 'uk', isDefault: false, currency: 'UAH' },
    { code: 'pl', isDefault: false, currency: 'gbp' },
  ];
  assert.deepEqual(extraCurrencies(locales, 'GBP', [{ currency: 'EUR' }, { currency: 'UAH' }], ['usd', 'EUR', 'nope']), [
    'UAH',
    'EUR',
    'USD',
  ]);
  assert.deepEqual(extraCurrencies([], 'GBP', []), []);
});

test('translation progress counts name, description, each option and value', () => {
  assert.deepEqual(translationProgress(hoodie(), 'uk'), { done: 0, of: 5 });
  const partial = hoodie({
    translations: {
      item: [{ locale: 'uk', name: 'Худі', description: null }],
      options: [
        { locale: 'uk', optionId: 'size', optionValueId: null, label: 'Розмір' },
        { locale: 'pl', optionId: null, optionValueId: 's', label: 'S' },
      ],
    },
  });
  assert.deepEqual(translationProgress(partial, 'uk'), { done: 2, of: 5 });
  // No description to translate: it doesn't count.
  assert.deepEqual(translationProgress(hoodie({ item: { description: '' }, options: [] }), 'uk'), { done: 0, of: 1 });
});

test('a product price covers every size; otherwise each size needs its own', () => {
  const sizeOnly = hoodie({ prices: [{ variantId: 'v-s', currency: 'UAH', price: '1200.00' }] });
  assert.deepEqual(pricedIn(sizeOnly, 'UAH'), { priced: 1, of: 2 });
  assert.equal(fromPrice(sizeOnly, 'UAH'), null);

  const both = hoodie({
    prices: [
      { variantId: null, currency: 'UAH', price: '1400.00' },
      { variantId: 'v-s', currency: 'UAH', price: '1200.00' },
      { variantId: null, currency: 'EUR', price: '30.00' },
    ],
  });
  assert.deepEqual(pricedIn(both, 'UAH'), { priced: 2, of: 2 });
  assert.equal(fromPrice(both, 'UAH'), '1200.00');
  assert.equal(fromPrice(both, 'EUR'), '30.00');
  assert.equal(fromPrice(hoodie({ variants: [], prices: [{ variantId: null, currency: 'USD', price: '35' }] }), 'USD'), '35.00');
});
