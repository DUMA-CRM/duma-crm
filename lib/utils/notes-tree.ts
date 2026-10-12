// The Notes sidebar as one tree: "My notes" (unfiled), every folder you can see
// with its subfolders and notes, then Recently deleted. A container's notes
// load when it's opened, so until then it carries one placeholder child — that
// is what gives it a disclosure arrow. Pure, so tests/notes-tree.test.mts can
// check it without React.

export interface TreeFolderLike {
  id: string;
  parentId: string | null;
  name: string;
  shared: boolean;
  canEdit: boolean;
  noteCount: number;
}

export interface TreeNoteLike {
  id: string;
  title: string;
  pinned: boolean;
  canEdit?: boolean;
  ownerUserId?: string;
  kind?: 'note' | 'drawing';
}

/** A container whose notes load on demand: unfiled notes, a folder, or the trash. */
export type NotesContainer = 'mine' | 'trash' | `folder:${string}`;

/** What one container's notes query has produced so far. */
export type ContainerNotes = { status: 'pending' } | { status: 'error' } | { status: 'success'; notes: readonly TreeNoteLike[] };

export type NotesTreeKind = 'mine' | 'trash' | 'folder' | 'note' | 'loading' | 'error' | 'more';

export interface NotesTreeItem {
  id: string;
  label: string;
  kind: NotesTreeKind;
  /** The note or folder id, for `note` and `folder`; the container, for placeholders. */
  ref: string;
  children?: NotesTreeItem[];
  /** A count shown at the end of the row. */
  count?: number;
  shared?: boolean;
  pinned?: boolean;
  /** For a note: a drawing rather than text. */
  drawing?: boolean;
  canEdit?: boolean;
  /** For a note: the container it's listed in — where a drag starts from. */
  container?: NotesContainer;
  /** For a note: its author, the only one who can move it back to My notes. */
  ownerUserId?: string;
}

export const folderNodeId = (folderId: string) => `folder:${folderId}` as const;
export const noteNodeId = (noteId: string) => `note:${noteId}`;

/** Its notes: loaded, loading, failed — or, before it was ever opened, a placeholder so it can be opened. */
function noteChildren(container: NotesContainer, count: number, loaded: ContainerNotes | undefined): NotesTreeItem[] {
  if (!loaded || loaded.status === 'pending') {
    return count > 0 ? [{ id: `${container}::loading`, label: 'Loading…', kind: 'loading', ref: container }] : [];
  }
  if (loaded.status === 'error') {
    return [{ id: `${container}::error`, label: 'Couldn’t load — select to retry', kind: 'error', ref: container }];
  }
  const notes = loaded.notes.map<NotesTreeItem>((note) => ({
    id: noteNodeId(note.id),
    label: note.title.trim() || (note.kind === 'drawing' ? 'Untitled drawing' : 'New note'),
    kind: 'note',
    ref: note.id,
    pinned: note.pinned,
    ...(note.kind === 'drawing' ? { drawing: true } : {}),
    canEdit: note.canEdit ?? false,
    container,
    ...(note.ownerUserId ? { ownerUserId: note.ownerUserId } : {}),
  }));
  // The API returns a page; past it, search is the way in.
  const hidden = count - notes.length;
  if (hidden > 0) notes.push({ id: `${container}::more`, label: `${hidden} more — search to find them`, kind: 'more', ref: container });
  return notes;
}

export function notesTree(input: {
  folders: readonly TreeFolderLike[];
  counts: { unfiled: number; trash: number };
  notes: ReadonlyMap<NotesContainer, ContainerNotes>;
}): NotesTreeItem[] {
  const byParent = new Map<string | null, TreeFolderLike[]>();
  const ids = new Set(input.folders.map((folder) => folder.id));
  for (const folder of input.folders) {
    // A subfolder whose parent you can't see sits at the top level rather than vanishing.
    const parent = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), folder]);
  }
  const seen = new Set<string>();
  const folderItem = (folder: TreeFolderLike): NotesTreeItem => {
    seen.add(folder.id);
    const container = folderNodeId(folder.id);
    const subfolders = (byParent.get(folder.id) ?? []).filter((child) => !seen.has(child.id)).map(folderItem);
    return {
      id: container,
      label: folder.name,
      kind: 'folder',
      ref: folder.id,
      count: folder.noteCount,
      shared: folder.shared,
      canEdit: folder.canEdit,
      children: [...subfolders, ...noteChildren(container, folder.noteCount, input.notes.get(container))],
    };
  };

  return [
    {
      id: 'mine',
      label: 'My notes',
      kind: 'mine',
      ref: 'mine',
      count: input.counts.unfiled,
      children: noteChildren('mine', input.counts.unfiled, input.notes.get('mine')),
    },
    ...(byParent.get(null) ?? []).map(folderItem),
    {
      id: 'trash',
      label: 'Recently deleted',
      kind: 'trash',
      ref: 'trash',
      count: input.counts.trash,
      children: noteChildren('trash', input.counts.trash, input.notes.get('trash')),
    },
  ];
}

/** The containers to open so a note in this folder (or unfiled, or deleted) can be seen. */
export function containersFor(
  note: { folderId: string | null; deletedAt: string | null },
  folders: readonly Pick<TreeFolderLike, 'id' | 'parentId'>[],
): NotesContainer[] {
  if (note.deletedAt) return ['trash'];
  if (!note.folderId) return ['mine'];
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: NotesContainer[] = [];
  let current = byId.get(note.folderId);
  while (current && chain.length < 50) {
    chain.unshift(folderNodeId(current.id));
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** Whether a tree node id names a container whose notes load on demand. */
export const isContainer = (id: string): id is NotesContainer => id === 'mine' || id === 'trash' || id.startsWith('folder:');

export interface MoveTarget {
  /** Null: My notes. */
  id: string | null;
  name: string;
  /** Nesting, for the indented list; 0 while searching, which lists flat. */
  depth: number;
  shared: boolean;
  /** The folders above it, e.g. "SOPs / Kitchen" — shown while searching. */
  path: string;
}

/**
 * Where a note can move: My notes, then every folder you can write in, as a
 * tree. A search lists the matches flat, each with the path above it so two
 * "Opening" folders can be told apart.
 */
export function moveTargets(folders: readonly Omit<TreeFolderLike, 'noteCount'>[], query = ''): MoveTarget[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const pathOf = (folder: (typeof folders)[number]) => {
    const names: string[] = [];
    let parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    while (parent && names.length < 50) {
      names.unshift(parent.name);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return names.join(' / ');
  };
  const writable = folders.filter((folder) => folder.canEdit);
  const ids = new Set(writable.map((folder) => folder.id));
  const children = new Map<string | null, typeof writable>();
  for (const folder of writable) {
    // Under its parent when you can write there too; otherwise at the top.
    const parent = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), folder]);
  }
  const ordered: MoveTarget[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const folder of children.get(parent) ?? []) {
      if (ordered.length > writable.length) return;
      ordered.push({ id: folder.id, name: folder.name, depth, shared: folder.shared, path: pathOf(folder) });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 1);
  const all: MoveTarget[] = [{ id: null, name: 'My notes', depth: 0, shared: false, path: '' }, ...ordered];

  const needle = query.trim().toLowerCase();
  if (!needle) return all;
  return all.filter((target) => target.name.toLowerCase().includes(needle)).map((target) => ({ ...target, depth: 0 }));
}
