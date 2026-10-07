'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Archive, Box, ChevronLeft, ChevronRight, Clock, EyeOff, FileText, Layers, Plus, Search, Send, X } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type CmsEntryFilters, bulkCmsEntries, getCmsContentTypes, getCmsEntries, getCmsLocales } from '@/lib/modules/cms/client';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { RowTile } from './rows';
import { EntryStatusBadge, LanguageChips, PanelError, cmsKeys, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

type StatusFilter = NonNullable<CmsEntryFilters['status']>;

const STATUS_OPTIONS: Array<{ value: StatusFilter | 'all'; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'draft', label: 'Drafts' },
  { value: 'live', label: 'Live' },
  { value: 'changed', label: 'Changed' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'review', label: 'In review' },
  { value: 'archived', label: 'Archived' },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function EntriesPanel({
  initialTypeId,
  onTypeChange,
  onOpenEntry,
  onNewEntry,
}: {
  initialTypeId: string;
  onTypeChange: (id: string) => void;
  onOpenEntry: (id: string) => void;
  onNewEntry: (contentTypeId?: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const [contentTypeId, setContentTypeId] = useState(initialTypeId);
  const [locale, setLocale] = useState('');
  const [status, setStatus] = useState<CmsEntryFilters['status']>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Search waits for a pause in typing rather than querying every keystroke.
  // Any change of filter starts again at page one with nothing selected.
  const resetPaging = () => {
    setPage(1);
    setSelected(new Set());
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      resetPaging();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // One row per entry: its languages are versions of it, switched inside the editor.
  const filters: CmsEntryFilters = {
    contentTypeId: contentTypeId || undefined,
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
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  });

  const bulk = useMutation({
    // A selected entry acts in every language it has, as one piece of content.
    mutationFn: (action: 'publish' | 'unpublish' | 'archive') => {
      const ids = rows.filter((row) => selected.has(row.id)).flatMap((row) => row.localizations?.map((version) => version.id) ?? [row.id]);
      return bulkCmsEntries([...new Set(ids)], action, tenantId ?? undefined);
    },
    onSuccess: (result, action) => {
      invalidateCms(queryClient);
      setSelected(new Set());
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

  const types = typesQuery.data ?? [];
  const typeOptions = [{ value: '', label: 'All models' }, ...types.map((type) => ({ value: type.id, label: type.name }))];
  const locales = localesQuery.data ?? [];
  const localeOptions = [
    { value: '', label: 'All languages' },
    ...locales.map((row) => ({ value: row.code, label: `${row.name} (${row.code})` })),
  ];
  const filtered = Boolean(contentTypeId || locale || status || q);
  const rows = entriesQuery.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const total = entriesQuery.data?.total ?? rows.length;
  const pages = entriesQuery.data?.pages ?? 1;
  const clearFilters = () => {
    setSearch('');
    setQ('');
    setStatus('');
    setLocale('');
    setContentTypeId('');
    onTypeChange('');
    resetPaging();
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            aria-label="Search entries"
            placeholder="Search titles, text and slugs"
            leftIcon={<Search size={14} aria-hidden="true" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          ariaLabel="Model"
          className="w-44"
          value={contentTypeId}
          onValueChange={(value) => {
            setContentTypeId(value);
            resetPaging();
            onTypeChange(value);
          }}
          options={typeOptions}
        />
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

      {entriesQuery.isError ? (
        <PanelError title="Entries couldn’t be loaded" onRetry={() => void entriesQuery.refetch()} />
      ) : entriesQuery.isPending ? (
        <div className="overflow-hidden rounded-lg border border-rule/60 bg-control">
          <ListSkeleton rows={6} />
        </div>
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState
            className="flex-1"
            kind="search"
            icon={Search}
            title="No entries match"
            description="Try another status, model or language."
            action={{ label: 'Clear filters', onClick: clearFilters, icon: X }}
          />
        ) : (
          <EmptyState
            className="flex-1"
            icon={FileText}
            title={access.canWrite ? 'Write your first entry' : 'No entries yet'}
            description="An entry is one piece of content — a post, a page, a banner — shaped by its model."
            action={access.canWrite ? { label: 'New entry', onClick: () => onNewEntry(contentTypeId || undefined), icon: Plus } : undefined}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule/60 bg-control">
          {/* The card's header: the count, or — once something is selected — what to do with it. */}
          <div
            className="flex min-h-12 flex-wrap items-center gap-2 border-b border-rule/50 px-3 py-2"
            role={selected.size > 0 ? 'region' : undefined}
            aria-label={selected.size > 0 ? 'Bulk actions' : undefined}
          >
            {access.canPublish && (
              <input
                type="checkbox"
                aria-label="Select all entries on this page"
                className="size-4 shrink-0 rounded accent-primary"
                checked={allSelected}
                ref={(node) => {
                  if (node) node.indeterminate = selected.size > 0 && !allSelected;
                }}
                onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))}
              />
            )}
            {selected.size > 0 ? (
              <>
                <span className="mr-auto text-sm font-semibold tabular-nums text-foreground">{selected.size} selected</span>
                <Button size="sm" className="gap-1.5" disabled={bulk.isPending} onClick={() => bulk.mutate('publish')}>
                  <Send size={13} aria-hidden="true" /> Publish
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={bulk.isPending} onClick={() => bulk.mutate('unpublish')}>
                  <EyeOff size={13} aria-hidden="true" /> Unpublish
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={bulk.isPending} onClick={() => bulk.mutate('archive')}>
                  <Archive size={13} aria-hidden="true" /> Archive
                </Button>
                <Tooltip side="top" align="end" label="Clear selection">
                  <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
                    <X size={14} aria-hidden="true" />
                  </Button>
                </Tooltip>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-foreground">
                  <span className="tabular-nums">{total}</span> {total === 1 ? 'entry' : 'entries'}
                </span>
                {filtered && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Clear filters
                  </button>
                )}
              </>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                {access.canPublish && <th>Select</th>}
                <th>Entry</th>
                <th>Languages</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/40">
              {rows.map((entry) => {
                const scheduled = entry.scheduledPublishAt ?? entry.scheduledUnpublishAt;
                const isSelected = selected.has(entry.id);
                return (
                  <tr
                    key={entry.id}
                    className={isSelected ? 'cursor-pointer bg-primary/5' : 'cursor-pointer transition-colors hover:bg-band/40'}
                    onClick={() => onOpenEntry(entry.id)}
                  >
                    {access.canPublish && (
                      <td className="w-10 py-2.5 pl-3" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${entry.title ?? 'untitled entry'}`}
                          className="size-4 rounded accent-primary"
                          checked={isSelected}
                          onChange={() => toggle(entry.id)}
                        />
                      </td>
                    )}
                    <td className="max-w-0 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <RowTile icon={entry.contentType.kind === 'singleton' ? Box : Layers} />
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            className="block w-full truncate text-left font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenEntry(entry.id);
                            }}
                          >
                            {entry.title ?? <span className="font-medium italic text-muted-foreground">Untitled</span>}
                          </button>
                          <span className="block truncate text-xs text-muted-foreground">
                            {entry.contentType.name}
                            {entry.slug && <span className="font-mono"> · /{entry.slug}</span>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden w-px whitespace-nowrap px-3 py-2.5 sm:table-cell">
                      <LanguageChips versions={entry.localizations ?? [{ id: entry.id, locale: entry.locale, status: entry.status }]} />
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <EntryStatusBadge status={entry.status} />
                        {scheduled && (
                          <Tooltip
                            side="top"
                            align="end"
                            label={
                              entry.scheduledPublishAt
                                ? `Publishes ${when(entry.scheduledPublishAt)}`
                                : `Comes down ${when(entry.scheduledUnpublishAt!)}`
                            }
                          >
                            <span className="flex size-6 items-center justify-center rounded-md text-reference" aria-label="Scheduled">
                              <Clock size={13} aria-hidden="true" />
                            </span>
                          </Tooltip>
                        )}
                      </span>
                    </td>
                    <td className="hidden w-px whitespace-nowrap py-2.5 pl-3 pr-4 text-right text-xs tabular-nums text-muted-foreground lg:table-cell">
                      <RelativeTime iso={entry.updatedAt} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-rule/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                Page {entriesQuery.data!.page} of {pages}
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
        </div>
      )}
    </div>
  );
}
