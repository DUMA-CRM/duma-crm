'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Box, ChevronRight, FileText, Layers, Plus, Search } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Input } from '@/components/ui/input';

import { type CmsContentType, getCmsContentTypes } from '@/lib/modules/cms/client';
import { FIELD_TYPES } from '@/lib/utils/cms';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { FIELD_ICONS } from './fieldIcons';
import { InfoRow, InfoRows, RowTile, SectionInfo } from './rows';
import { cmsKeys } from './shared';

type ModelWithCounts = CmsContentType & { entryCount?: number; publishedCount?: number };

/**
 * Content models in the editors' vocabulary: model rows with outlined tiles in
 * the main column; the workspace's shape and the field palette in the aside. "New model" lives in the page header.
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
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const types = useMemo(() => [...((query.data ?? []) as ModelWithCounts[])].sort((a, b) => a.name.localeCompare(b.name)), [query.data]);
  const needle = search.trim().toLowerCase();
  const shown = needle ? types.filter((type) => type.name.toLowerCase().includes(needle) || type.key.includes(needle)) : types;

  // No model yet: the one useful thing is to make one — Ask DUMA is waiting inside.
  if (query.isSuccess && types.length === 0) {
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

  return (
    <SettingsTabBody aside={<ModelsAside types={types} loaded={query.isSuccess} />} narrowAside>
      <SettingsSection
        title="Content models"
        actions={
          <div className="flex items-center gap-2">
            {query.isSuccess && <span className="text-xs tabular-nums text-muted-foreground">{types.length}</span>}
            <SectionInfo label="Each model is the shape of something your website shows. Websites query a model by its API key, so the key never changes once created." />
          </div>
        }
      >
        {query.isPending ? (
          <TilesSkeleton count={3} label="Loading content models" />
        ) : query.isError ? (
          <ErrorState title="Couldn’t load your content models" onRetry={() => void query.refetch()} />
        ) : (
          <div className="space-y-3">
            {types.length > 6 && (
              <Input
                aria-label="Find a model"
                placeholder="Find a model"
                value={search}
                leftIcon={<Search size={14} aria-hidden="true" />}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            {shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No model matches “{search.trim()}”.</p>
            ) : (
              <motion.ul initial="hidden" animate="shown" className="space-y-2">
                {shown.map((type, index) => (
                  <motion.li
                    key={type.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03 } }}
                  >
                    <ModelRow type={type} onOpen={() => onOpenModel(type.id)} onBrowseEntries={() => onBrowseEntries(type.id)} />
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        )}
      </SettingsSection>
    </SettingsTabBody>
  );
}

/** One model: tile, name and key on the left; its numbers, Entries and a chevron on the right. */
function ModelRow({ type, onOpen, onBrowseEntries }: { type: ModelWithCounts; onOpen: () => void; onBrowseEntries: () => void }) {
  const singleton = type.kind === 'singleton';
  const live = type.publishedCount ?? 0;
  const total = type.entryCount ?? 0;
  const fieldCount = type.fields.length;
  return (
    <div className="group flex items-center gap-1 rounded-lg border border-rule/50 bg-control pr-1.5 transition-colors hover:border-rule">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-l-lg py-2.5 pl-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <RowTile icon={singleton ? Box : Layers} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{type.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            <span className="font-mono">{type.key}</span> · {singleton ? 'Singleton' : 'Collection'}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
          <span className="block">
            {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
          </span>
          <span className="block">
            Changed <RelativeTime iso={type.updatedAt} />
          </span>
        </span>
      </button>
      <Tooltip side="top" align="end" label={total === 0 ? 'No entries yet — open the list' : `${live} live of ${total} — open the list`}>
        <button
          type="button"
          onClick={onBrowseEntries}
          aria-label={`${type.name} entries`}
          className="ml-2 flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-rule/55 bg-background px-2.5 text-xs font-semibold tabular-nums text-foreground transition-colors hover:border-rule hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <FileText size={13} className="text-muted-foreground" aria-hidden="true" />
          {total}
          {live > 0 && <span className="size-1.5 rounded-full bg-momentum" aria-hidden="true" />}
        </button>
      </Tooltip>
      <ChevronRight
        size={16}
        className="ml-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </div>
  );
}

function ModelsAside({ types, loaded }: { types: ModelWithCounts[]; loaded: boolean }) {
  const collections = types.filter((type) => type.kind !== 'singleton').length;
  const singletons = types.length - collections;
  const entries = types.reduce((sum, type) => sum + (type.entryCount ?? 0), 0);
  const live = types.reduce((sum, type) => sum + (type.publishedCount ?? 0), 0);
  const count = (value: number) => (loaded ? value : '—');
  return (
    <>
      <SettingsSection title="Overview">
        <InfoRows>
          <InfoRow icon={Layers} title="Collections">
            <Tooltip side="top" align="end" wrap label="Many entries of one shape — blog posts, menu sections, locations.">
              <span className="text-sm tabular-nums text-muted-foreground">{count(collections)}</span>
            </Tooltip>
          </InfoRow>
          <InfoRow icon={Box} title="Singletons">
            <Tooltip side="top" align="end" wrap label="Exactly one entry — the site banner, the footer, opening hours.">
              <span className="text-sm tabular-nums text-muted-foreground">{count(singletons)}</span>
            </Tooltip>
          </InfoRow>
          <InfoRow icon={FileText} title="Entries">
            <span className="text-sm tabular-nums text-muted-foreground">
              {loaded ? (
                <>
                  <span className="text-foreground">{live}</span> live of {entries}
                </>
              ) : (
                '—'
              )}
            </span>
          </InfoRow>
        </InfoRows>
      </SettingsSection>
      <SettingsSection
        title="Field types"
        actions={
          <SectionInfo label="What a model is built from. Any field can be required, or private — kept in DUMA and never sent to your website." />
        }
      >
        <ul className="flex flex-wrap gap-1.5">
          {FIELD_TYPES.map((entry) => {
            const Icon = FIELD_ICONS[entry.type];
            return (
              <li key={entry.type}>
                <Tooltip side="top" wrap label={entry.description}>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-rule/55 bg-control px-2 py-1 text-xs font-medium text-foreground">
                    <Icon size={12} className="text-muted-foreground" aria-hidden="true" />
                    {entry.label}
                  </span>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </SettingsSection>
    </>
  );
}
