'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Info, Loader2, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type EmailAutomation,
  type EmailAutomationPayload,
  createEmailAutomation,
  getEmailConnection,
  getEmailTemplates,
  updateEmailAutomation,
} from '@/lib/api/email.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { OPT_IN_TRIGGERS, TRIGGER_HELP, TRIGGER_OPTIONS, describeAutomation, labelClass, panelClass } from './shared';

const FORM_ID = 'email-automation-form';

/**
 * Full-page automation editor. Every field is followed by plain-language help, and
 * the sidebar states in one sentence exactly what the automation will do once on.
 */
export function AutomationEditorPage({
  automation,
  initial,
  onClose,
  onSaved,
  onPreviewTemplate,
  onOpenTemplates,
  onOpenConnection,
}: {
  automation?: EmailAutomation;
  initial?: Partial<EmailAutomationPayload>;
  onClose: () => void;
  onSaved?: (saved: EmailAutomation) => void;
  onPreviewTemplate?: (templateId: string) => void;
  onOpenTemplates?: () => void;
  onOpenConnection?: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId ?? ''),
    enabled: !!tenantId,
  });
  const { data: connection } = useQuery({
    queryKey: ['email-connection', tenantId],
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });

  const [form, setForm] = useState<EmailAutomationPayload>({
    name: automation?.name ?? initial?.name ?? '',
    templateId: automation?.templateId ?? initial?.templateId ?? '',
    trigger: automation?.trigger ?? initial?.trigger ?? 'order_created',
    offsetDays: automation?.offsetDays ?? initial?.offsetDays ?? 0,
    timezone: automation?.timezone ?? initial?.timezone ?? 'Europe/London',
    isEnabled: automation?.isEnabled ?? initial?.isEnabled ?? false,
    locationId: automation?.locationId ?? initial?.locationId ?? null,
  });
  const initialSnapshot = useRef(JSON.stringify(form)).current;

  // Templates load after the first render, so fall back to the first usable one.
  const usableTemplates = templates.filter((item) => item.isActive || item.id === automation?.templateId);
  const templateId = form.templateId || usableTemplates[0]?.id || '';
  const selectedTemplate = templates.find((item) => item.id === templateId);
  const selectedLocation = locations.find((item) => item.id === form.locationId);
  const payload = { ...form, templateId, tenantId: tenantId ?? undefined };
  const dirty = JSON.stringify(form) !== initialSnapshot;

  const save = useMutation({
    mutationFn: () => (automation ? updateEmailAutomation(automation.id, payload) : createEmailAutomation(payload)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['email-automations'] });
      toast('success', automation ? 'Automation saved.' : form.isEnabled ? 'Automation created and switched on.' : 'Automation created.');
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  const update = <K extends keyof EmailAutomationPayload>(key: K, value: EmailAutomationPayload[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const needsTiming = form.trigger === 'customer_birthday' || form.trigger === 'customer_inactive';
  const emailReady = connection?.isEnabled && connection?.lastTestSucceeded;
  const summary = describeAutomation({
    trigger: form.trigger,
    offsetDays: form.offsetDays,
    templateName: selectedTemplate?.name,
    locationName: selectedLocation?.name ?? null,
  });

  return (
    <EditorShell
      eyebrow="Automation"
      title={automation ? automation.name : form.name || 'New automation'}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      discardMessage="This automation has changes that have not been saved. Leaving now discards them."
      actions={
        <Button type="submit" form={FORM_ID} disabled={!form.name || !templateId || save.isPending} className="h-11 gap-2 px-6">
          {save.isPending && <Loader2 size={15} className="animate-spin" />}
          {save.isPending ? 'Saving…' : automation ? 'Save' : 'Create'}
        </Button>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,34rem)_1fr]"
      >
        <div className="space-y-4">
          <section className={panelClass}>
            <p className={labelClass}>What triggers it</p>
            <div className="mt-3 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="automation-trigger" className={labelClass}>
                  Send when
                </label>
                <Select
                  id="automation-trigger"
                  value={form.trigger}
                  onValueChange={(value) => {
                    const trigger = value as EmailAutomationPayload['trigger'];
                    setForm((current) => ({
                      ...current,
                      trigger,
                      // Birthday offsets count backwards; inactivity counts forwards.
                      offsetDays:
                        trigger === 'customer_inactive'
                          ? Math.max(1, Math.abs(current.offsetDays) || 30)
                          : trigger === 'customer_birthday'
                            ? -Math.abs(current.offsetDays)
                            : 0,
                    }));
                  }}
                  options={TRIGGER_OPTIONS}
                  ariaLabel="Send when"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">{TRIGGER_HELP[form.trigger]}</p>
              </div>

              {form.trigger === 'customer_birthday' && (
                <Input
                  label="How many days before the birthday"
                  type="number"
                  min={0}
                  max={90}
                  value={Math.abs(form.offsetDays)}
                  onChange={(event) => update('offsetDays', -Math.abs(Number(event.target.value)))}
                  hint="0 sends on the day itself. 7 sends a week ahead."
                />
              )}
              {form.trigger === 'customer_inactive' && (
                <Input
                  label="Days without a visit"
                  type="number"
                  min={1}
                  max={3650}
                  value={Math.max(1, form.offsetDays)}
                  onChange={(event) => update('offsetDays', Math.max(1, Number(event.target.value)))}
                  hint="Sent once per quiet spell. A new visit starts the count again."
                />
              )}
              {needsTiming && (
                <div className="space-y-1.5">
                  <label htmlFor="automation-timezone" className={labelClass}>
                    Send in this timezone
                  </label>
                  <TimezoneSelect id="automation-timezone" value={form.timezone} onChange={(value) => update('timezone', value)} />
                  <p className="text-xs text-muted-foreground">Decides what counts as “today” for these emails.</p>
                </div>
              )}
            </div>
          </section>

          <section className={panelClass}>
            <p className={labelClass}>What it sends</p>
            <div className="mt-3 space-y-4">
              {usableTemplates.length ? (
                <div className="space-y-1.5">
                  <label htmlFor="automation-template" className={labelClass}>
                    Template
                  </label>
                  <Select
                    id="automation-template"
                    value={templateId}
                    onValueChange={(value) => update('templateId', value)}
                    options={usableTemplates.map((item) => ({ value: item.id, label: `${item.name} — ${item.subject}` }))}
                    ariaLabel="Template"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">Only templates marked “ready to use” appear here.</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                  <div className="text-xs text-warning">
                    {templatesLoading ? 'Loading your templates…' : 'You need one ready-to-use template before an automation can send anything.'}
                    {!templatesLoading && onOpenTemplates && (
                      <button type="button" onClick={onOpenTemplates} className="ml-1 font-semibold underline">
                        Create a template
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="automation-location" className={labelClass}>
                  Which locations
                </label>
                <Select
                  id="automation-location"
                  value={form.locationId ?? ''}
                  onValueChange={(value) => update('locationId', value || null)}
                  options={[
                    { value: '', label: 'All locations' },
                    ...locations.map((location) => ({ value: location.id, label: location.name })),
                  ]}
                  ariaLabel="Which locations"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Limit the automation to one shop, or leave it across the business.</p>
              </div>

              <Input
                label="Name for your team"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                required
                hint="How this automation appears in your list. Customers never see it."
              />
            </div>
          </section>

          <section className={panelClass}>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(event) => update('isEnabled', event.target.checked)}
                className="mt-0.5 size-4 rounded accent-primary"
              />
              <span>
                Switch it on
                <span className="block text-xs text-muted-foreground">
                  While off, nothing is sent — handy for setting things up before going live. You can flip this any time from the list.
                </span>
              </span>
            </label>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-0">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">What this will do</p>
                <p className="mt-1.5 text-sm text-foreground">{summary}</p>
                {OPT_IN_TRIGGERS.includes(form.trigger) && (
                  <p className="mt-2 text-xs text-muted-foreground">Customers who have not opted in to marketing email are skipped.</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Each customer gets it once per event — duplicates are filtered out.</p>
              </div>
            </div>
          </div>

          {!emailReady && (
            <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
              <div className="text-xs text-warning">
                Email sending is not set up and verified yet, so nothing will actually go out.
                {onOpenConnection && (
                  <button type="button" onClick={onOpenConnection} className="ml-1 font-semibold underline">
                    Set up email
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div className={panelClass}>
              <p className={labelClass}>Template preview</p>
              <p className="mt-2 font-semibold text-foreground">{selectedTemplate.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedTemplate.subject}</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white">
                <iframe title="Template preview" sandbox="" srcDoc={selectedTemplate.htmlBody} className="h-64 w-full border-0 bg-white" />
              </div>
              {onPreviewTemplate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full gap-2"
                  onClick={() => onPreviewTemplate(selectedTemplate.id)}
                >
                  <Eye size={15} /> Open full preview
                </Button>
              )}
            </div>
          )}
        </aside>
      </form>
    </EditorShell>
  );
}
