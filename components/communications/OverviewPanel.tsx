'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { ArrowUpRight, FileText, MailX, Send, TriangleAlert, Zap } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  onOpenTemplates,
  onPreviewDelivery,
}: {
  onOpenAutomations: () => void;
  onOpenAutomation: (id: string) => void;
  /** Opens History filtered to failures. */
  onOpenFailures: () => void;
  onOpenHistory: () => void;
  onOpenTemplates?: () => void;
  onPreviewDelivery: (delivery: EmailDelivery) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const reduceMotion = useReducedMotion();

  const automationsQuery = useQuery({
    queryKey: moduleQueryKeys.automation.key('email-automations', tenantId),
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
      <ErrorState
        className="flex-1"
        title="Communications couldn’t be loaded"
        onRetry={() => queries.filter((query) => query.isError).forEach((query) => void query.refetch())}
      />
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
    <motion.div
      className="flex flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      {loading ? (
        <FactsSkeleton count={4} label="Loading email figures" className="gap-3 sm:grid-cols-2 xl:grid-cols-4" />
      ) : (
        <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact
            surface="page"
            icon={Send}
            label="Sent · 7 days"
            value={week.sent.toLocaleString()}
            hint={week.total === 0 ? 'Nothing sent yet' : `of ${week.total.toLocaleString()} queued`}
            onSelect={onOpenHistory}
          />
          <Fact
            surface="page"
            icon={MailX}
            label="Failed · 7 days"
            value={week.failed.toLocaleString()}
            tone={week.failed > 0 ? 'danger' : 'default'}
            hint={week.failed > 0 ? 'See why, and try again' : 'Nothing failing'}
            onSelect={week.failed > 0 ? onOpenFailures : undefined}
          />
          <Fact
            surface="page"
            icon={Zap}
            label="Automations live"
            value={live.length.toLocaleString()}
            hint={automations.length === 0 ? 'None set up' : drafts > 0 ? `${drafts} switched off` : 'All switched on'}
            onSelect={onOpenAutomations}
          />
          <Fact
            surface="page"
            icon={FileText}
            label="Templates"
            value={activeTemplates.length.toLocaleString()}
            hint="Ready to use"
            onSelect={onOpenTemplates}
          />
        </motion.dl>
      )}

      {loading ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm"
          role="status"
          aria-busy="true"
          aria-label="Checking what needs attention"
        >
          <Bone className="size-9 shrink-0" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-3.5 w-36" />
            <Bone className="h-3 w-72 max-w-full" />
          </span>
        </div>
      ) : (
        <NeedsAttention items={issues.map(toItem)} />
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <RecordGroup
          id="communications-live-automations"
          title="Live automations"
          actions={<OpenAll label="All automations" onClick={onOpenAutomations} />}
        >
          {loading ? (
            <ListSkeleton rows={6} label="Loading live automations" />
          ) : live.length === 0 ? (
            <EmptyState
              compact
              icon={Zap}
              title="No live automations"
              description="Set up an automation to send emails when something happens."
            />
          ) : (
            <ListRowGroup aria-label="Live automations">
              {live.slice(0, 6).map((automation) => {
                const failed = automation.failedRunCount ?? 0;
                return (
                  <ListRow
                    key={automation.id}
                    icon={failed > 0 ? TriangleAlert : Zap}
                    tone={failed > 0 ? 'exception' : 'success'}
                    title={automation.name}
                    titleExtra={
                      failed > 0 ? (
                        <Badge variant="destructive" className="shrink-0">
                          {failed} failed
                        </Badge>
                      ) : undefined
                    }
                    meta={`${TRIGGER_LABELS[automation.trigger]} · ${(automation.runCount ?? 0).toLocaleString()} run${automation.runCount === 1 ? '' : 's'}`}
                    trailing={
                      automation.lastEvaluatedAt && (
                        <span className="text-xs tabular-nums text-muted-foreground">{timeAgo(automation.lastEvaluatedAt, now)}</span>
                      )
                    }
                    chevron={false}
                    onClick={() => onOpenAutomation(automation.id)}
                  />
                );
              })}
            </ListRowGroup>
          )}
        </RecordGroup>

        <RecordGroup
          id="communications-latest-emails"
          title="Latest emails"
          actions={<OpenAll label="All history" onClick={onOpenHistory} />}
        >
          {loading ? (
            <ListSkeleton rows={6} avatar label="Loading latest emails" />
          ) : deliveries.length === 0 ? (
            <EmptyState compact icon={Send} title="No emails sent yet" description="Your latest deliveries will appear here." />
          ) : (
            <ListRowGroup aria-label="Latest emails">
              {deliveries.slice(0, 6).map((delivery) => (
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
                  titleExtra={
                    delivery.status === 'failed' ? (
                      <Badge variant="destructive" className="shrink-0">
                        Failed
                      </Badge>
                    ) : undefined
                  }
                  meta={delivery.subject}
                  trailing={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {timeAgo(delivery.sentAt ?? delivery.createdAt, now)}
                    </span>
                  }
                  chevron={false}
                  onClick={() => onPreviewDelivery(delivery)}
                />
              ))}
            </ListRowGroup>
          )}
        </RecordGroup>
      </div>
    </motion.div>
  );
}

/** The title-row way into the full list. */
function OpenAll({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      {label}
      <ArrowUpRight aria-hidden="true" />
    </Button>
  );
}
