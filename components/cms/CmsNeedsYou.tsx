'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { useCmsTenantId } from '@/components/cms/ContentScope';
import { Clock, FileText, KeyRound, Pencil, Users } from '@/components/icons';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';

import type { CmsEntryFilters } from '@/lib/modules/cms/client';
import { getCmsOverview } from '@/lib/modules/cms/client';
import { type CmsAttention, cmsAttention } from '@/lib/utils/cms';

import { cmsKeys } from './shared';
import { useCmsAccess } from './useCmsAccess';

type StatusFilter = NonNullable<CmsEntryFilters['status']>;

/**
 * What needs someone, at the top of Entries: entries waiting for review,
 * changes that aren't live, drafts never published, scheduled ones, and a
 * missing API key. Each fix filters the list below to those entries. Says
 * nothing while loading, on error, or when all is well — the list is the page.
 */
export function CmsNeedsYou({ onShowStatus }: { onShowStatus: (status: StatusFilter) => void }) {
  const router = useRouter();
  const tenantId = useCmsTenantId();
  const access = useCmsAccess();
  const query = useQuery({
    queryKey: cmsKeys.overview(tenantId),
    queryFn: () => getCmsOverview(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  if (!query.data) return null;
  const issues = cmsAttention(query.data, { canManageKeys: access.canManageKeys, canPublish: access.canPublish });
  if (issues.length === 0) return null;

  const entryWord = (count: number, singular: string, plural: string) => `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
  const show = (status: StatusFilter) => ({ label: 'Show', run: () => onShowStatus(status) });

  const toItem = (issue: CmsAttention): NeedsAttentionItem => {
    switch (issue.kind) {
      case 'no_api_key':
        return {
          key: 'no-api-key',
          icon: KeyRound,
          tone: issue.tone,
          title: 'No API key yet',
          detail: 'Websites can’t read live content until one exists.',
          fix: { label: 'Create key', run: () => router.push('/settings/developers') },
        };
      case 'awaiting_review':
        return {
          key: 'review',
          icon: Users,
          tone: issue.tone,
          title: `${entryWord(issue.count, 'entry is', 'entries are')} waiting for your review`,
          fix: show('review'),
        };
      case 'unpublished_changes':
        return {
          key: 'changes',
          icon: Pencil,
          tone: issue.tone,
          title: `${entryWord(issue.count, 'entry has', 'entries have')} changes that aren’t live`,
          detail: 'Websites still get the last published version.',
          fix: show('changed'),
        };
      case 'never_published':
        return {
          key: 'drafts',
          icon: FileText,
          tone: issue.tone,
          title: `${entryWord(issue.count, 'entry has', 'entries have')} never been published`,
          fix: show('draft'),
        };
      case 'scheduled':
        return {
          key: 'scheduled',
          icon: Clock,
          tone: issue.tone,
          title: `${entryWord(issue.count, 'entry is', 'entries are')} scheduled`,
          fix: show('scheduled'),
        };
    }
  };

  return <NeedsAttention label="Needs you" items={issues.map(toItem)} />;
}
