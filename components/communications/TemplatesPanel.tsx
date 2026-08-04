'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Copy, Eye, Mail, Pencil, Plus, Sparkles, Trash2 } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  type EmailTemplate,
  archiveEmailTemplate,
  createEmailTemplate,
  getEmailAutomations,
  getEmailTemplates,
} from '@/lib/api/email.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PanelHeader } from './PanelChrome';
import { workflowForAutomation } from './workflowModel';

export function TemplatesPanel({
  onEdit,
  onPreview,
}: {
  onEdit: (selection: { template?: EmailTemplate }) => void;
  onPreview: (template: EmailTemplate) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: automations = [] } = useQuery({
    queryKey: ['email-automations', tenantId],
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
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast('success', 'Copy created — opening it now.');
      onEdit({ template: created });
    },
    onError: (error) => toast('error', error.message),
  });

  const remove = useMutation({
    mutationFn: (template: EmailTemplate) => archiveEmailTemplate(template.id, tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setDeleteTarget(null);
      toast('success', 'Template deleted.');
    },
    onError: (error) => toast('error', error.message),
  });

  // Deleting a template only flags it inactive, so the list shows live ones and
  // nothing else — grouped by category, alphabetical within each.
  const visible = useMemo(
    () =>
      templates
        .filter((template) => template.isActive)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [templates],
  );

  const usageCount = (templateId: string) =>
    automations.filter((automation) =>
      workflowForAutomation(automation).nodes.some((node) => node.type === 'send_email' && node.config.templateId === templateId),
    ).length;
  const isFirstRun = !visible.length && !isLoading;

  return (
    <div className="space-y-4">
      {/* The "New template" action lives in the page header, next to the tabs. */}
      <PanelHeader
        title="Templates"
        count={visible.length}
        description="A template is an email you write once and reuse — order updates, birthday notes, thank-yous."
      />

      {isLoading ? (
        <TemplateGrid>
          {Array.from({ length: 6 }, (_, index) => (
            <TemplateCardSkeleton key={index} />
          ))}
        </TemplateGrid>
      ) : isFirstRun ? (
        <FirstRunCard onCreate={() => onEdit({})} />
      ) : (
        <TemplateGrid>
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              uses={usageCount(template.id)}
              duplicating={duplicate.isPending}
              onEdit={() => onEdit({ template })}
              onPreview={() => onPreview(template)}
              onDuplicate={() => duplicate.mutate(template)}
              onDelete={() => setDeleteTarget(template)}
            />
          ))}
        </TemplateGrid>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this template?"
          message={
            <>
              “{deleteTarget.name}” will be removed from your templates, and any automation step using it will stop sending. Emails
              already sent stay in History.
            </>
          }
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function TemplateGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}

function TemplateCard({
  template,
  uses,
  duplicating,
  onEdit,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  template: EmailTemplate;
  uses: number;
  duplicating: boolean;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="group/card flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary/40">
      {/* The thumbnail is the preview affordance — the whole plate is the button. */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${template.name}`}
        className="relative block aspect-4/3 w-full overflow-hidden border-b border-border bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <iframe
          title=""
          sandbox=""
          tabIndex={-1}
          srcDoc={template.htmlBody}
          className="pointer-events-none h-175 w-[200%] origin-top-left scale-50 border-0 bg-white"
        />
        {/* Rendered emails are white in both themes, so the scrim is fixed dark. */}
        <span className="absolute inset-0 flex items-center justify-center bg-foreground/25 opacity-0 transition-opacity group-hover/card:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-md">
            <Eye size={14} aria-hidden="true" /> Open preview
          </span>
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <p className="truncate font-semibold text-foreground" title={template.name}>
          {template.name}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground" title={template.subject}>
          {template.subject}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant="muted" className="capitalize">
            {template.category}
          </Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            {uses > 0 && <Sparkles size={11} aria-hidden="true" />}
            {uses ? `Used by ${uses} automation${uses === 1 ? '' : 's'}` : 'Not automated yet'}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            <Pencil /> Edit
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onPreview} aria-label={`Preview ${template.name}`} title="Preview">
            <Eye />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={duplicating}
            onClick={onDuplicate}
            aria-label={`Duplicate ${template.name}`}
            title="Create an editable copy"
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
        </div>
      </div>
    </article>
  );
}

function TemplateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-hidden="true">
      <div className="aspect-4/3 w-full animate-pulse border-b border-border bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function FirstRunCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Mail size={24} />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">Create your first email template</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        Build a reusable email with your own content, brand styles, images, and customer variables.
      </p>
      <Button className="mt-5 gap-2" onClick={onCreate}>
        <Plus size={15} /> Create template
      </Button>
    </div>
  );
}
