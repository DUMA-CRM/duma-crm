'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, GraphView, NotebookPen, PenLine, Plus, StickyNote } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { hasCapability } from '@/lib/auth/capabilities';
import { type NoteFolder, createNote, deleteNoteFolder, getNoteFolders } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { drawingNoteSnapshot, emptyDrawing } from '@/lib/utils/note-drawing';
import type { NoteLength } from '@/lib/utils/note-editor';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

import { FolderDialog, type FolderDialogMode } from './FolderDialog';
import { MenuOption } from './MenuOption';
import { NoteEditor } from './NoteEditor';
import { NotesSidebar } from './NotesSidebar';

type NewNote = { kind?: 'note' | 'drawing'; into?: string | null };

/** What a new drawing note starts as: an empty canvas, untitled. */
function blankDrawing() {
  const blank = drawingNoteSnapshot({ title: '', ...emptyDrawing(), files: {} })!;
  return { title: '', content: blank.content, markdown: blank.markdown, bodyText: blank.text };
}

/**
 * Notes in two panes: one sidebar holding every folder as a tree with its
 * notes inside, and the note — on a phone, one at a time. Everything lives in
 * the URL (`folder`, `note`, `tag`, `q`), so back closes a note and a link to
 * a note can be shared with someone who can read it.
 */
