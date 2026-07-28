'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  type EmailAutomation,
  type EmailAutomationPayload,
  deleteEmailAutomation,
  getEmailAutomations,
  getEmailTemplates,
  updateEmailAutomation,
} from '@/lib/api/email.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { AUTOMATION_PRESETS } from './presets';
import { TRIGGER_LABELS, describeAutomation, describeTiming, labelClass } from './shared';

export function AutomationsPanel({
  onEdit,
  onOpenTemplates,
}: {
  onEdit: (selection: { automation?: EmailAutomation; initial?: Partial<EmailAutomationPayload>; presetKey?: string }) => void;
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
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => updateEmailAutomation(id, { isEnabled }),
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

  /** Preset → editor, pre-picking the template it was written for when it exists. */
  const openPreset = (presetKey: string) => {
    const preset = AUTOMATION_PRESETS.find((item) => item.key === presetKey);
    if (!preset) return;
    const match = activeTemplates.find((template) => template.name === preset.suggestedTemplate);
    onEdit({ initial: { ...preset.initial, ...(match ? { templateId: match.id } : {}) }, presetKey });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          An automation watches for something happening — an order, a birthday — and emails one of your templates.
        </p>
        <Button disabled={!canCreate} onClick={() => onEdit({})} title={canCreate ? undefined : 'Create a ready-to-use template first'}>
          <Plus /> New automation
        </Button>
      </div>

      {!canCreate && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-offset/50 p-4">
          <p className="text-sm text-muted-foreground">
            Automations need one ready-to-use template to send. Create that first and the options below unlock.
          </p>
          <Button variant="outline" size="sm" onClick={onOpenTemplates}>
            Go to templates
          </Button>
        </div>
      )}

      {!automations.length && !isLoading ? (
        <EmptyState
          icon={Sparkles}
          title="No automations yet"
          description="Pick one of the scenarios below — they are already filled in for you."
        />
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => {
            const template = templates.find((item) => item.id === automation.templateId);
            const isToggling = toggle.isPending && toggle.variables?.id === automation.id;
            return (
              <article key={automation.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{automation.name}</p>
                      <Badge variant="muted">{TRIGGER_LABELS[automation.trigger]}</Badge>
                      {automation.location && <Badge variant="muted">{automation.location.name}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {describeAutomation({
                        trigger: automation.trigger,
                        offsetDays: automation.offsetDays,
                        templateName: template?.name ?? automation.template?.name,
                        locationName: automation.location?.name ?? null,
                      })}
                    </p>
                    {template && !template.isActive && (
                      <p className="mt-1 text-xs text-destructive">Its template is archived, so nothing is being sent.</p>
                    )}
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={automation.isEnabled}
                    aria-label={`${automation.isEnabled ? 'Pause' : 'Switch on'} ${automation.name}`}
                    disabled={isToggling}
                    onClick={() => toggle.mutate({ id: automation.id, isEnabled: !automation.isEnabled })}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50',
                      automation.isEnabled
                        ? 'border-success/30 bg-success/10 text-success hover:bg-success/20'
                        : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {isToggling ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <span className={cn('size-1.5 rounded-full', automation.isEnabled ? 'bg-success' : 'bg-muted-foreground')} />
                    )}
                    {automation.isEnabled ? 'Sending' : 'Paused'}
                  </button>
                  <Button variant="outline" size="icon" onClick={() => onEdit({ automation })} aria-label={`Edit ${automation.name}`}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(automation)}
                    aria-label={`Delete ${automation.name}`}
                    className="text-muted-foreground/60 hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Ready-made scenarios */}
      <details className="overflow-hidden rounded-2xl border border-border bg-card" open={!automations.length}>
        <summary className="flex cursor-pointer select-none items-center gap-2 px-5 py-4 text-sm font-semibold text-foreground hover:bg-surface-offset/50">
          <Sparkles size={16} className="text-primary" aria-hidden="true" />
          Common automations
          <span className="text-xs font-normal text-muted-foreground">{AUTOMATION_PRESETS.length} set up for you</span>
        </summary>
        <div className="border-t border-border p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {AUTOMATION_PRESETS.map((preset) => (
              <article key={preset.key} className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">{preset.name}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{preset.description}</p>
                <p className={`mt-3 ${labelClass}`}>Timing</p>
                <p className="text-[11px] text-muted-foreground">
                  {TRIGGER_LABELS[preset.initial.trigger ?? 'order_created']} ·{' '}
                  {describeTiming(preset.initial.trigger ?? 'order_created', preset.initial.offsetDays ?? 0)}
                </p>
                <Button variant="outline" size="sm" className="mt-3 w-full" disabled={!canCreate} onClick={() => openPreset(preset.key)}>
                  <Plus /> Set this up
                </Button>
              </article>
            ))}
          </div>
        </div>
      </details>

      {deleteTarget && (
        <ConfirmModal
          title="Delete this automation?"
          message={
            <>
              “{deleteTarget.name}” will stop sending and be removed. Emails already sent stay in History. If you only want a break, pause it
              instead.
            </>
          }
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
