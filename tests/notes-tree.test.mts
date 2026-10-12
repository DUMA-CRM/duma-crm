import assert from 'node:assert/strict';
import test from 'node:test';

const { containersFor, isContainer, notesTree } = await import('../lib/utils/notes-tree.ts');
type Loaded = import('../lib/utils/notes-tree.ts').ContainerNotes;
type Container = import('../lib/utils/notes-tree.ts').NotesContainer;

const folders = [
  { id: 'sops', parentId: null, name: 'SOPs', shared: true, canEdit: true, noteCount: 2 },
  { id: 'opening', parentId: 'sops', name: 'Opening', shared: true, canEdit: true, noteCount: 1 },
  { id: 'ideas', parentId: null, name: 'Ideas', shared: false, canEdit: true, noteCount: 0 },
];

test('one tree: My notes, the folders with subfolders first, then Recently deleted', () => {
  const tree = notesTree({ folders, counts: { unfiled: 0, trash: 3 }, notes: new Map() });
  assert.deepEqual(
    tree.map((item) => [item.id, item.kind]),
    [
      ['mine', 'mine'],
      ['folder:sops', 'folder'],
      ['folder:ideas', 'folder'],
      ['trash', 'trash'],
    ],
  );
  const sops = tree[1]!;
  assert.deepEqual(
    sops.children!.map((item) => item.id),
    ['folder:opening', 'folder:sops::loading'],
  );
  assert.equal(sops.shared, true);
  assert.equal(sops.count, 2);
});

test('a container shows a placeholder until opened, so it can be opened; an empty one has none', () => {
  const tree = notesTree({ folders, counts: { unfiled: 0, trash: 3 }, notes: new Map() });
  assert.deepEqual(tree[0]!.children, []);
  assert.deepEqual(tree[2]!.children, []);
  assert.equal(tree[3]!.children![0]!.kind, 'loading');
});

test('loaded notes become leaves; a failure is a retry row; past the page, a pointer to search', () => {
  const notes = new Map<Container, Loaded>([
    [
      'folder:sops',
      {
        status: 'success',
        notes: [
          { id: 'n1', title: 'Close the till', pinned: true },
          { id: 'n2', title: '  ', pinned: false },
        ],
      },
    ],
    ['mine', { status: 'error' }],
    ['trash', { status: 'success', notes: [{ id: 'n3', title: 'Old rota', pinned: false }] }],
  ]);
  const tree = notesTree({ folders, counts: { unfiled: 4, trash: 3 }, notes });
  const sops = tree.find((item) => item.id === 'folder:sops')!;
  assert.deepEqual(
    sops.children!.map((item) => [item.id, item.label, item.kind]),
    [
      ['folder:opening', 'Opening', 'folder'],
      ['note:n1', 'Close the till', 'note'],
      ['note:n2', 'New note', 'note'],
    ],
  );
  assert.equal(sops.children![1]!.pinned, true);
  assert.equal(tree[0]!.children![0]!.kind, 'error');
  assert.deepEqual(
    tree.at(-1)!.children!.map((item) => item.label),
    ['Old rota', '2 more — search to find them'],
  );
});

test('a subfolder whose parent you can’t see is kept, at the top level', () => {
  const tree = notesTree({
    folders: [{ id: 'orphan', parentId: 'hidden', name: 'Orphan', shared: true, canEdit: false, noteCount: 0 }],
    counts: { unfiled: 0, trash: 0 },
    notes: new Map(),
  });
  assert.deepEqual(
    tree.map((item) => item.id),
    ['mine', 'folder:orphan', 'trash'],
  );
});

test('opening a note opens the containers above it', () => {
  assert.deepEqual(containersFor({ folderId: 'opening', deletedAt: null }, folders), ['folder:sops', 'folder:opening']);
  assert.deepEqual(containersFor({ folderId: null, deletedAt: null }, folders), ['mine']);
  assert.deepEqual(containersFor({ folderId: 'opening', deletedAt: '2026-10-10T10:00:00Z' }, folders), ['trash']);
  assert.equal(isContainer('folder:x'), true);
  assert.equal(isContainer('note:x'), false);
});

test('move targets: My notes, then the folders you can write in, nested', async () => {
  const { moveTargets } = await import('../lib/utils/notes-tree.ts');
  const writable = [
    { id: 'sops', parentId: null, name: 'SOPs', shared: true, canEdit: true },
    { id: 'opening', parentId: 'sops', name: 'Opening', shared: true, canEdit: true },
    { id: 'locked', parentId: null, name: 'Payroll', shared: true, canEdit: false },
    { id: 'mine-open', parentId: null, name: 'My opening ideas', shared: false, canEdit: true },
  ];
  assert.deepEqual(
    moveTargets(writable).map((target) => [target.id, target.depth]),
    [
      [null, 0],
      ['sops', 1],
      ['opening', 2],
      ['mine-open', 1],
    ],
  );
  assert.deepEqual(
    moveTargets(writable, '  OPENING ').map((target) => [target.name, target.path, target.depth]),
    [
      ['Opening', 'SOPs', 0],
      ['My opening ideas', '', 0],
    ],
  );
  assert.deepEqual(moveTargets(writable, 'nothing like it'), []);
});

test('a drawing note is marked as one, and an untitled one says so', () => {
  const notes = new Map<Container, Loaded>([
    [
      'mine',
      {
        status: 'success',
        notes: [
          { id: 'd', title: '', pinned: false, kind: 'drawing' },
          { id: 'n', title: '', pinned: false },
        ],
      },
    ],
  ]);
  const mine = notesTree({ folders: [], counts: { unfiled: 2, trash: 0 }, notes })[0]!;
  assert.deepEqual(
    mine.children!.map((item) => [item.label, item.drawing ?? false]),
    [
      ['Untitled drawing', true],
      ['New note', false],
    ],
  );
});
