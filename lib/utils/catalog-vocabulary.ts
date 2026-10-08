/**
 * What the catalogue is, and therefore what it is called and which tools it
 * shows. Setup records `configuration.vocabulary` on the catalog module from
 * "What do you sell?":
 *
 *   menu    food and drink — modifiers, recipes and cost; no sizes or stock per SKU
 *   retail  physical products — sizes, stock per SKU and photos; no recipes
 *   mixed   both — every tool
 *
 * Absent (older workspaces) means `menu`, what they always had.
 */
export type CatalogVocabulary = 'menu' | 'retail' | 'mixed';

export const CATALOG_VOCABULARIES: readonly CatalogVocabulary[] = ['menu', 'retail', 'mixed'];

export function catalogVocabulary(moduleState: ReadonlyArray<{ moduleId: string; configuration?: unknown }>): CatalogVocabulary {
  const catalog = moduleState.find((state) => state.moduleId === 'catalog');
  const configuration = catalog?.configuration;
  const value = configuration && typeof configuration === 'object' ? (configuration as Record<string, unknown>).vocabulary : undefined;
  return value === 'retail' || value === 'mixed' ? value : 'menu';
}

/** Which product tools a catalogue of this kind needs. */
export function catalogTools(vocabulary: CatalogVocabulary) {
  return {
    /** Sizes, colours and stock per SKU; the photo gallery. */
    retail: vocabulary !== 'menu',
    /** Modifiers, recipes and cost. */
    kitchen: vocabulary !== 'retail',
  };
}

export function catalogWords(vocabulary: CatalogVocabulary) {
  return { ...catalogItemWords(vocabulary), ...orderQueueWords(vocabulary) };
}

/**
 * Where a paid order waits until it is handed over. A shop packs orders rather
 * than cooking them, so it has no kitchen to speak of; anything with a menu
 * (`mixed` included) still does.
 */
function orderQueueWords(vocabulary: CatalogVocabulary) {
  return vocabulary === 'retail'
    ? { inQueue: 'In progress', queue: 'the order queue' }
    : { inQueue: 'In the kitchen', queue: 'the kitchen queue' };
}

function catalogItemWords(vocabulary: CatalogVocabulary) {
  if (vocabulary === 'retail') {
    return {
      section: 'Products',
      item: 'product',
      items: 'products',
      Item: 'Product',
      newItem: 'New product',
      group: 'Category',
      groupPlaceholder: 'Choose a category',
      available: 'For sale',
      namePlaceholder: 'e.g. Oversized hoodie',
      descriptionPlaceholder: 'Fabric, fit and care — what a shopper needs before buying.',
      created: 'Product created — add its sizes and photos next.',
      saved: 'Product saved.',
    };
  }
  if (vocabulary === 'mixed') {
    return {
      section: 'Products',
      item: 'item',
      items: 'items',
      Item: 'Item',
      newItem: 'New item',
      group: 'Category',
      groupPlaceholder: 'Choose a category',
      available: 'For sale',
      namePlaceholder: 'e.g. Flat white, or Logo tote bag',
      descriptionPlaceholder: 'What it is, and what someone needs to know before buying.',
      created: 'Item created.',
      saved: 'Item saved.',
    };
  }
  return {
    section: 'Menu',
    item: 'menu item',
    items: 'menu items',
    Item: 'Menu item',
    newItem: 'New item',
    group: 'Section',
    groupPlaceholder: 'Choose a section',
    available: 'On the menu',
    namePlaceholder: 'e.g. Flat white',
    descriptionPlaceholder: 'What it is, in a line a guest would read.',
    created: 'Item created — you can attach modifiers now.',
    saved: 'Menu item updated.',
  };
}

/** What each choice means, for the setting that changes it. */
export const VOCABULARY_CHOICES: ReadonlyArray<{ value: CatalogVocabulary; label: string; detail: string }> = [
  { value: 'menu', label: 'Food & drink', detail: 'A menu: modifiers, recipes and margins.' },
  { value: 'retail', label: 'Products', detail: 'Sizes, colours, stock per SKU and photos.' },
  { value: 'mixed', label: 'Both', detail: 'Every tool — a café that also sells merch.' },
];
