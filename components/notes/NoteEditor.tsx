'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import { encodeImage } from '@/components/cms/imageEncode';
import {
  ArrowLeft,
  Check,
  FolderOpen,
  GoogleDrive,
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
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import { type Note, type NoteFolder, deleteNote, getGoogleDocMarkdown, getNote, restoreNote, saveNote } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { folderTree, noteTitleFrom, tagsInText } from '@/lib/utils/notes';
import { toast } from '@/stores/toastStore';

import type { EditorSnapshot } from './RichNoteEditor';
import { VersionsDrawer } from './VersionsDrawer';

// TipTap only ever loads on this page, and only in the browser (UI-ADR-031).
const RichNoteEditor = dynamic(() => import('./RichNoteEditor').then((module) => module.RichNoteEditor), {
  ssr: false,
  loading: () => <div className="min-h-[60vh]" aria-busy="true" />,
});

type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
const SAVE_DELAY_MS = 1200;

async function uploadNoteImage(file: File): Promise<string> {
  // Re-encoded in the browser first, as every image in DUMA is (UI-ADR-024).
  const encoded = await encodeImage(file, { format: 'image/webp', quality: 0.85, maxWidth: 2000 }).catch(() => null);
  const upload = encoded?.file ?? file;
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
}: {
  noteId: string;
  folders: NoteFolder[];
  onBack: () => void;
  onDeleted: () => void;
}) {
  const query = useQuery({ queryKey: moduleQueryKeys.notes.key('note', noteId), queryFn: () => getNote(noteId), staleTime: Infinity });

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
  // Keyed by the loaded copy: a restored version or "use theirs" remounts the editor on it.
  return (
    <LoadedNote
      key={`${query.data.id}:${query.data.version}:${query.data.deletedAt ?? ''}`}
      note={query.data}
      folders={folders}
      onBack={onBack}
      onDeleted={onDeleted}
    />
  );
}

function LoadedNote({
  note,
  folders,
  onBack,
  onDeleted,
}: {
  note: Note;
  folders: NoteFolder[];
  onBack: () => void;
  onDeleted: () => void;
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
          current ? { ...saved, version: current.version } : saved,
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
  const updateFromDrive = useMutation({
    mutationFn: async () => {
      await flush();
      const { markdown } = await getGoogleDocMarkdown(note.sourceFileId!);
      const editor = editorRef.current;
      if (!editor) throw new Error('The editor isn’t ready yet.');
      editor.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: true });
    },
    onSuccess: () => toast('success', 'Updated from Google Docs — the previous copy is in History.'),
    onError: (error) => toast('error', error.message),
  });

  const writable = folders.filter((folder) => folder.canEdit);
  const moveOptions = [
    { value: '', label: 'My notes (private)' },
    ...folderTree(writable).map(({ folder, depth }) => ({
      value: folder.id,
      label: `${'  '.repeat(depth)}${folder.name}${folder.shared ? ' · shared' : ''}`,
    })),
  ];
  const folderName = note.folderId ? (folders.find((folder) => folder.id === note.folderId)?.name ?? 'A folder') : 'My notes';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The note's own bar: where it is, whether it's saved, what you can do with it. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-divider px-3 py-2 md:px-5">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back to the list" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <FolderOpen size={13} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{folderName}</span>
          {!editable && !trashed && <span className="shrink-0 rounded-sm bg-band px-1.5 py-0.5 text-micro font-semibold">Read only</span>}
        </span>
        <span className="flex-1" />
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
        <div className="relative">
          <Button variant="ghost" size="icon-sm" aria-label="More" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-9 z-20 w-64 rounded-lg border border-rule/60 bg-card p-1.5 shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              {trashed ? (
                <MenuItem icon={RotateCcw} label="Restore" onClick={() => restore.mutate()} />
              ) : (
                <>
                  <MenuItem icon={History} label="History" onClick={() => setHistory(true)} />
                  {note.sourceProvider === 'google_drive' && note.sourceFileId && editable && (
                    <MenuItem icon={GoogleDrive} label="Update from Google Docs" onClick={() => updateFromDrive.mutate()} />
                  )}
                  {note.sourceUrl && (
                    <MenuItem
                      icon={GoogleDrive}
                      label="Open in Google Drive"
                      onClick={() => window.open(note.sourceUrl!, '_blank', 'noopener')}
                    />
                  )}
                  {note.canEdit && (
                    <div className="border-t border-rule/50 px-2 pb-1 pt-2">
                      <p className="mb-1 text-micro font-semibold uppercase text-muted-foreground">Move to</p>
                      <Select
                        value={note.folderId ?? ''}
                        onValueChange={(folderId) => meta.mutate({ folderId: folderId || null })}
                        options={moveOptions}
                        ariaLabel="Move to folder"
                        className="w-full"
                      />
                    </div>
                  )}
                  {note.canEdit && <MenuItem icon={Trash2} label="Delete" danger onClick={() => remove.mutate()} />}
                </>
              )}
            </div>
          )}
        </div>
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
      {note.sourceProvider === 'google_drive' && !trashed && (
        <div className="flex items-center gap-2 border-b border-rule/40 px-5 py-1.5 text-xs text-muted-foreground">
          <GoogleDrive size={13} aria-hidden="true" />
          From Google Docs
          {note.sourceSyncedAt && (
            <>
              {' '}
              · brought in <RelativeTime iso={note.sourceSyncedAt} />
            </>
          )}
          {updateFromDrive.isPending && <Loader2 size={12} className="animate-spin" aria-label="Updating" />}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 md:px-8">
          <RichNoteEditor
            content={note.content}
            markdown={note.markdown}
            editable={editable}
            onChange={onChange}
            onReady={(editor) => {
              editorRef.current = editor;
            }}
            onUploadImage={uploadNoteImage}
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
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Saving…
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
    <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
      <Check size={12} aria-hidden="true" /> Saved <RelativeTime iso={lastSaved} />
    </span>
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
