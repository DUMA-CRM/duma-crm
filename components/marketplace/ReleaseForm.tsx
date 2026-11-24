'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { TEXTAREA_CLASS } from '@/components/cms/shared';
import { ArrowLeft, FileText, Globe, LayoutDashboard, Package, Webhook } from '@/components/icons';
import { FormSection } from '@/components/shared/FormParts';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';

import { APP_EVENTS, APP_PLACEMENTS, type AppSurface, type PublisherApp, getPublisher, marketplaceRootKey, publisherKey, savePublisherRelease } from '@/lib/api/marketplace.service';
import { toast } from '@/lib/toast';
import { publisherListingDefaults } from '@/lib/utils/marketplace';

import { PublisherDocumentFields, publisherDocumentsFromForm } from './PublisherDocumentFields';

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

function encodeArchive(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The ZIP could not be read.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]!);
    reader.readAsDataURL(file);
  });
}

export function PublisherReleaseEditor({ appId }: { appId: string }) {
  const router = useRouter();
  const publisher = useQuery({ queryKey: publisherKey, queryFn: getPublisher, meta: { silentError: true } });
  const app = publisher.data?.apps.find(({ id }) => id === appId);
  if (publisher.isPending) return <LoadingState label="Opening release editor" />;
  if (publisher.isError) return <ErrorState icon={Package} title="The release editor couldn’t open"
    description={publisher.error.message} onRetry={() => void publisher.refetch()} />;
  if (!app || app.suspensionReason || app.releases.some(({ status }) => status === 'submitted')) {
    return <main className="mx-auto max-w-lg space-y-4 px-6 py-20">
      <h1 className="text-xl font-semibold">This release editor is unavailable</h1>
      <p className="text-sm text-muted-foreground">Choose an app you own. If it has a release in review, wait for the review to finish.</p>
      <Button asChild variant="outline"><Link href="/app-publisher">Back to Publisher</Link></Button>
    </main>;
  }
  return <ReleaseForm key={app.id} app={app} onClose={() => router.push('/app-publisher')} />;
}

