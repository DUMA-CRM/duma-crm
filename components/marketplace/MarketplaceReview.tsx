'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_PLACEMENTS, type Release, decideRelease, getReviewQueue, invitePublisher, restoreApp, setAppVisibility, suspendApp } from '@/lib/api/marketplace.service';
import { toast } from '@/lib/toast';
import { marketplaceFieldClass } from './PublisherDashboard';

import { ListingEditor } from './ListingEditor';
import { ListingIcon } from './ListingMedia';

const REVIEW_KEY = ['marketplace-review'] as const;

function ReviewRelease({ release, slug }: { release: Release; slug: string }) {
  const query = useQueryClient();
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const decision = useMutation({
    mutationFn: (action: 'publish' | 'request_changes') => decideRelease(release.id, action, note),
    onSuccess: () => {
      setConfirm(false);
      void query.invalidateQueries({ queryKey: REVIEW_KEY });
      void query.invalidateQueries({ queryKey: ['organization', 'marketplace'] });
    },
  });
  const manifest = release.manifest;
  const links = [
    ['Workspace page', manifest.pageUrl],
    ['Webhook endpoint', manifest.webhook?.url],
    ['Support', manifest.supportUrl],
    ['Privacy policy', manifest.privacyUrl],
    ...(manifest.extensions ?? []).map(({ surface, title, url }) => [`${APP_PLACEMENTS[surface].label} · ${title}`, url]),
  ];

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">{manifest.name} · v{release.version}</h2>
        <p className="text-sm text-muted-foreground">{slug}</p>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{manifest.description}</p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {links.map(([label, url]) => url && <div className="min-w-0" key={label}>
          <dt className="font-medium">{label}</dt>
          <dd className="break-all">
            {label === 'Webhook endpoint' ? url : <a className="underline" href={url} target="_blank" rel="noreferrer">{url}</a>}
          </dd>
        </div>)}
        {manifest.extensions?.map(({ surface }) => (
          <div key={surface}><dt className="font-medium">{APP_PLACEMENTS[surface].label} access</dt>
            <dd>{APP_PLACEMENTS[surface].access}</dd>
          </div>
        ))}
        <div><dt className="font-medium">API permissions</dt><dd>{manifest.scopes.join(', ') || 'None'}</dd></div>
        <div><dt className="font-medium">Webhook events</dt><dd>{manifest.webhook?.events.join(', ') || 'None'}</dd></div>
      </dl>
      <div className="rounded-md bg-band p-3 text-sm">
        <h3 className="font-medium">Review instructions</h3>
        <p className="mt-1 whitespace-pre-wrap break-words">{release.testInstructions}</p>
      </div>
      <label className="block space-y-1 text-sm">Review feedback
        <textarea className={marketplaceFieldClass} value={note} maxLength={3000} rows={3} onChange={(event) => setNote(event.target.value)} />
      </label>
      {decision.error && <p className="text-sm text-exception" role="alert">{decision.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={decision.isPending} onClick={() => setConfirm(true)}>Approve and publish</Button>
        <Button variant="outline" disabled={decision.isPending || note.trim().length < 3} onClick={() => decision.mutate('request_changes')}>Request changes</Button>
      </div>
      {confirm && (
        <Modal title="Publish this release?" onClose={() => { if (!decision.isPending) setConfirm(false); }}>
          <div className="space-y-3">
            <p className="text-sm">This release becomes available in the App Store. Existing installations keep their current release until a workspace admin updates it.</p>
            {decision.error && <p className="text-sm text-exception" role="alert">{decision.error.message}</p>}
            <Button disabled={decision.isPending} onClick={() => decision.mutate('publish')}>Publish release</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function MarketplaceReview() {
  const query = useQueryClient();
  const state = useQuery({ queryKey: REVIEW_KEY, queryFn: getReviewQueue, staleTime: 0, meta: { silentError: true } });
  const [editingId, setEditingId] = useState<string>();
  const editing = state.data?.apps.find((app) => app.id === editingId);
  const [selected, setSelected] = useState<{ id: string; slug: string } | null>(null);
  const invite = useMutation({
    mutationFn: (data: FormData) => invitePublisher(String(data.get('email') ?? ''), String(data.get('name') ?? '')),
    onSuccess: () => toast('success', 'Publisher access granted.'),
  });
  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => suspendApp(id, reason),
    onSuccess: () => {
      setSelected(null);
      void query.invalidateQueries({ queryKey: REVIEW_KEY });
      void query.invalidateQueries({ queryKey: ['organization', 'marketplace'] });
    },
  });
  const updateApp = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'hide' | 'show' | 'restore' }) =>
      action === 'restore' ? restoreApp(id) : setAppVisibility(id, action === 'hide'),
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: REVIEW_KEY });
      void query.invalidateQueries({ queryKey: ['organization', 'marketplace'] });
    },
  });
  const pending = state.data?.apps.flatMap((app) =>
    app.suspensionReason ? [] : app.releases.filter((release) => release.status === 'submitted').map((release) => ({ app, release }))) ?? [];

  function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    invite.mutate(new FormData(form), { onSuccess: () => form.reset() });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-title">App review</h1>
        <p className="mt-1 text-sm text-muted-foreground">Open the App Store in a demo workspace to test submitted releases before publishing.</p>
      </header>
      <form onSubmit={grant} className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">Grant publisher access</h2>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-1 text-sm">Publisher name<Input name="name" minLength={2} maxLength={120} required /></label>
          <label className="space-y-1 text-sm">Verified account email<Input name="email" type="email" required /></label>
          <Button disabled={invite.isPending}>Grant access</Button>
        </div>
        {invite.error && <p className="text-sm text-exception" role="alert">{invite.error.message}</p>}
      </form>
      {state.error ? (
        <div className="space-y-2" role="alert"><p>{state.error.message}</p><Button variant="outline" onClick={() => void state.refetch()}>Try again</Button></div>
      ) : state.isPending ? <p role="status">Loading review queue…</p> : (
        <>
          <h2 className="text-lg font-semibold">Awaiting review</h2>
          {pending.length ? pending.map(({ app, release }) => <ReviewRelease key={release.id} release={release} slug={`${app.publisher} · ${app.slug}`} />)
            : <p className="text-sm text-muted-foreground">There are no releases awaiting review.</p>}
          <h2 className="text-lg font-semibold">Registered apps</h2>
          {updateApp.error && <p role="alert" className="text-sm text-exception">{updateApp.error.message}</p>}
          {state.data.apps.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {state.data.apps.map((app) => (
                <li key={app.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <ListingIcon appId={app.id} imageId={app.storeListing?.icon} />
                    <div>
                      <p className="font-medium">{app.storeListing?.name ?? app.releases.find((release) => release.status === 'published')?.manifest.name ?? app.slug}</p>
                      <p className="text-sm text-muted-foreground">{app.publisher}{app.hidden ? ' · Hidden from store' : ''}{app.suspensionReason ? ` · Suspended · ${app.suspensionReason}` : ''}</p>
                      {app.releases.length > 0 && (
                        <details className="mt-1 text-sm"><summary className="cursor-pointer">Release history</summary>
                          <ul className="space-y-1 pt-1">{app.releases.map((release) => (
                            <li key={release.id}>v{release.version} · {release.status.replaceAll('_', ' ')}{release.reviewNote ? ` · ${release.reviewNote}` : ''}</li>
                          ))}</ul>
                        </details>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setEditingId(app.id)}>Edit listing</Button>
                    <Button variant="outline" disabled={updateApp.isPending}
                      onClick={() => updateApp.mutate({ id: app.id, action: app.hidden ? 'show' : 'hide' })}>
                      {app.hidden ? 'Show in store' : 'Hide from store'}
                    </Button>
                    {app.suspensionReason ? (
                      <Button variant="outline" disabled={updateApp.isPending}
                        onClick={() => updateApp.mutate({ id: app.id, action: 'restore' })}>Restore app</Button>
                    ) : (
                      <Button variant="destructive" onClick={() => { suspend.reset(); setSelected(app); }}>Disable globally</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">There are no registered apps.</p>}
        </>
      )}
      {editing && <ListingEditor app={editing} publisher={editing.publisher} admin onClose={() => setEditingId(undefined)} />}
      {selected && (
        <Modal title={`Disable ${selected.slug} globally?`} onClose={() => { if (!suspend.isPending) setSelected(null); }}>
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            suspend.mutate({ id: selected.id, reason: String(new FormData(event.currentTarget).get('reason') ?? '') });
          }}>
            <p className="text-sm">DUMA removes the listing and revokes access for every installation. After an app is restored, workspace admins can enable their installations again.</p>
            <label className="block space-y-1 text-sm">Reason
              <textarea className={marketplaceFieldClass} name="reason" minLength={3} maxLength={1000} required rows={3} />
            </label>
            {suspend.error && <p className="text-sm text-exception" role="alert">{suspend.error.message}</p>}
            <Button variant="destructive" disabled={suspend.isPending}>Disable globally</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
