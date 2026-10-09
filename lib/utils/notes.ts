// ---------------------------------------------------------------------------
// Notes, as the Notes page shapes them: the title from the first line, #tags
// from the text, the list grouped by when it was last edited (Today, Previous
// 7 days…), the folder tree, search snippets, and the words for a shared
// folder's audience. The API decides who sees what; nothing here does.
// ---------------------------------------------------------------------------

/** Apple Notes' rule: the first line is the title. Trimmed to what the API keeps. */
export function noteTitleFrom(text: string): string {
  const first = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return (first ?? '').slice(0, 300);
}

/** The text after the title — what the list shows under it when there is no search. */
export function noteBodyAfterTitle(text: string): string {
  const lines = text.split('\n').map((line) => line.trim());
  const start = lines.findIndex((line) => line.length > 0);
  return start === -1
    ? ''
    : lines
        .slice(start + 1)
        .filter(Boolean)
        .join(' ')
        .slice(0, 180);
}

/** #tags written anywhere in the note: letters, numbers, - and _, lower-cased, unique. Not inside a URL or after a letter. */
export function tagsInText(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(/(?:^|[\s(])#([\p{L}\p{N}][\p{L}\p{N}_-]{0,39})/gu)) {
    const tag = match[1]!.toLowerCase();
    if (!/^\d+$/.test(tag)) tags.add(tag); // #1 is a number, not a tag
  }
  return [...tags].slice(0, 20);
}

export type NoteGroup = 'Pinned' | 'Today' | 'Yesterday' | 'Previous 7 days' | 'Previous 30 days' | string;

/** The list's headings, newest first, pinned on top — month names after thirty days. */
export function groupNotesByDate<T extends { pinned: boolean; updatedAt: string }>(
  notes: readonly T[],
  now: Date = new Date(),
  locale = 'en-GB',
): { group: NoteGroup; notes: T[] }[] {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = startOfDay(now);
  const day = 24 * 60 * 60 * 1000;
  const groups = new Map<NoteGroup, T[]>();
  const push = (group: NoteGroup, note: T) => groups.set(group, [...(groups.get(group) ?? []), note]);
  for (const note of notes) {
    if (note.pinned) {
      push('Pinned', note);
      continue;
    }
    const edited = new Date(note.updatedAt);
    const at = startOfDay(edited);
    if (at >= today) push('Today', note);
    else if (at >= today - day) push('Yesterday', note);
    else if (at >= today - 7 * day) push('Previous 7 days', note);
    else if (at >= today - 30 * day) push('Previous 30 days', note);
    else
      push(
        edited.getFullYear() === now.getFullYear()
          ? edited.toLocaleDateString(locale, { month: 'long' })
          : edited.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
        note,
      );
  }
  return [...groups.entries()].map(([group, items]) => ({ group, notes: items }));
}

/** "Count the drawer, then [[till]] report" → text and highlighted parts. */
export function snippetParts(snippet: string): { text: string; match: boolean }[] {
  const parts: { text: string; match: boolean }[] = [];
  const pattern = /\[\[([\s\S]*?)\]\]/g;
  let last = 0;
  for (const found of snippet.matchAll(pattern)) {
    if (found.index! > last) parts.push({ text: snippet.slice(last, found.index), match: false });
    parts.push({ text: found[1]!, match: true });
    last = found.index! + found[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), match: false });
  return parts;
}

export interface FolderNode<T extends { id: string; parentId: string | null; name: string }> {
  folder: T;
  depth: number;
}

/** Folders in tree order — each followed by its subfolders, alphabetical at every level. */
export function folderTree<T extends { id: string; parentId: string | null; name: string }>(folders: readonly T[]): FolderNode<T>[] {
  const ids = new Set(folders.map((folder) => folder.id));
  const children = new Map<string | null, T[]>();
  for (const folder of folders) {
    // A subfolder whose parent we can't see sits at the top.
    const parent = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), folder]);
  }
  const result: FolderNode<T>[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const folder of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      result.push({ folder, depth });
      if (depth < 8) walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}

/** "Everyone · managers edit", "Baristas, Store managers at 2 locations". */
export function sharingSummary(
  folder: { readerRoles?: string[] | null; readerLocationIds?: string[] | null; editorRoles?: string[] | null },
  roleName: (role: string) => string = (role) => role.replace(/_/g, ' '),
): string {
  const readers = folder.readerRoles?.length ? folder.readerRoles.map(roleName).join(', ') : 'Everyone';
  const where = folder.readerLocationIds?.length
    ? ` at ${folder.readerLocationIds.length} ${folder.readerLocationIds.length === 1 ? 'location' : 'locations'}`
    : '';
  const editors = folder.editorRoles?.length ? ` · ${folder.editorRoles.map(roleName).join(', ')} edit` : '';
  return `${readers}${where}${editors}`;
}
