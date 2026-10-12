'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type TreeNode, TreeView } from '@/components/arc/tree-view/tree-view';
import {
  AlertCircle,
  Copy,
  ExternalLink,
  FolderIcon,
  FolderLocked,
  FolderMove,
  FolderOpen,
  FolderPlus,
  FolderShared,
  Hash,
  Loader2,
  MoreHorizontal,
  PenLine,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Trash2,
  Users,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import {
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { type NoteFolder, type NoteFoldersResponse, type NoteSummary, getNote, getNoteTags, getNotes } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { groupNotesByDate, noteBodyAfterTitle, snippetParts } from '@/lib/utils/notes';
import { rankSwitcher, titleParts } from '@/lib/utils/notes-switcher';
import {
  type ContainerNotes,
  type NotesContainer,
  type NotesTreeItem,
  containersFor,
  folderNodeId,
  isContainer,
  moveTargets,
  noteNodeId,
  notesTree,
} from '@/lib/utils/notes-tree';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

import { useNoteActions } from './useNoteActions';

export type FolderAction = 'subfolder' | 'rename' | 'share' | 'delete';

/** What someone may do to a folder: sharing is a top-level shared folder's, for managers; deleting a shared top level is theirs too. */
function folderRights(folder: NoteFolder, canManage: boolean) {
  return {
    share: canManage && folder.shared && folder.parentId === null,
    remove: folder.canEdit && (!folder.shared || folder.parentId !== null || canManage),
  };
}

const EXPANDED_KEY = 'duma.notes.expanded';

/** Which containers were open last time — a per-browser convenience, so it may be missing. */
function readExpanded(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(EXPANDED_KEY) ?? '[]') as unknown;
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function containerQuery(container: NotesContainer) {
  return {
    queryKey: moduleQueryKeys.notes.key('list', 'tree', container),
    queryFn: () =>
      container === 'mine'
        ? getNotes({ view: 'unfiled' })
        : container === 'trash'
          ? getNotes({ view: 'trash' })
          : getNotes({ folderId: container.slice('folder:'.length) }),
  };
}

/** From this many letters the notes' text is searched too, not just their titles. */
const SEARCH_TEXT_FROM = 2;

type SearchHit = { note: NoteSummary; inText: boolean };

/**
 * Typing in the sidebar search: titles first — part of any word matches, best
 * match first, filtered here from the notes you can read — then, from two
 * letters, notes whose text matches (the API matches the start of each word).
 * It is also "jump to": ⌘O focuses it, arrows move, Enter opens.
 */
function useNoteSearch(q: string, tag: string | null) {
  const titles = useQuery({
    queryKey: moduleQueryKeys.notes.key('list', 'titles', tag),
    queryFn: () => getNotes({ tag: tag ?? undefined, limit: 200 }),
    enabled: q !== '',
    staleTime: 30_000,
  });
  const searchesText = q.length >= SEARCH_TEXT_FROM;
  const text = useQuery({
    queryKey: moduleQueryKeys.notes.key('list', 'matches', tag, q),
    queryFn: () => getNotes({ q, tag: tag ?? undefined, limit: 30 }),
    enabled: searchesText,
    placeholderData: (previous) => previous,
  });
  const byTitle = rankSwitcher(titles.data ?? [], q, 30);
  const titleIds = new Set(byTitle.map((note) => note.id));
  const inText = searchesText ? (text.data ?? []).filter((note) => !titleIds.has(note.id)) : [];
  const hits: SearchHit[] = [...byTitle.map((note) => ({ note, inText: false })), ...inText.map((note) => ({ note, inText: true }))];
  return {
    hits,
    pending: titles.isPending || (searchesText && text.isPending),
    error: titles.isError,
    textError: searchesText && text.isError,
    retry: () => {
      if (titles.isError) void titles.refetch();
      if (text.isError) void text.refetch();
    },
  };
}

/**
 * The Notes sidebar, in one column: every folder as a tree with its notes in
 * it (each folder's notes load when it's opened), and Recently deleted pinned
 * to the bottom. A search or a tag swaps the tree for a flat list of matches.
 */
export function NotesSidebar({
  folders,
  noteId,
  folderId,
  tag,
  search,
  q,
  canWrite,
  onSearch,
  onOpenNote,
  onSelectFolder,
  onShowTag,
  onNewFolder,
  onFolderAction,
  onNewNote,
  onNewNoteIn,
  onNewDrawingIn,
  onNoteGone,
  searchRef,
}: {
  folders: NoteFoldersResponse;
  noteId: string | null;
  folderId: string | null;
  tag: string | null;
  search: string;
  /** The search as it's run (deferred). */
  q: string;
  canWrite: boolean;
  onSearch: (value: string) => void;
  onOpenNote: (id: string) => void;
  /** Null: My notes. Where a new note goes. */
  onSelectFolder: (id: string | null) => void;
  onShowTag: (tag: string | null) => void;
  onNewFolder: () => void;
  onFolderAction: (folder: NoteFolder, action: FolderAction) => void;
  onNewNote: () => void;
  /** A new note in this folder (null: My notes), from a folder's right-click menu. */
  onNewNoteIn: (folderId: string | null) => void;
  /** A new drawing there, the same way. */
  onNewDrawingIn: (folderId: string | null) => void;
  /** A note that no longer exists — deleted for good — so the page can close it if it's open. */
  onNoteGone: (id: string) => void;
  /** The search box, so ⌘O can put the caret in it. */
  searchRef: React.Ref<HTMLInputElement>;
}) {
  const me = useAuthStore((state) => state.user?.id ?? null);
  const actions = useNoteActions();
  const [purging, setPurging] = useState<NotesTreeItem | null>(null);
  const [expanded, setExpanded] = useState<string[]>(() => (folderId ? ['mine', folderNodeId(folderId)] : ['mine']));
  // After mount: the server render has no localStorage, and must match the first client render.
  useEffect(() => {
    const stored = readExpanded();
    if (stored.length) setExpanded((current) => [...new Set([...current, ...stored])]);
  }, []);
  const changeExpanded = (next: string[]) => {
    setExpanded(next);
    try {
      window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
    } catch {
      // Private window or blocked storage: the tree simply forgets.
    }
  };

  // Opening a note (a link, a search result) opens the folders above it. Same cache as the editor.
  const openNote = useQuery({
    queryKey: moduleQueryKeys.notes.key('note', noteId),
    queryFn: () => getNote(noteId!),
    enabled: noteId !== null,
    staleTime: Infinity,
  });
  const openNoteFolder = openNote.data?.folderId ?? null;
  const openNoteDeleted = openNote.data?.deletedAt ?? null;
  useEffect(() => {
    if (!openNote.data) return;
    const needed = containersFor({ folderId: openNoteFolder, deletedAt: openNoteDeleted }, folders.folders);
    setExpanded((current) => (needed.every((id) => current.includes(id)) ? current : [...new Set([...current, ...needed])]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the open note or its place changes
  }, [noteId, openNoteFolder, openNoteDeleted, openNote.data !== undefined]);

  const containers = expanded.filter(isContainer);
  const loaded = useQueries({ queries: containers.map(containerQuery) });
  const notesByContainer = new Map<NotesContainer, ContainerNotes>(
    containers.map((container, index) => {
      const result = loaded[index]!;
      return [
        container,
        result.isPending ? { status: 'pending' } : result.isError ? { status: 'error' } : { status: 'success', notes: result.data },
      ];
    }),
  );
  const items = notesTree({ folders: folders.folders, counts: folders.counts, notes: notesByContainer });
  const folderById = useMemo(() => new Map(folders.folders.map((folder) => [folder.id, folder])), [folders.folders]);
  const itemById = new Map<string, NotesTreeItem>();
  const toNode = (item: NotesTreeItem): TreeNode => {
    itemById.set(item.id, item);
    return {
      id: item.id,
      label: item.label,
      icon: itemIcon(item, expanded.includes(item.id)),
      meta: item.kind !== 'note' && item.count ? item.count : undefined,
      children: item.children?.map(toNode),
    };
  };
  // Recently deleted sits at the foot of the sidebar, not after however many folders are open.
  const nodes = items.filter((item) => item.kind !== 'trash').map(toNode);
  const trashNodes = items.filter((item) => item.kind === 'trash').map(toNode);
  const selectedId = noteId ? noteNodeId(noteId) : folderId ? folderNodeId(folderId) : null;

  const select = (node: TreeNode) => {
    const item = itemById.get(node.id);
    if (!item) return;
    if (item.kind === 'note') onOpenNote(item.ref);
    else if (item.kind === 'folder') onSelectFolder(item.ref);
    else if (item.kind === 'mine') onSelectFolder(null);
    else if (item.kind === 'error') void loaded[containers.indexOf(item.ref as NotesContainer)]?.refetch();
  };

  // ── Right-click menus ──
  const moveSubmenu = (item: NotesTreeItem) => {
    const here = item.container === 'mine' ? null : (item.container?.slice('folder:'.length) ?? null);
    const targets = moveTargets(folders.folders).filter((target) => target.id !== null || item.ownerUserId === me);
    return (
      <ContextMenuSub>
        <ContextMenuSubTrigger icon={FolderMove}>Move to</ContextMenuSubTrigger>
        <ContextMenuSubContent className="max-h-80 w-60 overflow-y-auto">
          {targets.map((target) => {
            const Icon = target.id === null ? FolderLocked : target.shared ? FolderShared : FolderIcon;
            return (
              <ContextMenuItem
                key={target.id ?? 'mine'}
                icon={Icon}
                disabled={target.id === here}
                style={{ paddingLeft: `${8 + target.depth * 12}px` }}
                onSelect={() => actions.move.mutate({ id: item.ref, folderId: target.id, name: target.name })}
              >
                {target.name}
              </ContextMenuItem>
            );
          })}
        </ContextMenuSubContent>
      </ContextMenuSub>
    );
  };
  const contextMenu = (node: TreeNode) => {
    const item = itemById.get(node.id);
    if (!item) return null;
    if (item.kind === 'note' && item.container === 'trash') {
      return (
        <>
          <ContextMenuItem icon={StickyNote} onSelect={() => onOpenNote(item.ref)}>
            Open
          </ContextMenuItem>
          {item.canEdit && (
            <>
              <ContextMenuItem icon={RotateCcw} onSelect={() => actions.restore.mutate(item.ref)}>
                Restore
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Trash2} danger onSelect={() => setPurging(item)}>
                Delete permanently
              </ContextMenuItem>
            </>
          )}
        </>
      );
    }
    if (item.kind === 'note') {
      return (
        <>
          <ContextMenuItem icon={StickyNote} onSelect={() => onOpenNote(item.ref)}>
            Open
          </ContextMenuItem>
          <ContextMenuItem icon={ExternalLink} onSelect={() => window.open(`/notes?note=${item.ref}`, '_blank', 'noopener')}>
            Open in a new tab
          </ContextMenuItem>
          <ContextMenuItem icon={Copy} onSelect={() => void actions.copyLink(item.ref)}>
            Copy link
          </ContextMenuItem>
          {item.canEdit && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                icon={item.pinned ? PinOff : Pin}
                onSelect={() => actions.pin.mutate({ id: item.ref, pinned: !item.pinned })}
              >
                {item.pinned ? 'Unpin' : 'Pin to the top'}
              </ContextMenuItem>
              {moveSubmenu(item)}
              <ContextMenuSeparator />
              <ContextMenuItem icon={Trash2} danger onSelect={() => actions.trash.mutate(item.ref)}>
                Move to Recently deleted
              </ContextMenuItem>
            </>
          )}
        </>
      );
    }
    if (item.kind === 'mine') {
      return canWrite ? (
        <>
          <ContextMenuItem icon={Plus} onSelect={() => onNewNoteIn(null)}>
            New note
          </ContextMenuItem>
          <ContextMenuItem icon={PenLine} onSelect={() => onNewDrawingIn(null)}>
            New drawing
          </ContextMenuItem>
          <ContextMenuItem icon={FolderPlus} onSelect={onNewFolder}>
            New folder
          </ContextMenuItem>
        </>
      ) : null;
    }
    if (item.kind === 'folder') {
      const folder = folderById.get(item.ref);
      if (!folder?.canEdit) return null;
      const rights = folderRights(folder, folders.canManage);
      return (
        <>
          <ContextMenuLabel>{folder.name}</ContextMenuLabel>
          {canWrite && (
            <>
              <ContextMenuItem icon={Plus} onSelect={() => onNewNoteIn(folder.id)}>
                New note here
              </ContextMenuItem>
              <ContextMenuItem icon={PenLine} onSelect={() => onNewDrawingIn(folder.id)}>
                New drawing here
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem icon={FolderPlus} onSelect={() => onFolderAction(folder, 'subfolder')}>
            New folder inside
          </ContextMenuItem>
          <ContextMenuItem icon={Pencil} onSelect={() => onFolderAction(folder, 'rename')}>
            Rename
          </ContextMenuItem>
          {rights.share && (
            <ContextMenuItem icon={Users} onSelect={() => onFolderAction(folder, 'share')}>
              Who sees it
            </ContextMenuItem>
          )}
          {rights.remove && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Trash2} danger onSelect={() => onFolderAction(folder, 'delete')}>
                Delete folder
              </ContextMenuItem>
            </>
          )}
        </>
      );
    }
    return null;
  };

  // ── Drag a note onto a folder (or onto My notes, if it's yours) to move it ──
  const canDrag = (node: TreeNode) => {
    const item = itemById.get(node.id);
    return item?.kind === 'note' && item.canEdit === true && item.container !== 'trash';
  };
  const canDrop = (dragged: TreeNode, target: TreeNode) => {
    const note = itemById.get(dragged.id);
    const place = itemById.get(target.id);
    if (!note || !place || note.kind !== 'note' || place.id === note.container) return false;
    if (place.kind === 'mine') return note.ownerUserId === me;
    return place.kind === 'folder' && (folderById.get(place.ref)?.canEdit ?? false);
  };
  const drop = (dragged: TreeNode, target: TreeNode) => {
    const note = itemById.get(dragged.id);
    const place = itemById.get(target.id);
    if (!note || !place) return;
    actions.move.mutate({ id: note.ref, folderId: place.kind === 'mine' ? null : place.ref, name: place.label });
  };

  const filtering = q !== '' || tag !== null;
  const found = useNoteSearch(q, tag);
  const [active, setActive] = useState(0);
  // A new search starts at its best match.
  const [searched, setSearched] = useState(q);
  if (searched !== q) {
    setSearched(q);
    setActive(0);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-divider p-3">
        <Input
          ref={searchRef}
          aria-label="Search notes, or jump to one"
          placeholder="Search or jump to…"
          value={search}
          role="combobox"
          aria-expanded={q !== ''}
          aria-controls="notes-search-results"
          aria-activedescendant={q && found.hits[active] ? `notes-search-${found.hits[active].note.id}` : undefined}
          leftIcon={<Search size={14} aria-hidden="true" />}
          rightIcon={
            search ? undefined : (
              <kbd className="hidden rounded-sm border border-rule/60 bg-band px-1 text-micro font-semibold text-muted-foreground lg:inline">
                ⌘O
              </kbd>
            )
          }
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && search) {
              event.preventDefault();
              onSearch('');
            } else if (!q) {
              return;
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, found.hits.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && found.hits[active]) {
              event.preventDefault();
              onOpenNote(found.hits[active].note.id);
            }
          }}
          className="min-w-0 flex-1"
        />
        {canWrite && (
          <Tooltip side="bottom" label="New folder">
            <button
              type="button"
              aria-label="New folder"
              onClick={onNewFolder}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <FolderPlus size={16} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {q ? (
          <SearchResults
            q={q}
            tag={tag}
            found={found}
            active={active}
            openId={noteId}
            onActive={setActive}
            onOpen={onOpenNote}
            onClearTag={() => onShowTag(null)}
          />
        ) : filtering ? (
          <Matches tag={tag!} activeId={noteId} onOpen={onOpenNote} onClearTag={() => onShowTag(null)} />
        ) : (
          <div className="p-2">
            <TreeView
              nodes={nodes}
              variant="plain"
              aria-label="Notes and folders"
              expandedIds={expanded}
              onExpandedChange={changeExpanded}
              selectedId={selectedId}
              onSelect={select}
              contextMenu={contextMenu}
              canDrag={canDrag}
              canDrop={canDrop}
              onDrop={drop}
              renderActions={(node) => {
                const item = itemById.get(node.id);
                const folder = item?.kind === 'folder' ? folderById.get(item.ref) : undefined;
                return folder?.canEdit ? (
                  <FolderMenu folder={folder} canManage={folders.canManage} onAction={(action) => onFolderAction(folder, action)} />
                ) : null;
              }}
            />
            {folders.counts.all === 0 && folders.folders.length === 0 && (
              <EmptyState
                className="py-8"
                icon={StickyNote}
                kind="start"
                compact
                title="No notes yet"
                description={canWrite ? 'Start one — the first line becomes its title.' : undefined}
                action={canWrite ? { label: 'New note', onClick: onNewNote, icon: Plus } : undefined}
              />
            )}
          </div>
        )}
      </div>

      {!filtering && <Tags active={tag} onShow={onShowTag} />}

      {/* Only when something's in it: an empty Recently deleted is just noise at the foot. */}
      {folders.counts.trash > 0 && (
        <div className="max-h-[40vh] shrink-0 overflow-auto border-t border-divider p-2">
          <TreeView
            nodes={trashNodes}
            variant="plain"
            aria-label="Recently deleted"
            expandedIds={expanded}
            onExpandedChange={changeExpanded}
            selectedId={selectedId}
            onSelect={select}
            contextMenu={contextMenu}
          />
        </div>
      )}

      {purging && (
        <ConfirmModal
          title={`Delete “${purging.label}” for good?`}
          message="It and its history are gone for everyone, and can’t be brought back. A copy already synced to Google Docs stays in that Drive."
          confirmLabel="Delete permanently"
          pendingLabel="Deleting…"
          isPending={actions.purge.isPending}
          onConfirm={() =>
            actions.purge.mutate(purging.ref, {
              onSuccess: () => {
                onNoteGone(purging.ref);
                setPurging(null);
              },
            })
          }
          onClose={() => setPurging(null)}
        />
      )}
    </div>
  );
}

function itemIcon(item: NotesTreeItem, open: boolean) {
  switch (item.kind) {
    // Every container reads as a folder: your own notes locked, shared ones with people on it.
    case 'mine':
      return <FolderLocked size={16} strokeWidth={1.7} />;
    case 'trash':
      return <Trash2 size={16} strokeWidth={1.7} />;
    case 'folder':
      if (item.shared) return <FolderShared size={16} strokeWidth={1.7} aria-label="Shared folder" />;
      return open ? <FolderOpen size={16} strokeWidth={1.7} /> : <FolderIcon size={16} strokeWidth={1.7} />;
    case 'note':
      if (item.pinned) return <Pin size={15} strokeWidth={1.7} className="text-primary" aria-label="Pinned" />;
      return item.drawing ? <PenLine size={16} strokeWidth={1.7} aria-label="Drawing" /> : <StickyNote size={16} strokeWidth={1.7} />;
    case 'loading':
      return <Loader2 size={14} className="animate-spin" />;
    case 'error':
      return <AlertCircle size={15} className="text-exception" />;
    case 'more':
      return <Search size={14} />;
  }
}

function FolderMenu({ folder, canManage, onAction }: { folder: NoteFolder; canManage: boolean; onAction: (action: FolderAction) => void }) {
  const [open, setOpen] = useState(false);
  const { share: canShare, remove: canDelete } = folderRights(folder, canManage);
  const items = [
    { action: 'subfolder' as const, label: 'New folder inside', show: true },
    { action: 'rename' as const, label: 'Rename', show: true },
    { action: 'share' as const, label: 'Who sees it', show: canShare },
    { action: 'delete' as const, label: 'Delete', show: canDelete },
  ].filter((item) => item.show);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${folder.name} options`}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1" role="menu" aria-label={`${folder.name} options`}>
        {items.map((item) => (
          <button
            key={item.action}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAction(item.action);
            }}
            className={cn(
              'flex w-full rounded-md px-2 py-1.5 text-left text-sm',
              item.action === 'delete' ? 'text-exception hover:bg-exception/6' : 'text-foreground hover:bg-band/60',
            )}
          >
            {item.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Tags({ active, onShow }: { active: string | null; onShow: (tag: string | null) => void }) {
  const tags = useQuery({ queryKey: moduleQueryKeys.notes.key('tags'), queryFn: getNoteTags });
  if (!tags.data?.length) return null;
  return (
    <div className="max-h-32 shrink-0 overflow-auto border-t border-divider px-3 py-2.5">
      <p className="mb-1.5 text-label uppercase text-muted-foreground">Tags</p>
      <div className="flex flex-wrap gap-1">
        {tags.data.slice(0, 30).map((entry) => (
          <button
            key={entry.tag}
            type="button"
            onClick={() => onShow(active === entry.tag ? null : entry.tag)}
            className={cn(
              'rounded-md border px-1.5 py-0.5 text-xs transition-colors',
              active === entry.tag
                ? 'border-primary bg-primary/8 text-primary'
                : 'border-rule/55 bg-control text-muted-foreground hover:text-foreground',
            )}
          >
            #{entry.tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagHeader({ tag, onClear }: { tag: string; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3">
      <span className="text-sm font-semibold text-foreground">#{tag}</span>
      <button type="button" onClick={onClear} className="text-xs font-medium text-primary hover:underline">
        Show all notes
      </button>
    </div>
  );
}

function Marked({ parts }: { parts: { text: string; match: boolean }[] }) {
  return parts.map((part, index) =>
    part.match ? (
      <mark key={index} className="rounded-sm bg-measured/25 px-0.5 text-foreground">
        {part.text}
      </mark>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}

const untitled = (note: NoteSummary) => (note.kind === 'drawing' ? 'Untitled drawing' : 'New note');

/** A search (within a tag, if one is picked): titles first, then notes whose text matches. */
function SearchResults({
  q,
  tag,
  found,
  active,
  openId,
  onActive,
  onOpen,
  onClearTag,
}: {
  q: string;
  tag: string | null;
  found: ReturnType<typeof useNoteSearch>;
  active: number;
  openId: string | null;
  onActive: (index: number) => void;
  onOpen: (id: string) => void;
  onClearTag: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="pb-4">
      {tag && <TagHeader tag={tag} onClear={onClearTag} />}
      {found.error ? (
        <ErrorState title="Notes couldn’t be searched" onRetry={found.retry} />
      ) : found.hits.length === 0 && found.pending ? (
        <div className="p-3">
          <TilesSkeleton count={6} label="Searching" />
        </div>
      ) : found.hits.length === 0 && !found.textError ? (
        <EmptyState
          className="py-12"
          icon={StickyNote}
          kind="search"
          compact
          title={`Nothing matches “${q}”`}
          description={tag ? `Only notes tagged #${tag} were searched.` : 'Try fewer letters, or another word.'}
        />
      ) : (
        <ul id="notes-search-results" role="listbox" aria-label="Matching notes" ref={listRef} className="px-2 pt-1">
          {found.hits.map(({ note, inText }, index) => {
            const firstInText = inText && (index === 0 || !found.hits[index - 1]!.inText);
            return (
              <li key={note.id} role="none">
                {(index === 0 || firstInText) && (
                  <p className="px-2 pb-1 pt-2.5 text-label uppercase text-muted-foreground">{inText ? 'In the text' : 'Titles'}</p>
                )}
                <button
                  type="button"
                  id={`notes-search-${note.id}`}
                  role="option"
                  aria-selected={index === active}
                  aria-current={openId === note.id ? 'true' : undefined}
                  data-index={index}
                  tabIndex={-1}
                  onMouseMove={() => onActive(index)}
                  onClick={() => onOpen(note.id)}
                  className={cn(
                    'w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
                    index === active ? 'bg-primary/10' : 'hover:bg-band/50',
                    openId === note.id && 'ring-1 ring-primary/30',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {note.pinned ? (
                      <Pin size={12} className="shrink-0 text-primary" aria-label="Pinned" />
                    ) : note.kind === 'drawing' ? (
                      <PenLine size={12} className="shrink-0 text-muted-foreground" aria-label="Drawing" />
                    ) : null}
                    <span className="truncate text-sm font-semibold text-foreground">
                      {note.title ? inText ? note.title : <Marked parts={titleParts(note.title, q)} /> : untitled(note)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 tabular-nums">{formatInstant(note.updatedAt, { day: 'numeric', month: 'short' })}</span>
                    <span className="min-w-0 truncate">
                      {inText ? <Marked parts={snippetParts(note.snippet)} /> : noteBodyAfterTitle(note.snippet) || 'No more text'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {found.pending && (
            <li role="none" className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Searching the text…
            </li>
          )}
          {found.textError && (
            <li role="none" className="px-2.5 py-2 text-xs text-muted-foreground">
              The notes’ text couldn’t be searched.{' '}
              <button type="button" className="font-medium text-primary hover:underline" onClick={found.retry}>
                Try again
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** A tag: the notes carrying it, by the day each was edited. */
function Matches({
  tag,
  activeId,
  onOpen,
  onClearTag,
}: {
  tag: string;
  activeId: string | null;
  onOpen: (id: string) => void;
  onClearTag: () => void;
}) {
  const list = useQuery({
    queryKey: moduleQueryKeys.notes.key('list', 'matches', tag, ''),
    queryFn: () => getNotes({ tag }),
    placeholderData: (previous) => previous,
  });
  return (
    <div className="pb-4">
      <TagHeader tag={tag} onClear={onClearTag} />
      {list.isPending ? (
        <div className="p-3">
          <TilesSkeleton count={6} label="Loading" />
        </div>
      ) : list.isError ? (
        <ErrorState title="Notes couldn’t be loaded" onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState className="py-12" icon={StickyNote} kind="search" compact title={`Nothing tagged #${tag}`} />
      ) : (
        <NoteList notes={list.data} activeId={activeId} onOpen={onOpen} />
      )}
    </div>
  );
}

function NoteList({ notes, activeId, onOpen }: { notes: NoteSummary[]; activeId: string | null; onOpen: (id: string) => void }) {
  return (
    <>
      {groupNotesByDate(notes).map((group) => (
        <section key={group.group} aria-label={group.group}>
          <h3 className="sticky top-0 z-1 bg-card/95 px-4 pb-1 pt-3 text-label uppercase text-muted-foreground backdrop-blur">
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
                    {note.pinned ? (
                      <Pin size={12} className="shrink-0 text-primary" aria-label="Pinned" />
                    ) : note.kind === 'drawing' ? (
                      <PenLine size={12} className="shrink-0 text-muted-foreground" aria-label="Drawing" />
                    ) : null}
                    <span className="truncate text-sm font-semibold text-foreground">{note.title || untitled(note)}</span>
                  </span>
                  <span className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 tabular-nums">{formatInstant(note.updatedAt, { day: 'numeric', month: 'short' })}</span>
                    <span className="min-w-0 truncate">{noteBodyAfterTitle(note.snippet) || note.snippet || 'No more text'}</span>
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
    </>
  );
}
