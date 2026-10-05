'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { FileText, Trash2, TriangleAlert, Zap } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Button } from '@/components/ui/button';

import {
  type EmailAutomation,
  type EmailTemplate,
  deleteEmailAutomation,
  getEmailAutomations,
  getEmailTemplates,
  publishEmailAutomation,
  updateEmailAutomation,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { attentionIssues, groupAutomations, hasUnpublishedChanges, missingTemplateCount, timeAgo } from '@/lib/utils/communications';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { TRIGGER_LABELS } from './shared';
import { type EmailAccess, useEmailAccess } from './useEmailAccess';
import { workflowForAutomation, workflowSummary } from './workflowModel';

/**
 * The automations as the Menu lists its items: what needs fixing folded at the
 * top, then one bordered list per kind of trigger with a
 * row per automation — what it is and what's wrong, runs, when it last ran, and
 * the on/off switch.
 */
export function AutomationsPanel({
  onEdit,
  onOpenTemplates,
}: {
  onEdit: (selection: { automation?: EmailAutomation }) => void;
  onOpenTemplates: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useEmailAccess();
  const [deleteTarget, setDeleteTarget] = useState<EmailAutomation | null>(null);
  // Pinned on mount so "5 min ago" doesn't shift under a render.
  const [now] = useState(() => Date.now());

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
  const automations = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const canCreate = templates.some((template) => template.isActive);

  const toggle = useMutation({
    mutationFn: ({ automation, isEnabled }: { automation: EmailAutomation; isEnabled: boolean }) =>
      isEnabled && automation.publishedVersion === 0
        ? publishEmailAutomation(automation.id, tenantId ?? undefined)
        : updateEmailAutomation(automation.id, { isEnabled }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-automations') });
      toast('success', saved.isEnabled ? `“${saved.name}” is now sending.` : `“${saved.name}” is switched off.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEmailAutomation(id, tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-automations') });
      setDeleteTarget(null);
      toast('success', 'Automation deleted.');
    },
    onError: (error) => toast('error', error.message),
  });

  const groups = useMemo(() => groupAutomations(automations), [automations]);

  // Only the automation problems — delivery failures and the connection belong to the Overview.
  const attention = useMemo<NeedsAttentionItem[]>(() => {
    const open = (id: string) => () => onEdit({ automation: automations.find((item) => item.id === id) });
    const items: NeedsAttentionItem[] = [];
    if (templatesQuery.isSuccess && !canCreate && access.canWrite)
      items.push({
        key: 'no-template',
        tone: 'measured',
        icon: FileText,
        title: 'There’s no template to send yet',
        detail: 'An automation sends a template — create one first.',
        fix: { label: 'Go to templates', run: onOpenTemplates },
      });
    for (const issue of attentionIssues({ connection: 'unknown', deliveries: [], automations, templates, now })) {
      if (issue.kind === 'missing_template')
        items.push({
          key: `missing-${issue.automationId}`,
          tone: 'exception',
          icon: TriangleAlert,
          title: `“${issue.name}” sends a deleted template`,
          detail: `${issue.count === 1 ? 'That step' : `${issue.count} steps`} won’t send until another template is chosen.`,
          fix: { label: 'Fix', run: open(issue.automationId) },
        });
      if (issue.kind === 'failed_runs')
        items.push({
          key: `runs-${issue.automationId}`,
          tone: 'measured',
          icon: Zap,
          title: `“${issue.name}” has ${issue.count} failed run${issue.count === 1 ? '' : 's'}`,
          detail: 'Open it to see which step failed and why.',
          fix: { label: 'Open', run: open(issue.automationId) },
        });
      if (issue.kind === 'unpublished')
        items.push({
          key: `unpublished-${issue.automationId}`,
          tone: 'measured',
          icon: Zap,
          title: `“${issue.name}” has changes that aren’t live`,
          detail: 'The published version is still the one sending.',
          fix: { label: 'Review', run: open(issue.automationId) },
        });
    }
    return items;
  }, [access.canWrite, automations, canCreate, now, onEdit, onOpenTemplates, templates, templatesQuery.isSuccess]);

  if (automationsQuery.isError)
    return (
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <ErrorState title="Automations couldn’t be loaded" onRetry={() => void automationsQuery.refetch()} />
      </div>
    );

  if (automationsQuery.isPending)
    return (
      <div className="space-y-3" aria-label="Loading automations">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg bg-band/60" />
        ))}
      </div>
    );

  if (automations.length === 0)
    return (
      <div className="space-y-5">
        <NeedsAttention items={attention} />
        <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          <EmptyState
            icon={Zap}
            title="No automations yet"
            description={
              access.canWrite
                ? 'Send the right email when something happens — an order is ready, a birthday, a first visit.'
                : 'Nobody has set one up yet.'
            }
          />
        </div>
      </div>
    );

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <NeedsAttention items={attention} />

      {groups.length > 0 && (
        <div className="-mb-3 hidden items-center gap-3 px-3.5 text-label uppercase text-muted-foreground sm:flex" aria-hidden="true">
          <span className="flex-1" />
          <span className="w-24 text-right">Runs</span>
          <span className="w-24 text-right">Last checked</span>
          <span className="w-24 text-right">Sending</span>
          {access.canWrite && <span className="w-8" />}
        </div>
      )}

      {groups.map((group) => (
        <motion.section key={group.group} variants={SECTION_RISE} aria-label={group.label}>
          <h2 className="mb-2 flex items-center gap-2 text-label uppercase text-muted-foreground">
            {group.label}
            <span className="normal-case tabular-nums">
              {group.sending}/{group.items.length} sending
            </span>
          </h2>
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {group.items.map((automation) => (
              <AutomationRow
                key={automation.id}
                automation={automation}
                templates={templates}
                now={now}
                access={access}
                toggling={toggle.isPending && toggle.variables?.automation.id === automation.id}
                onToggle={(isEnabled) => toggle.mutate({ automation, isEnabled })}
                onEdit={() => onEdit({ automation })}
                onDelete={() => setDeleteTarget(automation)}
              />
            ))}
          </ul>
        </motion.section>
      ))}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this automation?"
          message={
            <>
              “{deleteTarget.name}” will stop sending and be removed. Emails already sent stay in History. If you only want a break, switch
              it off instead.
            </>
          }
          confirmLabel="Delete automation"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </motion.div>
  );
}

/** One automation as a Menu item row: what it is and what's wrong, then runs, last checked and the switch. */
function AutomationRow({
  automation,
  templates,
  now,
  access,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  automation: EmailAutomation;
  templates: EmailTemplate[];
  now: number;
  access: EmailAccess;
  toggling: boolean;
  onToggle: (isEnabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const definition = workflowForAutomation(automation);
  const templateName = (id: string) => templates.find((item) => item.id === id)?.name ?? 'an email';
  const draft = automation.publishedVersion === 0;
  // A deleted template is only flagged inactive, so a step can still point at one.
  const missing = missingTemplateCount(definition, templates);
  const failed = automation.failedRunCount ?? 0;
  // Only what's wrong or not live — a healthy automation says nothing extra.
  const flags: { label: string; tone: 'exception' | 'measured' }[] = [];
  if (missing > 0) flags.push({ label: 'Deleted template', tone: 'exception' });
  if (draft) flags.push({ label: 'Draft', tone: 'measured' });
  else if (hasUnpublishedChanges(automation)) flags.push({ label: 'Unpublished changes', tone: 'measured' });
  // Switching a never-published draft on publishes it; switching off is an edit.
  const canToggle = !automation.isEnabled && draft ? access.canPublish : access.canWrite;

  return (
    <li className="group flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 transition-colors last:border-b-0 hover:bg-band/40">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Open ${automation.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            automation.isEnabled ? 'bg-momentum/10 text-momentum' : 'bg-band text-muted-foreground',
          )}
          aria-hidden="true"
        >
          <Zap size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate text-sm font-semibold', automation.isEnabled ? 'text-foreground' : 'text-muted-foreground')}>
              {automation.name}
            </span>
            {flags.map((flag) => (
              <span
                key={flag.label}
                className={cn(
                  'hidden shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold md:inline',
                  flag.tone === 'exception' ? 'bg-exception/8 text-exception' : 'bg-measured/10 text-measured',
                )}
              >
                {flag.label}
              </span>
            ))}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            When: {TRIGGER_LABELS[automation.trigger]}
            {automation.location && ` at ${automation.location.name}`} · {workflowSummary(definition, templateName)}
          </span>
        </span>
      </button>

      <span className="w-24 shrink-0 text-right text-sm tabular-nums">
        <span className="block font-semibold text-foreground">{(automation.runCount ?? 0).toLocaleString()}</span>
        {failed > 0 && <span className="block text-micro font-semibold text-exception">{failed} failed</span>}
      </span>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground" title={automation.lastEvaluatedAt ?? undefined}>
        {automation.lastEvaluatedAt ? timeAgo(automation.lastEvaluatedAt, now) : '—'}
      </span>
      <span className="flex w-24 shrink-0 items-center justify-end gap-2">
        <span className={cn('text-micro font-semibold', automation.isEnabled ? 'text-momentum' : 'text-muted-foreground')}>
          {automation.isEnabled ? 'On' : 'Off'}
        </span>
        <Switch label={`${automation.name} sending`} checked={automation.isEnabled} disabled={toggling || !canToggle} onChange={onToggle} />
      </span>
      {access.canWrite && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Delete ${automation.name}`}
          title="Delete"
          className="text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
        >
          <Trash2 />
        </Button>
      )}
    </li>
  );
}
