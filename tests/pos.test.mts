import assert from 'node:assert/strict';
import test from 'node:test';

const {
  applyKey, buildOptionGroups, cartSignature, changeDue, countByItem, defaultSelection, entryToMinor, filterMenu, lineKey,
  missingGroups, quickCash, ruleHint, toggleInGroup,
} = await import('../lib/utils/pos.ts');

const item = (id: string, name: string, category = 'c1') => ({ id, name, category, price: 300, image: '', modifiers: [] });

test('quick cash offers exact, the next whole unit and covering notes', () => {
  assert.deepEqual(quickCash(2340, 'GBP'), [2340, 2400, 2500, 3000]);
  assert.deepEqual(quickCash(500, 'GBP'), [500, 1000, 2000, 5000]);
  assert.deepEqual(quickCash(0), []);
  assert.equal(quickCash(1234, 'XYZ')[0], 1234);
});

test('the keypad shifts digits in from the right', () => {
  let entry = '';
  for (const key of ['2', '0', '0', '0'] as const) entry = applyKey(entry, key);
  assert.equal(entryToMinor(entry), 2000);
  assert.equal(applyKey(entry, 'back'), '200');
  assert.equal(applyKey('5', '00'), '500');
  assert.equal(applyKey('', '0'), '');
  assert.equal(applyKey('12345678', '9'), '12345678');
  assert.equal(applyKey('123', 'clear'), '');
});

test('change and shortfall', () => {
  assert.deepEqual(changeDue(2000, 1540), { change: 460, short: 0 });
  assert.deepEqual(changeDue(1000, 1540), { change: 0, short: 540 });
});

test('search spans categories and ranks word starts first', () => {
  const items = [item('a', 'Iced latte', 'c2'), item('b', 'Latte'), item('c', 'Chocolate cake', 'c3'), item('d', 'Flat white')];
  assert.deepEqual(filterMenu(items, 'c1', 'lat').map((i) => i.id), ['b', 'a', 'c', 'd']);
  assert.deepEqual(filterMenu(items, 'c1', '').map((i) => i.id), ['b', 'd']);
  assert.equal(filterMenu(items, 'all', '').length, 4);
  assert.deepEqual(filterMenu(items, 'all', 'whi').map((i) => i.id), ['d']);
});

test('option groups follow the API rules, with extras as optional-any', () => {
  const options = [
    { id: 's', label: 'Small', price: 0, groupId: 'size', isDefault: true },
    { id: 'l', label: 'Large', price: 50, groupId: 'size' },
    { id: 'soy', label: 'Soy', price: 40, groupId: 'milk', sortOrder: 2 },
    { id: 'oat', label: 'Oat', price: 40, groupId: 'milk', sortOrder: 1 },
    { id: 'shot', label: 'Extra shot', price: 60 },
  ];
  const groups = buildOptionGroups(options, [
    // The per-item rule order disagrees on purpose: the Categories page order (sortOrder) wins.
    { id: 'milk', name: 'Milk', minSelections: 0, maxSelections: 1, sortOrder: 1, itemSortOrder: 0 },
    { id: 'size', name: 'Size', minSelections: 1, maxSelections: 1, sortOrder: 0, itemSortOrder: 1 },
  ]);
  assert.deepEqual(groups.map((g) => g.name), ['Size', 'Milk', 'Extras']);
  assert.deepEqual(groups[1].options.map((o) => o.id), ['oat', 'soy']);
  assert.deepEqual(defaultSelection(groups), ['s']);
  const size = groups[0];
  assert.deepEqual(toggleInGroup(['s'], 'l', size), ['l']);
  assert.deepEqual(toggleInGroup(['s'], 's', size), []);
  assert.deepEqual(missingGroups(groups, []).map((g) => g.name), ['Size']);
  assert.equal(missingGroups(groups, ['l']).length, 0);
  assert.deepEqual(toggleInGroup(['shot'], 'oat', groups[1]), ['shot', 'oat']);
  assert.equal(ruleHint(size), 'Choose one');
  assert.equal(ruleHint(groups[2]), 'Optional · any');
});

test('lines, counts and the checkout signature', () => {
  const latte = item('b', 'Latte');
  const cart = [
    { cartId: '1', item: latte, quantity: 2, selected: [], note: '' },
    { cartId: '2', item: latte, quantity: 1, selected: [], note: 'No foam' },
  ];
  assert.notEqual(lineKey('b', [], ''), lineKey('b', [], 'no foam'));
  assert.equal(lineKey('b', [], 'No foam '), lineKey('b', [], 'no foam'));
  assert.deepEqual(countByItem(cart), { b: 3 });
  assert.equal(cartSignature(cart, null, ''), cartSignature([...cart].reverse(), null, ''));
  assert.notEqual(cartSignature(cart, null, ''), cartSignature(cart, 'cust', ''));
});

