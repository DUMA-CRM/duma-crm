'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';

import { TEXTAREA_CLASS } from '@/components/cms/shared';
import { FileText, Globe, LayoutDashboard, Webhook } from '@/components/icons';
import { FormSection, ModalActions } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';

import { APP_EVENTS, APP_PLACEMENTS, type AppSurface, type PublisherApp, publisherKey, submitRelease } from '@/lib/api/marketplace.service';
import { toast } from '@/lib/toast';

const surfaces = Object.keys(APP_PLACEMENTS) as AppSurface[];

const EVENT_LABEL: Record<(typeof APP_EVENTS)[number], string> = {
  'entry.published': 'Entry published',
  'entry.unpublished': 'Entry unpublished',
  'entry.deleted': 'Entry deleted',
  'asset.changed': 'Media changed',
};

/** The next version after the newest release: 1.2.3 → 1.2.4. A suggestion; the publisher can type any newer one. */
function nextVersion(app: PublisherApp) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(app.releases[0]?.version ?? '');
  return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : '1.0.0';
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input name={name} type="checkbox" className="size-4 accent-primary" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

/** Submit a release for review: what the app is, where it appears, what it reads, and how to test it. */
export function ReleaseForm({ app, onClose }: { app: PublisherApp; onClose: () => void }) {
  const formId = useId();
  const query = useQueryClient();
  const prior = app.releases[0]?.manifest;
  const submission = useMutation({
    mutationFn: (data: FormData) => {
      const value = (key: string) => String(data.get(key) ?? '').trim();
      const pageUrl = value('pageUrl');
      const webhookUrl = value('webhookUrl');
      const events = APP_EVENTS.filter((event) => data.has(event));
      const extensions = surfaces.flatMap((surface) => {
        const url = value(`${surface}.url`);
        const title = value(`${surface}.title`);
        if (!url && !title) return [];
        if (!url || !title) throw new Error(`Enter both a title and a URL for ${APP_PLACEMENTS[surface].label}.`);
        return [{ surface, title, url }];
      });
      if (webhookUrl && events.length === 0) throw new Error('Choose at least one webhook event, or clear the webhook URL.');
      if (!pageUrl && !webhookUrl && extensions.length === 0 && !data.has('publishedRead')) {
        throw new Error('Add a workspace page, a placement, a webhook or Content access.');
      }
      return submitRelease(app.id, value('version'), {
        name: value('name'),
        description: value('description'),
        supportUrl: value('supportUrl'),
        privacyUrl: value('privacyUrl'),
        scopes: data.has('publishedRead') ? ['cms.published:read'] : [],
        ...(extensions.length ? { extensions } : {}),
        ...(pageUrl ? { pageUrl } : {}),
        ...(webhookUrl ? { webhook: { url: webhookUrl, events } } : {}),
      }, value('testInstructions'));
    },
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: publisherKey });
      toast('success', 'Release submitted for review.');
      onClose();
    },
  });

  return (
    <Modal
      title="Submit a release"
      description={app.storeListing?.name ?? prior?.name ?? app.slug}
      size="xl"
      onClose={() => { if (!submission.isPending) onClose(); }}
      footer={<ModalActions form={formId} submitLabel="Submit for review" pendingLabel="Submitting…" pending={submission.isPending} onCancel={onClose} />}
    >
      <form id={formId} className="space-y-5" onSubmit={(event) => {
        event.preventDefault();
        submission.mutate(new FormData(event.currentTarget));
      }}>
        <FormSection title="Release" framed={false}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <Input label="App name" name="name" required minLength={2} maxLength={120} defaultValue={app.storeListing?.name ?? prior?.name} />
            <Input label="Version" name="version" required placeholder="1.0.0" pattern={'[0-9]+\\.[0-9]+\\.[0-9]+'} maxLength={32}
              defaultValue={nextVersion(app)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`${formId}-description`} required>Store description</FieldLabel>
            <textarea id={`${formId}-description`} className={TEXTAREA_CLASS} name="description" required rows={3} minLength={10} maxLength={2000}
              defaultValue={app.storeListing?.description ?? prior?.description} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Support URL" name="supportUrl" type="url" required placeholder="https://" defaultValue={app.storeListing?.supportUrl ?? prior?.supportUrl} />
            <Input label="Privacy policy URL" name="privacyUrl" type="url" required placeholder="https://" defaultValue={app.storeListing?.privacyUrl ?? prior?.privacyUrl} />
          </div>
        </FormSection>

        <FormSection title="Workspace page" icon={Globe} collapsible defaultOpen={Boolean(prior?.pageUrl) || !prior}
          note="A full page under Apps in the sidebar, loaded in a sandboxed frame.">
          <Input label="Page URL" name="pageUrl" type="url" placeholder="https://" defaultValue={prior?.pageUrl} />
        </FormSection>

        <FormSection title="Placements" icon={LayoutDashboard} collapsible defaultOpen={Boolean(prior?.extensions?.length)}
          note="Small tools inside DUMA’s own screens. Leave a placement empty to skip it.">
          {surfaces.map((surface) => {
            const previous = prior?.extensions?.find((extension) => extension.surface === surface);
            return (
              <div key={surface} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                <div>
                  <p className="text-sm font-semibold text-foreground">{APP_PLACEMENTS[surface].label}</p>
                  <p className="text-xs text-muted-foreground">{APP_PLACEMENTS[surface].access}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label={`${APP_PLACEMENTS[surface].label} tool title`} placeholder="Tool title" name={`${surface}.title`}
                    minLength={2} maxLength={80} defaultValue={previous?.title} />
                  <Input aria-label={`${APP_PLACEMENTS[surface].label} URL`} placeholder="https://" name={`${surface}.url`} type="url" defaultValue={previous?.url} />
                </div>
              </div>
            );
          })}
        </FormSection>

        <FormSection title="Content access" icon={FileText} collapsible
          defaultOpen={Boolean(prior?.webhook || prior?.scopes.length)}
          note="Needs the workspace’s Content module. Signed webhooks are delivered from DUMA’s servers.">
          <Check name="publishedRead" label="Read published Content metadata" defaultChecked={prior?.scopes.includes('cms.published:read')} />
          <Input label="Webhook URL" name="webhookUrl" type="url" placeholder="https://" defaultValue={prior?.webhook?.url} leftIcon={<Webhook size={14} aria-hidden="true" />} />
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted-foreground">Webhook events</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {APP_EVENTS.map((event) => (
                <Check key={event} name={event} label={EVENT_LABEL[event]} defaultChecked={prior?.webhook?.events.includes(event)} />
              ))}
            </div>
          </fieldset>
        </FormSection>

        <FormSection title="For the reviewer" framed={false}>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`${formId}-instructions`} required>Review instructions</FieldLabel>
            <textarea id={`${formId}-instructions`} className={TEXTAREA_CLASS} name="testInstructions" required minLength={10} maxLength={4000} rows={4}
              placeholder="How to set it up and test it, why it needs each permission, and what happens to data after uninstall. Don’t include credentials." />
          </div>
        </FormSection>
        {submission.error && <p role="alert" className="text-sm text-exception">{submission.error.message}</p>}
      </form>
    </Modal>
  );
}
