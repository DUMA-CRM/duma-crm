/**
 * Media folders, browsed like a drive.
 *
 * A folder is a path on the asset (`Menu/Summer`), not a row of its own: the
 * API lists every path that holds a file, and a folder exists while something
 * is in it or below it. So the tree is derived here — `Menu` appears because
 * `Menu/Summer` holds a file — and an empty folder someone just made lives only
 * on this device until a file goes into it.
 */

export const FOLDER_MAX_LENGTH = 120;

/** A drag that starts on a tile carries this, so a drop can tell it from files off the desktop. */
export const MEDIA_DRAG_TYPE = 'application/x-duma-media';

export type MediaDragPayload = { assetIds: string[]; folder: string | null };

export type FolderStat = { folder: string; files: number; bytes: number };

export const folderName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export const parentFolder = (path: string): string | null => {
  const at = path.lastIndexOf('/');
  return at === -1 ? null : path.slice(0, at);
};

export const joinFolder = (parent: string | null, name: string) => (parent ? `${parent}/${name}` : name);

/** `a/b` is inside `a`, and `a` is inside itself; `ab` is not inside `a`. */
export const isInsideFolder = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);

/** Every folder the paths imply, ancestors included: `a/b/c` gives `a`, `a/b` and `a/b/c`. */
export function allFolders(paths: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i += 1) out.add(parts.slice(0, i).join('/'));
  }
  return [...out].sort(compareFolders);
}

/** Folder order: by name, case-insensitively, numbers in number order — as a file manager sorts. */
export const compareFolders = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** The folders directly inside `parent` (null: the top level), as full paths. */
export const childFolders = (folders: readonly string[], parent: string | null) =>
  folders.filter((path) => parentFolder(path) === parent).sort((a, b) => compareFolders(folderName(a), folderName(b)));

/** The trail from the top to `path`: `a/b` gives `[a, a/b]`. */
export function folderTrail(path: string | null): Array<{ name: string; path: string }> {
  if (!path) return [];
  const parts = path.split('/');
  return parts.map((name, index) => ({ name, path: parts.slice(0, index + 1).join('/') }));
}

/** What a folder holds, counting everything below it. */
export function folderSummary(stats: readonly FolderStat[], folders: readonly string[], path: string) {
  let files = 0;
  let bytes = 0;
  let direct = 0;
  for (const stat of stats) {
    if (!isInsideFolder(stat.folder, path)) continue;
    files += stat.files;
    bytes += stat.bytes;
    if (stat.folder === path) direct = stat.files;
  }
  const subfolders = folders.filter((other) => other !== path && isInsideFolder(other, path)).length;
  return { files, bytes, direct, subfolders };
}

/** Why `name` cannot be a folder name inside `parent`, or null when it can. */
export function folderNameProblem(name: string, parent: string | null, siblings: readonly string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give the folder a name.';
  if (trimmed.includes('/')) return 'A folder name can’t contain “/”.';
  const path = joinFolder(parent, trimmed);
  if (path.length > FOLDER_MAX_LENGTH) return `Too long — a folder’s full path can be at most ${FOLDER_MAX_LENGTH} characters.`;
  if (siblings.some((sibling) => folderName(sibling).toLocaleLowerCase() === trimmed.toLocaleLowerCase()))
    return 'There’s already a folder with that name here.';
  return null;
}

/**
 * Where `path` goes when folder `from` becomes `to` — the same rewrite the API
 * applies. `to: null` dissolves the folder: its subfolders move up a level.
 */
export function movedFolderPath(path: string, from: string, to: string | null): string | null {
  if (!isInsideFolder(path, from)) return path;
  const rest = path.slice(from.length + 1);
  if (to === null) return rest || null;
  return rest ? `${to}/${rest}` : to;
}

/** Can folder `from` be dropped into `into` (null: the top level)? Not into itself, and not where it already is. */
export const canMoveFolderInto = (from: string, into: string | null) =>
  (into === null || !isInsideFolder(into, from)) && parentFolder(from) !== into;

/** The folders someone made here that are still empty — kept until a file lands in them. */
export function pendingFolders(local: readonly string[], server: readonly string[]): string[] {
  const known = new Set(allFolders(server));
  return local.filter((path) => !known.has(path));
}

export function encodeDrag(payload: MediaDragPayload) {
  return JSON.stringify(payload);
}

export function decodeDrag(raw: string): MediaDragPayload | null {
  try {
    const value = JSON.parse(raw) as Partial<MediaDragPayload>;
    if (!Array.isArray(value.assetIds) || !value.assetIds.every((id) => typeof id === 'string')) return null;
    if (value.folder !== null && typeof value.folder !== 'string') return null;
    if (value.assetIds.length === 0 && value.folder === null) return null;
    return { assetIds: value.assetIds, folder: value.folder };
  } catch {
    return null;
  }
}

/**
 * Click selection as a file manager does it: a plain click picks one, ⌘/Ctrl
 * adds or removes one, Shift takes the range from the last plain click.
 */
export function clickSelection(
  order: readonly string[],
  current: ReadonlySet<string>,
  anchor: string | null,
  id: string,
  modifiers: { toggle: boolean; range: boolean },
): Set<string> {
  if (modifiers.range && anchor && order.includes(anchor)) {
    const [from, to] = [order.indexOf(anchor), order.indexOf(id)].sort((a, b) => a - b);
    const range = order.slice(from, to + 1);
    return new Set(modifiers.toggle ? [...current, ...range] : range);
  }
  if (modifiers.toggle) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }
  return new Set([id]);
}
