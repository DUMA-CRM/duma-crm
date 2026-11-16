'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Box, FileText, Layers, Plus, Search, X } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Input } from '@/components/ui/input';

import { type CmsContentType, getCmsContentTypes } from '@/lib/modules/cms/client';
import { useCmsTenantId } from '@/components/cms/ContentScope';

import { cmsKeys } from './shared';

type ModelWithCounts = CmsContentType & { entryCount?: number; publishedCount?: number };

/**
 * Content models as a list, like Staff → Team: a search with the count beside
 * it, then Collections and Singletons as two titled lists of rows. A row opens
 * the model; its entries count opens their list. "New model" lives in the page
 * header.
 */
export function ModelsPanel({
  onOpenModel,
  onNewModel,
  onBrowseEntries,
}: {
  onOpenModel: (id: string) => void;
  /** Open a new model — with a description, Ask DUMA starts building it there. */
  onNewModel?: () => void;
  onBrowseEntries: (contentTypeId: string) => void;
}) {
  const tenantId = useCmsTenantId();
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const types = useMemo(() => [...((query.data ?? []) as ModelWithCounts[])].sort((a, b) => a.name.localeCompare(b.name)), [query.data]);

  if (query.isPending) return <ListSkeleton rows={4} label="Loading your content models" />;
  if (query.isError) return <ErrorState title="Couldn’t load your content models" onRetry={() => void query.refetch()} />;

  // No model yet: the one useful thing is to make one — Ask DUMA is waiting inside.
  if (types.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={Layers}
        title={onNewModel ? 'Create your first model' : 'No content models yet'}
        description={
          onNewModel
            ? 'A model is the shape of something your website shows — a blog post, a menu special, the footer. Describe it and Ask DUMA builds it.'
            : 'Someone who can edit models needs to create one first.'
        }
        action={onNewModel ? { label: 'New model', onClick: onNewModel, icon: Plus } : undefined}
      />
    );
  }

  const needle = search.trim().toLowerCase();
  const shown = needle ? types.filter((type) => type.name.toLowerCase().includes(needle) || type.key.includes(needle)) : types;
  const groups = [
    { id: 'models-collections', title: 'Collections', rows: shown.filter((type) => type.kind !== 'singleton') },
    { id: 'models-singletons', title: 'Singletons', rows: shown.filter((type) => type.kind === 'singleton') },
  ].filter((group) => group.rows.length > 0);

  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      className="flex flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 basis-full sm:max-w-sm sm:min-w-56 sm:basis-auto sm:flex-1">
          <Input
            type="search"
            aria-label="Find a model"
            placeholder="Name or API key…"
            value={search}
            leftIcon={<Search size={14} aria-hidden="true" />}
            onChange={(event) => setSearch(event.target.value)}
            rightAction={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : undefined
            }
          />
        </div>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {shown.length === types.length
            ? `${types.length} ${types.length === 1 ? 'model' : 'models'}`
            : `${shown.length} of ${types.length}`}
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Search}
          kind="search"
          title="No model matches"
          description="Try a different name or API key."
          action={{ label: 'Clear search', onClick: () => setSearch('') }}
        />
      ) : (
        groups.map((group) => (
          <RecordGroup key={group.id} id={group.id} title={group.title}>
            <ListRowGroup aria-label={group.title}>
              {group.rows.map((type) => (
                <ModelRow key={type.id} type={type} onOpen={() => onOpenModel(type.id)} onBrowseEntries={() => onBrowseEntries(type.id)} />
              ))}
            </ListRowGroup>
          </RecordGroup>
        ))
      )}
    </motion.div>
  );
}

/** One model: tile, name over its key and shape; its entries count beside it opens their list. The row opens the model. */
function ModelRow({ type, onOpen, onBrowseEntries }: { type: ModelWithCounts; onOpen: () => void; onBrowseEntries: () => void }) {
  const live = type.publishedCount ?? 0;
  const total = type.entryCount ?? 0;
  const fieldCount = type.fields.length;
  return (
    <ListRow
      icon={type.kind === 'singleton' ? Box : Layers}
      title={type.name}
      onClick={onOpen}
      meta={
        <>
          <span className="font-mono">{type.key}</span> · {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
          <span className="hidden sm:inline">
            {' '}
            · changed <RelativeTime iso={type.updatedAt} />
          </span>
        </>
      }
      control={
        <Tooltip side="top" align="end" label={total === 0 ? 'No entries yet — open the list' : `${live} live of ${total} — open the list`}>
          <button
            type="button"
            onClick={onBrowseEntries}
            aria-label={`${type.name} entries`}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <FileText size={13} aria-hidden="true" />
            {total}
            {live > 0 && <span className="size-1.5 rounded-full bg-momentum" aria-hidden="true" />}
          </button>
        </Tooltip>
      }
    />
  );
}
