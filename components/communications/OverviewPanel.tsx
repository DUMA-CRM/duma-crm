'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { FileText, MailX, Send, TriangleAlert, Zap } from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow } from '@/components/shared/ListRow';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Pill } from '@/components/shared/Pill';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';

import { type EmailDelivery, getEmailAutomations, getEmailDeliveries, getEmailTemplates } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type AttentionIssue, attentionIssues, summariseWeek, timeAgo } from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { DELIVERY_STATUS } from './HistoryPanel';
import { TRIGGER_LABELS } from './shared';

type ShownIssue = Exclude<AttentionIssue, { kind: 'connection' | 'failed_deliveries' }>;

/**
 * The front door: is email working, and does anything need me?
 *
 * Four figures for the last seven days, then the answer to "anything wrong" as
 * a list you can act on, then the two things people come to check — which
 * automations are live, and what went out most recently. Everything opens the
 * place that deals with it.
 */
export function OverviewPanel({
  onOpenAutomations,
  onOpenAutomation,
  onOpenFailures,
  onOpenHistory,
  onPreviewDelivery,
}: {
  onOpenAutomations: () => void;
  onOpenAutomation: (id: string) => void;
  /** Opens History filtered to failures. */
  onOpenFailures: () => void;
  onOpenHistory: () => void;
  onPreviewDelivery: (delivery: EmailDelivery) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);

  const automationsQuery = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-automations', tenantId),
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const templatesQuery = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-templates', tenantId),
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const deliveriesQuery = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-deliveries', tenantId, 1),
    queryFn: () => getEmailDeliveries(tenantId ?? undefined, 1),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Pinned on mount: the seven-day window must not slide underneath a render.
  const [now] = useState(() => Date.now());
  const automations = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const deliveries = useMemo(() => deliveriesQuery.data?.data ?? [], [deliveriesQuery.data]);
  const week = useMemo(() => summariseWeek(deliveries, now), [deliveries, now]);
  // The connection rides in the masthead and failures are the Failed tile, so
  // neither is repeated here — this list is what's wrong with the automations.
  const issues = useMemo(
    () =>
      attentionIssues({ connection: 'unknown', deliveries, automations, templates, now }).filter(
        (issue): issue is ShownIssue => issue.kind !== 'connection' && issue.kind !== 'failed_deliveries',
      ),
    [deliveries, automations, templates, now],
  );

  const queries = [automationsQuery, templatesQuery, deliveriesQuery];
  if (queries.some((query) => query.isError)) {
    return (
      <div className="rounded-lg border border-rule bg-card">
        <ErrorState
          title="Communications couldn’t be loaded"
          onRetry={() => queries.filter((query) => query.isError).forEach((query) => void query.refetch())}
        />
      </div>
    );
  }
  const loading = queries.some((query) => query.isLoading);

  const live = automations.filter((automation) => automation.isEnabled).sort((a, b) => (b.runCount ?? 0) - (a.runCount ?? 0));
  const drafts = automations.length - live.length;
  const activeTemplates = templates.filter((template) => template.isActive);

  const toItem = (issue: ShownIssue): NeedsAttentionItem => {
    switch (issue.kind) {
      case 'missing_template':
        return {
          key: `missing-${issue.automationId}`,
          icon: TriangleAlert,
          tone: 'exception',
          title: `“${issue.name}” sends a deleted template`,
          detail: `${issue.count === 1 ? 'That step' : `${issue.count} steps`} won’t send until another template is chosen.`,
          fix: { label: 'Fix', run: () => onOpenAutomation(issue.automationId) },
        };
      case 'failed_runs':
        return {
          key: `runs-${issue.automationId}`,
          icon: Zap,
          tone: 'measured',
          title: `“${issue.name}” has ${issue.count} failed run${issue.count === 1 ? '' : 's'}`,
          fix: { label: 'Open', run: () => onOpenAutomation(issue.automationId) },
        };
      case 'unpublished':
        return {
          key: `unpublished-${issue.automationId}`,
          icon: Zap,
          tone: 'measured',
          title: `“${issue.name}” has changes that aren’t live`,
          detail: 'The published version is still the one sending.',
          fix: { label: 'Publish', run: () => onOpenAutomation(issue.automationId) },
        };
      case 'draft':
        return {
          key: `draft-${issue.automationId}`,
          icon: Zap,
          tone: 'measured',
          title: `“${issue.name}” is a draft`,
          detail: 'It hasn’t been published, so it sends nothing.',
          fix: { label: 'Open', run: () => onOpenAutomation(issue.automationId) },
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* The same four-tile row as Inventory — facts to read, not buttons. */}
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          surface="page"
          icon={Send}
          label="Sent · 7 days"
          value={loading ? '—' : week.sent.toLocaleString()}
          hint={week.total === 0 ? 'Nothing sent yet' : `of ${week.total.toLocaleString()} queued`}
        />
        <Fact
          surface="page"
          icon={MailX}
          label="Failed · 7 days"
          value={loading ? '—' : week.failed.toLocaleString()}
          tone={week.failed > 0 ? 'danger' : 'default'}
          hint={week.failed > 0 ? 'See why, and try again' : 'Nothing failing'}
          onSelect={week.failed > 0 ? onOpenFailures : undefined}
        />
        <Fact
          surface="page"
          icon={Zap}
          label="Automations live"
          value={loading ? '—' : live.length.toLocaleString()}
          hint={drafts > 0 ? `${drafts} switched off` : 'All switched on'}
        />
        <Fact
          surface="page"
          icon={FileText}
          label="Templates"
          value={loading ? '—' : activeTemplates.length.toLocaleString()}
          hint="Ready to use"
        />
      </dl>

      {loading ? (
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
          items={issues.map(toItem)}
          clear={
            week.failed > 0
              ? undefined
              : { title: 'Nothing needs you', detail: 'Everything is sending — no failures, broken steps or unpublished changes.' }
          }
        />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ActivitySection title="Live automations" actionLabel="All automations" onAction={onOpenAutomations} loading={loading}>
          {live.length === 0 ? (
            <Quiet>Nothing is switched on yet.</Quiet>
          ) : (
            live.slice(0, 6).map((automation) => {
              const failed = automation.failedRunCount ?? 0;
              return (
                <ListRow
                  key={automation.id}
                  icon={failed > 0 ? TriangleAlert : Zap}
                  tone={failed > 0 ? 'exception' : 'success'}
                  title={automation.name}
                  meta={`${TRIGGER_LABELS[automation.trigger]} · ${(automation.runCount ?? 0).toLocaleString()} run${automation.runCount === 1 ? '' : 's'}`}
                  trailing={
                    <>
                      {failed > 0 && <Pill tone="exception">{failed} failed</Pill>}
                      {automation.lastEvaluatedAt && (
                        <span className="text-xs tabular-nums text-muted-foreground">{timeAgo(automation.lastEvaluatedAt, now)}</span>
                      )}
                    </>
                  }
                  chevron={false}
                  onClick={() => onOpenAutomation(automation.id)}
                />
              );
            })
          )}
        </ActivitySection>

        <ActivitySection title="Latest emails" actionLabel="All history" onAction={onOpenHistory} loading={loading}>
          {deliveries.length === 0 ? (
            <Quiet>No emails have gone out yet.</Quiet>
          ) : (
            deliveries.slice(0, 6).map((delivery) => (
              <ListRow
                key={delivery.id}
                leading={
                  <Avatar
                    // Initials only: no Gravatar lookup for every address in the send log.
                    name={delivery.toName || delivery.toEmail}
                    status={DELIVERY_STATUS[delivery.status].tone}
                    statusLabel={DELIVERY_STATUS[delivery.status].label}
                  />
                }
                title={delivery.toName || delivery.toEmail}
                meta={delivery.subject}
                trailing={
                  <>
                    {delivery.status === 'failed' && <Pill tone="exception">Failed</Pill>}
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {timeAgo(delivery.sentAt ?? delivery.createdAt, now)}
                    </span>
                  </>
                }
                chevron={false}
                onClick={() => onPreviewDelivery(delivery)}
              />
            ))
          )}
        </ActivitySection>
      </div>
    </div>
  );
}

/** A day heading and a bordered list, as the audit log groups its entries. */
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
