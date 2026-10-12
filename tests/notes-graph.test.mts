import assert from 'node:assert/strict';
import test from 'node:test';

const { buildNoteGraph, folderAndBelow, orbRadius } = await import('../lib/utils/notes-graph.ts');

const nodes = [
  { id: 'a', title: 'Opening', folderId: 'sops', tags: ['daily'], pinned: false },
  { id: 'b', title: 'Closing', folderId: 'kitchen', tags: ['daily', 'till'], pinned: true },
  { id: 'c', title: '  ', folderId: null, tags: [], pinned: false },
];
const links = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'a' },
  { source: 'a', target: 'gone' },
];

test('one link per pair, links to notes you can’t see dropped, orbs sized by links', () => {
  const graph = buildNoteGraph({ nodes, links });
  assert.deepEqual(graph.links, [{ source: 'a', target: 'b', kind: 'link' }]);
  assert.deepEqual(
    graph.nodes.map((node) => [node.id, node.degree, node.label]),
    [
      ['a', 1, 'Opening'],
      ['b', 1, 'Closing'],
      ['c', 0, 'New note'],
    ],
  );
  assert.ok(orbRadius({ kind: 'note', degree: 9 }) > orbRadius({ kind: 'note', degree: 0 }));
  assert.deepEqual([...graph.neighbours.get('a')!], ['b']);
});

test('tags become orbs joined to their notes; orphans can be hidden', () => {
  const graph = buildNoteGraph({ nodes, links }, { showTags: true, showOrphans: false });
  assert.deepEqual(
    graph.nodes.map((node) => [node.id, node.kind, node.degree]),
    [
      ['a', 'note', 2],
      ['b', 'note', 3],
      ['tag:daily', 'tag', 2],
      ['tag:till', 'tag', 1],
    ],
  );
});

test('the folder filter keeps a folder and everything under it', () => {
  const folders = [
    { id: 'sops', parentId: null },
    { id: 'kitchen', parentId: 'sops' },
    { id: 'other', parentId: null },
  ];
  const below = folderAndBelow('sops', folders);
  assert.deepEqual([...below].sort(), ['kitchen', 'sops']);
  assert.deepEqual(
    buildNoteGraph({ nodes, links }, { folderIds: folderAndBelow('kitchen', folders) }).nodes.map((node) => node.id),
    ['b'],
  );
});
