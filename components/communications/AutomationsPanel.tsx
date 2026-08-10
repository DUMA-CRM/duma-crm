'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Activity, Clock3, Loader2, Pencil, Sparkles, Trash2, TriangleAlert } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  type EmailAutomation,
  type EmailTemplate,
  deleteEmailAutomation,
  getEmailAutomations,
  getEmailTemplates,
  publishEmailAutomation,
  updateEmailAutomation,
} from '@/lib/api/email.service';
import { formatDateTime } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PanelHeader } from './PanelChrome';
import { TRIGGER_LABELS } from './shared';
import { orderedWorkflowNodes, workflowForAutomation, workflowSummary } from './workflowModel';
import { FlowStrip } from './workflowNodes';

export function AutomationsPanel({
  onEdit,
  onOpenTemplates,
}: {
  onEdit: (selection: { automation?: EmailAutomation }) => void;
  onOpenTemplates: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<EmailAutomation | null>(null);

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['email-automations', tenantId],
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const activeTemplates = templates.filter((template) => template.isActive);
  const canCreate = activeTemplates.length > 0;

  const toggle = useMutation({
    mutationFn: ({ automation, isEnabled }: { automation: EmailAutomation; isEnabled: boolean }) =>
      isEnabled && automation.publishedVersion === 0
        ? publishEmailAutomation(automation.id, tenantId ?? undefined)
        : updateEmailAutomation(automation.id, { isEnabled }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['email-automations'] });
      toast('success', saved.isEnabled ? `“${saved.name}” is now sending.` : `“${saved.name}” is paused.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEmailAutomation(id, tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-automations'] });
      setDeleteTarget(null);
      toast('success', 'Automation deleted.');
    },
    onError: (error) => toast('error', error.message),
  });

  // Everything is listed, so the ones actually sending lead.
  const visible = useMemo(
    () => [...automations].sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled) || a.name.localeCompare(b.name)),
    [automations],
  );

  const sendingCount = automations.filter((automation) => automation.isEnabled).length;

  return (
    <div className="space-y-4">
      {/* The "New automation" action lives in the page header, next to the tabs. */}
      <PanelHeader
        title="Automations"
        count={automations.length}
        description="An automation watches for something happening — an order, a birthday — and emails one of your templates."
        actions={
          automations.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-rule bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
              <span
                className={cn('size-1.5 rounded-full', sendingCount ? 'bg-success' : 'bg-muted-foreground')}
                aria-hidden="true"
              />
              {sendingCount} of {automations.length} sending
            </span>
          ) : undefined
        }
      />

      {!canCreate && (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-warning/40 bg-warning/6 p-4">
          <TriangleAlert size={16} className="shrink-0 text-warning" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-warning">
            Automations need one ready-to-use template to send. Create that first and the options below unlock.
          </p>
          <Button variant="outline" size="sm" onClick={onOpenTemplates}>
            Go to templates
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-sm border border-rule bg-card" aria-hidden="true" />
          ))}
        </div>
      ) : !automations.length ? (
        <div className="rounded-sm border border-dashed border-rule bg-card">
          <EmptyState
            icon={Sparkles}
            title="No automations yet"
            description="Create a workflow to send the right email when an order or customer event happens."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              templates={templates}
              toggling={toggle.isPending && toggle.variables?.automation.id === automation.id}
              onToggle={() => toggle.mutate({ automation, isEnabled: !automation.isEnabled })}
              onEdit={() => onEdit({ automation })}
              onDelete={() => setDeleteTarget(automation)}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this automation?"
          message={
            <>
              “{deleteTarget.name}” will stop sending and be removed. Emails already sent stay in History. If you only want a break, pause
              it instead.
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

function AutomationCard({
  automation,
  templates,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  automation: EmailAutomation;
  templates: EmailTemplate[];
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const definition = workflowForAutomation(automation);
  const displayNodes = orderedWorkflowNodes(definition);
  const templateName = (id: string) => templates.find((item) => item.id === id)?.name ?? 'an email';
  // A deleted template is only flagged inactive, so a step can still point at one.
  const missingTemplates = definition.nodes
    .filter((node) => node.type === 'send_email')
    .map((node) => templates.find((item) => item.id === node.config.templateId))
    .filter((template) => !template || !template.isActive);

  return (
    <article
      className={cn(
        'rounded-sm border bg-card p-4 shadow-sm transition-colors md:p-5',
        automation.isEnabled ? 'border-success/30' : 'border-rule',
      )}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-sm',
            automation.isEnabled ? 'bg-success/6 text-success' : 'bg-band text-muted-foreground',
          )}
          aria-hidden="true"
        >
          <Sparkles size={17} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-foreground">{automation.name}</p>
            <Badge variant="primary">{TRIGGER_LABELS[automation.trigger]}</Badge>
            {automation.location && <Badge variant="muted">{automation.location.name}</Badge>}
            {automation.publishedVersion === 0 ? (
              <Badge variant="warning">Draft</Badge>
            ) : (
              <Badge variant="muted">v{automation.publishedVersion}</Badge>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{workflowSummary(definition, templateName)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={automation.isEnabled}
            aria-label={`${automation.isEnabled ? 'Pause' : 'Switch on'} ${automation.name}`}
            disabled={toggling}
            onClick={onToggle}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors disabled:opacity-60',
              automation.isEnabled
                ? 'border-success/30 bg-success/6 hover:bg-band'
                : 'border-rule bg-muted hover:bg-secondary',
            )}
          >
            <span
              className={cn(
                'inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
                automation.isEnabled ? 'border-success bg-success' : 'border-rule bg-card',
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  'ml-0.5 flex size-4 items-center justify-center rounded-full shadow-sm transition-transform',
                  automation.isEnabled ? 'translate-x-4 bg-white' : 'translate-x-0 bg-muted-foreground/60',
                )}
              >
                {toggling && <Loader2 size={9} className="animate-spin text-foreground" />}
              </span>
            </span>
            <span
              className={cn(
                'text-label font-semibold uppercase tracking-label',
                automation.isEnabled ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {automation.isEnabled ? 'Sending' : 'Paused'}
            </span>
          </button>
          <Button variant="outline" size="icon" onClick={onEdit} aria-label={`Edit ${automation.name}`} title="Edit workflow">
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label={`Delete ${automation.name}`}
            title="Delete"
            className="text-muted-foreground/60 hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* The flow at a glance — the same chips and colours as the editor canvas. */}
      <FlowStrip nodes={displayNodes} templateName={templateName} className="mt-4" />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-label text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Activity size={12} aria-hidden="true" />
          {automation.runCount ?? 0} run{(automation.runCount ?? 0) === 1 ? '' : 's'}
        </span>
        {Boolean(automation.failedRunCount) && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
            <TriangleAlert size={12} aria-hidden="true" />
            {automation.failedRunCount} failed
          </span>
        )}
        {automation.lastEvaluatedAt && (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={12} aria-hidden="true" />
            Last checked {formatDateTime(automation.lastEvaluatedAt)}
          </span>
        )}
      </div>

      {missingTemplates.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {missingTemplates.length === 1 ? 'One email template has' : `${missingTemplates.length} email templates have`} been deleted,
            so affected steps will not send.
          </span>
        </p>
      )}
    </article>
  );
}
