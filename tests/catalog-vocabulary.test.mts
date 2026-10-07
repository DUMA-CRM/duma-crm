import assert from 'node:assert/strict';
import test from 'node:test';

const { catalogVocabulary, catalogWords } = await import('../lib/utils/catalog-vocabulary.ts');

test('a shop reads Products; a café, and any older workspace, reads Menu', () => {
  assert.equal(catalogVocabulary([{ moduleId: 'catalog', configuration: { vocabulary: 'retail' } }]), 'retail');
  assert.equal(catalogVocabulary([{ moduleId: 'catalog', configuration: { vocabulary: 'menu' } }]), 'menu');
  assert.equal(catalogVocabulary([{ moduleId: 'catalog', configuration: {} }]), 'menu');
  assert.equal(catalogVocabulary([]), 'menu');
  assert.equal(catalogWords('retail').newItem, 'New product');
  assert.equal(catalogWords('menu').section, 'Menu');
});
