import { apiFetch } from './client';

// ─── Notes ────────────────────────────────────────────────────────────────────
//
// The knowledge base and everyone's own notes (the notes module, /v1/notes).
// Every read is checked by the API: private notes are their author's alone;
// a shared folder says who reads and who edits. Design: Platform/Notes.

export type NotesView = 'all' | 'pinned' | 'unfiled' | 'shared' | 'trash';

export interface NoteFolder {
  id: string;
  parentId: string | null;
  name: string;
  shared: boolean;
  canEdit: boolean;
  noteCount: number;
  /** Present on a shared top-level folder, for whoever can change its sharing. */
  readerRoles?: string[] | null;
  readerLocationIds?: string[] | null;
  editorRoles?: string[] | null;
}

export interface NoteFoldersResponse {
  folders: NoteFolder[];
  counts: { all: number; unfiled: number; pinned: number; trash: number };
  canManage: boolean;
}

export interface NoteSummary {
  id: string;
  title: string;
  folderId: string | null;
  ownerUserId: string;
  tags: string[];
  pinned: boolean;
  updatedAt: string;
  deletedAt: string | null;
  /** With a search: the matching passage, the match wrapped in [[ ]]. */
  snippet: string;
  canEdit: boolean;
  sourceProvider: 'google_drive' | null;
}

export interface Note {
  id: string;
  title: string;
  folderId: string | null;
  ownerUserId: string;
  content: Record<string, unknown>;
  markdown: string;
  bodyText: string;
  tags: string[];
  pinned: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  deletedAt: string | null;
  canEdit: boolean;
  sourceProvider: 'google_drive' | null;
  sourceFileId: string | null;
  sourceUrl: string | null;
  sourceSyncedAt: string | null;
}

export interface NoteVersion {
  id: string;
  version: number;
  title: string;
  markdown: string;
  createdBy: string | null;
  createdAt: string;
}

export interface NoteContentFields {
  title: string;
  content: Record<string, unknown>;
  markdown: string;
  bodyText: string;
  tags: string[];
}

export interface GoogleDriveStatus {
  configured: boolean;
  connected: boolean;
  /** Connected with the access saving Docs needs — a connection made before sync existed has only read access. */
  canSync: boolean;
  status: 'connected' | 'error' | 'revoked' | null;
  email: string | null;
  lastError: string | null;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  return search.toString();
};

export const getNoteFolders = () => apiFetch<{ data: NoteFoldersResponse }>('/notes/folders').then((res) => res.data);

export const createNoteFolder = (data: {
  name: string;
  parentId?: string | null;
  shared?: boolean;
  readerRoles?: string[] | null;
  readerLocationIds?: string[] | null;
  editorRoles?: string[] | null;
}) => apiFetch<{ data: NoteFolder }>('/notes/folders', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.data);

export const renameNoteFolder = (id: string, name: string) =>
  apiFetch<{ data: NoteFolder }>(`/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }).then((res) => res.data);

export const shareNoteFolder = (
  id: string,
  data: { readerRoles: string[] | null; readerLocationIds: string[] | null; editorRoles: string[] | null },
) => apiFetch<{ data: NoteFolder }>(`/notes/folders/${id}/sharing`, { method: 'PUT', body: JSON.stringify(data) }).then((res) => res.data);

export const deleteNoteFolder = (id: string) =>
  apiFetch<{ data: { deletedFolders: number } }>(`/notes/folders/${id}`, { method: 'DELETE' });

export const getNotes = (params: { view?: NotesView; folderId?: string; tag?: string; q?: string }) =>
  apiFetch<{ data: NoteSummary[] }>(`/notes?${qs(params)}`).then((res) => res.data);

export const getNoteTags = () => apiFetch<{ data: { tag: string; count: number }[] }>('/notes/tags').then((res) => res.data);

export const getNote = (id: string) => apiFetch<{ data: Note }>(`/notes/${id}`).then((res) => res.data);

export const createNote = (
  data: Partial<NoteContentFields> & {
    folderId?: string | null;
    source?: { provider: 'google_drive'; fileId: string; url?: string | null; mimeType?: string | null; modifiedAt?: string | null };
  },
) => apiFetch<{ data: Note }>('/notes', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.data);

/** Content changes carry the version loaded; the API answers 409 `stale_version` if someone saved since. */
export const saveNote = (id: string, data: Partial<NoteContentFields> & { version?: number; folderId?: string | null; pinned?: boolean }) =>
  apiFetch<{ data: Note }>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((res) => res.data);

export const deleteNote = (id: string) => apiFetch<{ data: { id: string } }>(`/notes/${id}`, { method: 'DELETE' });
export const restoreNote = (id: string) =>
  apiFetch<{ data: { id: string; folderId: string | null } }>(`/notes/${id}/restore`, { method: 'POST' });

export const getNoteVersions = (id: string) => apiFetch<{ data: NoteVersion[] }>(`/notes/${id}/versions`).then((res) => res.data);
export const restoreNoteVersion = (id: string, versionId: string) =>
  apiFetch<{ data: Note }>(`/notes/${id}/versions/${versionId}/restore`, { method: 'POST' }).then((res) => res.data);

export const getGoogleDriveStatus = () => apiFetch<{ data: GoogleDriveStatus }>('/notes/google/status').then((res) => res.data);
export const startGoogleDriveConnect = () =>
  apiFetch<{ data: { url: string } }>('/notes/google/connect', { method: 'POST' }).then((res) => res.data);
/** Also stops every note syncing; the Docs already made stay in the person's Drive. */
export const disconnectGoogleDrive = () => apiFetch<{ data: { disconnected: boolean } }>('/notes/google', { method: 'DELETE' });

/**
 * A note kept as a Google Doc in the viewer's own Drive — one way, DUMA → Google.
 * `conflict`: the Doc was edited in Google, so pushing stopped; `missing`: the Doc
 * was deleted in Drive; `error`: it gave up, or the connection can't write.
 */
export interface NoteDriveSync {
  status: 'active' | 'conflict' | 'missing' | 'error';
  url: string | null;
  pushedAt: string | null;
  lastError: string | null;
  /** Changed since the last push; the push follows shortly after editing stops. */
  pending: boolean;
}

export const getNoteDriveSync = (id: string) => apiFetch<{ data: NoteDriveSync | null }>(`/notes/${id}/drive-sync`).then((res) => res.data);
export const startNoteDriveSync = (id: string) =>
  apiFetch<{ data: NoteDriveSync }>(`/notes/${id}/drive-sync`, { method: 'PUT' }).then((res) => res.data);
/** `overwrite` replaces a Doc edited in Google, or makes a new one if it was deleted. */
export const pushNoteDriveSync = (id: string, overwrite = false) =>
  apiFetch<{ data: NoteDriveSync | null }>(`/notes/${id}/drive-sync/push`, { method: 'POST', body: JSON.stringify({ overwrite }) }).then(
    (res) => res.data,
  );
export const stopNoteDriveSync = (id: string) =>
  apiFetch<{ data: { stopped: boolean } }>(`/notes/${id}/drive-sync`, { method: 'DELETE' }).then((res) => res.data);
