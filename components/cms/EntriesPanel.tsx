'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  Archive,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Layers,
  Link2,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  X,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
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
  type CmsEntryFilters,
  type CmsEntrySummary,
  bulkCmsEntries,
  deleteCmsEntry,
  duplicateCmsEntry,
  getCmsContentTypes,
  getCmsEntries,
  getCmsLocales,
  restoreCmsEntry,
} from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { clickSelection } from '@/lib/utils/media-folders';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { FolderTile } from './MediaFolders';
import { EntryStatusBadge, LanguageChips, PanelError, cmsKeys, copyText, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

type StatusFilter = NonNullable<CmsEntryFilters['status']>;
type BulkAction = 'publish' | 'unpublish' | 'archive';
type MenuTarget = { kind: 'here' } | { kind: 'model'; id: string } | { kind: 'entry'; entry: CmsEntrySummary };

const STATUS_OPTIONS: Array<{ value: StatusFilter | 'all'; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'draft', label: 'Drafts' },
  { value: 'live', label: 'Live' },
  { value: 'changed', label: 'Changed' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'review', label: 'In review' },
  { value: 'archived', label: 'Archived' },
];

const GRID_CLASS = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';

const when = (iso: string) => formatInstant(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, '—', undefined);

/** Every language version of an entry — what a tile stands for. */
const versionIds = (entry: CmsEntrySummary) => entry.localizations?.map((version) => version.id) ?? [entry.id];

/** A link to the entry's editor, for a new tab or the clipboard. */
const entryHref = (id: string) => `${window.location.origin}${window.location.pathname}?entry=${encodeURIComponent(id)}`;

/**
 * Entries, browsed like Media: each model is a folder, opened to show its
 * entries as tiles. Click opens (⌘/Ctrl/Shift-click or the checkbox selects),
 * right-click for everything else. Searching or filtering at the top level
 * looks across every model at once.
 */
