'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { RowTile } from '@/components/cms/rows';
import { ChevronRight, FileText, Plus, Search, Send, Trash2, TriangleAlert, XCircle, Zap } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
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
import { cn } from '@/lib/utils/cn';
import { attentionIssues, groupAutomations, hasUnpublishedChanges, missingTemplateCount, timeAgo } from '@/lib/utils/communications';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CommunicationsToolbar } from './CommunicationsToolbar';
import { TRIGGER_LABELS } from './shared';
import { type EmailAccess, useEmailAccess } from './useEmailAccess';
import { workflowForAutomation, workflowSummary } from './workflowModel';

/**
 * The automations in the Content lists' vocabulary: one card per kind of
 * trigger, a row per automation — tile, what it is and what's wrong, its runs,
 * the on/off switch — and the totals in the aside. "New automation" lives in
 * the page header.
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
  const reduceMotion = useReducedMotion();
  const [deleteTarget, setDeleteTarget] = useState<EmailAutomation | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
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

  // What blocks creating one — delivery failures and the connection belong to the Overview.
  const attention = useMemo<NeedsAttentionItem[]>(() => {
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
  const figure = (value: number | string) => (automationsQuery.isSuccess ? value : '—');
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

  if (automationsQuery.isSuccess && automations.length === 0)
    return (
      <div className="flex flex-1 flex-col space-y-5">
        <EmptyState
          icon={Zap}
          title="No automations yet"
          className="flex-1"
          description={
            access.canWrite
              ? 'Automations you set up appear here, each sending an email when something happens — an order is ready, a birthday, a first visit.'
              : 'Automations appear here once someone sets one up.'
          }
          action={
            access.canWrite
              ? canCreate
                ? { label: 'New automation', onClick: () => onEdit({}), icon: Plus }
                : { label: 'Create a template', onClick: onOpenTemplates, icon: FileText }
              : undefined
          }
        />
      </div>
    );

  return (
    <div className="flex flex-1 flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Fact surface="card" icon={Zap} label="Sending" value={figure(automations.filter((automation) => automation.isEnabled).length)} />
        <Fact
          surface="card"
          icon={Send}
          label="Runs"
          value={figure(automations.reduce((total, automation) => total + (automation.runCount ?? 0), 0).toLocaleString())}
        />
        <Fact
          surface="card"
          icon={XCircle}
          label="Failed runs"
          value={figure(automations.reduce((total, automation) => total + (automation.failedRunCount ?? 0), 0).toLocaleString())}
        />
        <Fact surface="card" icon={TriangleAlert} label="Needs a look" value={figure(flagged)} />
      </dl>
      {attention.length > 0 && <NeedsAttention items={attention} />}

      {automationsQuery.isPending ? (
        <div>
          <TilesSkeleton count={4} label="Loading automations" />
        </div>
      ) : automationsQuery.isError ? (
        <div>
          <ErrorState title="Automations couldn’t be loaded" onRetry={() => void automationsQuery.refetch()} />
        </div>
      ) : (
        <>
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
              className="flex-1"
              icon={Search}
              kind="search"
              title="Nothing matches"
              description="Try another search or status."
              action={{ label: 'Clear filters', onClick: reset }}
            />
          )}
          {shownGroups.map((group) => (
            <motion.section key={group.group} variants={SECTION_RISE} aria-label={group.label}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {group.items.filter((automation) => automation.isEnabled).length} of {group.items.length} sending
                </span>
              </div>
              <ul className="space-y-2">
                {group.items.map((automation, index) => (
                  <motion.li
                    key={automation.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03 } }}
                  >
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
                  </motion.li>
                ))}
              </ul>
            </motion.section>
          ))}
        </>
      )}

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
    </div>
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
    <div className="group flex items-center gap-2 rounded-lg border border-rule/50 bg-field pr-2 transition-colors hover:border-rule">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Open ${automation.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-l-lg py-2.5 pl-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <RowTile icon={Zap} tone={missing > 0 ? 'danger' : automation.isEnabled ? 'success' : 'default'} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className={cn('truncate text-sm font-semibold', automation.isEnabled ? 'text-foreground' : 'text-muted-foreground')}>
              {automation.name}
            </span>
            {flags.map((flag) => (
              <span
                key={flag.label}
                className={cn(
                  'inline shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold',
                  flag.tone === 'exception' ? 'bg-exception/8 text-exception' : 'bg-measured/10 text-measured',
                )}
              >
                {flag.label}
              </span>
            ))}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            <span className="sr-only">When: </span>
            {TRIGGER_LABELS[automation.trigger]}
            {automation.location && ` at ${automation.location.name}`} · {workflowSummary(definition, templateName)}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
          <span className="block">
            <span className="font-semibold text-foreground">{runs.toLocaleString()}</span> {runs === 1 ? 'run' : 'runs'}
            {failed > 0 && <span className="font-semibold text-exception"> · {failed} failed</span>}
          </span>
          <span className="block" title={automation.lastEvaluatedAt ?? undefined}>
            {automation.lastEvaluatedAt ? `Checked ${timeAgo(automation.lastEvaluatedAt, now)}` : 'Not checked yet'}
          </span>
        </span>
      </button>

      <span className="ml-1 flex shrink-0 items-center">
        <Switch label={`${automation.name} sending`} checked={automation.isEnabled} disabled={toggling || !canToggle} onChange={onToggle} />
      </span>
      {access.canWrite && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Delete ${automation.name}`}
          title="Delete"
          className="text-muted-foreground opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
        >
          <Trash2 />
        </Button>
      )}
      <ChevronRight
        size={16}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </div>
  );
}