test('only a request that never reached the API counts as offline', async () => {
  const { isUnreachable } = await import('../lib/utils/pos.ts');
  assert.equal(isUnreachable(new TypeError('Failed to fetch')), true);
  assert.equal(isUnreachable(new TypeError('Load failed')), true);
  assert.equal(isUnreachable(Object.assign(new Error('timed out'), { name: 'TimeoutError' })), true);
  assert.equal(isUnreachable(new Error('offline')), true);
  assert.equal(isUnreachable({ status: 503, message: 'Bad gateway' }), true);
  assert.equal(isUnreachable({ status: 400, message: 'Too many' }), false);
  assert.equal(isUnreachable(new TypeError("Cannot read properties of undefined (reading 'id')")), false);
  assert.equal(isUnreachable('nope'), false);
});

test('menu stock status reads the recipe against this location’s stock', async () => {
  const { menuStockStatus } = await import('../lib/utils/pos.ts');
  const stock = [
    { stockItemId: 'milk', quantity: '1.5', lowThreshold: '2', stockItem: { name: 'Whole milk' } },
    { stockItemId: 'beans', quantity: '5', lowThreshold: '1' },
    { stockItemId: 'oat', quantity: '0', lowThreshold: '1', stockItem: { name: 'Oat milk' } },
    { stockItemId: 'syrup', quantity: '3', lowThreshold: '1', isAvailable: false, stockItem: { name: 'Caramel' } },
  ];
  const status = menuStockStatus(
    {
      latte: [{ stockItemId: 'beans' }, { stockItemId: 'milk' }],
      oat: [{ stockItemId: 'beans' }, { stockItemId: 'milk' }, { stockItemId: 'oat' }],
      espresso: [{ stockItemId: 'beans' }],
      caramel: [{ stockItemId: 'syrup' }],
      cake: [{ stockItemId: 'flour' }],
      large: [{ stockItemId: 'beans' }, { stockItemId: 'oat', sizeModifierId: 'l' }],
    },
    stock,
  );
  assert.deepEqual(status.latte, { level: 'low', ingredient: 'Whole milk' });
  assert.deepEqual(status.oat, { level: 'out', ingredient: 'Oat milk' });
  assert.deepEqual(status.caramel, { level: 'out', ingredient: 'Caramel' });
  assert.equal(status.espresso, undefined);
  assert.equal(status.cake, undefined, 'untracked here, not out');
  assert.equal(status.large, undefined, 'size overrides do not decide');
});

test('favourites, pins and category tiles', async () => {
  const { resolveFavourites, togglePinned, movePinned, categoryTiles } = await import('../lib/utils/pos.ts');
  const items = [item('a', 'Latte'), item('b', 'Mocha'), item('c', 'Scone', 'c2')];
  assert.deepEqual(resolveFavourites('pinned', items, ['c', 'gone', 'a'], []).map((i) => i.id), ['c', 'a']);
  assert.deepEqual(resolveFavourites('top', items, [], ['b', 'a', 'b'], 1).map((i) => i.id), ['b']);
  assert.deepEqual(resolveFavourites('off', items, ['a'], ['a']), []);
  assert.deepEqual(togglePinned(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(togglePinned(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(movePinned(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b']);
  assert.deepEqual(movePinned(['a', 'b'], 'a', -1), ['a', 'b']);
  assert.deepEqual(categoryTiles(items, [{ id: 'c1', name: 'Coffee' }, { id: 'c2', name: 'Bakery' }, { id: 'c3', name: 'Empty' }]).map((t) => [t.name, t.count]), [['Coffee', 2], ['Bakery', 1]]);
});

test('new customer is pre-filled from the search and checked like the API', async () => {
  const { guessNewCustomer, newCustomerErrors } = await import('../lib/utils/pos.ts');
  assert.deepEqual(guessNewCustomer('+44 7911 123456'), { firstName: '', lastName: '', phone: '+44 7911 123456', email: '' });
  assert.equal(guessNewCustomer('jane@x.co').email, 'jane@x.co');
  assert.deepEqual(guessNewCustomer('Jane van Dijk'), { firstName: 'Jane', lastName: 'van Dijk', phone: '', email: '' });
  assert.deepEqual(Object.keys(newCustomerErrors({ firstName: '', lastName: 'D', phone: '123', email: 'nope' })).sort(), ['email', 'firstName', 'phone']);
  assert.deepEqual(newCustomerErrors({ firstName: 'J', lastName: 'D', phone: '07911 123456', email: '' }), {});
});

test('the promo check reads each line after its loyalty reward, as decimal strings', async () => {
  const { promoCheckLines } = await import('../lib/utils/pos.ts');
  const latte = { ...item('latte', 'Latte'), price: 350 };
  const cart = [
    { cartId: 'a', item: latte, selected: [{ id: 'oat', label: 'Oat', price: 50 }], quantity: 2, note: '' },
    { cartId: 'b', item: item('cookie', 'Cookie'), selected: [], quantity: 1, note: '' },
  ];
  assert.deepEqual(promoCheckLines(cart as never, [{ cartId: 'a', discountCents: 400 }]), [
    { menuItemId: 'latte', quantity: 2, lineTotal: '4.00' },
    { menuItemId: 'cookie', quantity: 1, lineTotal: '3.00' },
  ]);
  assert.equal(promoCheckLines(cart as never, [{ cartId: 'b', discountCents: 999 }])[1]!.lineTotal, '0.00', 'never below zero');
});
