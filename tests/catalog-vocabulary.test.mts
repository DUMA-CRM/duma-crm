import assert from 'node:assert/strict';
import test from 'node:test';

const { catalogTools, catalogVocabulary, catalogWords } = await import('../lib/utils/catalog-vocabulary.ts');

test('the catalogue says what it is; older workspaces stay a menu', () => {
  assert.equal(catalogVocabulary([{ moduleId: 'catalog', configuration: { vocabulary: 'retail' } }]), 'retail');
  assert.equal(catalogVocabulary([{ moduleId: 'catalog', configuration: { vocabulary: 'mixed' } }]), 'mixed');
  assert.equal(catalogVocabulary([{ moduleId: 'catalog', configuration: { vocabulary: 'nonsense' } }]), 'menu');
  assert.equal(catalogVocabulary([]), 'menu');
});

test('each kind of catalogue gets its own words and only the tools it needs', () => {
  assert.equal(catalogWords('retail').newItem, 'New product');
  assert.equal(catalogWords('retail').group, 'Category');
  assert.equal(catalogWords('menu').available, 'On the menu');
  assert.deepEqual(catalogTools('retail'), { retail: true, kitchen: false });
  assert.deepEqual(catalogTools('menu'), { retail: false, kitchen: true });
  assert.deepEqual(catalogTools('mixed'), { retail: true, kitchen: true });
});

test('only a catalogue with food has a kitchen for orders to wait in', () => {
  assert.equal(catalogWords('retail').inQueue, 'In progress');
  assert.equal(catalogWords('retail').queue, 'the order queue');
  assert.equal(catalogWords('menu').inQueue, 'In the kitchen');
  assert.equal(catalogWords('mixed').queue, 'the kitchen queue');
});

test('a shop is offered only the stock categories it uses, without refiling an item', async () => {
  const { stockCategoriesFor, stockUnitPlaceholder } = await import('../lib/utils/catalog-vocabulary.ts');
  assert.deepEqual(stockCategoriesFor('retail'), ['MERCH', 'SUPPLY']);
  assert.deepEqual(stockCategoriesFor('retail', 'FOOD'), ['MERCH', 'SUPPLY', 'FOOD']);
  assert.deepEqual(stockCategoriesFor('retail', 'SUPPLY'), ['MERCH', 'SUPPLY']);
  assert.deepEqual(stockCategoriesFor('menu'), ['FOOD', 'BEVERAGE', 'SUPPLY', 'MERCH']);
  assert.deepEqual(stockCategoriesFor('mixed', 'MERCH'), ['FOOD', 'BEVERAGE', 'SUPPLY', 'MERCH']);
  assert.equal(stockUnitPlaceholder('retail'), 'pcs, pairs, boxes…');
});
