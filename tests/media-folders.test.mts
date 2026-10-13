import assert from 'node:assert/strict';
import test from 'node:test';

const {
  allFolders,
  canMoveFolderInto,
  childFolders,
  clickSelection,
  decodeDrag,
  encodeDrag,
  folderNameProblem,
  folderSummary,
  folderTrail,
  movedFolderPath,
  parentFolder,
  pendingFolders,
} = await import('../lib/utils/media-folders.ts');

test('a nested path implies its ancestors, in file-manager order', () => {
  assert.deepEqual(allFolders(['Menu/Summer', 'Drinks', 'Menu/Winter', 'item 10', 'item 9']), [
    'Drinks',
    'item 9',
    'item 10',
    'Menu',
    'Menu/Summer',
    'Menu/Winter',
  ]);
});

test('children are the folders one level down, nothing deeper', () => {
  const folders = allFolders(['Menu/Summer/Drinks', 'Menu/Winter', 'Logos']);
  assert.deepEqual(childFolders(folders, null), ['Logos', 'Menu']);
  assert.deepEqual(childFolders(folders, 'Menu'), ['Menu/Summer', 'Menu/Winter']);
  assert.deepEqual(childFolders(folders, 'Menu/Winter'), []);
  assert.equal(parentFolder('Menu/Summer'), 'Menu');
  assert.equal(parentFolder('Menu'), null);
});

test('the trail leads from the top to the folder', () => {
  assert.deepEqual(folderTrail('Menu/Summer'), [
    { name: 'Menu', path: 'Menu' },
    { name: 'Summer', path: 'Menu/Summer' },
  ]);
  assert.deepEqual(folderTrail(null), []);
});

test('a folder summary counts everything below it, and a look-alike name is not below it', () => {
  const stats = [
    { folder: 'Menu', files: 2, bytes: 200 },
    { folder: 'Menu/Summer', files: 3, bytes: 300 },
    { folder: 'Menus', files: 9, bytes: 900 },
  ];
  const folders = allFolders(stats.map((stat) => stat.folder));
  assert.deepEqual(folderSummary(stats, folders, 'Menu'), { files: 5, bytes: 500, direct: 2, subfolders: 1 });
});

test('folder names: required, no slash, unique among siblings, path within the limit', () => {
  assert.match(folderNameProblem('  ', null, []) ?? '', /name/);
  assert.match(folderNameProblem('a/b', null, []) ?? '', /“\/”/);
  assert.match(folderNameProblem('menu', null, ['Menu']) ?? '', /already/);
  assert.equal(folderNameProblem('Summer', 'Menu', ['Menu/Winter']), null);
  assert.match(folderNameProblem('x'.repeat(116), 'Menu', []) ?? '', /120/);
});

test('moving a folder rewrites it and everything below it, as the API does', () => {
  assert.equal(movedFolderPath('Menu/Summer', 'Menu', 'Food'), 'Food/Summer');
  assert.equal(movedFolderPath('Menus', 'Menu', 'Food'), 'Menus');
  assert.equal(movedFolderPath('Menu', 'Menu', null), null);
  assert.equal(movedFolderPath('Menu/Summer', 'Menu', null), 'Summer');
});

test('a folder cannot be dropped into itself, below itself, or where it already is', () => {
  assert.equal(canMoveFolderInto('Menu', 'Menu'), false);
  assert.equal(canMoveFolderInto('Menu', 'Menu/Summer'), false);
  assert.equal(canMoveFolderInto('Menu/Summer', 'Menu'), false);
  assert.equal(canMoveFolderInto('Menu/Summer', null), true);
  assert.equal(canMoveFolderInto('Menu', 'Logos'), true);
  assert.equal(canMoveFolderInto('Menu', null), false);
});

test('an empty folder made here stays only until the server knows it', () => {
  assert.deepEqual(pendingFolders(['New', 'Menu', 'Menu/Empty'], ['Menu/Summer']), ['New', 'Menu/Empty']);
});

test('a drag payload round-trips, and anything else is refused', () => {
  const payload = { assetIds: ['a', 'b'], folder: null };
  assert.deepEqual(decodeDrag(encodeDrag(payload)), payload);
  assert.deepEqual(decodeDrag(encodeDrag({ assetIds: [], folder: 'Menu' })), { assetIds: [], folder: 'Menu' });
  assert.equal(decodeDrag('not json'), null);
  assert.equal(decodeDrag(JSON.stringify({ assetIds: [1], folder: null })), null);
  assert.equal(decodeDrag(JSON.stringify({ assetIds: [], folder: null })), null);
});

test('click selection: plain picks one, toggle adds or removes, shift takes a range', () => {
  const order = ['a', 'b', 'c', 'd'];
  assert.deepEqual([...clickSelection(order, new Set(['a', 'b']), 'a', 'c', { toggle: false, range: false })], ['c']);
  assert.deepEqual([...clickSelection(order, new Set(['a']), 'a', 'c', { toggle: true, range: false })], ['a', 'c']);
  assert.deepEqual([...clickSelection(order, new Set(['a', 'c']), 'a', 'c', { toggle: true, range: false })], ['a']);
  assert.deepEqual([...clickSelection(order, new Set(['a']), 'd', 'b', { toggle: false, range: true })], ['b', 'c', 'd']);
  assert.deepEqual([...clickSelection(order, new Set(['a']), 'c', 'd', { toggle: true, range: true })], ['a', 'c', 'd']);
});
