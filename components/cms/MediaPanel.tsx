'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderIcon,
  FolderOpen,
  FolderPlus,
  ImageIcon,
  Info,
  Link2,
  Loader2,
  Monitor,
  Pencil,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Type,
  UploadCloud,
  Video,
  X,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { DetailRow, DrawerSection } from '@/components/shared/DrawerSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { ActionButton, CopyButton, useDoneBeat } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import {
  type CmsAsset,
  type CmsMediaGroup,
  type CmsStorage,
  bulkCmsAssets,
  deleteCmsAsset,
  deleteCmsRenditions,
  getCmsAsset,
  getCmsAssetFile,
  getCmsAssets,
  getCmsStorage,
  moveCmsFolder,
  replaceCmsAssetFile,
  updateCmsAsset,
  uploadCmsAsset,
} from '@/lib/modules/cms/client';
import { formatBytes, isImage, isVideo } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import {
  MEDIA_DRAG_TYPE,
  type MediaDragPayload,
  allFolders,
  canMoveFolderInto,
  childFolders,
  clickSelection,
  decodeDrag,
  encodeDrag,
  folderName,
  folderNameProblem,
  folderSummary,
  isInsideFolder,
  joinFolder,
  movedFolderPath,
  parentFolder,
  pendingFolders,
} from '@/lib/utils/media-folders';
import { isConvertibleImage, isConvertibleVideo, renditionWidths } from '@/lib/utils/media-storage';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { assist } from './AssistSection';
import { FocalMarker, ImageOptionsDialog } from './ImageOptionsDialog';
import { MediaBulkBar } from './MediaBulkBar';
import {
  type DetailsSubject,
  FolderTile,
  FolderTrail,
  MediaDetailsPane,
  MoveToSub,
  NameDialog,
  setDragLabel,
  useLocalFolders,
} from './MediaFolders';
import { StorageUsage, type UploadTarget } from './StorageUsage';
import { VideoOptionsDialog } from './VideoOptionsDialog';
import { VideoThumb } from './VideoThumb';
import { createRenditions } from './renditions';
import { RowTile } from './rows';
import { PanelError, assetPreviewSrc, cmsKeys, copyText, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

type View = 'all' | 'unused' | 'duplicates';
const VIEW_OPTIONS = [
  { value: 'all' as const, label: 'All files' },
  { value: 'unused' as const, label: 'Unused' },
  { value: 'duplicates' as const, label: 'Duplicates' },
];

const KIND_OPTIONS = [
  { value: '', label: 'Any type' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documents' },
];

/** Where new uploads go, how full it is, and what is free there (null: no limit). */
function uploadTarget(storage: CmsStorage | undefined) {
  if (!storage) return null;
  const connection =
    storage.active.kind === 'connection' ? storage.connections.find((row) => row.id === storage.active.connectionId) : undefined;
  const place = connection
    ? {
        name: connection.displayName,
        byKind: connection.byKind,
        usedBytes: connection.usedBytes,
        quotaBytes: connection.quotaBytes,
        connectionId: connection.id,
      }
    : {
        name: 'DUMA storage',
        byKind: storage.builtIn.byKind,
        usedBytes: storage.builtIn.usedBytes,
        quotaBytes: storage.builtIn.quotaBytes,
        connectionId: null,
      };
  return {
    ...place,
    builtIn: !connection,
    freeBytes: place.quotaBytes === null ? null : Math.max(0, place.quotaBytes - place.usedBytes),
  } satisfies UploadTarget & { connectionId: string | null };
}

/** The preview stage: a soft checkerboard, so transparent images read as transparent. */
const STAGE_CLASS =
  'relative flex justify-center overflow-hidden rounded-lg border border-rule/50 bg-band/40 bg-[conic-gradient(var(--color-band)_25%,transparent_0_50%,var(--color-band)_0_75%,transparent_0)] bg-size-[16px_16px]';

/** Does this asset count against the allowance uploads go to? Then replacing it frees its space there. */
const sharesAllowance = (asset: CmsAsset, connectionId: string | null) =>
  connectionId ? asset.storageConnectionId === connectionId : asset.storageBackend !== 'connection';

/** Where a file or folder is, for people: `Menu › Summer`, or `Media` at the top. */
const placeName = (path: string | null) => (path ? path.split('/').join(' › ') : 'Media');

type Naming = null | { kind: 'new-folder' } | { kind: 'rename-folder'; path: string } | { kind: 'rename-file'; asset: CmsAsset };
type MenuTarget = { kind: 'here' } | { kind: 'folder'; path: string } | { kind: 'asset'; asset: CmsAsset };
type FolderChange = { from: string; to: string | null; verb: 'rename' | 'move' | 'remove' };

/** Save a file through the same-origin preview URL, so `download` keeps its name. */
function downloadAsset(asset: CmsAsset) {
  const link = document.createElement('a');
  link.href = assetPreviewSrc(asset);
  link.download = asset.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * The library, browsed like a drive: folders above files, a trail to climb
 * back up, click to open (⌘/Ctrl/Shift-click or the checkbox to select), drag onto a folder (or a
 * step of the trail) to move, right-click for everything else — including a
 * details window that opens where you clicked. Searching or filtering looks across every folder at once.
 *
 * `headerSlot` is an element in the page masthead: New folder, Upload and the
 * storage status are the tab's actions, so they sit where every other tab's primary
 * action sits, while the upload logic stays here with the file input.
 */
export function MediaPanel({
  headerSlot,
  folder,
  onOpenFolder,
}: {
  headerSlot?: HTMLElement | null;
  /** The open folder (null: the top level). It lives in the URL, so Back goes back up. */
  folder: string | null;
  onOpenFolder: (path: string | null) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<CmsMediaGroup | ''>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  // Files from the desktop are over the panel.
  const [fileDrag, setFileDrag] = useState(false);
  // Where a drop would land: a folder path, null for the top level, undefined for nowhere.
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined);
  // What is being dragged out of the grid — dragover cannot read the data, so it is kept here.
  const gridDrag = useRef<MediaDragPayload | null>(null);
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  // Uploads go to the folder they were dropped on, or the one that is open.
  const [uploadFolder, setUploadFolder] = useState<string | null>(folder);
  // Files waiting on the optimise dialog — any upload with a convertible image goes through it.
  const [staged, setStaged] = useState<File[] | null>(null);
  // Then the compress dialog, for any upload with a video — after the images are settled.
  const [stagedVideos, setStagedVideos] = useState<File[] | null>(null);
  const [view, setView] = useState<View>('all');
  // Selection survives paging and filtering, so it holds the assets, not just ids.
  const [selected, setSelected] = useState<Map<string, CmsAsset>>(new Map());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  // Where the details window opens: the last right-click.
  const [detailsAt, setDetailsAt] = useState<{ x: number; y: number } | null>(null);
  const menuPoint = useRef({ x: 0, y: 0 });
  const [bulkRequest, setBulkRequest] = useState<{ dialog: 'tag' | 'delete' } | null>(null);
  const [naming, setNaming] = useState<Naming>(null);
  const [removingFolder, setRemovingFolder] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget>({ kind: 'here' });
  const [localFolders, updateLocalFolders] = useLocalFolders(tenantId);
  const selecting = selected.size > 0;

  const clearSelection = () => {
    setSelected(new Map());
    setSelectedFolder(null);
    setAnchor(null);
  };
  // A new folder is a new view: nothing selected, first page.
  const [shownFolder, setShownFolder] = useState(folder);
  if (shownFolder !== folder) {
    setShownFolder(folder);
    clearSelection();
    setPage(1);
  }

  const toggle = (asset: CmsAsset) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(asset.id)) next.delete(asset.id);
      else next.set(asset.id, asset);
      return next;
    });
  const selectMany = (list: CmsAsset[]) =>
    setSelected((current) => new Map([...current, ...list.map((asset) => [asset.id, asset] as const)]));

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Browsing a folder, or looking across all of them for a search or a filter.
  const browsing = view === 'all' && !q && !kind;
  const filters = browsing
    ? { page, ...(folder ? { folder } : { root: 'true' as const }) }
    : {
        q: q || undefined,
        kind,
        page,
        ...(view === 'unused' ? { usage: 'unused' as const } : {}),
        ...(view === 'duplicates' ? { duplicates: 'true' as const } : {}),
      };
  const query = useQuery({
    queryKey: cmsKeys.assets(tenantId, filters),
    queryFn: () => getCmsAssets(filters, tenantId ?? undefined),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  });

  const storage = useQuery({
    queryKey: cmsKeys.storage(tenantId),
    queryFn: () => getCmsStorage(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const target = uploadTarget(storage.data);

  const serverFolders = query.data?.folders;
  const stats = query.data?.folderStats ?? [];
  // An empty folder made here is forgotten once the server lists it — it has a file now.
  useEffect(() => {
    if (serverFolders) updateLocalFolders((current) => pendingFolders(current, serverFolders));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateLocalFolders is stable in effect; only a new list matters
  }, [serverFolders]);
  const pending = pendingFolders(localFolders, serverFolders ?? []);
  const pendingSet = new Set(pending);
  const folders = allFolders([...(serverFolders ?? []), ...pending]);
  const here = childFolders(folders, folder);
  const subfolders = browsing && page === 1 ? here : [];
  const folderCount = (path: string) => {
    const files = folderSummary(stats, folders, path).files;
    return files === 0 && pendingSet.has(path) ? null : files;
  };

  const upload = useMutation({
    mutationFn: async ({ files, to }: { files: File[]; to: string | null }) => {
      // One at a time: each file is up to 25 MB, and a failure names its file.
      const failures: string[] = [];
      for (const file of files) {
        try {
          const asset = await uploadCmsAsset(file, { folder: to ?? undefined }, tenantId ?? undefined);
          // Responsive copies follow the upload; if they fail the file is still stored, and the drawer can make them later.
          await createRenditions(asset, tenantId ?? undefined, file).catch(() => 0);
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : 'failed'}`);
        }
      }
      return { uploaded: files.length - failures.length, failures, to };
    },
    onSuccess: ({ uploaded, failures, to }) => {
      invalidateCms(queryClient);
      if (uploaded > 0) toast('success', `Uploaded ${uploaded} ${uploaded === 1 ? 'file' : 'files'}${to ? ` to ${placeName(to)}` : ''}.`);
      if (failures.length > 0) toast('error', failures.join(' · '));
      setStaged(null);
      setStagedVideos(null);
    },
  });

  const moveAssets = useMutation({
    mutationFn: async ({ ids, to }: { ids: string[]; to: string | null }) => {
      let moved = 0;
      // The bulk endpoint takes 100 at a time.
      for (let start = 0; start < ids.length; start += 100) {
        const result = await bulkCmsAssets({ action: 'move', ids: ids.slice(start, start + 100), folder: to }, tenantId ?? undefined);
        moved += result.succeeded.length;
      }
      return { moved, failed: ids.length - moved, to };
    },
    onSuccess: ({ moved, failed, to }) => {
      invalidateCms(queryClient);
      clearSelection();
      if (moved > 0) toast('success', `Moved ${moved} ${moved === 1 ? 'file' : 'files'} to ${placeName(to)}.`);
      if (failed > 0) toast('error', `${failed} couldn’t be moved.`);
    },
    onError: (error) => {
      invalidateCms(queryClient);
      toast('error', error.message);
    },
  });

  const moveFolder = useMutation({
    mutationFn: async (change: FolderChange) => {
      // A folder only this device knows has nothing on the server to move.
      const onServer = (serverFolders ?? []).some((path) => isInsideFolder(path, change.from));
      if (onServer) await moveCmsFolder(change.from, change.to, tenantId ?? undefined);
      return change;
    },
    onSuccess: ({ from, to, verb }) => {
      updateLocalFolders((current) => current.flatMap((path) => movedFolderPath(path, from, to) ?? []));
      invalidateCms(queryClient);
      setSelectedFolder(null);
      setNaming(null);
      setRemovingFolder(null);
      if (folder && isInsideFolder(folder, from)) onOpenFolder(movedFolderPath(folder, from, to));
      toast(
        'success',
        verb === 'rename'
          ? `Renamed to ${folderName(to ?? '')}.`
          : verb === 'move'
            ? `Moved ${folderName(from)} to ${placeName(parentFolder(to ?? ''))}.`
            : `Removed ${folderName(from)} — its files are in ${placeName(to)}.`,
      );
    },
    onError: (error) => toast('error', error.message),
  });

  const renameFile = useMutation({
    mutationFn: ({ asset, title }: { asset: CmsAsset; title: string }) =>
      updateCmsAsset(asset.id, { title: title === asset.fileName ? null : title }, tenantId ?? undefined),
    onSuccess: () => {
      invalidateCms(queryClient);
      setNaming(null);
    },
    onError: (error) => toast('error', error.message),
  });

  /** Move a folder, with everything in it, into `into` — refused where a folder of that name already is. */
  const moveFolderInto = (from: string, into: string | null) => {
    const to = joinFolder(into, folderName(from));
    if (folders.includes(to)) {
      toast('error', `${placeName(into)} already has a folder called ${folderName(from)}.`);
      return;
    }
    moveFolder.mutate({ from, to, verb: 'move' });
  };

  const afterImages = (files: File[]) => {
    setStaged(null);
    if (files.some((file) => isConvertibleVideo(file.type))) setStagedVideos(files);
    else upload.mutate({ files, to: uploadFolder });
  };
  const onFiles = (list: FileList | null, to: string | null) => {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    setUploadFolder(to);
    if (files.some((file) => isConvertibleImage(file.type))) setStaged(files);
    else if (files.some((file) => isConvertibleVideo(file.type))) setStagedVideos(files);
    else upload.mutate({ files, to });
  };
  const pickFiles = (to: string | null) => {
    setUploadFolder(to);
    fileInput.current?.click();
  };

  const assets = query.data?.data ?? [];
  const filtered = Boolean(q || kind);
  // In Duplicates, the first of each checksum (oldest) is the one to keep.
  const copyIndex = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const asset of assets) {
    const n = seen.get(asset.checksumSha256) ?? 0;
    copyIndex.set(asset.id, n);
    seen.set(asset.checksumSha256, n + 1);
  }
  const pageBytes = assets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
  const pages = query.data?.pages ?? 1;
  const clearFilters = () => {
    setSearch('');
    setQ('');
    setKind('');
    setPage(1);
  };
  // The freshest copy of a selected asset: this page's, else the one kept when it was selected.
  const fresh = (id: string) => assets.find((asset) => asset.id === id) ?? selected.get(id)!;

  // ── One click opens; a modifier selects, as a file manager does it ──
  const clickAsset = (event: React.MouseEvent, asset: CmsAsset) => {
    // A plain click (or tap) opens, unless something is already selected — then it adds or removes.
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
      if (selecting) toggle(asset);
      else setOpenId(asset.id);
      return;
    }
    const ids = clickSelection(
      assets.map((row) => row.id),
      new Set(selected.keys()),
      anchor,
      asset.id,
      { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey },
    );
    setSelected(new Map([...ids].map((id) => [id, fresh(id)] as const)));
    if (!event.shiftKey) setAnchor(asset.id);
    setSelectedFolder(null);
  };
  const clickFolder = (event: React.MouseEvent, path: string) => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
      onOpenFolder(path);
      return;
    }
    setSelected(new Map());
    setSelectedFolder(path);
  };

  // ── Drag and drop ──
  const startDrag = (event: React.DragEvent, payload: MediaDragPayload, label: string) => {
    gridDrag.current = payload;
    setDraggingIds(payload.assetIds);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(MEDIA_DRAG_TYPE, encodeDrag(payload));
    setDragLabel(event, label);
  };
  const endDrag = () => {
    gridDrag.current = null;
    setDraggingIds([]);
    setDropTarget(undefined);
  };
  const canDropOn = (into: string | null) => {
    const drag = gridDrag.current;
    if (!drag) return true; // files from the desktop upload into any folder
    if (drag.folder !== null) return canMoveFolderInto(drag.folder, into);
    // Files shown while browsing are all in the open folder already.
    return !(browsing && into === folder);
  };
  const dropProps = (into: string | null): React.HTMLAttributes<HTMLElement> =>
    access.canWrite
      ? {
          onDragOver: (event) => {
            const fromGrid = !!gridDrag.current;
            if (!fromGrid && !event.dataTransfer.types.includes('Files')) return;
            if (!canDropOn(into)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = fromGrid ? 'move' : 'copy';
            setDropTarget(into);
            if (!fromGrid) setFileDrag(true);
          },
          onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(undefined);
          },
          onDrop: (event) => {
            event.preventDefault();
            event.stopPropagation();
            const drag = gridDrag.current ?? decodeDrag(event.dataTransfer.getData(MEDIA_DRAG_TYPE));
            endDrag();
            setFileDrag(false);
            if (!drag) onFiles(event.dataTransfer.files, into);
            else if (drag.folder !== null) moveFolderInto(drag.folder, into);
            else if (drag.assetIds.length > 0) moveAssets.mutate({ ids: drag.assetIds, to: into });
          },
        }
      : {};

  // ── Right-click ──
  const onMenu = (event: React.MouseEvent) => {
    menuPoint.current = { x: event.clientX, y: event.clientY };
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-media-item]');
    if (item?.dataset.mediaItem === 'folder' && item.dataset.path) {
      setMenuTarget({ kind: 'folder', path: item.dataset.path });
      setSelected(new Map());
      setSelectedFolder(item.dataset.path);
      return;
    }
    const asset = item?.dataset.mediaItem === 'asset' ? assets.find((row) => row.id === item.dataset.id) : undefined;
    if (asset) {
      // Right-clicking outside the selection selects just that file, as a file manager does.
      if (!selected.has(asset.id)) {
        setSelected(new Map([[asset.id, asset]]));
        setAnchor(asset.id);
      }
      setSelectedFolder(null);
      setMenuTarget({ kind: 'asset', asset });
      return;
    }
    setMenuTarget({ kind: 'here' });
  };
  const many = menuTarget.kind === 'asset' && selected.has(menuTarget.asset.id) && selected.size > 1;
  const showDetails = () => setDetailsAt(menuPoint.current);

  const menu = () => {
    if (menuTarget.kind === 'folder') {
      const path = menuTarget.path;
      return (
        <>
          <ContextMenuItem icon={FolderOpen} shortcut="↵" onSelect={() => onOpenFolder(path)}>
            Open
          </ContextMenuItem>
          {access.canWrite && (
            <>
              <ContextMenuItem icon={UploadCloud} onSelect={() => pickFiles(path)}>
                Upload files here
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Pencil} onSelect={() => setNaming({ kind: 'rename-folder', path })}>
                Rename
              </ContextMenuItem>
              <MoveToSub
                folders={folders}
                disabled={(into) => !canMoveFolderInto(path, into)}
                onMove={(into) => moveFolderInto(path, into)}
              />
            </>
          )}
          <ContextMenuItem icon={Info} onSelect={showDetails}>
            Folder details
          </ContextMenuItem>
          {access.canWrite && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Trash2} danger onSelect={() => setRemovingFolder(path)}>
                Remove folder
              </ContextMenuItem>
            </>
          )}
        </>
      );
    }
    if (menuTarget.kind === 'asset' && many) {
      const list = [...selected.keys()];
      return (
        <>
          <ContextMenuLabel>{list.length} files</ContextMenuLabel>
          {access.canWrite && (
            <>
              <MoveToSub
                label={`Move ${list.length} files to`}
                folders={folders}
                disabled={(into) => browsing && into === folder}
                onMove={(into) => moveAssets.mutate({ ids: list, to: into })}
              />
              <ContextMenuItem icon={Tag} onSelect={() => setBulkRequest({ dialog: 'tag' })}>
                Tag…
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem icon={Info} onSelect={showDetails}>
            Details
          </ContextMenuItem>
          {access.canWrite && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Trash2} danger onSelect={() => setBulkRequest({ dialog: 'delete' })}>
                Delete {list.length} files
              </ContextMenuItem>
            </>
          )}
        </>
      );
    }
    if (menuTarget.kind === 'asset') {
      const asset = menuTarget.asset;
      return (
        <>
          <ContextMenuItem icon={Eye} shortcut="↵" onSelect={() => setOpenId(asset.id)}>
            Open
          </ContextMenuItem>
          <ContextMenuItem icon={ExternalLink} onSelect={() => window.open(asset.url, '_blank', 'noopener')}>
            Open in new tab
          </ContextMenuItem>
          <ContextMenuItem icon={Download} onSelect={() => downloadAsset(asset)}>
            Download
          </ContextMenuItem>
          <ContextMenuItem
            icon={Link2}
            onSelect={() =>
              void copyText(asset.url).then((copied) =>
                toast(copied ? 'success' : 'error', copied ? 'Link copied.' : 'Copy failed — open the file to copy its URL.'),
              )
            }
          >
            Copy link
          </ContextMenuItem>
          <ContextMenuSeparator />
          {access.canWrite && (
            <>
              <ContextMenuItem icon={Pencil} onSelect={() => setNaming({ kind: 'rename-file', asset })}>
                Rename
              </ContextMenuItem>
              <MoveToSub
                folders={folders}
                disabled={(into) => into === asset.folder}
                onMove={(into) => moveAssets.mutate({ ids: [asset.id], to: into })}
              />
              <ContextMenuItem icon={Tag} onSelect={() => setBulkRequest({ dialog: 'tag' })}>
                Tag…
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem icon={Info} onSelect={showDetails}>
            File details
          </ContextMenuItem>
          {access.canWrite && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Trash2} danger onSelect={() => setBulkRequest({ dialog: 'delete' })}>
                Delete
              </ContextMenuItem>
            </>
          )}
        </>
      );
    }
    return (
      <>
        {access.canWrite && (
          <>
            {browsing && (
              <ContextMenuItem icon={FolderPlus} onSelect={() => setNaming({ kind: 'new-folder' })}>
                New folder
              </ContextMenuItem>
            )}
            <ContextMenuItem icon={UploadCloud} onSelect={() => pickFiles(folder)}>
              Upload files{folder ? ` to ${folderName(folder)}` : ''}
            </ContextMenuItem>
            {assets.length > 0 && (
              <ContextMenuItem icon={Check} onSelect={() => selectMany(assets)}>
                Select all on this page
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          icon={Info}
          onSelect={() => {
            clearSelection();
            showDetails();
          }}
        >
          {browsing && folder ? 'Folder details' : 'Details'}
        </ContextMenuItem>
      </>
    );
  };

  const details: DetailsSubject = selectedFolder
    ? { kind: 'folder', path: selectedFolder, pending: pendingSet.has(selectedFolder) }
    : selected.size === 1
      ? { kind: 'asset', asset: fresh([...selected.keys()][0]!) }
      : selected.size > 1
        ? { kind: 'assets', assets: [...selected.keys()].map(fresh) }
        : {
            kind: 'here',
            path: browsing ? folder : null,
            filesHere: browsing ? (query.data?.total ?? null) : null,
            subfolders: here.length,
          };

  const fileGrid = (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {assets.map((asset) => {
        const isSelected = selected.has(asset.id);
        const copy = copyIndex.get(asset.id) ?? 0;
        const missingAlt = !asset.altText && isImage(asset.mimeType);
        return (
          <li key={asset.id} className="group relative">
            <button
              type="button"
              data-media-item="asset"
              data-id={asset.id}
              aria-pressed={isSelected}
              draggable={access.canWrite}
              onDragStart={(event) => {
                const ids = isSelected ? [...selected.keys()] : [asset.id];
                if (!isSelected) {
                  setSelected(new Map([[asset.id, asset]]));
                  setSelectedFolder(null);
                }
                startDrag(
                  event,
                  { assetIds: ids, folder: null },
                  ids.length === 1 ? (asset.title ?? asset.fileName) : `${ids.length} files`,
                );
              }}
              onDragEnd={endDrag}
              onClick={(event) => clickAsset(event, asset)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                setOpenId(asset.id);
              }}
              className={cn(
                'block w-full overflow-hidden rounded-lg border bg-background text-left transition-[border-color,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-rule/55 hover:border-rule',
                draggingIds.includes(asset.id) && 'opacity-50',
              )}
            >
              <AssetThumb asset={asset} />
              <span className="flex items-center gap-1.5 px-2.5 pt-2">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{asset.title ?? asset.fileName}</span>
              </span>
              <span className="block truncate px-2.5 pb-2 text-xs tabular-nums text-muted-foreground">
                {formatBytes(asset.sizeBytes)}
                {/* Results from every folder say where each one lives. */}
                {!browsing ? ` · ${placeName(asset.folder)}` : asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
              </span>
            </button>
            {view === 'duplicates' && (
              <span
                className={cn(
                  'pointer-events-none absolute right-2 top-2 rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium',
                  copy === 0 ? 'bg-momentum text-white' : 'bg-black/60 text-white',
                )}
              >
                {copy === 0 ? 'Original' : `Copy ${copy}`}
              </span>
            )}
            {/* Missing alt text: a quiet flag on the picture, explained on hover. */}
            {missingAlt && view !== 'duplicates' && (
              <Tooltip side="top" align="end" label="No alt text — open to add it">
                <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md border border-measured/40 bg-background/95 text-measured shadow-sm">
                  <AlertTriangle size={13} aria-label="No alt text" />
                </span>
              </Tooltip>
            )}
            {access.canWrite && (
              <label
                className={cn(
                  'absolute left-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-md bg-background/95 shadow-sm transition-opacity',
                  selecting || isSelected ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100',
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={isSelected}
                  onChange={() => toggle(asset)}
                  aria-label={`Select ${asset.title ?? asset.fileName}`}
                />
              </label>
            )}
          </li>
        );
      })}
    </ul>
  );

  const pager = pages > 1 && (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span className="tabular-nums">
        Page {page} of {pages}
      </span>
      <span className="flex gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </span>
    </div>
  );

  const sectionTitle = 'text-label uppercase text-muted-foreground';

  const body = query.isError ? (
    <PanelError title="Media couldn’t be loaded" onRetry={() => void query.refetch()} />
  ) : query.isPending ? (
    <LoadingState label="Loading media" />
  ) : browsing ? (
    subfolders.length === 0 && assets.length === 0 ? (
      folder ? (
        <EmptyState
          className="flex-1"
          icon={FolderOpen}
          title="This folder is empty"
          description={
            access.canWrite ? 'Drop files here, or drag files in from another folder.' : 'Nothing has been put in this folder yet.'
          }
          action={access.canWrite ? { label: 'Upload here', onClick: () => pickFiles(folder), icon: UploadCloud } : undefined}
        />
      ) : (
        <EmptyState
          className="flex-1"
          icon={ImageIcon}
          title={access.canWrite ? 'Upload your first file' : 'No media yet'}
          description="Images, video, audio and documents up to 25 MB. Each gets a permanent public URL your website can use directly."
          action={access.canWrite ? { label: 'Upload', onClick: () => pickFiles(null), icon: UploadCloud } : undefined}
        />
      )
    ) : (
      <>
        {subfolders.length > 0 && (
          <section aria-label="Folders" className="space-y-2">
            <h3 className={sectionTitle}>Folders</h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {subfolders.map((path) => (
                <li key={path}>
                  <FolderTile
                    path={path}
                    count={folderCount(path)}
                    selected={selectedFolder === path}
                    dropTarget={dropTarget === path}
                    draggable={access.canWrite}
                    onDragStart={(event) => startDrag(event, { assetIds: [], folder: path }, folderName(path))}
                    onDragEnd={endDrag}
                    onClick={(event) => clickFolder(event, path)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      onOpenFolder(path);
                    }}
                    {...dropProps(path)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        {assets.length > 0 && (
          <section aria-label="Files" className="space-y-2">
            {subfolders.length > 0 && <h3 className={sectionTitle}>Files</h3>}
            {fileGrid}
          </section>
        )}
        {pager}
      </>
    )
  ) : assets.length === 0 ? (
    view !== 'all' && !filtered ? (
      <EmptyState
        className="flex-1"
        icon={view === 'unused' ? Check : Copy}
        title={view === 'unused' ? 'Every file is in use' : 'No duplicates'}
        description={
          view === 'unused'
            ? 'Each file is used by at least one entry, so there’s nothing to clear out.'
            : 'No file has been uploaded twice.'
        }
      />
    ) : (
      <EmptyState
        className="flex-1"
        kind="search"
        icon={Search}
        title="Nothing matches"
        description="Try another search or type. Results come from every folder."
        action={{ label: 'Clear filters', onClick: clearFilters, icon: X }}
      />
    )
  ) : (
    <>
      {/* Unused / Duplicates: the one useful next step, nothing more. */}
      {view !== 'all' && access.canWrite && (
        <div className="flex items-center justify-end gap-1.5">
          <Tooltip
            side="top"
            align="end"
            wrap
            label={
              view === 'unused'
                ? `No entry uses these. This page holds ${formatBytes(pageBytes)}.`
                : 'Files uploaded more than once. The first of each group is the original; the rest are copies.'
            }
          >
            <span className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
              <Info size={15} aria-label="About this view" />
            </span>
          </Tooltip>
          <Button
            size="sm"
            variant="outline"
            onClick={() => selectMany(view === 'unused' ? assets : assets.filter((asset) => (copyIndex.get(asset.id) ?? 0) > 0))}
          >
            {view === 'unused' ? 'Select this page' : 'Select the copies'}
          </Button>
        </div>
      )}
      {fileGrid}
      {pager}
    </>
  );

  const renaming = naming?.kind === 'rename-folder' ? naming.path : null;
  const removing = removingFolder ? folderSummary(stats, folders, removingFolder) : null;

  return (
    <div
      className="relative flex flex-1 flex-col gap-3"
      onDragOver={(event) => {
        // Only files from the desktop; tiles dragged inside the grid drop on folders.
        if (!access.canWrite || gridDrag.current || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setFileDrag(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFileDrag(false);
          setDropTarget(undefined);
        }
      }}
      onDrop={(event) => {
        if (!access.canWrite || gridDrag.current) return;
        event.preventDefault();
        setFileDrag(false);
        onFiles(event.dataTransfer.files, folder);
      }}
      onKeyDown={(event) => {
        // Keys typed in a field, or in a dialog (portals bubble through React), are not for the grid.
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        if (event.key === 'Escape' && (selecting || selectedFolder)) clearSelection();
        if ((event.key === 'Delete' || event.key === 'Backspace') && selecting && access.canWrite) setBulkRequest({ dialog: 'delete' });
      }}
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          onFiles(event.target.files, uploadFolder);
          event.target.value = '';
        }}
      />
      {headerSlot &&
        createPortal(
          <>
            {target && <StorageUsage target={target} canManage={access.canManageKeys} />}
            {access.canWrite && browsing && (
              <Button variant="outline" className="h-9 gap-1.5" aria-label="New folder" onClick={() => setNaming({ kind: 'new-folder' })}>
                <FolderPlus size={15} aria-hidden="true" />
                <span className="hidden md:inline">New folder</span>
              </Button>
            )}
            {access.canWrite && (
              <Button className="h-9 gap-1.5" disabled={upload.isPending} onClick={() => pickFiles(folder)}>
                <UploadCloud size={15} aria-hidden="true" />
                <span className="hidden md:inline">{upload.isPending ? 'Uploading…' : 'Upload'}</span>
              </Button>
            )}
          </>,
          headerSlot,
        )}

      {/* One row, as on Entries: search, then what to show and which type. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            aria-label="Search media"
            placeholder="Search every folder by name, title or alt text"
            leftIcon={<Search size={14} aria-hidden="true" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          ariaLabel="Which files"
          className="w-36"
          value={view}
          onValueChange={(next) => {
            setView(next as View);
            setPage(1);
          }}
          options={VIEW_OPTIONS}
        />
        <Select
          ariaLabel="File type"
          className="w-36"
          value={kind}
          onValueChange={(value) => {
            setKind(value as CmsMediaGroup | '');
            setPage(1);
          }}
          options={KIND_OPTIONS}
        />
      </div>

      {/* Where you are, and what you can do here. */}
      <div className="flex min-h-9 items-center gap-2">
        {browsing ? (
          <FolderTrail folder={folder} dropTarget={dropTarget} dropProps={dropProps} onOpen={onOpenFolder} />
        ) : (
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {view === 'all'
              ? 'Results from every folder'
              : `${VIEW_OPTIONS.find((option) => option.value === view)?.label} in every folder`}
          </p>
        )}
      </div>

      <div className="flex flex-1 items-start gap-4">
        <ContextMenu>
          <ContextMenuTrigger asChild onContextMenu={onMenu}>
            <div
              className="flex min-h-[50vh] min-w-0 flex-1 flex-col gap-4 self-stretch"
              // A click on empty space clears the selection.
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest('[data-media-item], button, input, label, a')) clearSelection();
              }}
            >
              {body}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>{menu()}</ContextMenuContent>
        </ContextMenu>
        {detailsAt && (
          <MediaDetailsPane
            subject={details}
            at={detailsAt}
            stats={stats}
            folders={folders}
            onOpenAsset={setOpenId}
            onClose={() => setDetailsAt(null)}
          />
        )}
      </div>

      {/* Over the page rather than above it, so nothing jumps while dragging. */}
      {fileDrag && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center rounded-lg border-2 border-dashed border-primary bg-primary/4 pb-6">
          <span className="flex items-center gap-2 rounded-lg border border-primary/30 bg-control px-4 py-2.5 text-sm font-semibold text-primary shadow-sm">
            <UploadCloud size={16} aria-hidden="true" />
            Drop to upload to {placeName(dropTarget !== undefined ? dropTarget : folder)}
          </span>
        </div>
      )}

      {selecting && access.canWrite && (
        <MediaBulkBar selected={[...selected.values()]} folders={folders} request={bulkRequest} onClear={clearSelection} />
      )}

      {naming?.kind === 'new-folder' && (
        <NameDialog
          title="New folder"
          label="Folder name"
          placeholder="e.g. Menu photos"
          confirmLabel="Create"
          problem={(value) => folderNameProblem(value, folder, here)}
          onSubmit={(name) => {
            const path = joinFolder(folder, name);
            updateLocalFolders((current) => [...current, path]);
            setSelected(new Map());
            setSelectedFolder(path);
            setNaming(null);
          }}
          onClose={() => setNaming(null)}
        />
      )}
      {renaming !== null && (
        <NameDialog
          title="Rename folder"
          label="Folder name"
          initial={folderName(renaming)}
          confirmLabel="Rename"
          pending={moveFolder.isPending}
          problem={(value) =>
            value.trim() === folderName(renaming)
              ? null
              : folderNameProblem(
                  value,
                  parentFolder(renaming),
                  childFolders(folders, parentFolder(renaming)).filter((path) => path !== renaming),
                )
          }
          onSubmit={(name) =>
            name === folderName(renaming)
              ? setNaming(null)
              : moveFolder.mutate({ from: renaming, to: joinFolder(parentFolder(renaming), name), verb: 'rename' })
          }
          onClose={() => setNaming(null)}
        />
      )}
      {naming?.kind === 'rename-file' && (
        <NameDialog
          title="Rename file"
          label="Name"
          initial={naming.asset.title ?? naming.asset.fileName}
          confirmLabel="Rename"
          pending={renameFile.isPending}
          problem={(value) => (!value.trim() ? 'Give the file a name.' : value.trim().length > 200 ? 'At most 200 characters.' : null)}
          onSubmit={(title) => renameFile.mutate({ asset: naming.asset, title })}
          onClose={() => setNaming(null)}
        />
      )}
      {removingFolder && removing && (
        <ConfirmModal
          title={`Remove “${folderName(removingFolder)}”?`}
          message={
            removing.files > 0
              ? `Its ${removing.files} ${removing.files === 1 ? 'file' : 'files'}${removing.subfolders > 0 ? ` and ${removing.subfolders} ${removing.subfolders === 1 ? 'folder' : 'folders'}` : ''} move to ${placeName(parentFolder(removingFolder))}. Nothing is deleted, and file URLs don’t change.`
              : 'It’s empty, so nothing else changes.'
          }
          confirmLabel="Remove folder"
          isPending={moveFolder.isPending}
          onConfirm={() => moveFolder.mutate({ from: removingFolder, to: parentFolder(removingFolder), verb: 'remove' })}
          onClose={() => setRemovingFolder(null)}
        />
      )}

      {openId && <AssetDrawer assetId={openId} target={target} onClose={() => setOpenId(null)} />}
      {staged && (
        <ImageOptionsDialog
          files={staged}
          mode="upload"
          freeBytes={target?.freeBytes ?? null}
          isPending={upload.isPending}
          onConfirm={afterImages}
          onClose={() => setStaged(null)}
        />
      )}
      {stagedVideos && (
        <VideoOptionsDialog
          files={stagedVideos}
          mode="upload"
          freeBytes={target?.freeBytes ?? null}
          isPending={upload.isPending}
          onConfirm={(files) => upload.mutate({ files, to: uploadFolder })}
          onClose={() => setStagedVideos(null)}
        />
      )}
    </div>
  );
}

function AssetThumb({ asset, className }: { asset: CmsAsset; className?: string }) {
  if (isImage(asset.mimeType)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tenant media served by the API
      <img
        src={assetPreviewSrc(asset)}
        alt={asset.altText ?? ''}
        loading="lazy"
        className={cn('aspect-4/3 w-full bg-band object-cover', className)}
      />
    );
  }
  if (isVideo(asset.mimeType)) return <VideoThumb src={assetPreviewSrc(asset)} variant="tile" className={className} />;
  return (
    <span className={cn('flex aspect-4/3 w-full flex-col items-center justify-center gap-1 bg-band/60 text-muted-foreground', className)}>
      <FileText size={24} aria-hidden="true" />
      <span className="font-mono text-xs uppercase">{asset.fileName.split('.').pop()}</span>
    </span>
  );
}

/**
 * One file's drawer. Media opens it from its grid; a product's Photos tab
 * opens the same drawer with `extra` — the photo's place on that product —
 * and hears every change through `onChanged`.
 */
export function AssetDrawer({
  assetId,
  target = null,
  onClose,
  extra,
  onChanged,
}: {
  assetId: string;
  target?: ReturnType<typeof uploadTarget> | null;
  onClose: () => void;
  extra?: React.ReactNode;
  onChanged?: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const query = useQuery({
    queryKey: [...cmsKeys.assets(tenantId ?? null, 'detail'), assetId],
    queryFn: () => getCmsAsset(assetId, tenantId),
  });
  const loaded = query.data;
  // Initialised from the first load; the form owns the values after that.
  const [form, setForm] = useState<{
    title: string;
    altText: string;
    folder: string;
    tags: string;
    focal: { x: number; y: number } | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<null | { force: boolean; message?: string }>(null);
  const [converting, setConverting] = useState<File | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  /** Alt text from the image itself; it fills the field for you to read and save. */
  async function suggestAlt(target: CmsAsset) {
    setSuggesting(true);
    try {
      const result = await assist<{ text: string }>({ task: 'alt-text', assetId: target.id, tenantId, title: form?.title || undefined });
      setForm((current) => (current ? { ...current, altText: result.text } : current));
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Writing help is unavailable right now.');
    } finally {
      setSuggesting(false);
    }
  }
  // Save plays the button's done beat (tick, pop) and the drawer stays open.
  const [saved, flashSaved] = useDoneBeat();
  if (loaded && !form)
    setForm({
      title: loaded.title ?? '',
      altText: loaded.altText ?? '',
      folder: loaded.folder ?? '',
      tags: loaded.tags.join(', '),
      focal: loaded.focalPoint,
    });

  const save = useMutation({
    mutationFn: () =>
      updateCmsAsset(
        assetId,
        {
          title: form!.title.trim() || null,
          altText: form!.altText.trim() || null,
          folder: form!.folder.trim() || null,
          tags: form!.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          focalPoint: form!.focal,
        },
        tenantId,
      ),
    onSuccess: () => {
      invalidateCms(queryClient);
      onChanged?.();
      // The button says "Saved"; a toast as well would say it twice.
      flashSaved();
    },
    onError: (error) => toast('error', error.message),
  });
  const load = useMutation({
    mutationFn: async (asset: CmsAsset) => {
      const blob = await getCmsAssetFile(asset.id, tenantId);
      return new File([blob], asset.fileName, { type: asset.mimeType });
    },
    onSuccess: (file) => setConverting(file),
    onError: (error) => toast('error', error.message),
  });
  const replace = useMutation({
    mutationFn: async ({ file, focal }: { file: File; focal?: { x: number; y: number } | null }) => {
      const asset = await replaceCmsAssetFile(assetId, file, tenantId);
      // A crop moves the subject; the dialog worked out where it now sits.
      if (focal !== undefined) await updateCmsAsset(assetId, { focalPoint: focal }, tenantId);
      // The API dropped the old picture's smaller copies; make the new picture's.
      await createRenditions(asset, tenantId, file).catch(() => 0);
      return { asset, focal };
    },
    onSuccess: ({ asset, focal }) => {
      invalidateCms(queryClient);
      onChanged?.();
      setConverting(null);
      if (focal !== undefined) setForm((current) => (current ? { ...current, focal } : current));
      toast('success', `Replaced — now ${formatBytes(asset.sizeBytes)}.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const sizes = useMutation({
    mutationFn: async (asset: CmsAsset) => {
      if (asset.renditions.length > 0) await deleteCmsRenditions(asset.id, tenantId);
      return createRenditions(asset, tenantId);
    },
    onSuccess: (made) => {
      invalidateCms(queryClient);
      onChanged?.();
      toast(
        'success',
        made > 0
          ? `Made ${made} ${made === 1 ? 'size' : 'sizes'} for websites.`
          : 'This image is already small enough — no extra sizes needed.',
      );
    },
    onError: (error) => toast('error', error.message),
  });
  // The focus point alone: no new file, so the URL and the website sizes stay.
  const saveFocal = useMutation({
    mutationFn: (focal: { x: number; y: number } | null) => updateCmsAsset(assetId, { focalPoint: focal }, tenantId).then(() => focal),
    onSuccess: (focal) => {
      invalidateCms(queryClient);
      onChanged?.();
      setForm((current) => (current ? { ...current, focal } : current));
      setConverting(null);
      toast('success', focal ? 'Focus point saved.' : 'Focus point cleared.');
    },
    onError: (error) => toast('error', error.message),
  });
  const dropSizes = useMutation({
    mutationFn: () => deleteCmsRenditions(assetId, tenantId),
    onSuccess: () => {
      invalidateCms(queryClient);
      onChanged?.();
      toast('success', 'Website sizes removed — websites get the original file.');
    },
    onError: (error) => toast('error', error.message),
  });
  const [openRow, setOpenRow] = useState<string | null>(null);
  const toggleRow = (row: string) => setOpenRow((current) => (current === row ? null : row));

  const remove = useMutation({
    mutationFn: (force: boolean) => deleteCmsAsset(assetId, force, tenantId),
    onSuccess: () => {
      invalidateCms(queryClient);
      onChanged?.();
      toast('success', 'File deleted.');
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setDeleting({ force: true, message: `${error.message}. Deleting it leaves those fields empty, and the file URL stops working.` });
        return;
      }
      setDeleting(null);
      toast('error', error.message);
    },
  });

  const asset = query.data;
  return (
    <Drawer
      title={asset?.fileName ?? 'File'}
      onClose={onClose}
      footer={
        access.canWrite && asset && form ? (
          <div className="flex justify-between gap-2">
            <Button variant="ghost" className="gap-1.5 text-exception hover:text-exception" onClick={() => setDeleting({ force: false })}>
              <Trash2 size={14} aria-hidden="true" /> Delete
            </Button>
            <ActionButton className="min-w-32" pending={save.isPending} done={saved} onClick={() => save.mutate()}>
              Save details
            </ActionButton>
          </div>
        ) : undefined
      }
    >
      {query.isError ? (
        <PanelError title="The file couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : !asset || !form ? (
        <LoadingState label="Loading file" compact />
      ) : (
        <div className="space-y-6">
          {extra}
          {/* The file itself: a clean stage, its facts in one line, and three things to do with it. */}
          <div className="space-y-3">
            <div className={STAGE_CLASS}>
              {isVideo(asset.mimeType) ? (
                <VideoThumb src={assetPreviewSrc(asset)} variant="player" />
              ) : (
                // The focus point shows where it is; it is set in Edit image.
                <span className="relative inline-block">
                  <AssetThumb asset={asset} className="aspect-auto max-h-80 w-auto bg-transparent object-contain" />
                  {form.focal && isImage(asset.mimeType) && <FocalMarker focal={form.focal} />}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                asset.fileName.split('.').pop()?.toUpperCase() ?? asset.mimeType,
                formatBytes(asset.sizeBytes),
                asset.width && asset.height ? `${asset.width} × ${asset.height}` : null,
              ]
                .filter(Boolean)
                .map((fact) => (
                  <span
                    key={fact}
                    className="rounded-md border border-rule/55 bg-control px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
                  >
                    {fact}
                  </span>
                ))}
            </div>
            <div
              className={cn(
                'grid gap-2',
                access.canWrite && (isConvertibleImage(asset.mimeType) || isConvertibleVideo(asset.mimeType))
                  ? 'grid-cols-3'
                  : 'grid-cols-2',
              )}
            >
              {access.canWrite && isConvertibleImage(asset.mimeType) && (
                <Button variant="outline" className="gap-1.5 bg-control" disabled={load.isPending} onClick={() => load.mutate(asset)}>
                  {load.isPending ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <SlidersHorizontal size={14} aria-hidden="true" />
                  )}
                  Edit image
                </Button>
              )}
              {access.canWrite && isConvertibleVideo(asset.mimeType) && (
                <Button variant="outline" className="gap-1.5 bg-control" disabled={load.isPending} onClick={() => load.mutate(asset)}>
                  {load.isPending ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Video size={14} aria-hidden="true" />
                  )}
                  Compress
                </Button>
              )}
              <CopyButton
                className="bg-control"
                label="Copy URL"
                copiedLabel="Copied"
                onCopy={async () => {
                  const copied = await copyText(asset.url);
                  if (!copied) toast('error', 'Copy failed — select the URL instead.');
                  return copied;
                }}
              />
              <Button variant="outline" className="gap-1.5 bg-control" asChild>
                <a href={asset.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} aria-hidden="true" />
                  Open
                </a>
              </Button>
            </div>
          </div>

          {/* One line each — what it is set to — and the input opens underneath on a tap. */}
          <DrawerSection id="asset-details" title="Details">
            <DetailRow
              icon={Type}
              title="Title"
              value={form.title.trim() || asset.fileName}
              muted={!form.title.trim()}
              open={openRow === 'title'}
              onToggle={() => toggleRow('title')}
            >
              <Input
                aria-label="Title"
                autoFocus
                value={form.title}
                disabled={!access.canWrite}
                placeholder={asset.fileName}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </DetailRow>
            {isImage(asset.mimeType) && (
              <DetailRow
                icon={Eye}
                title="Alt text"
                value={form.altText.trim() || 'Missing'}
                tone={form.altText.trim() ? undefined : 'warning'}
                open={openRow === 'alt'}
                onToggle={() => toggleRow('alt')}
              >
                <Input
                  aria-label="Alt text"
                  autoFocus
                  value={form.altText}
                  disabled={!access.canWrite}
                  placeholder="What the image shows"
                  hint="Read aloud by screen readers; used by search engines"
                  onChange={(event) => setForm({ ...form, altText: event.target.value })}
                  rightAction={
                    access.canWrite && asset.mimeType !== 'image/svg+xml' ? (
                      <Tooltip side="top" align="end" label="Suggest alt text from the image">
                        <button
                          type="button"
                          aria-label="Suggest alt text from the image"
                          className="flex size-7 items-center justify-center rounded-sm text-primary hover:bg-primary/8 disabled:opacity-50"
                          disabled={suggesting}
                          onClick={() => void suggestAlt(asset)}
                        >
                          {suggesting ? (
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Sparkles size={14} aria-hidden="true" />
                          )}
                        </button>
                      </Tooltip>
                    ) : undefined
                  }
                />
              </DetailRow>
            )}
            <DetailRow
              icon={FolderIcon}
              title="Folder"
              value={form.folder.trim() || 'None'}
              muted={!form.folder.trim()}
              open={openRow === 'folder'}
              onToggle={() => toggleRow('folder')}
            >
              <Input
                aria-label="Folder"
                autoFocus
                value={form.folder}
                disabled={!access.canWrite}
                placeholder="e.g. Menu photos"
                onChange={(event) => setForm({ ...form, folder: event.target.value })}
              />
            </DetailRow>
            <DetailRow
              icon={Tag}
              title="Tags"
              value={form.tags.trim() || 'None'}
              muted={!form.tags.trim()}
              open={openRow === 'tags'}
              onToggle={() => toggleRow('tags')}
            >
              <Input
                aria-label="Tags"
                autoFocus
                value={form.tags}
                disabled={!access.canWrite}
                placeholder="menu, summer"
                hint="Comma separated"
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
              />
            </DetailRow>
            {isConvertibleImage(asset.mimeType) && (
              <DetailRow
                icon={Monitor}
                title="Website sizes"
                info="Smaller copies made on upload, so phones download a phone-sized image instead of the full file. Optional — without them websites use the original."
                value={
                  asset.renditions.length > 0
                    ? `${asset.renditions.length} ${asset.renditions.length === 1 ? 'size' : 'sizes'}`
                    : renditionWidths(asset.width).length > 0
                      ? 'None'
                      : 'Not needed'
                }
                muted={asset.renditions.length === 0}
                open={openRow === 'sizes'}
                onToggle={() => toggleRow('sizes')}
              >
                {asset.renditions.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {asset.renditions.map((rendition) => (
                      <li
                        key={rendition.url}
                        className="rounded-md border border-rule/55 bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">{rendition.width}w</span> · {formatBytes(rendition.sizeBytes)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {renditionWidths(asset.width).length > 0
                      ? 'None yet — websites get the full file.'
                      : 'Small enough already — websites use the original.'}
                  </p>
                )}
                {access.canWrite && renditionWidths(asset.width).length > 0 && (
                  <div className="mt-2.5 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-background"
                      disabled={sizes.isPending || dropSizes.isPending}
                      onClick={() => sizes.mutate(asset)}
                    >
                      {sizes.isPending ? 'Making…' : asset.renditions.length > 0 ? 'Regenerate' : 'Make sizes'}
                    </Button>
                    {asset.renditions.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-exception hover:text-exception"
                        disabled={sizes.isPending || dropSizes.isPending}
                        onClick={() => dropSizes.mutate()}
                      >
                        <Trash2 size={13} aria-hidden="true" /> {dropSizes.isPending ? 'Removing…' : 'Remove'}
                      </Button>
                    )}
                  </div>
                )}
              </DetailRow>
            )}
          </DrawerSection>

          <DrawerSection id="asset-used-by" title="Used by" count={asset.usedBy?.length}>
            {asset.usedBy && asset.usedBy.length > 0 ? (
              <ul>
                {asset.usedBy.map((use) => (
                  <li key={use.id} className="flex min-w-0 items-center gap-3 border-b border-rule/45 px-4 py-2.5 last:border-b-0">
                    <RowTile icon={FileText} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{use.title ?? 'Untitled'}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{use.contentType}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">No entry uses this file, so deleting it breaks nothing in DUMA.</p>
            )}
          </DrawerSection>
        </div>
      )}
      {converting && asset && isConvertibleVideo(converting.type) && (
        <VideoOptionsDialog
          files={[converting]}
          mode="replace"
          freeBytes={
            target?.freeBytes == null ? null : target.freeBytes + (sharesAllowance(asset, target.connectionId) ? asset.sizeBytes : 0)
          }
          isPending={replace.isPending}
          onConfirm={([file]) => file && replace.mutate({ file })}
          onClose={() => setConverting(null)}
        />
      )}
      {converting && asset && !isConvertibleVideo(converting.type) && (
        <ImageOptionsDialog
          files={[converting]}
          mode="replace"
          freeBytes={
            target?.freeBytes == null ? null : target.freeBytes + (sharesAllowance(asset, target.connectionId) ? asset.sizeBytes : 0)
          }
          isPending={replace.isPending || saveFocal.isPending}
          onConfirm={([file], focal) => file && replace.mutate({ file, focal })}
          focal={form?.focal ?? null}
          onSaveFocal={(focal) => saveFocal.mutate(focal)}
          onClose={() => setConverting(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={deleting.force ? 'This file is in use' : 'Delete this file?'}
          message={deleting.message ?? 'The file and its public URL are removed. This cannot be undone.'}
          confirmLabel={deleting.force ? 'Delete anyway' : 'Delete'}
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleting.force)}
          onClose={() => setDeleting(null)}
        />
      )}
    </Drawer>
  );
}
