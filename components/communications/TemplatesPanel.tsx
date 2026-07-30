'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, Mail, Pencil, Plus, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type EmailTemplate, createEmailTemplate, getEmailAutomations, getEmailTemplates } from '@/lib/api/email.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { TEMPLATE_PRESETS } from './presets';
import { labelClass } from './shared';

const FILTERS = [
  { value: 'active' as const, label: 'In use' },
  { value: 'archived' as const, label: 'Archived' },
  { value: 'all' as const, label: 'All' },
];

export function TemplatesPanel({
  onEdit,
  onPreview,
}: {
  onEdit: (selection: { template?: EmailTemplate; presetKey?: string }) => void;
  onPreview: (template: EmailTemplate) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [search, setSearch] = useState('');

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
        isActive: false,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast('success', 'Copy created as a draft — opening it now.');
      onEdit({ template: created });
    },
    onError: (error) => toast('error', error.message),
  });

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates
      .filter((template) => (filter === 'all' ? true : filter === 'active' ? template.isActive : !template.isActive))
      .filter((template) => (query ? `${template.name} ${template.subject} ${template.category}`.toLowerCase().includes(query) : true))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [templates, filter, search]);

  const usageCount = (templateId: string) => automations.filter((automation) => automation.templateId === templateId).length;
  const isFirstRun = !templates.length && !isLoading;

  return (
    <div className="space-y-5">
      {/* The "New template" action lives in the page header, next to the tabs. */}
      <p className="max-w-2xl text-sm text-muted-foreground">
        A template is an email you write once and reuse — order updates, birthday notes, thank-yous.
      </p>

      {templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
          <div className="w-full max-w-xs">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search size={14} />}
              placeholder="Search templates…"
              aria-label="Search templates"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {visible.length} of {templates.length}
          </span>
        </div>
      )}

      {isFirstRun ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail size={24} />
          </div>
          <p className="mt-3 text-base font-semibold text-foreground">Start with a ready-made email</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Pick one of the templates below, change the wording to sound like you, and save it. You can always start from scratch instead.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => onEdit({})}>
            <Plus size={15} /> Start from scratch
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title="No matching templates" description="Try a different search or filter." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => {
            const uses = usageCount(template.id);
            return (
              <article key={template.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Mail size={18} />
                  </div>
                  <Badge variant={template.isActive ? 'success' : 'muted'} className="ml-auto">
                    {template.isActive ? 'In use' : 'Archived'}
                  </Badge>
                </div>
                <p className="mt-4 font-semibold text-foreground">{template.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.subject}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{template.category}</Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {uses ? `Used by ${uses} automation${uses === 1 ? '' : 's'}` : 'Not automated yet'}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button variant="outline" size="sm" onClick={() => onEdit({ template })}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onPreview(template)}>
                    <Eye /> Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={duplicate.isPending}
                    onClick={() => duplicate.mutate(template)}
                    title="Create an editable copy"
                  >
                    <Copy /> Duplicate
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Ready-made starting points */}
      <details className="overflow-hidden rounded-2xl border border-border bg-card" open={isFirstRun}>
        <summary className="flex cursor-pointer select-none items-center gap-2 px-5 py-4 text-sm font-semibold text-foreground hover:bg-surface-offset/50">
          <Sparkles size={16} className="text-primary" aria-hidden="true" />
          Ready-made templates
          <span className="text-xs font-normal text-muted-foreground">{TEMPLATE_PRESETS.length} you can edit</span>
        </summary>
        <div className="border-t border-border p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TEMPLATE_PRESETS.map((preset) => (
              <article key={preset.key} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{preset.name}</p>
                  <Badge variant="muted">{preset.category}</Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{preset.description}</p>
                <p className={`mt-3 ${labelClass}`}>Pairs with</p>
                <p className="text-[11px] text-muted-foreground">{preset.recommendedTrigger}</p>
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => onEdit({ presetKey: preset.key })}>
                  <Plus /> Use and edit
                </Button>
              </article>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
