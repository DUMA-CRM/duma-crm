'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ArrowLeft,
  Check,
  ChevronRight,
  FolderMove,
  GraphView,
  History,
  Loader2,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
  StickyNote,
  Trash2,
  TriangleAlert,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { ApiError } from '@/lib/api/client';
import { type Note, type NoteFolder, deleteNote, getNote, purgeNote, restoreNote, saveNote } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { isDrawingNote } from '@/lib/utils/note-drawing';
import { type NoteLength, noteLength } from '@/lib/utils/note-editor';
import { noteTitleFrom, tagsInText } from '@/lib/utils/notes';
import { toast } from '@/stores/toastStore';

import { MoveToPage } from './MoveToPage';
import { NoteBacklinks } from './NoteBacklinks';
import { DriveSyncBar, useNoteDriveSync } from './NoteDriveSync';
import type { EditorSnapshot } from './RichNoteEditor';
import { VersionsDrawer } from './VersionsDrawer';
import { uploadDrawingImage, uploadNoteImage, useContentUpload } from './noteUploads';

// TipTap only ever loads on this page, and only in the browser (UI-ADR-031).
const RichNoteEditor = dynamic(() => import('./RichNoteEditor').then((module) => module.RichNoteEditor), {
  ssr: false,
  loading: () => <div className="min-h-[60vh]" aria-busy="true" />,
});
// Same chunk as the editor; it sits in the note's bar, so the bar is one row.
const NoteToolbar = dynamic(() => import('./NoteToolbar').then((module) => module.NoteToolbar), { ssr: false });
// A drawing note's canvas. Excalidraw is large: only fetched when one is opened (UI-ADR-033).
const DrawingNote = dynamic(() => import('./DrawingNote'), {
  ssr: false,
  loading: () => <LoadingState label="Opening the drawing" />,
});

type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
const SAVE_DELAY_MS = 1200;

export function NoteEditor({
  noteId,
  folders,
  onBack,
  onDeleted,
  onLength,
  onOpenNote,
}: {
  noteId: string;
  folders: NoteFolder[];
  onBack: () => void;
  onDeleted: () => void;
  /** Open another note — from a link in this one, or from "Linked from". */
  onOpenNote: (id: string) => void;
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
      onOpenNote={onOpenNote}
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
  onOpenNote,
}: {
  note: Note;
  folders: NoteFolder[];
  onBack: () => void;
  onDeleted: () => void;
  /** Remount the editor on the copy now in the cache. */
  onReload: () => void;
  onLength: (length: NoteLength | null) => void;
  onOpenNote: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSaved, setLastSaved] = useState(note.updatedAt);
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu's second page, for picking a folder.
  const [menuPage, setMenuPage] = useState<'main' | 'move'>('main');
  const [history, setHistory] = useState(false);
  const [purging, setPurging] = useState(false);
  const versionRef = useRef(note.version);
  const pending = useRef<EditorSnapshot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<Promise<void> | null>(null);
  const editorRef = useRef<Editor | null>(null);
  // The same editor, as state: the toolbar renders once it exists.
  const [editor, setEditor] = useState<Editor | null>(null);
  const contentUpload = useContentUpload('note');
  // A drawing's photos go to their own folder, compressed harder (see noteUploads).
  const drawingUpload = useContentUpload('drawing');
  // Where a drawing note puts its title and "Photo or video": this bar.
  const [drawingBar, setDrawingBar] = useState<HTMLDivElement | null>(null);
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
  const drawing = isDrawingNote(note.content);

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
  const purge = useMutation({
    mutationFn: () => purgeNote(note.id),
    onSuccess: () => {
      setPurging(false);
      queryClient.removeQueries({ queryKey: moduleQueryKeys.notes.key('note', note.id) });
      refreshLists();
      toast('success', 'Deleted for good.');
      onDeleted();
    },
    onError: (error) => toast('error', error.message),
  });

  const hereNow = note.folderId ? (folders.find((folder) => folder.id === note.folderId)?.name ?? 'a folder') : 'My notes';
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
        {drawing ? (
          <div ref={setDrawingBar} className="flex min-w-0 flex-1 items-center gap-1" />
        ) : editable && editor ? (
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
        <Popover
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open);
            if (!open) setMenuPage('main');
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-1.5" role="menu" aria-label="Note actions">
            {menuPage === 'move' ? (
              <MoveToPage
                folders={folders}
                currentFolderId={note.folderId ?? null}
                pending={meta.isPending}
                onBack={() => setMenuPage('main')}
                onMove={(target) =>
                  act(() => meta.mutate({ folderId: target.id }, { onSuccess: () => toast('success', `Moved to ${target.name}.`) }))
                }
              />
            ) : trashed ? (
              <>
                <MenuItem icon={RotateCcw} label="Restore" onClick={() => act(() => restore.mutate())} />
                {note.canEdit && <MenuItem icon={Trash2} label="Delete permanently" danger onClick={() => act(() => setPurging(true))} />}
              </>
            ) : (
              <>
                <MenuItem icon={History} label="History" onClick={() => act(() => setHistory(true))} />
                <MenuItem icon={GraphView} label="Show in graph" onClick={() => act(() => router.push(`/notes/graph?focus=${note.id}`))} />
                {/* Only once Google Drive is connected (Settings → Connectors); each person's own Drive. */}
                {drive.menuItems.map((item) => (
                  <MenuItem key={item.key} icon={item.icon} label={item.label} onClick={() => act(item.onClick)} />
                ))}
                {note.canEdit && (
                  <button
                    type="button"
                    role="menuitem"
                    aria-haspopup="true"
                    onClick={() => setMenuPage('move')}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-foreground transition-colors duration-150 hover:bg-band/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <FolderMove size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">Move to…</span>
                    <span className="max-w-[45%] truncate text-xs text-muted-foreground">{hereNow}</span>
                    <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
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
            <>
              <Button size="sm" variant="ghost" className="text-exception hover:text-exception" onClick={() => setPurging(true)}>
                Delete permanently
              </Button>
              <Button size="sm" variant="outline" onClick={() => restore.mutate()}>
                Restore
              </Button>
            </>
          )}
        </div>
      )}
      {!trashed && <DriveSyncBar drive={drive} part="alert" />}

      {drawing ? (
        <>
          {!trashed && (
            <div className="shrink-0 px-4 pb-2 md:px-5 empty:hidden">
              <DriveSyncBar drive={drive} part="line" />
            </div>
          )}
          <DrawingNote
            content={note.content}
            editable={editable}
            onChange={onChange}
            upload={drawingUpload ?? uploadDrawingImage}
            uploadVideo={drawingUpload}
            bar={drawingBar}
          />
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {/* The full width of the pane. */}
          <div className="w-full px-4 pb-24 md:px-5">
            {!trashed && <DriveSyncBar drive={drive} part="line" />}
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
              noteId={note.id}
              onOpenNote={onOpenNote}
            />
            {!trashed && <NoteBacklinks noteId={note.id} onOpen={onOpenNote} />}
          </div>
        </div>
      )}

      {purging && (
        <ConfirmModal
          title={`Delete “${note.title || 'New note'}” for good?`}
          message="It and its history are gone for everyone, and can’t be brought back. A copy already synced to Google Docs stays in that Drive."
          confirmLabel="Delete permanently"
          pendingLabel="Deleting…"
          isPending={purge.isPending}
          onConfirm={() => purge.mutate()}
          onClose={() => setPurging(false)}
        />
      )}
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
