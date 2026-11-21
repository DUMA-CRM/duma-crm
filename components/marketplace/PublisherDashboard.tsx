'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  APP_EVENTS, APP_PLACEMENTS, type AppSurface, type PublisherApp, type Release, getPublisher, registerApp, submitRelease,
} from '@/lib/api/marketplace.service';

import { ListingEditor } from './ListingEditor';
import { ListingIcon } from './ListingMedia';

const surfaces = Object.keys(APP_PLACEMENTS) as AppSurface[];
const PUBLISHER_KEY = ['app-publisher'] as const;
const releaseLabels: Record<Release['status'], string> = {
  submitted: 'Awaiting review', changes_requested: 'Changes requested', published: 'Published', superseded: 'Previous release',
};

export const marketplaceFieldClass = 'block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring';

function ReadError({ error }: { error: Error }) {
  return <p role="alert" className="text-sm text-exception">{error.message}</p>;
}

function AppSubmission({ app, publisher }: { app: PublisherApp; publisher: string }) {
  const [editing, setEditing] = useState(false);
  const query = useQueryClient();
  const submission = useMutation({
    mutationFn: (data: FormData) => {
      const value = (key: string) => String(data.get(key) ?? '').trim();
      const pageUrl = value('pageUrl');
      const webhookUrl = value('webhookUrl');
      const extensions = surfaces.flatMap((surface) => {
        const url = value(`${surface}.url`);
        const title = value(`${surface}.title`);
        if (!url && !title) return [];
        if (!url || !title) throw new Error(`Enter both a title and a URL for ${APP_PLACEMENTS[surface].label}.`);
        return [{ surface, title, url }];
      });
      return submitRelease(app.id, value('version'), {
        name: value('name'),
        description: value('description'),
        supportUrl: value('supportUrl'),
        privacyUrl: value('privacyUrl'),
        scopes: data.has('publishedRead') ? ['cms.published:read'] : [],
        ...(extensions.length ? { extensions } : {}),
        ...(pageUrl ? { pageUrl } : {}),
        ...(webhookUrl ? { webhook: { url: webhookUrl, events: APP_EVENTS.filter((event) => data.has(event)) } } : {}),
      }, value('testInstructions'));
    },
    onSuccess: () => void query.invalidateQueries({ queryKey: PUBLISHER_KEY }),
  });
  const prior = app.releases[0]?.manifest;
  const pending = app.releases.some((release) => release.status === 'submitted');

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ListingIcon appId={app.id} imageId={app.storeListing?.icon} />
          <div><h2 className="text-lg font-semibold">{app.storeListing?.name ?? prior?.name ?? app.slug}</h2>
            <p className="text-sm text-muted-foreground">{publisher}</p></div>
        </div>
        {!app.suspensionReason && <Button variant="outline" onClick={() => setEditing(true)}>Edit listing</Button>}
      </header>
      {editing && <ListingEditor app={app} publisher={publisher} onClose={() => setEditing(false)} />}
      {app.suspensionReason && <p className="text-sm text-exception">Suspended · {app.suspensionReason}</p>}
      {app.releases.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {app.releases.map((release) => <li key={release.id} className="space-y-1 p-3 text-sm">
            <p><strong>v{release.version}</strong> · {releaseLabels[release.status]}</p>
            {release.reviewNote && <p className="whitespace-pre-wrap break-words text-muted-foreground">{release.reviewNote}</p>}
          </li>)}
        </ul>
      )}
      {pending && <p className="text-sm text-muted-foreground">Open the App Store in a demo workspace you manage to test the submitted release.</p>}
      {!pending && !app.suspensionReason && (
        <details open={app.releases.length === 0}>
          <summary className="cursor-pointer font-medium">Submit a release</summary>
          <form className="mt-4 space-y-4" onSubmit={(event) => {
            event.preventDefault();
            submission.mutate(new FormData(event.currentTarget));
          }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">App name<Input name="name" required minLength={2} maxLength={120} defaultValue={app.storeListing?.name ?? prior?.name} /></label>
              <label className="space-y-1 text-sm">Version<Input name="version" required placeholder="1.0.0" pattern={'[0-9]+\\.[0-9]+\\.[0-9]+'} maxLength={32} /></label>
              <label className="space-y-1 text-sm">Support URL<Input name="supportUrl" type="url" required defaultValue={app.storeListing?.supportUrl ?? prior?.supportUrl} /></label>
              <label className="space-y-1 text-sm">Privacy policy URL<Input name="privacyUrl" type="url" required defaultValue={app.storeListing?.privacyUrl ?? prior?.privacyUrl} /></label>
              <label className="space-y-1 text-sm">Workspace page URL<Input name="pageUrl" type="url" placeholder="https://" defaultValue={prior?.pageUrl} /></label>
              <label className="space-y-1 text-sm">Webhook URL<Input name="webhookUrl" type="url" placeholder="https://" defaultValue={prior?.webhook?.url} /></label>
            </div>
            <label className="block space-y-1 text-sm">Store description
              <textarea className={marketplaceFieldClass} name="description" required rows={3} minLength={10} maxLength={2000} defaultValue={app.storeListing?.description ?? prior?.description} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="publishedRead" type="checkbox" defaultChecked={prior?.scopes.includes('cms.published:read')} />
              Read published Content metadata
            </label>
            <fieldset className="space-y-3">
              <legend className="mb-1 text-sm font-medium">Widgets and tools</legend>
              {surfaces.map((surface) => {
                const previous = prior?.extensions?.find((extension) => extension.surface === surface);
                return (
                  <div key={surface} className="space-y-2 rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{APP_PLACEMENTS[surface].label}</p>
                    <p className="text-sm text-muted-foreground">{APP_PLACEMENTS[surface].access}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1 text-sm">Tool title<Input name={`${surface}.title`} minLength={2} maxLength={80} defaultValue={previous?.title} /></label>
                      <label className="space-y-1 text-sm">HTTPS URL<Input name={`${surface}.url`} type="url" defaultValue={previous?.url} /></label>
                    </div>
                  </div>
                );
              })}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Webhook events</legend>
              <div className="flex flex-wrap gap-4">
                {APP_EVENTS.map((event) => <label className="flex items-center gap-2 text-sm" key={event}>
                  <input name={event} type="checkbox" defaultChecked={prior?.webhook?.events.includes(event)} />{event}
                </label>)}
              </div>
            </fieldset>
            <label className="block space-y-1 text-sm">Review instructions
              <textarea className={marketplaceFieldClass} name="testInstructions" required minLength={10} maxLength={4000} rows={4}
                placeholder="Describe setup, how to test the app, why it needs each permission, and how it handles data after uninstall. Omit credentials." />
            </label>
            {submission.error && <ReadError error={submission.error} />}
            {submission.error && 'issues' in submission.error && Array.isArray(submission.error.issues) && (
              <ul className="list-disc pl-5 text-sm text-exception">
                {submission.error.issues.map((issue: { field: string; message: string }) => <li key={`${issue.field}-${issue.message}`}>{issue.field ? `${issue.field} — ` : ''}{issue.message}</li>)}
              </ul>
            )}
            <Button disabled={submission.isPending}>Submit for review</Button>
          </form>
        </details>
      )}
    </section>
  );
}

