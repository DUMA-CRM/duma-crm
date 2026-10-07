/**
 * What the catalogue is called. Setup records `configuration.vocabulary` on
 * the catalog module — `retail` for a business that sells products — so a
 * clothing shop reads Products and "New product" where a café reads Menu and
 * "New item". Absent (older workspaces) means the café words they always had.
 */
export type CatalogVocabulary = 'menu' | 'retail';

export function catalogVocabulary(moduleState: ReadonlyArray<{ moduleId: string; configuration?: unknown }>): CatalogVocabulary {
  const catalog = moduleState.find((state) => state.moduleId === 'catalog');
  const configuration = catalog?.configuration;
  return configuration && typeof configuration === 'object' && (configuration as Record<string, unknown>).vocabulary === 'retail'
    ? 'retail'
    : 'menu';
}

export function catalogWords(vocabulary: CatalogVocabulary) {
  return vocabulary === 'retail'
    ? { section: 'Products', item: 'product', Item: 'Product', newItem: 'New product' }
    : { section: 'Menu', item: 'menu item', Item: 'Menu item', newItem: 'New item' };
}
