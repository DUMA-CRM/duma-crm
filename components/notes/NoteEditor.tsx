'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import { encodeImage } from '@/components/cms/imageEncode';
import { createRenditions } from '@/components/cms/renditions';
import { assetSrc, invalidateCms } from '@/components/cms/shared';
import {
  ArrowLeft,
  Check,
  FolderIcon,
  History,
  Loader2,
  Lock,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
  StickyNote,
  Trash2,
  TriangleAlert,
  Users,
} from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { ApiError } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { uploadCmsAsset } from '@/lib/modules/cms/client';
import { type Note, type NoteFolder, deleteNote, getNote, restoreNote, saveNote } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type NoteLength, noteLength } from '@/lib/utils/note-editor';
import { folderTree, noteTitleFrom, tagsInText } from '@/lib/utils/notes';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { DriveSyncBar, useNoteDriveSync } from './NoteDriveSync';
import type { EditorSnapshot } from './RichNoteEditor';
import { VersionsDrawer } from './VersionsDrawer';

// TipTap only ever loads on this page, and only in the browser (UI-ADR-031).
const RichNoteEditor = dynamic(() => import('./RichNoteEditor').then((module) => module.RichNoteEditor), {
  ssr: false,
  loading: () => <div className="min-h-[60vh]" aria-busy="true" />,
});
// Same chunk as the editor; it sits in the note's bar, so the bar is one row.
const NoteToolbar = dynamic(() => import('./NoteToolbar').then((module) => module.NoteToolbar), { ssr: false });

type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
const SAVE_DELAY_MS = 1200;

/** Re-encoded in the browser first, as every image in DUMA is (UI-ADR-024). Videos go as they are. */
async function optimised(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  const encoded = await encodeImage(file, { format: 'image/webp', quality: 0.85, maxWidth: 2000 }).catch(() => null);
  return encoded?.file ?? file;
}

/**
 * Where a photo from this device goes. With Content on and `cms:write`, into
 * Content's media library (folder "Notes", with its smaller copies), so it can
 * be used anywhere afterwards; the note keeps the keyless delivery URL through
 * `/be`. Null otherwise — the toolbar then offers no upload, and a pasted
 * screenshot falls back to the note's own image store.
 */
function useContentUpload(): ((file: File) => Promise<string>) | null {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const { contentEnabled } = useCatalogWords();
  if (!contentEnabled || !hasCapability(capabilities, 'cms:write')) return null;
  return async (file) => {
    try {
      const upload = await optimised(file);
      const asset = await uploadCmsAsset(upload, { title: file.name.replace(/\.[^.]+$/, ''), folder: 'Notes' }, tenantId ?? undefined);
      if (asset.mimeType.startsWith('image/')) await createRenditions(asset, tenantId ?? undefined, upload).catch(() => 0);
      void invalidateCms(queryClient);
      return assetSrc(asset.url);
    } catch (error) {
      toast('error', error instanceof Error && error.message ? error.message : `${file.name} couldn’t be uploaded.`);
      throw error;
    }
  };
}

