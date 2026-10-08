'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  FolderIcon,
  ImageIcon,
  Info,
  Loader2,
  Monitor,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Type,
  UploadCloud,
  X,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { ActionButton, CopyButton, useDoneBeat } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import {
  type CmsAsset,
  type CmsMediaGroup,
  type CmsStorage,
  deleteCmsAsset,
  deleteCmsRenditions,
  getCmsAsset,
  getCmsAssetFile,
  getCmsAssets,
  getCmsStorage,
  replaceCmsAssetFile,
  updateCmsAsset,
  uploadCmsAsset,
} from '@/lib/modules/cms/client';
import { formatBytes, isImage } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { isConvertibleImage, renditionWidths } from '@/lib/utils/media-storage';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { assist } from './AssistSection';
import { FocalMarker, ImageOptionsDialog } from './ImageOptionsDialog';
import { MediaBulkBar } from './MediaBulkBar';
import { StorageUsage, type UploadTarget } from './StorageUsage';
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

/**
 * `headerSlot` is an element in the page masthead: Upload and the storage
 * status are the tab's actions, so they sit where every other tab's primary
 * action sits, while the upload logic stays here with the file input.
 */
export function MediaPanel({ headerSlot }: { headerSlot?: HTMLElement | null }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<CmsMediaGroup | ''>('');
  const [folder, setFolder] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Files waiting on the optimise dialog — any upload with a convertible image goes through it.
  const [staged, setStaged] = useState<File[] | null>(null);
  const [view, setView] = useState<View>('all');
  // Selection survives paging and filtering, so it holds the assets, not just ids.
  const [selected, setSelected] = useState<Map<string, CmsAsset>>(new Map());
  const selecting = selected.size > 0;
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

  const filters = {
    q: q || undefined,
    kind,
    folder: folder || undefined,
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

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      // One at a time: each file is up to 25 MB, and a failure names its file.
      const failures: string[] = [];
      for (const file of files) {
        try {
          const asset = await uploadCmsAsset(file, { folder: folder || undefined }, tenantId ?? undefined);
          // Responsive copies follow the upload; if they fail the file is still stored, and the drawer can make them later.
          await createRenditions(asset, tenantId ?? undefined, file).catch(() => 0);
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : 'failed'}`);
        }
      }
      return { uploaded: files.length - failures.length, failures };
    },
    onSuccess: ({ uploaded, failures }) => {
      invalidateCms(queryClient);
      if (uploaded > 0) toast('success', `Uploaded ${uploaded} ${uploaded === 1 ? 'file' : 'files'}.`);
      if (failures.length > 0) toast('error', failures.join(' · '));
      setStaged(null);
    },
  });

  const onFiles = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    if (files.some((file) => isConvertibleImage(file.type))) setStaged(files);
    else upload.mutate(files);
  };

  const assets = query.data?.data ?? [];
  const filtered = Boolean(q || kind || folder);
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
    setFolder('');
    setPage(1);
  };

  return (
    <div
      className="relative flex flex-1 flex-col gap-3"
      onDragOver={(event) => {
        if (!access.canWrite) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!access.canWrite) return;
        event.preventDefault();
        setDragging(false);
        onFiles(event.dataTransfer.files);
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
          onFiles(event.target.files);
          event.target.value = '';
        }}
      />
      {headerSlot &&
        createPortal(
          <>
            {target && <StorageUsage target={target} canManage={access.canManageKeys} />}
            {access.canWrite && (
              <Button className="h-9 gap-1.5" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
                <UploadCloud size={15} aria-hidden="true" />
                <span className="hidden md:inline">{upload.isPending ? 'Uploading…' : 'Upload'}</span>
              </Button>
            )}
          </>,
          headerSlot,
        )}

      {/* One row, as on Entries: search, then what to show, type and folder. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            aria-label="Search media"
            placeholder="Search by name, title or alt text"
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
        {(query.data?.folders.length ?? 0) > 0 && (
          <Select
            ariaLabel="Folder"
            className="w-40"
            value={folder}
            onValueChange={(value) => {
              setFolder(value);
              setPage(1);
            }}
            options={[{ value: '', label: 'All folders' }, ...query.data!.folders.map((name) => ({ value: name, label: name }))]}
          />
        )}
      </div>

      {query.isError ? (
        <PanelError title="Media couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <LoadingState label="Loading media" />
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
        ) : filtered ? (
          <EmptyState
            className="flex-1"
            kind="search"
            icon={Search}
            title="Nothing matches"
            description="Try another search, type or folder."
            action={{ label: 'Clear filters', onClick: clearFilters, icon: X }}
          />
        ) : (
          <EmptyState
            className="flex-1"
            icon={ImageIcon}
            title={access.canWrite ? 'Upload your first file' : 'No media yet'}
            description="Images, video, audio and documents up to 25 MB. Each gets a permanent public URL your website can use directly."
            action={access.canWrite ? { label: 'Upload', onClick: () => fileInput.current?.click(), icon: UploadCloud } : undefined}
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
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {assets.map((asset) => {
              const isSelected = selected.has(asset.id);
              const copy = copyIndex.get(asset.id) ?? 0;
              const missingAlt = !asset.altText && isImage(asset.mimeType);
              return (
                <li key={asset.id} className="group relative">
                  <button
                    type="button"
                    // While anything is selected, a click selects — the grid is in choosing mode.
                    onClick={() => (selecting ? toggle(asset) : setOpenId(asset.id))}
                    className={cn(
                      'block w-full overflow-hidden rounded-lg border bg-background text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-rule/55 hover:border-rule',
                    )}
                  >
                    <AssetThumb asset={asset} />
                    <span className="flex items-center gap-1.5 px-2.5 pt-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{asset.title ?? asset.fileName}</span>
                    </span>
                    <span className="block truncate px-2.5 pb-2 text-xs tabular-nums text-muted-foreground">
                      {formatBytes(asset.sizeBytes)}
                      {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
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
          {pages > 1 && (
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
          )}
        </>
      )}

      {/* Over the page rather than above it, so nothing jumps while dragging. */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/6 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-lg border border-primary/30 bg-control px-4 py-2.5 text-sm font-semibold text-primary shadow-sm">
            <UploadCloud size={16} aria-hidden="true" />
            Drop to upload{folder ? ` to ${folder}` : ''}
          </span>
        </div>
      )}

      {selecting && (
        <MediaBulkBar selected={[...selected.values()]} folders={query.data?.folders ?? []} onClear={() => setSelected(new Map())} />
      )}

      {openId && <AssetDrawer assetId={openId} target={target} onClose={() => setOpenId(null)} />}
      {staged && (
        <ImageOptionsDialog
          files={staged}
          mode="upload"
          freeBytes={target?.freeBytes ?? null}
          isPending={upload.isPending}
          onConfirm={(files) => upload.mutate(files)}
          onClose={() => setStaged(null)}
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
              {/* The focus point shows where it is; it is set in Edit image. */}
              <span className="relative inline-block">
                <AssetThumb asset={asset} className="aspect-auto max-h-80 w-auto bg-transparent object-contain" />
                {form.focal && isImage(asset.mimeType) && <FocalMarker focal={form.focal} />}
              </span>
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
            <div className={cn('grid gap-2', access.canWrite && isConvertibleImage(asset.mimeType) ? 'grid-cols-3' : 'grid-cols-2')}>
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
      {converting && asset && (
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

/** A titled group in the file drawer — the heading above, its rows together in one white card, as the order drawer does it. */
function DrawerSection({
  id,
  title,
  count,
  action,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold text-foreground">
          {title}
          {count ? <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{count}</span> : null}
        </h3>
        {action}
      </div>
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-control">{children}</div>
    </section>
  );
}

/**
 * One detail on one line — icon, name, what it is set to — that opens its
 * input underneath on a tap, as the Schedule card does on an entry.
 */
function DetailRow({
  icon,
  title,
  value,
  muted,
  tone,
  info,
  open,
  onToggle,
  children,
}: {
  icon: IconComponent;
  title: string;
  value: string;
  muted?: boolean;
  tone?: 'warning';
  info?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-rule/45 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <RowTile icon={icon} tone={tone} />
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-foreground">
          {title}
          {info && (
            <Tooltip side="top" wrap label={info}>
              <span className="text-muted-foreground hover:text-foreground">
                <Info size={13} aria-label="About" />
              </span>
            </Tooltip>
          )}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-right text-sm',
            tone === 'warning' ? 'font-medium text-measured' : muted ? 'text-muted-foreground/70' : 'text-muted-foreground',
          )}
        >
          {value}
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && <div className="bg-band/25 px-4 pb-3.5 pt-1">{children}</div>}
    </div>
  );
}
