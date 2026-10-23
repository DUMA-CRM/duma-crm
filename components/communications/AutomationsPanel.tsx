'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { InfoRow, InfoRows, RowMenu, RowTile } from '@/components/cms/rows';
import { FileText, Pencil, Plus, Search, Send, Trash2, TriangleAlert, XCircle, Zap } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils/cn';
import { attentionIssues, groupAutomations, hasUnpublishedChanges, missingTemplateCount, timeAgo } from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CommunicationsToolbar } from './CommunicationsToolbar';
import { TRIGGER_LABELS } from './shared';
import { type EmailAccess, useEmailAccess } from './useEmailAccess';
import { workflowForAutomation, workflowSummary } from './workflowModel';

/**
 * The automations laid out like the settings rules pages: a section per kind
 * of trigger, a row per automation — tile, what it is and what's wrong, its
 * runs, the on/off switch, a ⋯ menu — and the totals, with anything blocking,
 * in the aside. "New workflow" lives in the page header.
 */
export function AutomationsPanel({
  onEdit,
  onOpenTemplates,
  asideExtra,
}: {
  onEdit: (selection: { automation?: EmailAutomation }) => void;
  onOpenTemplates: () => void;
  /** More rail cards under the Overview, from the page mounting the panel (Automation's scheduled jobs). */
  asideExtra?: React.ReactNode;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useEmailAccess();
  const reduceMotion = useReducedMotion();
  const [deleteTarget, setDeleteTarget] = useState<EmailAutomation | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  // Pinned on mount so "5 min ago" doesn't shift under a render.
  const [now] = useState(() => Date.now());

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
      toast('success', 'Automation deleted.');
    },
    onError: (error) => toast('error', error.message),
  });

  const groups = useMemo(() => groupAutomations(automations), [automations]);

  // What blocks creating one — delivery failures and the connection belong to the Overview.
  const attention = useMemo<NeedsAttentionItem[]>(() => {
    const items: NeedsAttentionItem[] = [];
    if (templatesQuery.isSuccess && !canCreate && access.canWrite)
      items.push({
        key: 'no-template',
        tone: 'measured',
        icon: FileText,
        title: 'There’s no template to send yet',
        detail: 'Email actions need a template. You can also build a workflow that creates a helpdesk task.',
        fix: { label: 'Go to templates', run: onOpenTemplates },
      });
    return items;
  }, [access.canWrite, canCreate, onOpenTemplates, templatesQuery.isSuccess]);

  // The automation problems are flagged on their own rows, so up here they are
  // only counted — the fix is one glance down.
  const flagged = useMemo(() => {
    const ids = new Set<string>();
    for (const issue of attentionIssues({ connection: 'unknown', deliveries: [], automations, templates, now }))
      if (issue.kind === 'missing_template' || issue.kind === 'failed_runs' || issue.kind === 'unpublished') ids.add(issue.automationId);
    return ids.size;
  }, [automations, now, templates]);

  const needle = search.trim().toLowerCase();
  const reset = () => {
    setSearch('');
    setStatus('all');
  };
  const shownGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (automation) =>
              automation.name.toLowerCase().includes(needle) &&
              (status === 'all' || (status === 'live' ? automation.isEnabled : !automation.isEnabled)),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [groups, needle, status],
  );

  if (automationsQuery.isSuccess && automations.length === 0) {
    const empty = (
      <div className="flex flex-1 flex-col space-y-5">
        <EmptyState
          icon={Zap}
          title="No automations yet"
          className="flex-1"
          description={
            access.canWrite
              ? 'Start with an event, then send an email or create a task for your team.'
              : 'Automations appear here once someone sets one up.'
          }
          action={access.canWrite ? { label: 'New workflow', onClick: () => onEdit({}), icon: Plus } : undefined}
        />
      </div>
    );
    return asideExtra ? (
      <SettingsTabBody narrowAside aside={asideExtra}>
        {empty}
      </SettingsTabBody>
    ) : (
      empty
    );
  }

  if (automationsQuery.isPending) return <Bone className="h-96 w-full rounded-lg" />;
  if (automationsQuery.isError)
    return <ErrorState title="Automations couldn’t be loaded" onRetry={() => void automationsQuery.refetch()} />;

  const sending = automations.filter((automation) => automation.isEnabled).length;
  const runs = automations.reduce((total, automation) => total + (automation.runCount ?? 0), 0);
  const failed = automations.reduce((total, automation) => total + (automation.failedRunCount ?? 0), 0);

  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      <SettingsTabBody
        narrowAside
        // A taller rail would pin its foot out of reach.
        stickyAside={!asideExtra}
        aside={
          <>
            <SettingsSection title="Overview">
              <InfoRows>
                <InfoRow icon={Zap} tone={sending > 0 ? 'success' : 'default'} title="Sending">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {sending} of {automations.length}
                  </span>
                </InfoRow>
                <InfoRow icon={Send} title="Runs">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{runs.toLocaleString()}</span>
                </InfoRow>
                <InfoRow icon={XCircle} tone={failed > 0 ? 'danger' : 'default'} title="Failed runs">
                  <span className={cn('text-sm font-semibold tabular-nums', failed > 0 ? 'text-exception' : 'text-foreground')}>
                    {failed.toLocaleString()}
                  </span>
                </InfoRow>
                <InfoRow icon={TriangleAlert} tone={flagged > 0 ? 'warning' : 'default'} title="Needs a look">
                  <span className={cn('text-sm font-semibold tabular-nums', flagged > 0 ? 'text-measured' : 'text-foreground')}>
                    {flagged}
                  </span>
                </InfoRow>
              </InfoRows>
              {flagged > 0 && (
                <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                  Flagged workflows are marked on their rows — a deleted template, a draft, or changes not yet published.
                </p>
              )}
              {attention.map((item) => (
                <div
                  key={item.key}
                  className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured"
                  role="status"
                >
                  <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
                  <span>
                    {item.title}. {item.detail}{' '}
                    {item.fix && (
                      <button type="button" className="underline underline-offset-2 hover:no-underline" onClick={item.fix.run}>
                        {item.fix.label}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </SettingsSection>
            {asideExtra}
          </>
        }
      >
        <CommunicationsToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search automations…"
          onClear={reset}
          count={`${shownGroups.reduce((total, group) => total + group.items.length, 0)} automations`}
          filters={
            <Select
              value={status}
              onValueChange={setStatus}
              options={[
                { value: 'all', label: 'All automations' },
                { value: 'live', label: 'Sending' },
                { value: 'off', label: 'Switched off' },
              ]}
              ariaLabel="Automation status"
              className="w-full sm:w-44"
            />
          }
          chips={status === 'all' ? [] : [{ label: status === 'live' ? 'Sending' : 'Switched off', onRemove: () => setStatus('all') }]}
        />
        {shownGroups.length === 0 && (
          <EmptyState
            icon={Search}
            kind="search"
            title="Nothing matches"
            description="Try another search or status."
            action={{ label: 'Clear filters', onClick: reset }}
          />
        )}
        {shownGroups.map((group) => {
          const on = group.items.filter((automation) => automation.isEnabled).length;
          return (
            <SettingsSection
              key={group.group}
              title={group.label}
              actions={
                <Badge variant={on > 0 ? 'success' : 'muted'}>
                  {on} of {group.items.length} on
                </Badge>
              }
            >
              <ul className="-mx-2 flex flex-col gap-0.5">
                {group.items.map((automation) => (
                  <li key={automation.id}>
                    <AutomationRow
                      automation={automation}
                      templates={templates}
                      now={now}
                      access={access}
                      toggling={toggle.isPending && toggle.variables?.automation.id === automation.id}
                      onToggle={(isEnabled) => toggle.mutate({ automation, isEnabled })}
                      onEdit={() => onEdit({ automation })}
                      onDelete={() => setDeleteTarget(automation)}
                    />
                  </li>
                ))}
              </ul>
            </SettingsSection>
          );
        })}
      </SettingsTabBody>

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

/** One automation, in the Content list rows' shape: tile, name and what's wrong, its numbers, the switch. */
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
  const runs = automation.runCount ?? 0;
  // Only what's wrong or not live — a healthy automation says nothing extra.
  const flags: { label: string; tone: 'exception' | 'measured' }[] = [];
  if (missing > 0) flags.push({ label: 'Deleted template', tone: 'exception' });
  if (draft) flags.push({ label: 'Draft', tone: 'measured' });
  else if (hasUnpublishedChanges(automation)) flags.push({ label: 'Unpublished changes', tone: 'measured' });
  // Switching a never-published draft on publishes it; switching off is an edit.
  const canToggle = !automation.isEnabled && draft ? access.canPublish : access.canWrite;

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Open ${automation.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <RowTile icon={Zap} tone={missing > 0 ? 'danger' : automation.isEnabled ? 'success' : 'default'} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn('truncate text-sm font-semibold', automation.isEnabled ? 'text-foreground' : 'text-muted-foreground')}>
              {automation.name}
            </span>
            {flags.map((flag) => (
              <Badge key={flag.label} variant={flag.tone === 'exception' ? 'destructive' : 'warning'} className="shrink-0">
                {flag.label}
              </Badge>
            ))}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            <span className="sr-only">When: </span>
            {TRIGGER_LABELS[automation.trigger]}
            {automation.location && ` at ${automation.location.name}`} · {workflowSummary(definition, templateName)}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs tabular-nums text-muted-foreground md:block">
          <span className="block">
            <span className="font-semibold text-foreground">{runs.toLocaleString()}</span> {runs === 1 ? 'run' : 'runs'}
            {failed > 0 && <span className="font-semibold text-exception"> · {failed} failed</span>}
          </span>
          <span className="block" title={automation.lastEvaluatedAt ?? undefined}>
            {automation.lastEvaluatedAt ? `Checked ${timeAgo(automation.lastEvaluatedAt, now)}` : 'Not checked yet'}
          </span>
        </span>
      </button>
      <Switch label={`${automation.name} sending`} checked={automation.isEnabled} disabled={toggling || !canToggle} onChange={onToggle} />
      <RowMenu
        label={`${automation.name} actions`}
        items={[
          { icon: Pencil, label: 'Open', onClick: onEdit },
          ...(access.canWrite ? [{ icon: Trash2, label: 'Delete', danger: true, onClick: onDelete }] : []),
        ]}
      />
    </div>
  );
}