async function uploadNoteImage(file: File): Promise<string> {
  const upload = await optimised(file);
  const response = await fetch(`/api/notes/images?filename=${encodeURIComponent(upload.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': upload.type },
    body: upload,
  });
  const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !result.url) {
    toast('error', result.error ?? 'The image couldn’t be added.');
    throw new Error(result.error ?? 'upload failed');
  }
  return result.url;
}

export function NoteEditor({
  noteId,
  folders,
  onBack,
  onDeleted,
  onLength,
}: {
  noteId: string;
  folders: NoteFolder[];
  onBack: () => void;
  onDeleted: () => void;
  /** The open note's length as it changes, for the page header; null when no note is open. */
  onLength: (length: NoteLength | null) => void;
}) {
  const query = useQuery({ queryKey: moduleQueryKeys.notes.key('note', noteId), queryFn: () => getNote(noteId), staleTime: Infinity });
  // Bumped to put a different copy in the editor on purpose: a restored version, or "use their copy".
  const [reloads, setReloads] = useState(0);

  if (query.isPending) return <LoadingState label="Opening the note" />;
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return gone ? (
      <EmptyState
        className="flex-1"
        icon={StickyNote}
        kind="gone"
        title="This note isn’t here"
        description="It was deleted, moved somewhere you can’t see, or the link is wrong."
      />
    ) : (
      <ErrorState title="The note couldn’t be opened" onRetry={() => void query.refetch()} />
    );
  }
  // Not keyed by version: the cache follows every save, and a remount (coming back to
  // the note) must start from the version last saved, never an older one.
  return (
    <LoadedNote
      key={`${query.data.id}:${query.data.deletedAt ?? ''}:${reloads}`}
      note={query.data}
      folders={folders}
      onBack={onBack}
      onDeleted={onDeleted}
      onReload={() => setReloads((count) => count + 1)}
      onLength={onLength}
    />
  );
}

function LoadedNote({
  note,
  folders,
  onBack,
  onDeleted,
  onReload,
  onLength,
}: {
  note: Note;
  folders: NoteFolder[];
  onBack: () => void;
  onDeleted: () => void;
  /** Remount the editor on the copy now in the cache. */
  onReload: () => void;
  onLength: (length: NoteLength | null) => void;
}) {
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSaved, setLastSaved] = useState(note.updatedAt);
  const [menuOpen, setMenuOpen] = useState(false);
  const [history, setHistory] = useState(false);
  const versionRef = useRef(note.version);
  const pending = useRef<EditorSnapshot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<Promise<void> | null>(null);
  const editorRef = useRef<Editor | null>(null);
  // The same editor, as state: the toolbar renders once it exists.
  const [editor, setEditor] = useState<Editor | null>(null);
  const contentUpload = useContentUpload();
  const drive = useNoteDriveSync(note);

  // Words and reading time follow every edit, up to the page header.
  useEffect(() => {
    if (!editor) return;
    const report = () => onLength(noteLength(editor.getText({ blockSeparator: '\n' })));
    report();
    editor.on('update', report);
    return () => {
      editor.off('update', report);
      onLength(null);
    };
  }, [editor, onLength]);
  // Read by the save loop, which outlives the render that started it — so it
  // changes with the state, through one setter, never during render.
  const saveStateRef = useRef<SaveState>('saved');
  const updateSaveState = useCallback((next: SaveState) => {
    saveStateRef.current = next;
    setSaveState(next);
  }, []);
  const trashed = note.deletedAt !== null;
  const editable = note.canEdit && !trashed;

  const refreshLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('list') });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('folders') });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('tags') });
  }, [queryClient]);

  // The retry and the follow-up save call the latest flush, not the one they were scheduled by.
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    const snapshot = pending.current;
    if (!snapshot) return;
    pending.current = null;
    updateSaveState('saving');
    const run = (async () => {
      try {
        const saved = await saveNote(note.id, {
          version: versionRef.current,
          title: noteTitleFrom(snapshot.text),
          content: snapshot.content,
          markdown: snapshot.markdown,
          bodyText: snapshot.text,
          tags: tagsInText(snapshot.text),
        });
        versionRef.current = saved.version;
        setLastSaved(saved.updatedAt);
        queryClient.setQueryData(moduleQueryKeys.notes.key('note', note.id), (current: Note | undefined) =>
          current ? { ...current, ...saved } : saved,
        );
        updateSaveState(pending.current ? 'pending' : 'saved');
        refreshLists();
      } catch (error) {
        if (error instanceof ApiError && error.code === 'stale_version') {
          pending.current = snapshot;
          updateSaveState('conflict');
          return;
        }
        // Kept, and tried again shortly — typing is never lost to a dropped connection.
        pending.current = pending.current ?? snapshot;
        updateSaveState('error');
        timer.current = setTimeout(() => void flushRef.current(), 5000);
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (pending.current && saveStateRef.current !== 'conflict') void flushRef.current();
  }, [note.id, queryClient, refreshLists, updateSaveState]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const onChange = useCallback(
    (snapshot: EditorSnapshot) => {
      if (!editable) return;
      pending.current = snapshot;
      if (saveStateRef.current !== 'conflict') updateSaveState('pending');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [editable, flush, updateSaveState],
  );

  // Leaving the note (another note, another page) saves what's waiting.
  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );
  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const keepMine = async () => {
    const latest = await getNote(note.id);
    versionRef.current = latest.version;
    updateSaveState('pending');
    await flush();
  };
  const takeTheirs = async () => {
    pending.current = null;
    await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('note', note.id) });
    onReload();
  };

  const meta = useMutation({
    mutationFn: (patch: { pinned?: boolean; folderId?: string | null }) => saveNote(note.id, patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(moduleQueryKeys.notes.key('note', note.id), (current: Note | undefined) =>
        current ? { ...current, pinned: saved.pinned, folderId: saved.folderId } : saved,
      );
      refreshLists();
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: async () => {
      await flush();
      return deleteNote(note.id);
    },
    onSuccess: () => {
      refreshLists();
      toast('success', 'Moved to Recently Deleted — it’s kept for 30 days.');
      onDeleted();
    },
    onError: (error) => toast('error', error.message),
  });
  const restore = useMutation({
    mutationFn: () => restoreNote(note.id),
    onSuccess: async () => {
      refreshLists();
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('note', note.id) });
      toast('success', 'Note restored.');
    },
    onError: (error) => toast('error', error.message),
  });

  const writable = folders.filter((folder) => folder.canEdit);
  // Where it can go: your private notes, or any folder you can write in.
  const moveTargets = [
    { id: null, name: 'My notes', depth: 0, shared: false, icon: Lock },
    ...folderTree(writable).map(({ folder, depth }) => ({
      id: folder.id as string | null,
      name: folder.name,
      depth,
      shared: folder.shared,
      icon: folder.shared ? Users : FolderIcon,
    })),
  ];
  /** A menu choice closes the menu, then does its thing. */
  const act = (run: () => void) => {
    setMenuOpen(false);
    run();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The note's own bar, in one row: how to format it, whether it's saved, what you can do with it. */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-divider bg-card px-2 md:px-3">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back to the list" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        {!editable && !trashed && (
          <span className="shrink-0 rounded-sm bg-band px-1.5 py-0.5 text-micro font-semibold text-muted-foreground">Read only</span>
        )}
        {editable && editor ? (
          <div className="flex min-w-0 flex-1 overflow-x-auto">
            <NoteToolbar editor={editor} onUploadMedia={contentUpload} />
          </div>
        ) : (
          <span className="flex-1" />
        )}
        <SaveStatus state={saveState} lastSaved={lastSaved} />
        {!trashed && note.canEdit && (
          <Tooltip side="bottom" label={note.pinned ? 'Unpin' : 'Pin to the top'}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={note.pinned ? 'Unpin' : 'Pin'}
              onClick={() => meta.mutate({ pinned: !note.pinned })}
            >
              {note.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
            </Button>
          </Tooltip>
        )}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-1.5" role="menu" aria-label="Note actions">
            {trashed ? (
              <MenuItem icon={RotateCcw} label="Restore" onClick={() => act(() => restore.mutate())} />
            ) : (
              <>
                <MenuItem icon={History} label="History" onClick={() => act(() => setHistory(true))} />
                {/* Only once Google Drive is connected (Settings → Connectors); each person's own Drive. */}
                {drive.menuItems.map((item) => (
                  <MenuItem key={item.key} icon={item.icon} label={item.label} onClick={() => act(item.onClick)} />
                ))}
                {note.canEdit && (
                  <div className="mt-1.5 border-t border-rule/50 pt-2" role="group" aria-label="Move to">
                    <p className="mb-1 px-2 text-label uppercase text-muted-foreground">Move to</p>
                    <ul className="max-h-60 space-y-px overflow-y-auto">
                      {moveTargets.map((target) => {
                        const current = (note.folderId ?? null) === target.id;
                        return (
                          <li key={target.id ?? 'mine'}>
                            <button
                              type="button"
                              role="menuitemradio"
                              aria-checked={current}
                              disabled={current || meta.isPending}
                              onClick={() =>
                                act(() =>
                                  meta.mutate({ folderId: target.id }, { onSuccess: () => toast('success', `Moved to ${target.name}.`) }),
                                )
                              }
                              style={{ paddingLeft: `${0.5 + target.depth * 0.875}rem` }}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                                current ? 'bg-primary/8 font-medium text-primary' : 'text-foreground hover:bg-band/60 disabled:opacity-50',
                              )}
                            >
                              <target.icon size={15} className={cn('shrink-0', !current && 'text-muted-foreground')} aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">{target.name}</span>
                              {target.shared && (
                                <span className="shrink-0 rounded-sm bg-band px-1.5 py-0.5 text-micro font-semibold text-muted-foreground">
                                  Shared
                                </span>
                              )}
                              {current && <Check size={14} className="shrink-0" aria-hidden="true" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {note.canEdit && (
                  <div className="mt-1.5 border-t border-rule/50 pt-1.5">
                    <MenuItem icon={Trash2} label="Delete" danger onClick={() => act(() => remove.mutate())} />
                  </div>
                )}
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {saveState === 'conflict' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-measured/40 bg-measured/8 px-5 py-2.5 text-sm">
          <TriangleAlert size={16} className="shrink-0 text-measured" aria-hidden="true" />
          <span className="min-w-0 flex-1">Someone else saved this note while you were writing.</span>
          <Button size="sm" variant="outline" onClick={() => void takeTheirs()}>
            Use their copy
          </Button>
          <Button size="sm" onClick={() => void keepMine()}>
            Keep mine
          </Button>
        </div>
      )}
      {trashed && (
        <div className="flex items-center gap-3 border-b border-rule/50 bg-band/60 px-5 py-2.5 text-sm text-muted-foreground">
          <span className="min-w-0 flex-1">In Recently Deleted. Restore it to edit.</span>
          {note.canEdit && (
            <Button size="sm" variant="outline" onClick={() => restore.mutate()}>
              Restore
            </Button>
          )}
        </div>
      )}
      {!trashed && <DriveSyncBar drive={drive} />}

      <div className="min-h-0 flex-1 overflow-auto">
        {/* The full width of the pane. */}
        <div className="w-full px-4 pb-24 md:px-5">
          <RichNoteEditor
            content={note.content}
            markdown={note.markdown}
            editable={editable}
            onChange={onChange}
            onReady={(ready) => {
              editorRef.current = ready;
              setEditor(ready);
            }}
            onUploadImage={contentUpload ?? uploadNoteImage}
            acceptsVideo={contentUpload !== null}
          />
        </div>
      </div>

      {history && (
        <VersionsDrawer
          noteId={note.id}
          canRestore={editable}
          onClose={() => setHistory(false)}
          onRestored={async () => {
            pending.current = null;
            setHistory(false);
            await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('note', note.id) });
            refreshLists();
            onReload();
          }}
        />
      )}
    </div>
  );
}

function SaveStatus({ state, lastSaved }: { state: SaveState; lastSaved: string }) {
  if (state === 'saving' || state === 'pending')
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> <span className="max-xl:sr-only">Saving…</span>
      </span>
    );
  if (state === 'error')
    return (
      <span className="text-xs font-medium text-exception" aria-live="polite">
        Couldn’t save — retrying
      </span>
    );
  if (state === 'conflict') return <span className="text-xs font-medium text-measured">Not saved</span>;
  return (
    <Tooltip side="bottom" align="end" label="Saved automatically as you type">
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground" aria-live="polite">
        <Check size={12} aria-hidden="true" />
        {/* Next to the toolbar there is room for a tick; the words come back on a wide screen. */}
        <span className="max-xl:sr-only">
          Saved <RelativeTime iso={lastSaved} />
        </span>
      </span>
    </Tooltip>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Trash2;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
        danger ? 'text-exception hover:bg-exception/6' : 'text-foreground hover:bg-band/60',
      )}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
