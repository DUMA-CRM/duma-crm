'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Copy, Eye, Mail, Plus, Trash2, Zap } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import {
  type EmailTemplate,
  archiveEmailTemplate,
  createEmailTemplate,
  getEmailAutomations,
  getEmailTemplates,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { groupTemplates, templateUsage } from '@/lib/utils/communications';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { TEMPLATE_CATEGORIES, templateCategoryLabel } from './shared';
import { useEmailAccess } from './useEmailAccess';
import { workflowForAutomation } from './workflowModel';

const CATEGORY_ORDER = TEMPLATE_CATEGORIES.map((category) => category.value);

/**
 * Templates as the Menu lists its items — a heading per category, then the
 * things in it — but as cards, because what a template looks like is the
 * reason to open this tab. A card opens the editor (or the preview, for
 * someone who can only read); the thumbnail always previews.
 */
export function TemplatesPanel({
  onEdit,
  onPreview,
}: {
  onEdit: (selection: { template?: EmailTemplate }) => void;
  onPreview: (template: EmailTemplate) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const { canWrite } = useEmailAccess();
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const templatesQuery = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-templates', tenantId),
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: automations = [] } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-automations', tenantId),
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const duplicate = useMutation({
    mutationFn: (template: EmailTemplate) =>
      createEmailTemplate({
        tenantId: tenantId ?? undefined,
        name: `${template.name} (copy)`,
        category: template.category,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody ?? '',
        design: template.design ?? null,
        isActive: true,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-templates') });
      toast('success', 'Copy created — opening it now.');
      onEdit({ template: created });
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (template: EmailTemplate) => archiveEmailTemplate(template.id, tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-templates') });
      setDeleteTarget(null);
      toast('success', 'Template deleted.');
    },
    onError: (error) => toast('error', error.message),
  });

  // Through workflowForAutomation so an automation saved before workflows existed still counts.
  const usage = useMemo(
    () => templateUsage(automations.map((automation) => ({ definition: workflowForAutomation(automation) }))),
    [automations],
  );
  const groups = useMemo(() => groupTemplates(templatesQuery.data ?? [], CATEGORY_ORDER, usage), [templatesQuery.data, usage]);
  const deleteUses = deleteTarget ? (usage.get(deleteTarget.id) ?? 0) : 0;

  if (templatesQuery.isError)
    return (
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <ErrorState title="Templates couldn’t be loaded" onRetry={() => void templatesQuery.refetch()} />
      </div>
    );

  if (templatesQuery.isPending)
    return (
      <div role="status" aria-busy="true" aria-label="Loading templates">
        <Bone className="mb-2 h-3 w-40" />
        <TemplateGrid>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col overflow-hidden rounded-lg border border-rule/60 bg-card" aria-hidden="true">
              <Bone className="aspect-16/10 w-full rounded-none border-b border-rule/45" />
              <span className="space-y-1.5 px-3.5 py-3">
                <Bone className={cn('h-3.5', index % 2 ? 'w-28' : 'w-36')} />
                <Bone className="h-3 w-44 max-w-full" />
              </span>
            </div>
          ))}
        </TemplateGrid>
      </div>
    );

  if (groups.length === 0)
    return (
      <EmptyState
        icon={Mail}
        title={canWrite ? 'Create your first email template' : 'No email templates yet'}
        description="A reusable email with your own content, brand styles, images and customer details. Automations send these."
        action={canWrite ? { label: 'Create template', onClick: () => onEdit({}), icon: Plus } : undefined}
      />
    );

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      {groups.map((group) => (
        <motion.section key={group.category} variants={SECTION_RISE} aria-label={templateCategoryLabel(group.category)}>
          <h2 className="mb-2 flex items-center gap-2 text-label uppercase text-muted-foreground">
            {templateCategoryLabel(group.category)}
            <span className="normal-case tabular-nums">
              {group.items.length} {group.items.length === 1 ? 'template' : 'templates'} · {group.inUse} in use
            </span>
          </h2>
          <TemplateGrid>
            {group.items.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                uses={usage.get(template.id) ?? 0}
                canWrite={canWrite}
                duplicating={duplicate.isPending}
                onOpen={() => (canWrite ? onEdit({ template }) : onPreview(template))}
                onPreview={() => onPreview(template)}
                onDuplicate={() => duplicate.mutate(template)}
                onDelete={() => setDeleteTarget(template)}
              />
            ))}
          </TemplateGrid>
        </motion.section>
      ))}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this template?"
          message={
            deleteUses > 0 ? (
              <>
                “{deleteTarget.name}” is sent by {deleteUses} automation{deleteUses === 1 ? '' : 's'} — those steps will stop sending.
                Emails already sent stay in History.
              </>
            ) : (
              <>“{deleteTarget.name}” will be removed from your templates. Emails already sent stay in History.</>
            )
          }
          confirmLabel="Delete template"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </motion.div>
  );
}

function TemplateGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function TemplateCard({
  template,
  uses,
  canWrite,
  duplicating,
  onOpen,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  template: EmailTemplate;
  uses: number;
  canWrite: boolean;
  duplicating: boolean;
  onOpen: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-rule/60 bg-card transition-colors hover:border-rule">
      {/* The thumbnail is the preview — the whole plate is the button. */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${template.name}`}
        className="relative block aspect-16/10 w-full overflow-hidden border-b border-rule/45 bg-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <iframe
          title=""
          sandbox=""
          tabIndex={-1}
          srcDoc={template.htmlBody}
          className="pointer-events-none h-175 w-[200%] origin-top-left scale-50 border-0 bg-white"
        />
        {/* Rendered emails are white in both themes, so the scrim is fixed dark. */}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-md">
            <Eye size={14} aria-hidden="true" /> Preview
          </span>
        </span>
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2 px-3.5 py-3 transition-colors hover:bg-band/40">
        <button
          type="button"
          onClick={onOpen}
          aria-label={canWrite ? `Edit ${template.name}` : `Preview ${template.name}`}
          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="block truncate text-sm font-semibold text-foreground" title={template.name}>
            {template.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground" title={template.subject}>
            {template.subject}
          </span>
          <span
            className={cn(
              'mt-1 inline-flex items-center gap-1 text-micro font-semibold tabular-nums',
              uses > 0 ? 'text-momentum' : 'text-muted-foreground/60',
            )}
            title={uses > 0 ? `In ${uses} automation${uses === 1 ? '' : 's'}` : 'Not in an automation'}
          >
            <Zap size={11} aria-hidden="true" />
            {uses}
          </span>
        </button>
        {canWrite && (
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={duplicating}
              onClick={onDuplicate}
              aria-label={`Duplicate ${template.name}`}
              title="Make an editable copy"
            >
              <Copy />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              aria-label={`Delete ${template.name}`}
              title="Delete"
              className="text-muted-foreground/60 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </span>
        )}
      </div>
    </article>
  );
}
