'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Clock, FileText, MailX, PlugZap, Send, TriangleAlert, Zap } from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';

import { type EmailDelivery, getEmailAutomations, getEmailDeliveries, getEmailTemplates } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type AttentionIssue, type ConnectionState, attentionIssues, summariseWeek, timeAgo } from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { TRIGGER_LABELS } from './shared';

/**
 * The front door: is email working, and does anything need me?
 *
 * Four figures for the last seven days, then the answer to "anything wrong" as
 * a list you can act on, then the two things people come to check — which
 * automations are live, and what went out most recently. Everything opens the
 * place that deals with it.
 */
export function OverviewPanel({
  connection,
  onOpenConnection,
  onOpenAutomations,
  onOpenAutomation,
  onOpenFailures,
  onOpenHistory,
  onPreviewDelivery,
}: {
  connection: ConnectionState;
  onOpenConnection?: () => void;
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
  const issues = useMemo(
    () => attentionIssues({ connection, deliveries, automations, templates, now }),
    [connection, deliveries, automations, templates, now],
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

  const toItem = (issue: AttentionIssue): NeedsAttentionItem => {
    switch (issue.kind) {
      case 'connection':
        return {
          key: 'connection',
          icon: PlugZap,
          tone: 'exception',
          title: issue.state === 'missing' ? 'Email isn’t set up — nothing can send' : 'The email connection hasn’t passed a test',
          detail: onOpenConnection ? undefined : 'Ask an owner to check the email connector in Settings.',
          fix: onOpenConnection ? { label: 'Open connector', run: onOpenConnection } : undefined,
        };
      case 'failed_deliveries':
        return {
          key: 'failed',
          icon: MailX,
          tone: 'exception',
          title: `${issue.count} email${issue.count === 1 ? '' : 's'} failed this week`,
          detail: 'See why, and try them again.',
          fix: { label: 'Review', run: onOpenFailures },
        };
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
          hint={week.failed > 0 ? 'Needs a retry' : 'Nothing failing'}
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
        <div className="h-16 animate-pulse rounded-lg border border-rule/60 bg-field" aria-hidden="true" />
      ) : (
        <NeedsAttention
          items={issues.map(toItem)}
          clear={{ title: 'Nothing needs you', detail: 'Everything is sending — no failures, broken steps or unpublished changes.' }}
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
                <ActivityRow
                  key={automation.id}
                  icon={failed > 0 ? TriangleAlert : Zap}
                  glyph={failed > 0 ? 'bg-exception/8 text-exception' : 'bg-momentum/8 text-momentum'}
                  title={automation.name}
                  detail={`When: ${TRIGGER_LABELS[automation.trigger]} · ${(automation.runCount ?? 0).toLocaleString()} run${automation.runCount === 1 ? '' : 's'}`}
                  pill={failed > 0 ? { label: `${failed} failed`, tone: 'exception' } : undefined}
                  time={automation.lastEvaluatedAt ? timeAgo(automation.lastEvaluatedAt, now) : undefined}
                  onSelect={() => onOpenAutomation(automation.id)}
                />
              );
            })
          )}
        </ActivitySection>

        <ActivitySection title="Latest emails" actionLabel="All history" onAction={onOpenHistory} loading={loading}>
          {deliveries.length === 0 ? (
            <Quiet>No emails have gone out yet.</Quiet>
          ) : (
            deliveries
              .slice(0, 6)
              .map((delivery) => (
                <ActivityRow
                  key={delivery.id}
                  icon={delivery.status === 'failed' ? MailX : delivery.status === 'sent' ? Send : Clock}
                  glyph={DELIVERY_GLYPH[delivery.status]}
                  title={delivery.toName || delivery.toEmail}
                  detail={delivery.subject}
                  pill={
                    delivery.status === 'failed'
                      ? { label: 'Failed', tone: 'exception' }
                      : delivery.status === 'sent'
                        ? undefined
                        : { label: delivery.status === 'cancelled' ? 'Cancelled' : 'Waiting', tone: 'warning' }
                  }
                  time={timeAgo(delivery.sentAt ?? delivery.createdAt, now)}
                  onSelect={() => onPreviewDelivery(delivery)}
                />
              ))
          )}
        </ActivitySection>
      </div>
    </div>
  );
}

const DELIVERY_GLYPH: Record<EmailDelivery['status'], string> = {
  queued: 'bg-band text-muted-foreground',
  sending: 'bg-primary/8 text-primary',
  sent: 'bg-momentum/8 text-momentum',
  failed: 'bg-exception/8 text-exception',
  cancelled: 'bg-measured/10 text-measured',
};

const PILL_TONE = {
  exception: 'bg-exception/8 text-exception',
  warning: 'bg-measured/10 text-measured',
} as const;

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
        <div className="h-64 animate-pulse rounded-lg border border-rule/60 bg-card" aria-hidden="true" />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">{children}</ul>
      )}
    </section>
  );
}

/** One row in the audit log's shape: tinted glyph, who/what, detail, status pill, time. */
function ActivityRow({
  icon: Icon,
  glyph,
  title,
  detail,
  pill,
  time,
  onSelect,
}: {
  icon: typeof Zap;
  glyph: string;
  title: string;
  detail?: string;
  pill?: { label: string; tone: keyof typeof PILL_TONE };
  time?: string;
  onSelect: () => void;
}) {
  return (
    <li className="border-b border-rule/45 last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', glyph)}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
          {detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
        {pill && (
          <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', PILL_TONE[pill.tone])}>{pill.label}</span>
        )}
        {time && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{time}</span>}
      </button>
    </li>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <li className="px-3.5 py-8 text-center text-sm text-muted-foreground">{children}</li>;
}
