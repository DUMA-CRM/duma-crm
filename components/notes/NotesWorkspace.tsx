'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import {
  FolderIcon,
  FolderPlus,
  GoogleDrive,
  Hash,
  Lock,
  MoreHorizontal,
  NotebookPen,
  Pin,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Users,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type NoteFolder,
  type NoteSummary,
  type NotesView,
  createNote,
  deleteNoteFolder,
  getNoteFolders,
  getNoteTags,
  getNotes,
} from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { folderTree, groupNotesByDate, noteBodyAfterTitle, sharingSummary, snippetParts } from '@/lib/utils/notes';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

import { DriveDialog } from './DriveDialog';
import { FolderDialog, type FolderDialogMode } from './FolderDialog';
import { NoteEditor } from './NoteEditor';

const VIEW_LABEL: Record<NotesView, string> = {
  all: 'All notes',
  pinned: 'Pinned',
  unfiled: 'My notes',
  shared: 'Shared',
  trash: 'Recently deleted',
};

/**
 * Notes, Apple Notes' way: folders on the left, the notes in one (newest
 * edit first, grouped by day) in the middle, the note on the right — on a
 * phone, one at a time. Everything lives in the URL, so back closes a note
 * and a link to a note can be shared with someone who can read it.
 */
export function NotesWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'notes:write');

  const view = (params.get('view') as NotesView | null) ?? 'all';
  const folderId = params.get('folder');
  const tag = params.get('tag');
  const noteId = params.get('note');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDeferredValue(search.trim());
  const [folderDialog, setFolderDialog] = useState<FolderDialogMode | null>(null);
  const [deleting, setDeleting] = useState<NoteFolder | null>(null);
  const [drive, setDrive] = useState(false);

  const navigate = (patch: Record<string, string | null>, mode: 'push' | 'replace' = 'push') => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const show = (place: { view?: NotesView; folder?: string; tag?: string }) =>
    navigate({
      view: place.view && place.view !== 'all' ? place.view : null,
      folder: place.folder ?? null,
      tag: place.tag ?? null,
      note: null,
    });

  // Back from Google's consent screen.
  useEffect(() => {
    const outcome = params.get('google');
    if (!outcome) return;
    if (outcome === 'connected') {
      toast('success', 'Google Drive connected.');
      setDrive(true);
    } else toast('error', params.get('reason') ?? 'Google Drive didn’t connect.');
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('google-status') });
    navigate({ google: null, reason: null }, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the redirect
  }, []);

  const folders = useQuery({ queryKey: moduleQueryKeys.notes.key('folders'), queryFn: getNoteFolders });
  const tags = useQuery({ queryKey: moduleQueryKeys.notes.key('tags'), queryFn: getNoteTags });
  const list = useQuery({
    queryKey: moduleQueryKeys.notes.key('list', view, folderId, tag, q),
    queryFn: () =>
      getNotes({ view: folderId || tag ? 'all' : view, folderId: folderId ?? undefined, tag: tag ?? undefined, q: q || undefined }),
    placeholderData: (previous) => previous,
  });
  const allFolders = useMemo(() => folders.data?.folders ?? [], [folders.data]);
  const currentFolder = allFolders.find((folder) => folder.id === folderId) ?? null;
  const placeLabel = currentFolder?.name ?? (tag ? `#${tag}` : VIEW_LABEL[view]);

  const create = useMutation({
    mutationFn: () => createNote({ folderId: currentFolder?.canEdit ? currentFolder.id : null }),
    onSuccess: async (note) => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.all });
      navigate({ note: note.id, ...(view === 'trash' ? { view: null } : {}) });
    },
    onError: (error) => toast('error', error.message),
  });
  const removeFolder = useMutation({
    mutationFn: (folder: NoteFolder) => deleteNoteFolder(folder.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.all });
      setDeleting(null);
      show({ view: 'all' });
      toast('success', 'Folder deleted — its notes are in Recently Deleted for 30 days.');
    },
    onError: (error) => toast('error', error.message),
  });

  // ⌘N / Ctrl+N: a new note, as in Notes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'n' && canWrite) {
        event.preventDefault();
        if (!create.isPending) create.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <EditorShell
      eyebrow="Knowledge base"
      title="Notes"
      icon={<NotebookPen size={20} aria-hidden="true" />}
      flush
      actions={
        <div className="flex items-center gap-1.5 md:gap-2">
          <Tooltip side="bottom" label="Google Drive">
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => setDrive(true)} aria-label="Google Drive">
              <GoogleDrive size={15} aria-hidden="true" />
              <span className="hidden md:inline">Drive</span>
            </Button>
          </Tooltip>
          {canWrite && (
            <Tooltip side="bottom" align="end" label="New note (⌘N)">
              <Button className="h-9 gap-1.5" disabled={create.isPending} onClick={() => create.mutate()}>
                <Plus size={15} aria-hidden="true" />
                <span className="hidden md:inline">New note</span>
              </Button>
            </Tooltip>
          )}
        </div>
      }
    >
      <div className="grid min-h-0 flex-1 lg:grid-cols-[15rem_21rem_minmax(0,1fr)]">
        {/* ── Folders ── */}
        <aside className="hidden min-h-0 overflow-auto border-r border-divider bg-card p-3 lg:block" aria-label="Folders">
          {folders.isPending ? (
            <TilesSkeleton count={5} label="Loading folders" />
          ) : folders.isError ? (
            <ErrorState title="Folders couldn’t be loaded" onRetry={() => void folders.refetch()} />
          ) : (
            <nav className="space-y-5">
              <ul className="space-y-0.5">
                <Place
                  icon={StickyNote}
                  label="All notes"
                  count={folders.data.counts.all}
                  active={!folderId && !tag && view === 'all'}
                  onClick={() => show({ view: 'all' })}
                />
                <Place
                  icon={Pin}
                  label="Pinned"
                  count={folders.data.counts.pinned}
                  active={!folderId && !tag && view === 'pinned'}
                  onClick={() => show({ view: 'pinned' })}
                />
                <Place
                  icon={Lock}
                  label="My notes"
                  count={folders.data.counts.unfiled}
                  active={!folderId && !tag && view === 'unfiled'}
                  onClick={() => show({ view: 'unfiled' })}
                />
                <Place
                  icon={Users}
                  label="Shared"
                  active={!folderId && !tag && view === 'shared'}
                  onClick={() => show({ view: 'shared' })}
                />
              </ul>

              <div>
                <div className="mb-1 flex items-center justify-between px-2">
                  <p className="text-label uppercase text-muted-foreground">Folders</p>
                  {canWrite && (
                    <Tooltip side="right" label="New folder">
                      <button
                        type="button"
                        aria-label="New folder"
                        onClick={() => setFolderDialog({ kind: 'create', parent: null })}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-band hover:text-foreground"
                      >
                        <FolderPlus size={14} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  )}
                </div>
                {allFolders.length === 0 ? (
                  <p className="px-2 text-xs leading-relaxed text-muted-foreground">
                    {folders.data.canManage
                      ? 'Make a shared folder for SOPs and recipes, or a private one for yourself.'
                      : 'No folders yet.'}
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {folderTree(allFolders).map(({ folder, depth }) => (
                      <FolderRow
                        key={folder.id}
                        folder={folder}
                        depth={depth}
                        active={folderId === folder.id}
                        canManage={folders.data.canManage}
                        onOpen={() => show({ folder: folder.id })}
                        onAction={(action) =>
                          action === 'delete'
                            ? setDeleting(folder)
                            : setFolderDialog(action === 'subfolder' ? { kind: 'create', parent: folder } : { kind: action, folder })
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>

              {(tags.data?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1.5 px-2 text-label uppercase text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1 px-1">
                    {tags.data!.slice(0, 30).map((entry) => (
                      <button
                        key={entry.tag}
                        type="button"
                        onClick={() => show({ tag: entry.tag })}
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 text-xs transition-colors',
                          tag === entry.tag
                            ? 'border-primary bg-primary/8 text-primary'
                            : 'border-rule/55 bg-control text-muted-foreground hover:text-foreground',
                        )}
                      >
                        #{entry.tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ul className="border-t border-rule/50 pt-3">
                <Place
                  icon={Trash2}
                  label="Recently deleted"
                  count={folders.data.counts.trash}
                  active={!folderId && view === 'trash'}
                  onClick={() => show({ view: 'trash' })}
                />
              </ul>
            </nav>
          )}
        </aside>

        {/* ── The list ── */}
        <section
          className={cn('min-h-0 flex-col border-r border-divider bg-background', noteId ? 'hidden lg:flex' : 'flex')}
          aria-label={placeLabel}
        >
          <div className="shrink-0 space-y-2 border-b border-divider p-3">
            {/* Below the desktop layout the folders live in this one control. */}
            <Select
              value={folderId ? `folder:${folderId}` : tag ? `tag:${tag}` : `view:${view}`}
              onValueChange={(value) => {
                const [kind, id] = value.split(':') as [string, string];
                show(kind === 'folder' ? { folder: id } : kind === 'tag' ? { tag: id } : { view: id as NotesView });
              }}
              options={[
                ...(Object.keys(VIEW_LABEL) as NotesView[]).map((key) => ({ value: `view:${key}`, label: VIEW_LABEL[key] })),
                ...folderTree(allFolders).map(({ folder, depth }) => ({
                  value: `folder:${folder.id}`,
                  label: `${'  '.repeat(depth + 1)}${folder.name}`,
                })),
              ]}
              ariaLabel="Folder"
              className="w-full lg:hidden"
            />
            <div className="flex items-baseline justify-between gap-2 max-lg:hidden">
              <h2 className="truncate text-base font-semibold tracking-title text-foreground">{placeLabel}</h2>
              {currentFolder?.shared && (
                <span className="shrink-0 truncate text-xs text-muted-foreground" title={sharingSummary(currentFolder)}>
                  Shared
                </span>
              )}
            </div>
            <Input
              aria-label="Search notes"
              placeholder="Search"
              value={search}
              leftIcon={<Search size={14} aria-hidden="true" />}
              onChange={(event) => {
                setSearch(event.target.value);
                navigate({ q: event.target.value.trim() || null }, 'replace');
              }}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {list.isPending ? (
              <div className="p-3">
                <TilesSkeleton count={6} label="Loading notes" />
              </div>
            ) : list.isError ? (
              <ErrorState title="Notes couldn’t be loaded" onRetry={() => void list.refetch()} />
            ) : list.data.length === 0 ? (
              <EmptyState
                className="py-12"
                icon={view === 'trash' ? Trash2 : StickyNote}
                kind={q ? 'search' : 'start'}
                compact
                title={q ? `Nothing matches “${q}”` : view === 'trash' ? 'Nothing deleted' : 'No notes here yet'}
                description={
                  q
                    ? 'Try fewer words.'
                    : view === 'trash'
                      ? 'Deleted notes stay here for 30 days.'
                      : canWrite
                        ? 'Start one — the first line becomes its title.'
                        : undefined
                }
                action={!q && view !== 'trash' && canWrite ? { label: 'New note', onClick: () => create.mutate(), icon: Plus } : undefined}
              />
            ) : (
              <NoteList notes={list.data} activeId={noteId} searching={Boolean(q)} onOpen={(id) => navigate({ note: id })} />
            )}
          </div>
        </section>

        {/* ── The note ── */}
        <main className={cn('min-h-0 flex-col bg-background', noteId ? 'flex' : 'hidden lg:flex')}>
          {noteId ? (
            <NoteEditor
              noteId={noteId}
              folders={allFolders}
              onBack={() => navigate({ note: null })}
              onDeleted={() => navigate({ note: null }, 'replace')}
            />
          ) : (
            <EmptyState
              className="flex-1"
              icon={NotebookPen}
              title="Pick a note, or start one"
              description="Recipes, opening and closing checklists, how-tos — written once, found by search, and answered by Ask DUMA from shared folders."
              action={canWrite ? { label: 'New note', onClick: () => create.mutate(), icon: Plus } : undefined}
            />
          )}
        </main>
      </div>

      {folderDialog && folders.data && (
        <FolderDialog
          mode={folderDialog}
          canManage={folders.data.canManage}
          onClose={() => setFolderDialog(null)}
          onDone={(folder) => {
            setFolderDialog(null);
            if (folderDialog.kind === 'create') show({ folder: folder.id });
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={`Delete “${deleting.name}”?`}
          message={`The folder and its subfolders go, and their ${deleting.noteCount === 1 ? 'note moves' : 'notes move'} to Recently Deleted for 30 days.${deleting.shared ? ' Everyone it was shared with loses it too.' : ''}`}
          confirmLabel="Delete folder"
          pendingLabel="Deleting…"
          isPending={removeFolder.isPending}
          onConfirm={() => removeFolder.mutate(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
      {drive && (
        <DriveDialog
          folderId={currentFolder?.canEdit ? currentFolder.id : null}
          onClose={() => setDrive(false)}
          onOpened={(note) => {
            setDrive(false);
            navigate({ note: note.id });
          }}
        />
      )}
    </EditorShell>
  );
}

function Place({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
          active ? 'bg-primary/10 font-semibold text-foreground' : 'text-muted-foreground hover:bg-band/60 hover:text-foreground',
        )}
      >
        <Icon size={15} className={active ? 'text-primary' : undefined} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
      </button>
    </li>
  );
}

function FolderRow({
  folder,
  depth,
  active,
  canManage,
  onOpen,
  onAction,
}: {
  folder: NoteFolder;
  depth: number;
  active: boolean;
  canManage: boolean;
  onOpen: () => void;
  onAction: (action: 'subfolder' | 'rename' | 'share' | 'delete') => void;
}) {
  const [menu, setMenu] = useState(false);
  const canShare = canManage && folder.shared && folder.parentId === null;
  const canDelete = folder.canEdit && (!folder.shared || folder.parentId !== null || canManage);
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? 'page' : undefined}
        style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md py-1.5 pr-8 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
          active ? 'bg-primary/10 font-semibold text-foreground' : 'text-muted-foreground hover:bg-band/60 hover:text-foreground',
        )}
      >
        {folder.shared ? (
          <Users size={15} className={active ? 'text-primary' : undefined} aria-label="Shared folder" />
        ) : (
          <FolderIcon size={15} className={active ? 'text-primary' : undefined} aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        {folder.noteCount > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground group-hover:invisible">{folder.noteCount}</span>
        )}
      </button>
      {folder.canEdit && (
        <div className="absolute right-1 top-1">
          <button
            type="button"
            aria-label={`${folder.name} options`}
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-band hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </button>
          {menu && (
            <div
              role="menu"
              className="absolute right-0 top-7 z-20 w-48 rounded-lg border border-rule/60 bg-card p-1 shadow-lg"
              onMouseLeave={() => setMenu(false)}
            >
              {[
                { action: 'subfolder' as const, label: 'New folder inside', show: true },
                { action: 'rename' as const, label: 'Rename', show: true },
                { action: 'share' as const, label: 'Who sees it', show: canShare },
                { action: 'delete' as const, label: 'Delete', show: canDelete },
              ]
                .filter((item) => item.show)
                .map((item) => (
                  <button
                    key={item.action}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      onAction(item.action);
                    }}
                    className={cn(
                      'flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-band/60',
                      item.action === 'delete' ? 'text-exception hover:bg-exception/6' : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function NoteList({
  notes,
  activeId,
  searching,
  onOpen,
}: {
  notes: NoteSummary[];
  activeId: string | null;
  searching: boolean;
  onOpen: (id: string) => void;
}) {
  // A search is ranked by relevance; anything else is grouped by when it was edited.
  const groups = searching ? [{ group: 'Top matches', notes }] : groupNotesByDate(notes);
  return (
    <div className="pb-4">
      {groups.map((group) => (
        <section key={group.group} aria-label={group.group}>
          <h3 className="sticky top-0 z-[1] bg-background/95 px-4 pb-1 pt-3 text-label uppercase text-muted-foreground backdrop-blur">
            {group.group}
          </h3>
          <ul className="px-2">
            {group.notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => onOpen(note.id)}
                  aria-current={activeId === note.id ? 'true' : undefined}
                  className={cn(
                    'w-full rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    activeId === note.id ? 'bg-primary/10' : 'hover:bg-band/50',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {note.pinned && <Pin size={12} className="shrink-0 text-primary" aria-label="Pinned" />}
                    {note.sourceProvider === 'google_drive' && (
                      <GoogleDrive size={12} className="shrink-0 text-muted-foreground" aria-label="From Google Drive" />
                    )}
                    <span className="truncate text-sm font-semibold text-foreground">{note.title || 'New note'}</span>
                  </span>
                  <span className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 tabular-nums">{formatInstant(note.updatedAt, { day: 'numeric', month: 'short' })}</span>
                    <span className="min-w-0 truncate">
                      {searching
                        ? snippetParts(note.snippet).map((part, index) =>
                            part.match ? (
                              <mark key={index} className="rounded-sm bg-measured/25 px-0.5 text-foreground">
                                {part.text}
                              </mark>
                            ) : (
                              <span key={index}>{part.text}</span>
                            ),
                          )
                        : noteBodyAfterTitle(note.snippet) || note.snippet || 'No more text'}
                    </span>
                  </span>
                  {note.tags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {note.tags.slice(0, 3).map((entry) => (
                        <span key={entry} className="inline-flex items-center gap-0.5 text-micro text-muted-foreground">
                          <Hash size={10} aria-hidden="true" />
                          {entry}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
