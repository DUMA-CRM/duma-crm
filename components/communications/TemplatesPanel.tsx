'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Copy, Eye, Mail, Plus, Search, Trash2 } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import {
  type EmailTemplate,
  archiveEmailTemplate,
  createEmailTemplate,
  getEmailAutomations,
  getEmailTemplates,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { groupTemplates, templateUsage } from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CommunicationsToolbar } from './CommunicationsToolbar';
import { TEMPLATE_CATEGORIES, templateCategoryLabel } from './shared';
import { useEmailAccess } from './useEmailAccess';
import { workflowForAutomation } from './workflowModel';

const CATEGORY_ORDER = TEMPLATE_CATEGORIES.map((category) => category.value);

type Usage = 'any' | 'used' | 'unused';

/**
 * Templates as Forms lists its forms: a search with the Category and Use
 * selects and the count, then one row per template — category order, then
 * name. A row opens the editor (the preview, for someone who can only read);
 * Preview, Duplicate and Delete sit on the row's hover.
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
  const reduceMotion = useReducedMotion();
  const { canWrite } = useEmailAccess();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [inUse, setInUse] = useState<Usage>('any');
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const templatesQuery = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-templates', tenantId),
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: automations = [] } = useQuery({
    queryKey: moduleQueryKeys.automation.key('email-automations', tenantId),
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
  // groupTemplates keeps the live ones in category order; the list is one run of rows.
  const all = useMemo(
    () => groupTemplates(templatesQuery.data ?? [], CATEGORY_ORDER, usage).flatMap((group) => group.items),
    [templatesQuery.data, usage],
  );
  const needle = search.trim().toLowerCase();
  const shown = all.filter((template) => {
    const uses = usage.get(template.id) ?? 0;
    return (
      (category === 'all' || template.category === category) &&
      (inUse === 'any' || (inUse === 'used' ? uses > 0 : uses === 0)) &&
      `${template.name} ${template.subject}`.toLowerCase().includes(needle)
    );
  });
  const unused = all.filter((template) => (usage.get(template.id) ?? 0) === 0).length;
  const filtersActive = Boolean(needle) || category !== 'all' || inUse !== 'any';
  const reset = () => {
    setSearch('');
    setCategory('all');
    setInUse('any');
  };
  const deleteUses = deleteTarget ? (usage.get(deleteTarget.id) ?? 0) : 0;

  if (templatesQuery.isError)
    return <ErrorState className="flex-1" title="Templates couldn’t be loaded" onRetry={() => void templatesQuery.refetch()} />;

  if (templatesQuery.isPending)
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Bone className="h-9 min-w-56 flex-1" />
          <Bone className="h-9 w-40" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={5} label="Loading templates" />
      </div>
    );

  if (all.length === 0)
    return (
      <EmptyState
        className="flex-1"
        icon={Mail}
        title={canWrite ? 'Create your first email template' : 'No email templates yet'}
        description="A reusable email with your own content, brand styles, images and customer details. Automations send these."
        action={canWrite ? { label: 'Create template', onClick: () => onEdit({}), icon: Plus } : undefined}
      />
    );

  return (
    <motion.div
      className="flex flex-col gap-3"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      <motion.div variants={SECTION_RISE}>
        <CommunicationsToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Name or subject…"
          label="Find a template by name or subject"
          count={filtersActive ? `${shown.length} of ${all.length}` : `${all.length} ${all.length === 1 ? 'template' : 'templates'}`}
          filters={
            <>
              <Select
                value={category}
                onValueChange={setCategory}
                options={[{ value: 'all', label: 'All categories' }, ...TEMPLATE_CATEGORIES.map(({ value, label }) => ({ value, label }))]}
                ariaLabel="Template category"
                className="w-40"
              />
              <Select
                value={inUse}
                onValueChange={(value) => setInUse(value as Usage)}
                options={[
                  { value: 'any', label: 'Any use' },
                  { value: 'used', label: `In use · ${all.length - unused}` },
                  { value: 'unused', label: `Not in use · ${unused}` },
                ]}
                ariaLabel="Whether an automation sends it"
                className="w-40"
              />
            </>
          }
        />
      </motion.div>

      <motion.div variants={SECTION_RISE}>
        {shown.length === 0 ? (
          <EmptyState
            icon={Search}
            kind="search"
            title="No template matches"
            description="Try a different search or filter."
            action={{ label: 'Clear filters', onClick: reset }}
          />
        ) : (
          <ListRowGroup aria-label="Templates">
            {shown.map((template) => (
              <TemplateRow
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
          </ListRowGroup>
        )}
      </motion.div>

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

/** One template: tile and name; its category and subject; how many automations send it; Preview, Duplicate, Delete on hover. */
function TemplateRow({
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
    <ListRow
      icon={Mail}
      tone={uses > 0 ? 'success' : 'muted'}
      title={template.name}
      meta={
        <>
          {templateCategoryLabel(template.category)} · {template.subject}
        </>
      }
      trailing={
        <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
          {uses > 0 ? `${uses} automation${uses === 1 ? '' : 's'}` : 'Not in use'}
        </span>
      }
      targetLabel={canWrite ? `Edit ${template.name}` : `Preview ${template.name}`}
      onClick={onOpen}
      actions={
        <>
          <Button variant="ghost" size="icon-sm" onClick={onPreview} aria-label={`Preview ${template.name}`} title="Preview">
            <Eye />
          </Button>
          {canWrite && (
            <>
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
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </>
          )}
        </>
      }
    />
  );
}
