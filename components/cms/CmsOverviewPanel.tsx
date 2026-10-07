'use client';

import { useQuery } from '@tanstack/react-query';

import { Clock, FileText, ImageIcon, KeyRound, Layers, Pencil, Send, Users } from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListRow } from '@/components/shared/ListRow';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Pill } from '@/components/shared/Pill';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';

import { getCmsContentTypes, getCmsOverview } from '@/lib/modules/cms/client';
import { type CmsAttention, cmsAttention, formatBytes } from '@/lib/utils/cms';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { LanguageChips, PanelError, cmsKeys } from './shared';
import { useCmsAccess } from './useCmsAccess';

type OverviewTab = 'entries' | 'models' | 'media' | 'developers';

/**
 * The Content front door, laid out as Communications' is: four fact tiles,
 * the folded "needs you" card, then two activity lists side by side — what was
 * edited, and the models it was written against. Counts are per entry, and
 * each entry appears once whatever languages it is written in.
 */
export function CmsOverviewPanel({
  onOpenEntry,
  onOpenTab,
  onNewModel,
}: {
  onOpenEntry: (id: string) => void;
  onOpenTab: (tab: OverviewTab) => void;
  onNewModel?: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const access = useCmsAccess();
  const query = useQuery({
    queryKey: cmsKeys.overview(tenantId),
    queryFn: () => getCmsOverview(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  if (query.isError) return <PanelError title="The content overview couldn’t be loaded" onRetry={() => void query.refetch()} />;

  const overview = query.data;
  if (overview && overview.contentTypes === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={Layers}
        title={onNewModel ? 'Model your first content type' : 'No content model yet'}
        description="A content type is the shape of something your website shows — a blog post, a menu section, an opening-hours banner. Define its fields once, then write as many entries as you like and fetch them over the delivery API."
        action={onNewModel ? { label: 'Create a content type', onClick: onNewModel, icon: Layers } : undefined}
      />
    );
  }

  const loading = query.isPending;
  const entries = overview?.entries;
  const count = (value: number | undefined) => (loading || value === undefined ? '—' : value.toLocaleString());

  const toItem = (issue: CmsAttention): NeedsAttentionItem => {
    const plural = issue.count === 1 ? 'entry has' : 'entries have';
    switch (issue.kind) {
      case 'no_api_key':
        return {
          key: 'no-api-key',
          icon: KeyRound,
          tone: issue.tone,
          title: 'No API key yet',
          detail: 'Content is live, but no website can read it until a key exists.',
          fix: { label: 'Create key', run: () => onOpenTab('developers') },
        };
      case 'unpublished_changes':
        return {
          key: 'changes',
          icon: Pencil,
          tone: issue.tone,
          title: `${issue.count} ${plural} changes that aren’t live`,
          detail: 'Websites still get the last published version.',
          fix: { label: 'Review', run: () => onOpenTab('entries') },
        };
      case 'never_published':
        return {
          key: 'drafts',
          icon: FileText,
          tone: issue.tone,
          title: `${issue.count} ${issue.count === 1 ? 'entry has' : 'entries have'} never been published`,
          detail: 'Drafts are invisible to websites.',
          fix: { label: 'Review', run: () => onOpenTab('entries') },
        };
      case 'awaiting_review':
        return {
          key: 'review',
          icon: Users,
          tone: issue.tone,
          title: `${issue.count} ${issue.count === 1 ? 'entry is' : 'entries are'} waiting for your review`,
          detail: 'Publish to approve, or send back with a note.',
          fix: { label: 'Review', run: () => onOpenTab('entries') },
        };
      case 'scheduled':
        return {
          key: 'scheduled',
          icon: Clock,
          tone: issue.tone,
          title: `${issue.count} ${issue.count === 1 ? 'entry is' : 'entries are'} scheduled`,
          detail: 'They publish or come down on their own at the set time.',
          fix: { label: 'Show', run: () => onOpenTab('entries') },
        };
    }
  };

  const models = [...(typesQuery.data ?? [])].sort((a, b) => (b.entryCount ?? 0) - (a.entryCount ?? 0));

  return (
    <div className="space-y-5">
      {/* The same four-tile row as Communications and Inventory — facts to read. */}
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          surface="page"
          icon={Send}
          label="Live entries"
          value={count(entries?.live)}
          hint={entries ? (entries.total === 0 ? 'Nothing written yet' : `of ${entries.total.toLocaleString()} entries`) : undefined}
          onSelect={() => onOpenTab('entries')}
        />
        <Fact
          surface="page"
          icon={Pencil}
          label="Unpublished changes"
          value={count(entries?.changed)}
          tone={entries && entries.changed > 0 ? 'warning' : 'default'}
          hint={entries && entries.changed > 0 ? 'Edits websites can’t see yet' : 'Everything live is up to date'}
          onSelect={entries && entries.changed > 0 ? () => onOpenTab('entries') : undefined}
        />
        <Fact
          surface="page"
          icon={Layers}
          label="Content models"
          value={count(overview?.contentTypes)}
          hint={overview ? `${overview.locales} ${overview.locales === 1 ? 'language' : 'languages'}` : undefined}
          onSelect={() => onOpenTab('models')}
        />
        <Fact
          surface="page"
          icon={ImageIcon}
          label="Media"
          value={count(overview?.assets.count)}
          hint={overview ? formatBytes(overview.assets.bytes) : undefined}
          onSelect={() => onOpenTab('media')}
        />
      </dl>

      {loading || !overview ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3.5"
          role="status"
          aria-busy="true"
          aria-label="Checking what needs attention"
        >
          <Bone className="size-10 shrink-0" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-3.5 w-36" />
            <Bone className="h-3 w-72 max-w-full" />
          </span>
        </div>
      ) : (
        <NeedsAttention
          items={cmsAttention(overview, { canManageKeys: access.canManageKeys, canPublish: access.canPublish }).map(toItem)}
          clear={{ title: 'Nothing needs you', detail: 'Everything written is live and up to date.' }}
        />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ActivitySection title="Recently edited" actionLabel="All entries" onAction={() => onOpenTab('entries')} loading={loading}>
          {!overview || overview.recentEntries.length === 0 ? (
            <Quiet>Nothing written yet.</Quiet>
          ) : (
            overview.recentEntries.slice(0, 6).map((entry) => (
              <ListRow
                key={entry.documentId}
                icon={FileText}
                tone={entry.status === 'published' ? 'success' : entry.status === 'changed' ? 'warning' : 'info'}
                title={entry.title ?? 'Untitled'}
                meta={
                  <>
                    {entry.contentType.name}
                    {entry.localizations.length > 1 ? ` · edited in ${entry.locale}` : ''}
                  </>
                }
                trailing={
                  <>
                    <span className="hidden sm:inline-flex">
                      <LanguageChips
                        versions={
                          entry.localizations.length > 0
                            ? entry.localizations
                            : [{ id: entry.id, locale: entry.locale, status: entry.status }]
                        }
                      />
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      <RelativeTime iso={entry.updatedAt} />
                    </span>
                  </>
                }
                chevron={false}
                onClick={() => onOpenEntry(entry.id)}
              />
            ))
          )}
        </ActivitySection>

        <ActivitySection
          title="Content models"
          actionLabel="All models"
          onAction={() => onOpenTab('models')}
          loading={loading || typesQuery.isPending}
        >
          {typesQuery.isError ? (
            <Quiet>Models couldn’t be loaded.</Quiet>
          ) : models.length === 0 ? (
            <Quiet>No models yet.</Quiet>
          ) : (
            models.slice(0, 6).map((type) => {
              const total = type.entryCount ?? 0;
              const live = type.publishedCount ?? 0;
              return (
                <ListRow
                  key={type.id}
                  icon={Layers}
                  tone="primary"
                  title={type.name}
                  meta={`${type.kind === 'singleton' ? 'Singleton' : 'Collection'} · ${type.fields.length} ${type.fields.length === 1 ? 'field' : 'fields'}`}
                  trailing={
                    total === 0 ? (
                      <Pill tone="muted">Empty</Pill>
                    ) : (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {live} live of {total}
                      </span>
                    )
                  }
                  chevron={false}
                  onClick={() => onOpenTab('models')}
                />
              );
            })
          )}
        </ActivitySection>
      </div>
    </div>
  );
}

/** The titled list Communications' overview uses, so the two pages read alike. */
function ActivitySection({
  title,
  actionLabel,
  onAction,
  loading,
  children,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {actionLabel}
        </button>
      </div>
      {loading ? (
        <ListSkeleton rows={6} label={`Loading ${title.toLowerCase()}`} />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">{children}</ul>
      )}
    </section>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <li className="px-3.5 py-8 text-center text-sm text-muted-foreground">{children}</li>;
}