export function EntriesPanel({
  typeId,
  onOpenType,
  onOpenEntry,
  onNewEntry,
  onOpenModel,
}: {
  /** The open model ('' for the top level). It lives in the URL, so Back goes back up. */
  typeId: string;
  onOpenType: (id: string) => void;
  onOpenEntry: (id: string) => void;
  onNewEntry: (contentTypeId?: string) => void;
  onOpenModel: (id: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const [locale, setLocale] = useState('');
  const [status, setStatus] = useState<CmsEntryFilters['status']>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, CmsEntrySummary>>(new Map());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget>({ kind: 'here' });
  const [deleting, setDeleting] = useState<null | { entry: CmsEntrySummary; force: boolean; message?: string }>(null);
  const selecting = selected.size > 0;

  const clearSelection = () => {
    setSelected(new Map());
    setSelectedModel(null);
    setAnchor(null);
  };
  // Any change of filter starts again at page one with nothing selected.
  const resetPaging = () => {
    setPage(1);
    clearSelection();
  };
  // A new folder is a new view, too.
  const [shownType, setShownType] = useState(typeId);
  if (shownType !== typeId) {
    setShownType(typeId);
    resetPaging();
  }

  // Search waits for a pause in typing rather than querying every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      resetPaging();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // At the top level with no search or filter there is nothing to list but the models.
  const filtered = Boolean(locale || status || q);
  const atRoot = !typeId && !filtered;

  // One tile per entry: its languages are versions of it, switched inside the editor.
  const filters: CmsEntryFilters = {
    contentTypeId: typeId || undefined,
    locale: locale || undefined,
    status,
    q: q || undefined,
    page,
    group: 'document',
  };
  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const localesQuery = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const entriesQuery = useQuery({
    queryKey: cmsKeys.entries(tenantId, filters),
    queryFn: () => getCmsEntries(filters, tenantId ?? undefined),
    enabled: !!tenantId && !atRoot,
    placeholderData: keepPreviousData,
  });

  const bulk = useMutation({
    // A selected entry acts in every language it has, as one piece of content.
    mutationFn: ({ action, entries }: { action: BulkAction; entries: CmsEntrySummary[] }) =>
      bulkCmsEntries([...new Set(entries.flatMap(versionIds))], action, tenantId ?? undefined),
    onSuccess: (result, { action }) => {
      invalidateCms(queryClient);
      clearSelection();
      const verb = action === 'publish' ? 'Published' : action === 'unpublish' ? 'Unpublished' : 'Archived';
      if (result.failed.length === 0)
        toast('success', `${verb} ${result.succeeded.length} ${result.succeeded.length === 1 ? 'version' : 'versions'}.`);
      else
        toast(
          'error',
          `${verb} ${result.succeeded.length}; ${result.failed.length} language ${result.failed.length === 1 ? 'version' : 'versions'} could not be — open them to see why.`,
        );
    },
    onError: (error) => toast('error', error.message),
  });

  const duplicate = useMutation({
    mutationFn: (entry: CmsEntrySummary) => duplicateCmsEntry(entry.id, tenantId ?? undefined),
    onSuccess: (copy) => {
      invalidateCms(queryClient);
      toast('success', 'Copy created — opening it now.');
      onOpenEntry(copy.id);
    },
    onError: (error) => toast('error', error.message),
  });

  const restore = useMutation({
    mutationFn: async (entry: CmsEntrySummary) => {
      for (const id of versionIds(entry)) await restoreCmsEntry(id, tenantId ?? undefined);
    },
    onSuccess: () => {
      invalidateCms(queryClient);
      toast('success', 'Restored to draft.');
    },
    onError: (error) => {
      invalidateCms(queryClient);
      toast('error', error.message);
    },
  });

  const remove = useMutation({
    // Every language version goes; one already gone (a forced retry) is not a failure.
    mutationFn: async ({ entry, force }: { entry: CmsEntrySummary; force: boolean }) => {
      for (const id of versionIds(entry)) {
        try {
          await deleteCmsEntry(id, force, tenantId ?? undefined);
        } catch (error) {
          if (!(force && error instanceof ApiError && error.status === 404)) throw error;
        }
      }
    },
    onSuccess: () => {
      invalidateCms(queryClient);
      setDeleting(null);
      clearSelection();
      toast('success', 'Entry deleted.');
    },
    onError: (error, { entry }) => {
      invalidateCms(queryClient);
      if (error instanceof ApiError && error.status === 409) {
        setDeleting({ entry, force: true, message: `${error.message}. Deleting it leaves those links empty on your website.` });
        return;
      }
      setDeleting(null);
      toast('error', error.message);
    },
  });

  const types = typesQuery.data ?? [];
  const openType = types.find((type) => type.id === typeId);
  const locales = localesQuery.data ?? [];
  const localeOptions = [
    { value: '', label: 'All languages' },
    ...locales.map((row) => ({ value: row.code, label: `${row.name} (${row.code})` })),
  ];
  const rows = entriesQuery.data?.data ?? [];
  const total = entriesQuery.data?.total ?? rows.length;
  const pages = entriesQuery.data?.pages ?? 1;
  const busy = bulk.isPending || duplicate.isPending || restore.isPending || remove.isPending;

  if (typesQuery.isSuccess && types.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={FileText}
        title="No models yet"
        description="Entries are written against a model. Create one in Models first."
      />
    );
  }

  const clearFilters = () => {
    setSearch('');
    setQ('');
    setStatus('');
    setLocale('');
    resetPaging();
  };

  const toggle = (entry: CmsEntrySummary) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.set(entry.id, entry);
      return next;
    });
  const fresh = (id: string) => rows.find((row) => row.id === id) ?? selected.get(id)!;

  // ── One click opens; a modifier selects, as a file manager does it ──
  const clickEntry = (event: React.MouseEvent, entry: CmsEntrySummary) => {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!modified || !access.canPublish) {
      if (selecting && access.canPublish) toggle(entry);
      else onOpenEntry(entry.id);
      return;
    }
    const ids = clickSelection(
      rows.map((row) => row.id),
      new Set(selected.keys()),
      anchor,
      entry.id,
      { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey },
    );
    setSelected(new Map([...ids].map((id) => [id, fresh(id)] as const)));
    if (!event.shiftKey) setAnchor(entry.id);
    setSelectedModel(null);
  };
  const clickModel = (event: React.MouseEvent, id: string) => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
      onOpenType(id);
      return;
    }
    setSelected(new Map());
    setSelectedModel(id);
  };

  // ── Right-click ──
  const onMenu = (event: React.MouseEvent) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-media-item], [data-entry-item]');
    if (item?.dataset.mediaItem === 'folder' && item.dataset.path) {
      setMenuTarget({ kind: 'model', id: item.dataset.path });
      setSelected(new Map());
      setSelectedModel(item.dataset.path);
      return;
    }
    const entry = item?.dataset.entryItem ? rows.find((row) => row.id === item.dataset.entryItem) : undefined;
    if (entry) {
      // Right-clicking outside the selection selects just that entry, as a file manager does.
      if (access.canPublish && !selected.has(entry.id)) {
        setSelected(new Map([[entry.id, entry]]));
        setAnchor(entry.id);
      }
      setSelectedModel(null);
      setMenuTarget({ kind: 'entry', entry });
      return;
    }
    setMenuTarget({ kind: 'here' });
  };
  const many = menuTarget.kind === 'entry' && selected.has(menuTarget.entry.id) && selected.size > 1;

  const bulkItems = (entries: CmsEntrySummary[], suffix = '') => (
    <>
      <ContextMenuItem icon={Send} disabled={busy} onSelect={() => bulk.mutate({ action: 'publish', entries })}>
        Publish{suffix}
      </ContextMenuItem>
      <ContextMenuItem icon={EyeOff} disabled={busy} onSelect={() => bulk.mutate({ action: 'unpublish', entries })}>
        Unpublish{suffix}
      </ContextMenuItem>
      <ContextMenuItem icon={Archive} disabled={busy} onSelect={() => bulk.mutate({ action: 'archive', entries })}>
        Archive{suffix}
      </ContextMenuItem>
    </>
  );

  const menu = () => {
    if (menuTarget.kind === 'model') {
      const type = types.find((row) => row.id === menuTarget.id);
      if (!type) return null;
      return (
        <>
          <ContextMenuItem icon={FolderOpen} shortcut="↵" onSelect={() => onOpenType(type.id)}>
            Open
          </ContextMenuItem>
          {access.canWrite && (type.kind === 'collection' || !type.entryCount) && (
            <ContextMenuItem icon={Plus} onSelect={() => onNewEntry(type.id)}>
              New {type.name} entry
            </ContextMenuItem>
          )}
          {access.canModel && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Layers} onSelect={() => onOpenModel(type.id)}>
                Edit model
              </ContextMenuItem>
            </>
          )}
        </>
      );
    }
    if (menuTarget.kind === 'entry' && many) {
      const entries = [...selected.keys()].map(fresh);
      return (
        <>
          <ContextMenuLabel>{entries.length} entries</ContextMenuLabel>
          {bulkItems(entries, ` ${entries.length} entries`)}
        </>
      );
    }
    if (menuTarget.kind === 'entry') {
      const entry = menuTarget.entry;
      const archived = entry.status === 'archived';
      const live = entry.status === 'published' || entry.status === 'changed';
      return (
        <>
          <ContextMenuItem icon={Eye} shortcut="↵" onSelect={() => onOpenEntry(entry.id)}>
            Open
          </ContextMenuItem>
          <ContextMenuItem icon={ExternalLink} onSelect={() => window.open(entryHref(entry.id), '_blank', 'noopener')}>
            Open in new tab
          </ContextMenuItem>
          <ContextMenuItem
            icon={Link2}
            onSelect={() =>
              void copyText(entryHref(entry.id)).then((copied) =>
                toast(copied ? 'success' : 'error', copied ? 'Link copied.' : 'Copy failed — open the entry and copy the address.'),
              )
            }
          >
            Copy link
          </ContextMenuItem>
          {(access.canWrite || access.canPublish) && <ContextMenuSeparator />}
          {access.canWrite && entry.contentType.kind === 'collection' && (
            <ContextMenuItem icon={Copy} disabled={busy} onSelect={() => duplicate.mutate(entry)}>
              Duplicate
            </ContextMenuItem>
          )}
          {access.canPublish && !archived && entry.status !== 'published' && (
            <ContextMenuItem icon={Send} disabled={busy} onSelect={() => bulk.mutate({ action: 'publish', entries: [entry] })}>
              Publish
            </ContextMenuItem>
          )}
          {access.canPublish && live && (
            <ContextMenuItem icon={EyeOff} disabled={busy} onSelect={() => bulk.mutate({ action: 'unpublish', entries: [entry] })}>
              Unpublish
            </ContextMenuItem>
          )}
          {access.canPublish && !archived && (
            <ContextMenuItem icon={Archive} disabled={busy} onSelect={() => bulk.mutate({ action: 'archive', entries: [entry] })}>
              Archive
            </ContextMenuItem>
          )}
          {access.canWrite && archived && (
            <ContextMenuItem icon={RotateCcw} disabled={busy} onSelect={() => restore.mutate(entry)}>
              Restore to draft
            </ContextMenuItem>
          )}
          {access.canModel && (
            <ContextMenuItem icon={Layers} onSelect={() => onOpenModel(entry.contentType.id)}>
              Edit the {entry.contentType.name} model
            </ContextMenuItem>
          )}
          {access.canPublish && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Trash2} danger disabled={busy} onSelect={() => setDeleting({ entry, force: false })}>
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
          <ContextMenuItem icon={Plus} onSelect={() => onNewEntry(typeId || undefined)}>
            {openType ? `New ${openType.name} entry` : 'New entry'}
          </ContextMenuItem>
        )}
        {access.canPublish && rows.length > 0 && !atRoot && (
          <ContextMenuItem icon={Check} onSelect={() => setSelected(new Map(rows.map((row) => [row.id, row] as const)))}>
            Select all on this page
          </ContextMenuItem>
        )}
        {access.canModel && openType && (
          <ContextMenuItem icon={Layers} onSelect={() => onOpenModel(openType.id)}>
            Edit model
          </ContextMenuItem>
        )}
        {!access.canWrite && !access.canModel && !(access.canPublish && rows.length > 0 && !atRoot) && (
          <ContextMenuLabel>Right-click an entry for its actions</ContextMenuLabel>
        )}
      </>
    );
  };

  const entryGrid = (
    <ul className={GRID_CLASS}>
      {rows.map((entry) => {
        const isSelected = selected.has(entry.id);
        const scheduled = entry.scheduledPublishAt ?? entry.scheduledUnpublishAt;
        const Icon = entry.contentType.kind === 'singleton' ? Box : FileText;
        return (
          <li key={entry.id} className="group relative">
            <button
              type="button"
              data-entry-item={entry.id}
              aria-pressed={access.canPublish ? isSelected : undefined}
              onClick={(event) => clickEntry(event, entry)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                onOpenEntry(entry.id);
              }}
              className={cn(
                'block w-full overflow-hidden rounded-lg border bg-background text-left transition-[border-color,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-rule/55 hover:border-rule',
              )}
            >
              <span className="relative flex aspect-4/3 w-full flex-col items-center justify-center gap-1.5 bg-band/60 px-3 text-muted-foreground">
                <Icon size={24} aria-hidden="true" />
                {entry.slug && <span className="max-w-full truncate font-mono text-xs">/{entry.slug}</span>}
                {/* The languages it is in, along the foot of the preview. */}
                {locales.length > 1 && (
                  <span className="absolute inset-x-2 bottom-2 overflow-hidden">
                    <LanguageChips versions={entry.localizations ?? [{ id: entry.id, locale: entry.locale, status: entry.status }]} />
                  </span>
                )}
              </span>
              <span className="block truncate px-2.5 pt-2 text-xs font-semibold text-foreground">
                {entry.title ?? <span className="font-medium italic text-muted-foreground">Untitled</span>}
              </span>
              <span className="block truncate px-2.5 pb-2 text-xs tabular-nums text-muted-foreground">
                {/* Results from every model say which one each comes from. */}
                {!typeId && `${entry.contentType.name} · `}
                <RelativeTime iso={entry.updatedAt} />
              </span>
            </button>
            {/* Its status over the preview, as Media flags a file. */}
            <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1">
              {scheduled && (
                <span
                  className="flex size-6 items-center justify-center rounded-md bg-background/95 text-reference shadow-sm"
                  role="img"
                  aria-label={
                    entry.scheduledPublishAt
                      ? `Publishes ${when(entry.scheduledPublishAt)}`
                      : `Comes down ${when(entry.scheduledUnpublishAt!)}`
                  }
                >
                  <Clock size={13} aria-hidden="true" />
                </span>
              )}
              <EntryStatusBadge status={entry.status} className="shadow-sm" />
            </span>
            {access.canPublish && (
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
                  onChange={() => toggle(entry)}
                  aria-label={`Select ${entry.title ?? 'untitled entry'}`}
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

  const body = atRoot ? (
    typesQuery.isError ? (
      <PanelError title="Models couldn’t be loaded" onRetry={() => void typesQuery.refetch()} />
    ) : typesQuery.isPending ? (
      <LoadingState label="Loading entries" />
    ) : (
      <section aria-label="Models" className="space-y-2">
        <h3 className="text-label uppercase text-muted-foreground">Models</h3>
        <ul className={GRID_CLASS}>
          {types.map((type) => (
            <li key={type.id}>
              <FolderTile
                path={type.id}
                name={type.name}
                count={type.entryCount ?? 0}
                selected={selectedModel === type.id}
                dropTarget={false}
                onClick={(event) => clickModel(event, type.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  onOpenType(type.id);
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    )
  ) : entriesQuery.isError ? (
    <PanelError title="Entries couldn’t be loaded" onRetry={() => void entriesQuery.refetch()} />
  ) : entriesQuery.isPending ? (
    <LoadingState label="Loading entries" />
  ) : rows.length === 0 ? (
    filtered ? (
      <EmptyState
        className="flex-1"
        kind="search"
        icon={Search}
        title="No entries match"
        description={
          typeId ? 'Try another search, status or language.' : 'Try another search, status or language. Results come from every model.'
        }
        action={{ label: 'Clear filters', onClick: clearFilters, icon: X }}
      />
    ) : (
      <EmptyState
        className="flex-1"
        icon={FolderOpen}
        title={access.canWrite ? `Write your first ${openType ? `${openType.name} ` : ''}entry` : 'No entries yet'}
        description="An entry is one piece of content — a post, a page, a banner — shaped by its model."
        action={access.canWrite ? { label: 'New entry', onClick: () => onNewEntry(typeId || undefined), icon: Plus } : undefined}
      />
    )
  ) : (
    <>
      {entryGrid}
      {pager}
    </>
  );

  const crumbs = [{ id: '', name: 'Entries' }, ...(typeId ? [{ id: typeId, name: openType?.name ?? 'Model' }] : [])];

  return (
    <div
      className="flex flex-1 flex-col gap-3"
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        if (event.key === 'Escape' && (selecting || selectedModel)) clearSelection();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            aria-label="Search entries"
            placeholder={openType ? `Search ${openType.name} by title, text or slug` : 'Search every model by title, text or slug'}
            leftIcon={<Search size={14} aria-hidden="true" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          ariaLabel="Status"
          className="w-40"
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : (value as StatusFilter));
            resetPaging();
          }}
          options={STATUS_OPTIONS}
        />
        {/* One language needs no language filter. */}
        {locales.length > 1 && (
          <Select
            ariaLabel="Language"
            className="w-40"
            value={locale}
            onValueChange={(value) => {
              setLocale(value);
              resetPaging();
            }}
            options={localeOptions}
          />
        )}
      </div>

      {selecting && (
        <div className="flex min-h-9 flex-wrap items-center gap-2" role="region" aria-label="Bulk actions">
          <>
            <span className="mr-auto text-sm font-semibold tabular-nums text-foreground">{selected.size} selected</span>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => bulk.mutate({ action: 'publish', entries: [...selected.values()] })}
            >
              <Send size={13} aria-hidden="true" /> Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busy}
              onClick={() => bulk.mutate({ action: 'unpublish', entries: [...selected.values()] })}
            >
              <EyeOff size={13} aria-hidden="true" /> Unpublish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busy}
              onClick={() => bulk.mutate({ action: 'archive', entries: [...selected.values()] })}
            >
              <Archive size={13} aria-hidden="true" /> Archive
            </Button>
            <Tooltip side="top" align="end" label="Clear selection">
              <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={clearSelection}>
                <X size={14} aria-hidden="true" />
              </Button>
            </Tooltip>
          </>
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild onContextMenu={onMenu}>
          <div
            className="flex min-h-[50vh] min-w-0 flex-1 flex-col gap-4"
            // A click on empty space clears the selection.
            onClick={(event) => {
              if (!(event.target as HTMLElement).closest('[data-media-item], [data-entry-item], button, input, label, a')) clearSelection();
            }}
          >
            {body}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>{menu()}</ContextMenuContent>
      </ContextMenu>

      {/* Location stays at the foot of the browser, separate from filtering and selection. */}
      <div className="sticky bottom-0 z-10 mt-auto flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-t border-rule/60 bg-background py-1">
        {atRoot || typeId ? (
          <>
            <nav aria-label="Folder" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
              {crumbs.map((step, index) => {
                const current = index === crumbs.length - 1;
                return (
                  <span key={step.id} className="flex min-w-0 shrink-0 items-center gap-0.5">
                    {index > 0 && <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <button
                      type="button"
                      aria-current={current ? 'location' : undefined}
                      onClick={() => onOpenType(step.id)}
                      className={cn(
                        'max-w-56 truncate rounded-md border border-transparent px-2 py-1 text-sm transition-colors',
                        current ? 'font-semibold text-foreground' : 'text-muted-foreground hover:bg-band/60 hover:text-foreground',
                      )}
                    >
                      {step.name}
                    </button>
                  </span>
                );
              })}
            </nav>
            {!atRoot && entriesQuery.isSuccess && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {total} {total === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">Results from every model</p>
            <button type="button" onClick={clearFilters} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Clear filters
            </button>
          </>
        )}
      </div>

      {deleting && (
        <ConfirmModal
          title={`Delete “${deleting.entry.title ?? 'Untitled'}”?`}
          message={
            deleting.message ??
            `${versionIds(deleting.entry).length > 1 ? `All ${versionIds(deleting.entry).length} language versions are deleted. ` : ''}This can’t be undone.`
          }
          confirmLabel={deleting.force ? 'Delete anyway' : 'Delete entry'}
          isPending={remove.isPending}
          onConfirm={() => remove.mutate({ entry: deleting.entry, force: deleting.force })}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
