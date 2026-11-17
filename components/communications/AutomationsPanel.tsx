'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Activity, FileText, Plus, Power, Search, Trash2, TriangleAlert, XCircle, Zap } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact, Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

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
import { toast } from '@/lib/toast';
import {
  AUTOMATION_VIEW_LABELS,
  type AutomationFlag,
  type AutomationView,
  automationFlags,
  automationsOverview,
  groupAutomations,
  inAutomationView,
  missingTemplateCount,
} from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CommunicationsToolbar } from './CommunicationsToolbar';
import { TRIGGER_LABELS } from './shared';
import { type EmailAccess, useEmailAccess } from './useEmailAccess';
import { workflowForAutomation, workflowSummary } from './workflowModel';

const VIEWS = Object.keys(AUTOMATION_VIEW_LABELS) as AutomationView[];

const FLAG_BADGE: Record<AutomationFlag, { label: string; variant: 'destructive' | 'warning' }> = {
  missing_template: { label: 'Deleted template', variant: 'destructive' },
  draft: { label: 'Draft', variant: 'warning' },
  unpublished: { label: 'Unpublished changes', variant: 'warning' },
};

/**
 * The workflows as Promotions lists its promotions: anything blocking at the
 * top, four figures (three filter the list), the search with the Show select
 * and the count, then a titled list per kind of trigger. A row opens the
 * editor; the switch is always on the row, Delete on its hover. "New workflow"
 * lives in the page header.
 */
