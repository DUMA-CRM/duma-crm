import assert from 'node:assert/strict';
import test from 'node:test';

const { folderTree, groupNotesByDate, noteBodyAfterTitle, noteTitleFrom, sharingSummary, snippetParts, tagsInText } =
  await import('../lib/utils/notes.ts');

test('the first line is the title; the rest is the preview', () => {
  const text = '\n  Closing the till  \nCount the drawer.\n\nPrint the Z report.';
  assert.equal(noteTitleFrom(text), 'Closing the till');
  assert.equal(noteBodyAfterTitle(text), 'Count the drawer. Print the Z report.');
  assert.equal(noteTitleFrom('   '), '');
});

test('#tags come from the text — not from URLs, numbers or the middle of a word', () => {
  assert.deepEqual(tagsInText('Opening #checklist for #Leeds-Site (#barista) see https://x.com/#anchor and issue #12 and email#nope'), [
    'checklist',
    'leeds-site',
    'barista',
  ]);
  assert.deepEqual(tagsInText('#рецепт кави'), ['рецепт']);
});

test('the list groups by when it was edited, pinned on top', () => {
  const now = new Date('2026-10-09T15:00:00');
  const notes = [
    { id: 'p', pinned: true, updatedAt: '2025-01-01T10:00:00' },
    { id: 't', pinned: false, updatedAt: '2026-10-09T09:00:00' },
    { id: 'y', pinned: false, updatedAt: '2026-10-08T09:00:00' },
    { id: 'w', pinned: false, updatedAt: '2026-10-04T09:00:00' },
    { id: 'm', pinned: false, updatedAt: '2026-09-20T09:00:00' },
    { id: 'old', pinned: false, updatedAt: '2026-06-01T09:00:00' },
    { id: 'older', pinned: false, updatedAt: '2025-06-01T09:00:00' },
  ];
  assert.deepEqual(
    groupNotesByDate(notes, now).map((group) => [group.group, group.notes.map((note) => note.id)]),
    [
      ['Pinned', ['p']],
      ['Today', ['t']],
      ['Yesterday', ['y']],
      ['Previous 7 days', ['w']],
      ['Previous 30 days', ['m']],
      ['June', ['old']],
      ['June 2025', ['older']],
    ],
  );
});

test('a search snippet’s [[match]] is marked', () => {
  assert.deepEqual(snippetParts('Count the [[till]] then [[lock]]'), [
    { text: 'Count the ', match: false },
    { text: 'till', match: true },
    { text: ' then ', match: false },
    { text: 'lock', match: true },
  ]);
});

test('folders come in tree order; an orphan sits at the top', () => {
  const tree = folderTree([
    { id: 'b', parentId: null, name: 'SOPs' },
    { id: 'c', parentId: 'b', name: 'Kitchen' },
    { id: 'a', parentId: null, name: 'Recipes' },
    { id: 'd', parentId: 'gone', name: 'Orphan' },
  ]);
  assert.deepEqual(
    tree.map((node) => `${'-'.repeat(node.depth)}${node.folder.name}`),
    ['Orphan', 'Recipes', 'SOPs', '-Kitchen'],
  );
});

test('sharing reads as who reads, where, and who edits', () => {
  assert.equal(sharingSummary({}), 'Everyone');
  assert.equal(
    sharingSummary({ readerRoles: ['barista', 'store_manager'], readerLocationIds: ['l1', 'l2'], editorRoles: ['store_manager'] }),
    'barista, store manager at 2 locations · store manager edit',
  );
});
