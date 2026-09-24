'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Copy, Eye, Mail, Pencil, Plus, Trash2 } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Button } from '@/components/ui/button';

import {
  type EmailTemplate,
  archiveEmailTemplate,
  createEmailTemplate,
  getEmailAutomations,
  getEmailTemplates,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { TEMPLATE_CATEGORIES, templateCategoryLabel } from './shared';
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

  // Deleting a template only flags it inactive, so the list shows live ones and
  // nothing else — grouped by category, alphabetical within each.
  const live = useMemo(
    () =>
      templates
        .filter((template) => template.isActive)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [templates],
  );

  /**
   * The sort already puts categories together; without headings that grouping is
   * only implied, and a staff member scanning for "the birthday one" has to read
   * every card to find where one category ends and the next begins.
   */
  const groups = useMemo(() => {
    const buckets = new Map<string, typeof live>();
    for (const template of live) buckets.set(template.category, [...(buckets.get(template.category) ?? []), template]);
    const rank = (value: string) => {
      const at = TEMPLATE_CATEGORIES.findIndex((category) => category.value === value);
      // Anything from the old free-text era sorts after the known five.
      return at === -1 ? TEMPLATE_CATEGORIES.length : at;
    };
    return [...buckets.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  }, [live]);

  const usageCount = (templateId: string) =>
    automations.filter((automation) =>
      workflowForAutomation(automation).nodes.some((node) => node.type === 'send_email' && node.config.templateId === templateId),
    ).length;
  const isFirstRun = !live.length && !isLoading;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <TemplateGrid>
          {Array.from({ length: 6 }, (_, index) => (
            <TemplateCardSkeleton key={index} />
          ))}
        </TemplateGrid>
      ) : isFirstRun ? (
        <FirstRunCard onCreate={() => onEdit({})} />
      ) : (
        <div className="space-y-5">
          {groups.map(([category, items]) => (
            <section key={category}>
              <h3 className="mb-2 text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                {templateCategoryLabel(category)} <span className="tabular-nums">· {items.length}</span>
              </h3>
              <TemplateGrid>
                {items.map((template) => (
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
            </section>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this template?"
          message={
            <>
              “{deleteTarget.name}” will be removed from your templates, and any automation step using it will stop sending. Emails already
              sent stay in History.
            </>
          }
          confirmLabel="Delete template"
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
    <article className="group/card flex flex-col overflow-hidden rounded-sm border border-rule bg-card shadow-sm transition-colors hover:border-primary/40">
      {/* The thumbnail is the preview affordance — the whole plate is the button. */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${template.name}`}
        className="relative block aspect-4/3 w-full overflow-hidden border-b border-rule bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-md">
            <Eye size={14} aria-hidden="true" /> Open preview
          </span>
        </span>
      </button>

      {/* Four things, not six.
          - The category badge went: these cards sit under a category heading, so
            it restated the line directly above them.
          - The preview icon went: the whole thumbnail is already the preview
            button and says so on hover. Two controls for one action is how a
            card ends up with a toolbar.
          - "Not automated yet" went: it was on most cards and told nobody
            anything. The count now appears only when the template IS in use,
            which is the case where it changes a decision — deleting it breaks
            something. */}
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <p className="truncate text-sm font-semibold text-foreground" title={template.name}>
          {template.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={template.subject}>
          {template.subject}
        </p>

        <div className="mt-3 flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            <Pencil /> Edit
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

        {uses > 0 && (
          <p className="mt-2 text-label text-muted-foreground">
            In {uses} automation{uses === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </article>
  );
}

function TemplateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-sm border border-rule bg-card shadow-sm" aria-hidden="true">
      <div className="aspect-4/3 w-full animate-pulse border-b border-rule bg-muted" />
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
    <div className="rounded-sm border border-dashed border-rule bg-card p-10 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-sm bg-band text-primary">
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
