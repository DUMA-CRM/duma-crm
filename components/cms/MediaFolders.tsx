'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { ChevronRight, FileText, FolderIcon, FolderMove, FolderOpen, ImageIcon, X } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { ContextMenuItem, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';

import { type CmsAsset, getCmsAsset } from '@/lib/modules/cms/client';
import { formatBytes, isImage } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import { type FolderStat, folderName, folderSummary, folderTrail, parentFolder } from '@/lib/utils/media-folders';

import { assetPreviewSrc, cmsKeys } from './shared';

// ─── Empty folders, kept on this device ──────────────────────────────────────

/*
 * A folder exists on the server only while a file is in it, so a folder made
 * and not yet filled lives here, per workspace, until a file lands in it (the
 * panel then stops listing it as pending — see `pendingFolders`).
 */
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
const snapshots = new Map<string, string[]>();
const storageKey = (tenantId: string) => `duma.cms.media-folders.${tenantId}`;

function readLocal(tenantId: string): string[] {
  const cached = snapshots.get(tenantId);
  if (cached) return cached;
  let value = EMPTY;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(tenantId)) ?? '[]');
    if (Array.isArray(parsed)) value = parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    // Unreadable storage: no local folders.
  }
  snapshots.set(tenantId, value);
  return value;
}

function writeLocal(tenantId: string, next: string[]) {
  snapshots.set(tenantId, next);
  try {
    localStorage.setItem(storageKey(tenantId), JSON.stringify(next));
  } catch {
    // Private mode or full: the folder still shows until the page reloads.
  }
  for (const listener of listeners) listener();
}

export function useLocalFolders(tenantId: string | null) {
  const folders = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (tenantId ? readLocal(tenantId) : EMPTY),
    () => EMPTY,
  );
  const update = (change: (current: string[]) => string[]) => {
    if (!tenantId) return;
    const current = readLocal(tenantId);
    const next = [...new Set(change(current))];
    if (next.length !== current.length || next.some((path, index) => path !== current[index])) writeLocal(tenantId, next);
  };
  return [folders, update] as const;
}

// ─── Folder tile and trail ───────────────────────────────────────────────────

/** The drop-target look, shared by folder tiles and the trail. */
export const DROP_TARGET_CLASS = 'border-primary bg-primary/10 ring-2 ring-primary/30';

