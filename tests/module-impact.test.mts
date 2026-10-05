import assert from 'node:assert/strict';
import test from 'node:test';

const { automationName, capabilityName, describeModuleImpact, pageName } = await import('../lib/utils/module-impact.ts');

test('pages read as names, and detail pages fold into their parent', () => {
  assert.equal(pageName('/inventory/stocktakes'), 'Stocktakes');
  assert.equal(pageName('/inventory/restock-requests'), 'Restock requests');
  assert.equal(pageName('/inventory/items/[id]'), null);
  assert.equal(pageName('/menu/modifiers/new'), null);
  assert.equal(pageName('/kds'), 'Kitchen screen');
});

test('capabilities read as what staff can do', () => {
  assert.equal(capabilityName('stock:read'), 'View stock');
  assert.equal(capabilityName('stock.locations:write'), 'Edit stock locations');
  assert.equal(capabilityName('orders:refund'), 'Refund orders');
});

test('automations drop the module prefix', () => {
  assert.equal(automationName('inventory.expiry-sweep'), 'Expiry sweep');
});

test('the impact is grouped, de-duplicated and skips empty groups', () => {
  const groups = describeModuleImpact(
    {
      navigation: ['/inventory'],
      routes: ['/inventory', '/inventory/items/[id]', '/inventory/stocktakes'],
      widgets: ['inventory.low-stock'],
      backgroundWorkers: ['inventory.expiry-sweep'],
      integrations: [],
      capabilities: ['stock:read', 'stock:read'],
    },
    { 'inventory.low-stock': 'Low stock' },
  );
  assert.deepEqual(
    groups.map((group) => [group.key, group.items]),
    [
      ['pages', ['Inventory', 'Stocktakes']],
      ['panels', ['Low stock']],
      ['automations', ['Expiry sweep']],
      ['access', ['View stock']],
    ],
  );
});

const { listSentence } = await import('../lib/utils/module-impact.ts');

test('lists read as a sentence', () => {
  assert.equal(listSentence([]), '');
  assert.equal(listSentence(['Stock']), 'Stock');
  assert.equal(listSentence(['Inventory', 'Stocktakes']), 'Inventory and Stocktakes');
  assert.equal(listSentence(['A', 'B', 'C']), 'A, B and C');
});