export function NotesWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'notes:write');

  const folderId = params.get('folder');
  const tag = params.get('tag');
  const noteId = params.get('note');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDeferredValue(search.trim());
  const [folderDialog, setFolderDialog] = useState<FolderDialogMode | null>(null);
  const [deleting, setDeleting] = useState<NoteFolder | null>(null);
  const [length, setLength] = useState<NoteLength | null>(null);
  const [newMenu, setNewMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // ⌘O with a note open on a narrow screen: the list comes back first, then the search takes the caret.
  const focusSearchSoon = useRef(false);

  const navigate = (patch: Record<string, string | null>, mode: 'push' | 'replace' = 'push') => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const folders = useQuery({ queryKey: moduleQueryKeys.notes.key('folders'), queryFn: getNoteFolders });
  const allFolders = useMemo(() => folders.data?.folders ?? [], [folders.data]);
  // The folder picked in the tree: where a new note goes.
  const currentFolder = allFolders.find((folder) => folder.id === folderId) ?? null;

  const create = useMutation({
    // A folder's right-click "New note here" names it; otherwise the folder picked in the tree, if you can write there.
    mutationFn: ({ kind = 'note', into }: NewNote = {}) =>
      createNote({
        folderId: into !== undefined ? into : currentFolder?.canEdit ? currentFolder.id : null,
        ...(kind === 'drawing' ? blankDrawing() : {}),
      }),
    onSuccess: async (note) => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.all });
      navigate({ note: note.id, tag: null, q: null });
      setSearch('');
    },
    onError: (error) => toast('error', error.message),
  });
  const removeFolder = useMutation({
    mutationFn: (folder: NoteFolder) => deleteNoteFolder(folder.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.all });
      setDeleting(null);
      navigate({ folder: null, note: null });
      toast('success', 'Folder deleted — its notes are in Recently Deleted for 30 days.');
    },
    onError: (error) => toast('error', error.message),
  });

  const focusSearch = () => {
    const input = searchRef.current;
    if (input && input.offsetParent !== null) {
      input.focus();
      input.select();
    } else {
      focusSearchSoon.current = true;
      navigate({ note: null });
    }
  };
  useEffect(() => {
    if (!focusSearchSoon.current || noteId) return;
    focusSearchSoon.current = false;
    searchRef.current?.focus();
  }, [noteId]);

  // ⌘N / Ctrl+N: a new note, as in Notes. ⌘O / Ctrl+O: search and jump to a note, as in Obsidian (⌘K is the editor's link).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'n' && canWrite) {
        event.preventDefault();
        if (!create.isPending) create.mutate({});
      } else if (key === 'o') {
        event.preventDefault();
        focusSearch();
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
          {noteId && length && length.words > 0 && (
            <span className="mr-1 hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground md:inline" aria-live="polite">
              {length.words.toLocaleString()} {length.words === 1 ? 'word' : 'words'}
              <span className="max-xl:hidden"> · {length.characters.toLocaleString()} characters</span> · {length.minutes} min read
            </span>
          )}
          <Tooltip side="bottom" label="See how your notes connect">
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => router.push('/notes/graph')} aria-label="Graph">
              <GraphView size={15} aria-hidden="true" />
              <span className="hidden md:inline">Graph</span>
            </Button>
          </Tooltip>
          {canWrite && (
            <div className="flex">
              <Tooltip side="bottom" label="New note (⌘N)">
                <Button className="h-9 gap-1.5 rounded-r-none" disabled={create.isPending} onClick={() => create.mutate({})}>
                  <Plus size={15} aria-hidden="true" />
                  <span className="hidden md:inline">New note</span>
                </Button>
              </Tooltip>
              <Popover open={newMenu} onOpenChange={setNewMenu}>
                <Tooltip side="bottom" align="end" label="A note or a drawing">
                  <PopoverTrigger asChild>
                    <Button
                      className="h-9 rounded-l-none border-l border-primary-foreground/25 px-2"
                      disabled={create.isPending}
                      aria-label="New — choose a note or a drawing"
                    >
                      <ChevronDown size={15} aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                </Tooltip>
                <PopoverContent align="end" className="w-64 p-1">
                  <MenuOption
                    icon={StickyNote}
                    label="Note"
                    hint="Text, checklists, tables, photos"
                    onSelect={() => {
                      setNewMenu(false);
                      create.mutate({});
                    }}
                  />
                  <MenuOption
                    icon={PenLine}
                    label="Drawing"
                    hint="A canvas to sketch on, with photos and videos"
                    onSelect={() => {
                      setNewMenu(false);
                      create.mutate({ kind: 'drawing' });
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      }
    >
      <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* ── Folders and their notes, one tree ── */}
        <aside
          className={cn('min-h-0 flex-col border-r border-divider bg-card', noteId ? 'hidden lg:flex' : 'flex')}
          aria-label="Notes and folders"
        >
          {folders.isPending ? (
            <div className="p-3">
              <TilesSkeleton count={6} label="Loading folders" />
            </div>
          ) : folders.isError ? (
            <ErrorState title="Folders couldn’t be loaded" onRetry={() => void folders.refetch()} />
          ) : (
            <NotesSidebar
              folders={folders.data}
              noteId={noteId}
              folderId={folderId}
              tag={tag}
              search={search}
              q={q}
              canWrite={canWrite}
              onSearch={(value) => {
                setSearch(value);
                navigate({ q: value.trim() || null }, 'replace');
              }}
              onOpenNote={(id) => navigate({ note: id })}
              onSelectFolder={(id) => navigate({ folder: id }, 'replace')}
              onShowTag={(value) => navigate({ tag: value })}
              onNewFolder={() => setFolderDialog({ kind: 'create', parent: null })}
              onFolderAction={(folder, action) =>
                action === 'delete'
                  ? setDeleting(folder)
                  : setFolderDialog(action === 'subfolder' ? { kind: 'create', parent: folder } : { kind: action, folder })
              }
              onNewNote={() => create.mutate({})}
              onNewNoteIn={(id) => create.mutate({ into: id })}
              onNewDrawingIn={(id) => create.mutate({ kind: 'drawing', into: id })}
              searchRef={searchRef}
              onNoteGone={(id) => {
                if (id === noteId) navigate({ note: null }, 'replace');
              }}
            />
          )}
        </aside>

        {/* ── The note ── */}
        <main className={cn('min-h-0 flex-col bg-background', noteId ? 'flex' : 'hidden lg:flex')}>
          {noteId ? (
            <NoteEditor
              noteId={noteId}
              folders={allFolders}
              onBack={() => navigate({ note: null })}
              onDeleted={() => navigate({ note: null }, 'replace')}
              onOpenNote={(id) => navigate({ note: id })}
              onLength={setLength}
            />
          ) : (
            <EmptyState
              className="flex-1"
              icon={NotebookPen}
              title="Pick a note, or start one"
              description="Recipes, opening and closing checklists, how-tos — written once, found by search, and answered by Ask DUMA from shared folders."
              action={
                canWrite
                  ? {
                      label: currentFolder?.canEdit ? `New note in ${currentFolder.name}` : 'New note',
                      onClick: () => create.mutate({}),
                      icon: Plus,
                    }
                  : undefined
              }
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
            if (folderDialog.kind === 'create') navigate({ folder: folder.id }, 'replace');
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
    </EditorShell>
  );
}