export function AutomationsPanel({
  onEdit,
  onOpenTemplates,
  onOpenRuns,
  after,
}: {
  onEdit: (selection: { automation?: EmailAutomation }) => void;
  onOpenTemplates: () => void;
  /** Makes the Runs figure open the runs list. */
  onOpenRuns?: () => void;
  /** Sections under the list, from the page mounting the panel (Automation's scheduled jobs). */
  after?: React.ReactNode;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useEmailAccess();
  const reduceMotion = useReducedMotion();
  const [deleteTarget, setDeleteTarget] = useState<EmailAutomation | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AutomationView>('all');

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
  const automations = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const canCreate = templates.some((template) => template.isActive);

  const toggle = useMutation({
    mutationFn: ({ automation, isEnabled }: { automation: EmailAutomation; isEnabled: boolean }) =>
      isEnabled && automation.publishedVersion === 0
        ? publishEmailAutomation(automation.id, tenantId ?? undefined)
        : updateEmailAutomation(automation.id, { isEnabled }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.automation.key('email-automations') });
      toast('success', saved.isEnabled ? `“${saved.name}” is now running.` : `“${saved.name}” is switched off.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEmailAutomation(id, tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.automation.key('email-automations') });
      setDeleteTarget(null);
      toast('success', 'Workflow deleted.');
    },
    onError: (error) => toast('error', error.message),
  });

  // A deleted template is only flagged inactive, so a step can still point at one.
  const missing = useMemo(() => {
    const counts = new Map<string, number>();
    for (const automation of automations) counts.set(automation.id, missingTemplateCount(workflowForAutomation(automation), templates));
    return counts;
  }, [automations, templates]);
  const missingOf = (automation: EmailAutomation) => missing.get(automation.id) ?? 0;
  const overview = useMemo(() => automationsOverview(automations, (automation) => missing.get(automation.id) ?? 0), [automations, missing]);

  const needle = search.trim().toLowerCase();
  const shownGroups = groupAutomations(
    automations.filter(
      (automation) => automation.name.toLowerCase().includes(needle) && inAutomationView(automation, view, missingOf(automation)),
    ),
  );
  const shownCount = shownGroups.reduce((total, group) => total + group.items.length, 0);
  const filtersActive = Boolean(needle) || view !== 'all';
  const reset = () => {
    setSearch('');
    setView('all');
  };
  /** A figure picks its view; picking it again shows every workflow. */
  const pick = (next: AutomationView) => setView((current) => (current === next ? 'all' : next));

  // Blocking creation, and runs that broke — each flagged row says the rest.
  const attention: NeedsAttentionItem[] = [];
  if (templatesQuery.isSuccess && !canCreate && access.canWrite)
    attention.push({
      key: 'no-template',
      tone: 'measured',
      icon: FileText,
      title: 'There’s no template to send yet',
      detail: 'Email steps need one. A workflow can still create a helpdesk task.',
      fix: { label: 'Go to templates', run: onOpenTemplates },
    });
  if (overview.failed > 0 && view !== 'failed')
    attention.push({
      key: 'failed-runs',
      tone: 'exception',
      icon: XCircle,
      title: `${overview.failed} ${overview.failed === 1 ? 'workflow has' : 'workflows have'} failed runs`,
      fix: { label: 'Show failed', run: () => setView('failed') },
    });

  const stagger = {
    initial: reduceMotion ? false : ('hidden' as const),
    animate: 'shown',
    variants: { shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } },
  };

  if (automationsQuery.isPending)
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <FactsSkeleton count={4} label="Loading workflow figures" className="gap-3 sm:grid-cols-2 xl:grid-cols-4" />
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Bone className="h-9 min-w-56 flex-1" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={5} label="Loading workflows" />
      </div>
    );

  if (automationsQuery.isError)
    return <ErrorState className="flex-1" title="Workflows couldn’t be loaded" onRetry={() => void automationsQuery.refetch()} />;

  if (automations.length === 0)
    return (
      <motion.div className="flex flex-1 flex-col gap-5" {...stagger}>
        <NeedsAttention items={attention} />
        <EmptyState
          icon={Zap}
          title={access.canWrite ? 'Create your first workflow' : 'No workflows yet'}
          className="flex-1"
          description={
            access.canWrite
              ? 'Start with an event, then send an email or create a task for your team.'
              : 'Workflows appear here once someone sets one up.'
          }
          action={access.canWrite ? { label: 'New workflow', onClick: () => onEdit({}), icon: Plus } : undefined}
        />
        {after}
      </motion.div>
    );

  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div className="flex flex-col gap-5" {...stagger}>
      <NeedsAttention items={attention} />

      <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          surface="page"
          icon={Zap}
          label="Sending"
          value={overview.sending}
          hint={`of ${overview.all} ${overview.all === 1 ? 'workflow' : 'workflows'}`}
          selected={view === 'sending'}
          onSelect={() => pick('sending')}
        />
        <Fact
          surface="page"
          icon={Power}
          label="Switched off"
          value={overview.off}
          hint={overview.off > 0 ? 'Not running' : 'None off'}
          selected={view === 'off'}
          onSelect={overview.off > 0 || view === 'off' ? () => pick('off') : undefined}
        />
        <Fact
          surface="page"
          icon={TriangleAlert}
          label="Needs a look"
          value={overview.attention}
          tone={overview.attention > 0 ? 'warning' : 'default'}
          hint={overview.attention > 0 ? 'Drafts, edits or a deleted template' : 'All published'}
          selected={view === 'attention'}
          onSelect={overview.attention > 0 || view === 'attention' ? () => pick('attention') : undefined}
        />
        <Fact
          surface="page"
          icon={Activity}
          label="Runs"
          value={overview.runs.toLocaleString('en-GB')}
          hint={overview.failedRuns > 0 ? `${overview.failedRuns.toLocaleString('en-GB')} failed` : 'None failed'}
          onSelect={onOpenRuns}
        />
      </motion.dl>

      <motion.div variants={SECTION_RISE}>
        <CommunicationsToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Workflow name…"
          label="Find a workflow by name"
          count={filtersActive ? `${shownCount} of ${overview.all}` : `${overview.all} ${overview.all === 1 ? 'workflow' : 'workflows'}`}
          filters={
            <Select
              value={view}
              onValueChange={(value) => setView(value as AutomationView)}
              options={VIEWS.map((value) => ({
                value,
                label: value === 'all' ? AUTOMATION_VIEW_LABELS.all : `${AUTOMATION_VIEW_LABELS[value]} · ${overview[value]}`,
              }))}
              ariaLabel="Which workflows"
              className="w-40"
            />
          }
        />
      </motion.div>

      {shownGroups.length === 0 ? (
        <motion.div variants={SECTION_RISE}>
          <EmptyState
            icon={Search}
            kind="search"
            title="No workflow matches"
            description="Try a different search or filter."
            action={{ label: 'Clear filters', onClick: reset }}
          />
        </motion.div>
      ) : (
        shownGroups.map((group) => (
          <RecordGroup
            key={group.group}
            id={`automation-${group.group}`}
            title={group.label}
            actions={
              <span className="text-xs tabular-nums text-muted-foreground">
                {group.sending} of {group.items.length} on
              </span>
            }
          >
            <ListRowGroup aria-label={`${group.label} workflows`}>
              {group.items.map((automation) => (
                <AutomationRow
                  key={automation.id}
                  automation={automation}
                  templates={templates}
                  missing={missingOf(automation)}
                  access={access}
                  toggling={toggle.isPending && toggle.variables?.automation.id === automation.id}
                  onToggle={(isEnabled) => toggle.mutate({ automation, isEnabled })}
                  onEdit={() => onEdit({ automation })}
                  onDelete={() => setDeleteTarget(automation)}
                />
              ))}
            </ListRowGroup>
          </RecordGroup>
        ))
      )}

      {after}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this workflow?"
          message={
            <>
              “{deleteTarget.name}” will stop sending and be removed. Emails already sent stay in History. If you only want a break, switch
              it off instead.
            </>
          }
          confirmLabel="Delete workflow"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </motion.div>
  );
}

/** One workflow: name and what's wrong; trigger · what it does; its runs; the switch, always there; Delete on hover. */
function AutomationRow({
  automation,
  templates,
  missing,
  access,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  automation: EmailAutomation;
  templates: EmailTemplate[];
  missing: number;
  access: EmailAccess;
  toggling: boolean;
  onToggle: (isEnabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const definition = workflowForAutomation(automation);
  const templateName = (id: string) => templates.find((item) => item.id === id)?.name ?? 'an email';
  const flags = automationFlags(automation, missing);
  const failed = automation.failedRunCount ?? 0;
  const runs = automation.runCount ?? 0;
  // Switching a never-published draft on publishes it; switching off is an edit.
  const canToggle = !automation.isEnabled && automation.publishedVersion === 0 ? access.canPublish : access.canWrite;

  return (
    <ListRow
      icon={Zap}
      tone={missing > 0 ? 'exception' : automation.isEnabled ? 'success' : 'muted'}
      muted={!automation.isEnabled && missing === 0}
      title={automation.name}
      titleExtra={flags.map((flag) => (
        <Badge key={flag} variant={FLAG_BADGE[flag].variant} className="shrink-0">
          {FLAG_BADGE[flag].label}
        </Badge>
      ))}
      meta={
        <>
          <span className="sr-only">When: </span>
          {TRIGGER_LABELS[automation.trigger]}
          {automation.location && ` at ${automation.location.name}`} · {workflowSummary(definition, templateName)}
        </>
      }
      trailing={
        <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
          {runs.toLocaleString('en-GB')} {runs === 1 ? 'run' : 'runs'}
          {failed > 0 && <span className="font-semibold text-exception"> · {failed.toLocaleString('en-GB')} failed</span>}
        </span>
      }
      targetLabel={`Open ${automation.name}`}
      onClick={onEdit}
      control={
        <Switch label={`${automation.name} sending`} checked={automation.isEnabled} disabled={toggling || !canToggle} onChange={onToggle} />
      }
      actions={
        access.canWrite ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={`Delete ${automation.name}`}
            title="Delete"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        ) : undefined
      }
    />
  );
}
