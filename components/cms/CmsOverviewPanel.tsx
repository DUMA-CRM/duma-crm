'use client';

import { useQuery } from '@tanstack/react-query';

import { Clock, FileText, KeyRound, Languages, Layers, Pencil, Send, Users } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { ListSkeleton } from '@/components/shared/Skeleton';

import { getCmsOverview } from '@/lib/modules/cms/client';
import { type CmsAttention, cmsAttention } from '@/lib/utils/cms';
import { useCmsTenantId } from '@/components/cms/ContentScope';

import { InfoRow, InfoRows } from './rows';
import { EntryStatusBadge, PanelError, cmsKeys } from './shared';
import { useCmsAccess } from './useCmsAccess';

type OverviewTab = 'entries' | 'models' | 'media' | 'developers';

/** Resume recent work and surface publishing issues; configuration lives under Configure. */
export function CmsOverviewPanel({
  onOpenEntry,
  onOpenTab,
  onNewModel,
}: {
  onOpenEntry: (id: string) => void;
  onOpenTab: (tab: OverviewTab) => void;
  onNewModel?: () => void;
}) {
  const tenantId = useCmsTenantId();
  const access = useCmsAccess();
  const query = useQuery({
    queryKey: cmsKeys.overview(tenantId),
    queryFn: () => getCmsOverview(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  if (query.isError) return <PanelError title="The content overview couldn’t be loaded" onRetry={() => void query.refetch()} />;

  const overview = query.data;
  if (overview && overview.contentTypes === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={Layers}
        title={onNewModel ? 'Create your first model' : 'No content models yet'}
        description="Define a model, then add the content your website will use."
        action={onNewModel ? { label: 'New model', onClick: onNewModel, icon: Layers } : undefined}
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

  return (
    <div className="space-y-5">
      {overview && (
        <NeedsAttention
          items={cmsAttention(overview, { canManageKeys: access.canManageKeys, canPublish: access.canPublish }).map(toItem)}
        />
      )}
      <SettingsTabBody
        narrowAside
        aside={
          <SettingsSection title="Publishing">
            <InfoRows>
              <InfoRow icon={Send} title="Live">
                <span className="text-sm font-semibold tabular-nums text-foreground">{count(entries?.live)}</span>
              </InfoRow>
              <InfoRow icon={FileText} title="Drafts">
                <span className="text-sm font-semibold tabular-nums text-foreground">{count(entries?.draft)}</span>
              </InfoRow>
              <InfoRow icon={Layers} title="Entries">
                <span className="text-sm font-semibold tabular-nums text-foreground">{count(entries?.total)}</span>
              </InfoRow>
              <InfoRow icon={Languages} title="Languages">
                <span className="text-sm font-semibold tabular-nums text-foreground">{count(overview?.locales)}</span>
              </InfoRow>
              {!!entries?.changed && (
                <InfoRow icon={Pencil} title="Unpublished changes">
                  <span className="text-sm font-semibold tabular-nums text-measured">{count(entries.changed)}</span>
                </InfoRow>
              )}
              {!!entries?.review && (
                <InfoRow icon={Users} title="Awaiting review">
                  <span className="text-sm font-semibold tabular-nums text-measured">{count(entries.review)}</span>
                </InfoRow>
              )}
              {!!entries?.scheduled && (
                <InfoRow icon={Clock} title="Scheduled">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{count(entries.scheduled)}</span>
                </InfoRow>
              )}
            </InfoRows>
          </SettingsSection>
        }
      >
        <section aria-labelledby="cms-recent-heading" className="min-w-0">
          <h2 id="cms-recent-heading" className="mb-4 px-3.5 text-base font-semibold tracking-title text-foreground">
            Recently edited
          </h2>
          {loading ? (
            <div className="px-4 pb-4">
              <ListSkeleton rows={3} label="Loading recent entries" />
            </div>
          ) : !overview?.recentEntries.length ? (
            <p className="px-3.5 pb-6 pt-2 text-sm text-muted-foreground">Nothing written yet. Create an entry to get started.</p>
          ) : (
            <ListRowGroup>
              {overview.recentEntries.slice(0, 6).map((entry) => (
                <ListRow
                  key={entry.documentId}
                  icon={FileText}
                  tone={entry.status === 'published' ? 'success' : entry.status === 'changed' ? 'warning' : 'info'}
                  title={entry.title ?? 'Untitled'}
                  meta={entry.contentType.name}
                  trailing={
                    <>
                      <EntryStatusBadge status={entry.status} />
                      <RelativeTime iso={entry.updatedAt} className="shrink-0 text-xs tabular-nums text-muted-foreground" />
                    </>
                  }
                  chevron={false}
                  onClick={() => onOpenEntry(entry.id)}
                />
              ))}
            </ListRowGroup>
          )}
        </section>
      </SettingsTabBody>
    </div>
  );
}