export function FolderTile({
  path,
  count,
  selected,
  dropTarget,
  ...props
}: {
  path: string;
  /** Files in it and below; null for an empty folder made on this device. */
  count: number | null;
  selected: boolean;
  dropTarget: boolean;
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-media-item="folder"
      data-path={path}
      aria-pressed={selected}
      className={cn(
        'flex h-12 w-full min-w-0 items-center gap-2.5 rounded-lg border px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        dropTarget
          ? DROP_TARGET_CLASS
          : selected
            ? 'border-primary/60 bg-primary/8'
            : 'border-rule/55 bg-control hover:border-rule hover:bg-band/50',
      )}
      {...props}
    >
      {dropTarget ? (
        <FolderOpen size={18} className="shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <FolderIcon size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{folderName(path)}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count === null ? 'Empty' : count}</span>
    </button>
  );
}

/**
 * Where you are: Media › Menu › Summer. Every step opens that folder and takes
 * a drop, so a file can be moved up without leaving the folder it is in.
 */
export function FolderTrail({
  folder,
  dropTarget,
  dropProps,
  onOpen,
}: {
  folder: string | null;
  dropTarget: string | null | undefined;
  dropProps: (path: string | null) => React.HTMLAttributes<HTMLElement>;
  onOpen: (path: string | null) => void;
}) {
  const steps = [{ name: 'Media', path: null as string | null }, ...folderTrail(folder)];
  return (
    <nav aria-label="Folder" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
      {steps.map((step, index) => {
        const current = index === steps.length - 1;
        return (
          <span key={step.path ?? ''} className="flex min-w-0 shrink-0 items-center gap-0.5">
            {index > 0 && <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
            <button
              type="button"
              aria-current={current ? 'location' : undefined}
              onClick={() => onOpen(step.path)}
              {...dropProps(step.path)}
              className={cn(
                'max-w-56 truncate rounded-md border border-transparent px-2 py-1 text-sm transition-colors',
                current ? 'font-semibold text-foreground' : 'text-muted-foreground hover:bg-band/60 hover:text-foreground',
                dropTarget === step.path && DROP_TARGET_CLASS,
              )}
            >
              {step.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

// ─── Move to … ───────────────────────────────────────────────────────────────

/** The right-click "Move to" list: the top level, then every folder, indented by depth. */
export function MoveToSub({
  folders,
  disabled,
  label = 'Move to',
  onMove,
}: {
  folders: readonly string[];
  disabled: (path: string | null) => boolean;
  label?: string;
  onMove: (path: string | null) => void;
}) {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger icon={FolderMove}>{label}</ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-80 w-60 overflow-y-auto">
        <ContextMenuItem icon={ImageIcon} disabled={disabled(null)} onSelect={() => onMove(null)}>
          Media (top level)
        </ContextMenuItem>
        {folders.map((path) => (
          <ContextMenuItem
            key={path}
            icon={FolderIcon}
            disabled={disabled(path)}
            style={{ paddingLeft: `${8 + (path.split('/').length - 1) * 12}px` }}
            onSelect={() => onMove(path)}
          >
            {folderName(path)}
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

// ─── Name a folder or a file ─────────────────────────────────────────────────

export function NameDialog({
  title,
  label,
  initial = '',
  placeholder,
  confirmLabel,
  pending = false,
  problem,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  confirmLabel: string;
  pending?: boolean;
  /** Why this value cannot be used, or null. */
  problem?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const error = problem?.(value) ?? null;
  const submit = () => {
    setTouched(true);
    if (!error && !pending) onSubmit(value.trim());
  };
  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || (touched && !!error)} onClick={submit}>
            {pending ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          label={label}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          value={value}
          placeholder={placeholder}
          error={touched && error ? error : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setTouched(true);
          }}
        />
      </form>
    </Modal>
  );
}

// ─── Details pane ────────────────────────────────────────────────────────────

const BACKEND_LABEL: Record<CmsAsset['storageBackend'], string> = {
  local: 'API server',
  duma: 'DUMA storage',
  connection: 'Your connected storage',
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

const placeName = (path: string | null) => (path ? path.split('/').join(' › ') : 'Media');

export type DetailsSubject =
  | { kind: 'asset'; asset: CmsAsset }
  | { kind: 'assets'; assets: CmsAsset[] }
  | { kind: 'folder'; path: string; pending: boolean }
  | { kind: 'here'; path: string | null; filesHere: number | null; subfolders: number };

/**
 * A file manager's Properties window: the item's facts — or, with nothing
 * selected, the folder you are in. It opens where you right-clicked, as on
 * Windows, kept inside the viewport, and closes on Escape or a click elsewhere.
 */
export function MediaDetailsPane({
  subject,
  at,
  stats,
  folders,
  onOpenAsset,
  onClose,
}: {
  subject: DetailsSubject;
  /** The right-click point, in viewport pixels. */
  at: { x: number; y: number };
  stats: readonly FolderStat[];
  folders: readonly string[];
  onOpenAsset: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [position, setPosition] = useState(at);
  // Keep the whole window on screen, again whenever it grows ("Used by" loads late).
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const place = () => {
      const { width, height } = element.getBoundingClientRect();
      setPosition({
        x: Math.max(8, Math.min(at.x, window.innerWidth - width - 8)),
        y: Math.max(8, Math.min(at.y, window.innerHeight - height - 8)),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, [at]);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const title =
    subject.kind === 'asset'
      ? (subject.asset.title ?? subject.asset.fileName)
      : subject.kind === 'assets'
        ? `${subject.assets.length} files selected`
        : subject.kind === 'folder'
          ? folderName(subject.path)
          : subject.path
            ? folderName(subject.path)
            : 'Media';
  return createPortal(
    <aside
      ref={ref}
      role="dialog"
      aria-label={`${title} — details`}
      style={{ left: position.x, top: position.y }}
      className="fixed z-50 flex max-h-[calc(100dvh-1rem)] w-80 max-w-[calc(100vw-1rem)] flex-col rounded-lg border border-rule/60 bg-card shadow-xl"
    >
      <header className="flex items-center gap-2 border-b border-rule/50 px-4 py-3">
        {subject.kind === 'asset' ? (
          <FileText size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <FolderIcon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</h2>
        <Button size="icon-sm" variant="ghost" aria-label="Close details" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {subject.kind === 'asset' && <AssetFacts asset={subject.asset} onOpen={() => onOpenAsset(subject.asset.id)} />}
        {subject.kind === 'assets' && (
          <dl>
            <Fact label="Selected">{subject.assets.length} files</Fact>
            <Fact label="Total size">{formatBytes(subject.assets.reduce((sum, asset) => sum + asset.sizeBytes, 0))}</Fact>
            <Fact label="Locations">{[...new Set(subject.assets.map((asset) => placeName(asset.folder)))].join(', ')}</Fact>
          </dl>
        )}
        {subject.kind === 'folder' && <FolderFacts path={subject.path} pending={subject.pending} stats={stats} folders={folders} />}
        {subject.kind === 'here' &&
          (subject.path ? (
            <FolderFacts path={subject.path} pending={false} stats={stats} folders={folders} />
          ) : (
            <dl>
              <Fact label="Folders">{subject.subfolders}</Fact>
              <Fact label="Files here">{subject.filesHere ?? '—'}</Fact>
              <p className="pt-3 text-xs text-muted-foreground">Select a file or folder to see its details.</p>
            </dl>
          ))}
      </div>
    </aside>,
    document.body,
  );
}

function FolderFacts({
  path,
  pending,
  stats,
  folders,
}: {
  path: string;
  pending: boolean;
  stats: readonly FolderStat[];
  folders: readonly string[];
}) {
  const summary = folderSummary(stats, folders, path);
  return (
    <dl>
      <Fact label="Type">Folder</Fact>
      <Fact label="Location">{placeName(parentFolder(path))}</Fact>
      <Fact label="Files">
        {summary.files}
        {summary.files !== summary.direct ? ` (${summary.direct} directly inside)` : ''}
      </Fact>
      <Fact label="Folders">{summary.subfolders}</Fact>
      <Fact label="Size">{formatBytes(summary.bytes)}</Fact>
      {pending && (
        <p className="pt-3 text-xs text-muted-foreground">
          Empty folders are kept on this device only. Put a file in it and everyone sees it.
        </p>
      )}
    </dl>
  );
}

function AssetFacts({ asset, onOpen }: { asset: CmsAsset; onOpen: () => void }) {
  // "Used by" is only on the single-asset read — the same query the drawer uses.
  const detail = useQuery({
    queryKey: [...cmsKeys.assets(asset.tenantId, 'detail'), asset.id],
    queryFn: () => getCmsAsset(asset.id, asset.tenantId),
  });
  const usedBy = detail.data?.usedBy;
  return (
    <div className="space-y-3">
      {isImage(asset.mimeType) ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant media served by the API
        <img src={assetPreviewSrc(asset)} alt={asset.altText ?? ''} className="max-h-44 w-full rounded-md bg-band object-contain" />
      ) : (
        <span className="flex h-24 w-full items-center justify-center rounded-md bg-band/60 font-mono text-xs uppercase text-muted-foreground">
          {asset.fileName.split('.').pop()}
        </span>
      )}
      <dl>
        <Fact label="File name">{asset.fileName}</Fact>
        <Fact label="Type">{asset.mimeType}</Fact>
        <Fact label="Size">{formatBytes(asset.sizeBytes)}</Fact>
        {asset.width && asset.height ? <Fact label="Dimensions">{`${asset.width} × ${asset.height}`}</Fact> : null}
        <Fact label="Location">{placeName(asset.folder)}</Fact>
        <Fact label="Uploaded">{formatDateTime(asset.createdAt)}</Fact>
        <Fact label="Modified">{formatDateTime(asset.updatedAt)}</Fact>
        <Fact label="Stored in">{BACKEND_LABEL[asset.storageBackend]}</Fact>
        {isImage(asset.mimeType) && <Fact label="Alt text">{asset.altText ?? <span className="text-measured">Missing</span>}</Fact>}
        {asset.tags.length > 0 && <Fact label="Tags">{asset.tags.join(', ')}</Fact>}
        {asset.renditions.length > 0 && <Fact label="Website sizes">{asset.renditions.map((r) => `${r.width}w`).join(', ')}</Fact>}
        <Fact label="Used by">
          {detail.isError
            ? '—'
            : !usedBy
              ? 'Checking…'
              : usedBy.length === 0
                ? 'No entries'
                : usedBy.map((use) => use.title ?? 'Untitled').join(', ')}
        </Fact>
      </dl>
      <Button variant="outline" className="w-full bg-control" onClick={onOpen}>
        Open file
      </Button>
    </div>
  );
}

// ─── Drag image ──────────────────────────────────────────────────────────────

/** A small "3 files" chip under the pointer instead of a ghost of one tile. */
export function setDragLabel(event: React.DragEvent, label: string) {
  const chip = document.createElement('div');
  chip.textContent = label;
  chip.className =
    'fixed -top-24 left-0 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-lg';
  document.body.appendChild(chip);
  event.dataTransfer.setDragImage(chip, -12, -12);
  setTimeout(() => chip.remove(), 0);
}