export function PublisherDashboard() {
  const query = useQueryClient();
  const state = useQuery({ queryKey: PUBLISHER_KEY, queryFn: getPublisher, meta: { silentError: true }, staleTime: 0 });
  const registration = useMutation({
    mutationFn: (slug: string) => registerApp(slug),
    onSuccess: () => void query.invalidateQueries({ queryKey: PUBLISHER_KEY }),
  });

  function createApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    registration.mutate(String(new FormData(form).get('slug') ?? '').trim(), { onSuccess: () => form.reset() });
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-title">Publisher dashboard</h1>
          {state.data?.publisher && <p className="mt-1 text-sm text-muted-foreground">{state.data.publisher}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/developers/apps">Developer guide</Link></Button>
          <Button asChild variant="outline"><Link href="/apps">Back to App Store</Link></Button>
        </div>
      </header>
      {state.isPending ? <p role="status">Loading publisher dashboard…</p> : state.error ? (
        <div className="space-y-2"><ReadError error={state.error} /><Button variant="outline" onClick={() => void state.refetch()}>Try again</Button></div>
      ) : !state.data.publisher ? (
        <p className="rounded-lg border border-border bg-card p-5 text-sm">Ask DUMA for a publisher invitation using the verified email on this account.</p>
      ) : (
        <>
          <form onSubmit={createApp} className="space-y-2 rounded-lg border border-border bg-card p-5">
            <label htmlFor="new-app-slug" className="text-sm font-medium">Register an app</label>
            <div className="flex flex-wrap gap-2">
              <Input id="new-app-slug" className="max-w-sm" name="slug" required minLength={3} maxLength={64}
                pattern={'[a-z0-9]+(?:\\-[a-z0-9]+)*'} placeholder="publishing-activity" />
              <Button disabled={registration.isPending}>Register app</Button>
            </div>
            {registration.error && <ReadError error={registration.error} />}
          </form>
          {state.data.apps.map((app) => <AppSubmission key={app.id} app={app} publisher={state.data.publisher!} />)}
        </>
      )}
    </main>
  );
}