function ReleaseForm({ app, onClose }: { app: PublisherApp; onClose: () => void }) {
  const formId = useId();
  const query = useQueryClient();
  const [draft] = useState(() => app.releases.find(({ status }) => status === 'draft'));
  const [source, setSource] = useState(draft?.manifest.hostedBundleId ? 'zip' : 'url');
  const [archive, setArchive] = useState<File>();
  const prior = draft?.manifest ?? app.releases[0]?.manifest;
  const listing = draft?.manifest ?? publisherListingDefaults(app);
  const submission = useMutation({
    mutationFn: async ({ data, saveAsDraft }: { data: FormData; saveAsDraft: boolean }) => {
      const value = (key: string) => String(data.get(key) ?? '').trim();
      const pageUrl = source === 'url' ? value('pageUrl') : '';
      let hostedArchive: string | undefined;
      if (source === 'zip') {
        if (archive) {
          if (!archive.size || archive.size > 640 * 1024) throw new Error('Choose a ZIP under 640 KB.');
          hostedArchive = await encodeArchive(archive);
        } else if (draft?.manifest.hostedBundleId) {
          hostedArchive = 'keep';
        } else {
          throw new Error('Choose a ZIP containing index.html.');
        }
      }
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
      if (!hostedArchive && !pageUrl && !webhookUrl && extensions.length === 0 && !data.has('publishedRead')) {
        throw new Error('Add a workspace page, a placement, a webhook or Content access.');
      }
      const testInstructions = value('testInstructions');
      if (!saveAsDraft && testInstructions.length < 10) throw new Error('Enter review instructions with at least 10 characters.');
      return savePublisherRelease(app.id, {
        version: value('version'),
        draftId: draft?.id,
        draftSavedAt: draft?.submittedAt,
        saveAsDraft,
        hostedArchive,
        testInstructions,
        manifest: {
          name: value('name'),
          description: value('description'),
          ...publisherDocumentsFromForm(data),
          scopes: data.has('publishedRead') ? ['cms.published:read'] : [],
          ...(extensions.length ? { extensions } : {}),
          ...(pageUrl ? { pageUrl } : {}),
          ...(webhookUrl ? { webhook: { url: webhookUrl, events } } : {}),
        },
      });
    },
    onSuccess: (_, { saveAsDraft }) => {
      void query.invalidateQueries({ queryKey: publisherKey });
      void query.invalidateQueries({ queryKey: marketplaceRootKey });
      toast('success', saveAsDraft ? 'Draft saved. Open Apps in a demo workspace to test it.' : 'Release submitted for review.');
      onClose();
    },
  });

  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3 sm:px-8">
          <Button asChild variant="ghost" size="sm"><Link href="/app-publisher"><ArrowLeft aria-hidden="true" />Publisher</Link></Button>
          <span className="truncate border-l border-border pl-3 text-sm text-muted-foreground">{app.slug}</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-8">
        <div className="mb-8 flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Package aria-hidden="true" /></span>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-heading">{draft ? 'Edit draft release' : 'Prepare a release'}</h1>
            <p className="truncate text-sm text-muted-foreground">{listing.name}</p>
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <form id={formId} className="min-w-0 space-y-5" onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(event.currentTarget, submitter);
        if (!submission.isPending) submission.mutate({ data, saveAsDraft: data.get('intent') !== 'review' });
      }}>
        <FormSection title="Release" framed={false}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <Input label="App name" name="name" required minLength={2} maxLength={120} defaultValue={listing.name} />
            <Input label="Version" name="version" required placeholder="1.0.0" pattern={'[0-9]+\\.[0-9]+\\.[0-9]+'} maxLength={32}
              defaultValue={draft?.version ?? nextVersion(app)} readOnly={Boolean(draft)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`${formId}-description`} required>Store description</FieldLabel>
            <textarea id={`${formId}-description`} className={TEXTAREA_CLASS} name="description" required rows={3} minLength={10} maxLength={2000}
              defaultValue={listing.description} />
          </div>
          <PublisherDocumentFields initial={listing} />
        </FormSection>

        <FormSection title="App build" icon={Globe}>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">How should DUMA load this app?</legend>
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
              <input type="radio" checked={source === 'url'} onChange={() => setSource('url')} name="buildSource" className="accent-primary" />
              Use an HTTPS URL
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
              <input type="radio" checked={source === 'zip'} onChange={() => setSource('zip')} name="buildSource" className="accent-primary" />
              Upload a ZIP
            </label>
          </fieldset>
          <div hidden={source !== 'url'}>
            <Input label="Workspace page URL" name="pageUrl" type="url" placeholder="https://" disabled={source !== 'url'} defaultValue={prior?.pageUrl} />
          </div>
          {source === 'zip' && (
            <div className="space-y-2 rounded-lg border border-dashed border-border bg-band/35 p-4">
              <label htmlFor={`${formId}-archive`} className="block text-sm font-medium">App ZIP</label>
              <input id={`${formId}-archive`} type="file" accept=".zip,application/zip" className="block w-full text-sm"
                aria-describedby={`${formId}-archive-help`} onChange={(event) => setArchive(event.currentTarget.files?.[0])} />
              <p id={`${formId}-archive-help`} className="text-xs text-muted-foreground">Include index.html at the root and use relative paths to your assets. Maximum ZIP size is 640 KB.</p>
              {archive ? <p className="break-all text-sm font-medium">{archive.name} · {Math.ceil(archive.size / 1024)} KB</p>
                : draft?.manifest.hostedBundleId ? <p className="text-sm font-medium">Current ZIP will be reused.</p> : null}
            </div>
          )}
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
            <FieldLabel htmlFor={`${formId}-instructions`}>Review instructions</FieldLabel>
            <textarea id={`${formId}-instructions`} className={TEXTAREA_CLASS} name="testInstructions" maxLength={4000} rows={4} defaultValue={draft?.testInstructions}
              placeholder="How to set it up and test it, why it needs each permission, and what happens to data after uninstall. Don’t include credentials." />
          </div>
        </FormSection>
      </form>
          <aside className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-5" aria-busy={submission.isPending}>
            <h2 className="text-sm font-semibold text-heading">Save or submit</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">Save a draft to test the build in your demo workspace. Submit it when you’re ready for DUMA review.</p>
            <Button type="submit" form={formId} name="intent" value="draft" variant="outline" disabled={submission.isPending}>Save draft</Button>
            <Button type="submit" form={formId} name="intent" value="review" disabled={submission.isPending}>Submit for review</Button>
            {submission.isPending && <p role="status" className="text-xs text-muted-foreground">Saving release…</p>}
            {submission.error && <p role="alert" className="break-words text-sm text-exception">{submission.error.message}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
