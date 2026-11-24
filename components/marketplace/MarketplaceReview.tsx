'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { TEXTAREA_CLASS } from '@/components/cms/shared';
import { type RowMenuItem, RowMenu } from '@/components/shared/rows';
import { Ban, CheckCircle2, ExternalLink, Eye, EyeOff, MessageSquarePlus, Package, Pencil, RotateCcw, UserPlus } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ModalActions } from '@/components/shared/FormParts';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import { CARD_SURFACE } from '@/components/shared/surface';

import {
  APP_PLACEMENTS, type AppManifest, type PublisherApp, type Release, decideRelease, getReviewQueue, invitePublisher, marketplaceRootKey,
  restoreApp, reviewKey, setAppVisibility, suspendApp,
} from '@/lib/api/marketplace.service';
import { toast } from '@/lib/toast';
import { RELEASE_STATUS } from '@/lib/utils/marketplace';

import { AppAccess } from './InstallFlow';
import { ListingEditor } from './ListingEditor';
import { ListingIcon } from './ListingMedia';
import { TONE_BADGE } from './MarketplaceStore';

type ReviewApp = PublisherApp & { publisher: string; hidden: boolean };

const origin = (url: string) => new URL(url).origin;

/** A manifest in the store's access shape, so a reviewer reads the same rows an owner will consent to. */
function manifestAccess(manifest: AppManifest) {
  return {
    pageOrigin: manifest.pageUrl ? origin(manifest.pageUrl) : null,
    extensions: manifest.extensions?.map(({ surface, title, url }) => ({ surface, title, origin: origin(url) })) ?? [],
    scopes: manifest.scopes,
    webhookOrigin: manifest.webhook ? origin(manifest.webhook.url) : null,
    events: manifest.webhook?.events ?? [],
  };
}

function useInvalidateReview() {
  const query = useQueryClient();
  return () => {
    void query.invalidateQueries({ queryKey: reviewKey });
    void query.invalidateQueries({ queryKey: marketplaceRootKey });
  };
}

function ReviewRelease({ app, release }: { app: ReviewApp; release: Release }) {
  const invalidate = useInvalidateReview();
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const decision = useMutation({
    mutationFn: (action: 'publish' | 'request_changes') => decideRelease(release.id, action, note),
    onSuccess: (_, action) => {
      setConfirm(false);
      toast('success', action === 'publish' ? `v${release.version} published.` : 'Changes requested.');
      invalidate();
    },
  });
  const manifest = release.manifest;
  const live = app.releases.find((entry) => entry.status === 'published');
  const endpoints = [
    ['Workspace page', manifest.pageUrl],
    ...(manifest.extensions ?? []).map(({ surface, url }) => [APP_PLACEMENTS[surface].label, url]),
    ['Webhook', manifest.webhook?.url],
    ['Support', manifest.supportUrl],
    ['Privacy policy', manifest.privacyUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <article aria-labelledby={`review-${release.id}`} className={CARD_SURFACE}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <ListingIcon appId={app.id} imageId={app.storeListing?.icon} />
        <div className="min-w-0 flex-1">
          <h2 id={`review-${release.id}`} className="truncate text-base font-semibold text-heading">
            {manifest.name} <span className="font-mono text-sm font-normal text-muted-foreground">v{release.version}</span>
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {app.publisher} · <span className="font-mono">{app.slug}</span> · submitted <RelativeTime iso={release.submittedAt} />
            {live && <> · replaces v{live.version}</>}
          </p>
        </div>
      </header>

      <div className="grid gap-6 px-5 py-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-heading">Description</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{manifest.description}</p>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-heading">Access requested</h3>
            <AppAccess item={manifestAccess(manifest)} />
          </section>
        </div>
        <div className="min-w-0 space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-heading">Endpoints</h3>
            <dl className="space-y-2 text-sm">
              {endpoints.map(([label, url]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-all font-mono text-xs">
                    {label === 'Webhook' ? url : (
                      <a className="inline-flex items-center gap-1 hover:text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
                        {url}<ExternalLink size={11} aria-hidden="true" className="shrink-0" />
                      </a>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-md bg-band/50 p-3">
            <h3 className="mb-1 text-sm font-semibold text-heading">Review instructions</h3>
            <p className="whitespace-pre-wrap break-words text-sm">{release.testInstructions}</p>
          </section>
        </div>
      </div>

      <footer className="space-y-3 border-t border-border bg-band/20 px-5 py-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`note-${release.id}`} optional>Feedback to the publisher</FieldLabel>
          <textarea id={`note-${release.id}`} className={TEXTAREA_CLASS} value={note} maxLength={3000} rows={3}
            placeholder="Required when requesting changes." onChange={(event) => setNote(event.target.value)} />
        </div>
        {decision.error && <p className="text-sm text-exception" role="alert">{decision.error.message}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={decision.isPending || note.trim().length < 3} onClick={() => decision.mutate('request_changes')}>
            <MessageSquarePlus aria-hidden="true" />
            Request changes
          </Button>
          <Button disabled={decision.isPending} onClick={() => setConfirm(true)}>
            <CheckCircle2 aria-hidden="true" />
            Approve and publish
          </Button>
        </div>
      </footer>

      {confirm && (
        <Modal
          title={`Publish ${manifest.name} v${release.version}?`}
          onClose={() => { if (!decision.isPending) setConfirm(false); }}
          footer={(
            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" disabled={decision.isPending} onClick={() => setConfirm(false)}>Cancel</Button>
              <Button size="lg" className="flex-1" disabled={decision.isPending} onClick={() => decision.mutate('publish')}>
                {decision.isPending ? 'Publishing…' : 'Publish'}
              </Button>
            </div>
          )}
        >
          <div className="space-y-2 text-sm">
            <p>It becomes available in the App Store. Workspaces keep their installed release until an admin updates it.</p>
            {decision.error && <p className="text-exception" role="alert">{decision.error.message}</p>}
          </div>
        </Modal>
      )}
    </article>
  );
}

function GrantPublisher({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const grant = useMutation({
    mutationFn: (data: FormData) => invitePublisher(String(data.get('email') ?? '').trim(), String(data.get('name') ?? '').trim()),
    onSuccess: () => {
      toast('success', 'Publisher access granted.');
      onClose();
    },
  });
  return (
    <Modal
      title="Grant publisher access"
      description="The account must exist and have a verified email."
      onClose={() => { if (!grant.isPending) onClose(); }}
      footer={<ModalActions form={formId} submitLabel="Grant access" pendingLabel="Granting…" pending={grant.isPending} onCancel={onClose} />}
    >
      <form id={formId} className="space-y-3" onSubmit={(event) => { event.preventDefault(); grant.mutate(new FormData(event.currentTarget)); }}>
        <Input label="Publisher name" name="name" minLength={2} maxLength={120} required hint="Shown on every listing they publish." />
        <Input label="Account email" name="email" type="email" required />
        {grant.error && <p className="text-sm text-exception" role="alert">{grant.error.message}</p>}
      </form>
    </Modal>
  );
}

function SuspendApp({ app, onClose }: { app: ReviewApp; onClose: () => void }) {
  const formId = useId();
  const invalidate = useInvalidateReview();
  const suspend = useMutation({
    mutationFn: (reason: string) => suspendApp(app.id, reason),
    onSuccess: () => {
      toast('success', `${app.slug} disabled everywhere.`);
      invalidate();
      onClose();
    },
  });
  return (
    <Modal
      title={`Disable ${app.slug} everywhere?`}
      onClose={() => { if (!suspend.isPending) onClose(); }}
      footer={(
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" disabled={suspend.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="destructive" size="lg" className="flex-1" disabled={suspend.isPending}>
            {suspend.isPending ? 'Disabling…' : 'Disable everywhere'}
          </Button>
        </div>
      )}
    >
      <form id={formId} className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        suspend.mutate(String(new FormData(event.currentTarget).get('reason') ?? '').trim());
      }}>
        <p className="text-sm text-muted-foreground">
          DUMA removes the listing and revokes every installation’s credentials. After a restore, workspace admins enable their installations again.
        </p>
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`${formId}-reason`} required>Reason</FieldLabel>
          <textarea id={`${formId}-reason`} className={TEXTAREA_CLASS} name="reason" minLength={3} maxLength={1000} required rows={3}
            placeholder="The publisher sees this." />
        </div>
        {suspend.error && <p className="text-sm text-exception" role="alert">{suspend.error.message}</p>}
      </form>
    </Modal>
  );
}

function AppRow({ app, onEdit, onSuspend }: { app: ReviewApp; onEdit: () => void; onSuspend: () => void }) {
  const invalidate = useInvalidateReview();
  const [open, setOpen] = useState(false);
  const update = useMutation({
    mutationFn: (action: 'hide' | 'show' | 'restore') => (action === 'restore' ? restoreApp(app.id) : setAppVisibility(app.id, action === 'hide')),
    onSuccess: (_, action) => {
      toast('success', action === 'restore' ? `${app.slug} restored.` : action === 'hide' ? `${app.slug} hidden from the store.` : `${app.slug} shown in the store.`);
      invalidate();
    },
    onError: (error) => toast('error', error.message),
  });
  const live = app.releases.find((release) => release.status === 'published');
  const name = app.storeListing?.name ?? live?.manifest.name ?? app.releases[0]?.manifest.name ?? app.slug;
  const items: RowMenuItem[] = [
    { icon: Pencil, label: 'Edit listing', onClick: onEdit },
    app.hidden
      ? { icon: Eye, label: 'Show in store', onClick: () => update.mutate('show') }
      : { icon: EyeOff, label: 'Hide from store', onClick: () => update.mutate('hide') },
    app.suspensionReason
      ? { icon: RotateCcw, label: 'Restore', onClick: () => update.mutate('restore') }
      : { icon: Ban, label: 'Disable everywhere', onClick: onSuspend, danger: true },
  ];

  return (
    <ListRow
      leading={<ListingIcon appId={app.id} imageId={app.storeListing?.icon} size="sm" />}
      title={name}
      meta={[app.publisher, app.slug, live ? `v${live.version} live` : 'Not published', app.suspensionReason ? `Suspended: ${app.suspensionReason}` : null].filter(Boolean).join(' · ')}
      trailing={(
        <span className="flex items-center gap-1.5">
          {app.hidden && <Badge variant="muted">Hidden</Badge>}
          {app.suspensionReason && <Badge variant="destructive">Suspended</Badge>}
          {!app.suspensionReason && live && !app.hidden && <Badge variant="success">Live</Badge>}
        </span>
      )}
      onClick={app.releases.length ? () => setOpen((value) => !value) : undefined}
      expanded={app.releases.length ? open : undefined}
      targetLabel={`${name}: release history`}
      control={<RowMenu label={`Actions for ${name}`} items={items} pending={update.isPending} />}
      details={open ? (
        <ol className="space-y-2 border-t border-border bg-band/20 px-5 py-3 pl-16">
          {app.releases.map((release) => (
            <li key={release.id} className="text-sm">
              <span className="font-mono font-semibold">v{release.version}</span>{' '}
              <Badge variant={TONE_BADGE[RELEASE_STATUS[release.status].tone]}>{RELEASE_STATUS[release.status].label}</Badge>{' '}
              <span className="text-xs text-muted-foreground"><RelativeTime iso={release.submittedAt} /></span>
              {release.reviewNote && <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">{release.reviewNote}</p>}
            </li>
          ))}
        </ol>
      ) : null}
    />
  );
}

/** DUMA Admin → App review: releases waiting for a decision, and every registered app. */
export function MarketplaceReview() {
  const state = useQuery({ queryKey: reviewKey, queryFn: getReviewQueue, staleTime: 0, meta: { silentError: true } });
  const [tab, setTab] = useState<'queue' | 'apps'>('queue');
  const [editingId, setEditingId] = useState<string>();
  const [suspending, setSuspending] = useState<ReviewApp | null>(null);
  const [granting, setGranting] = useState(false);
  const apps = state.data?.apps ?? [];
  const editing = apps.find((app) => app.id === editingId);
  // Oldest first: the queue is first come, first served.
  const pending = apps
    .flatMap((app) => (app.suspensionReason ? [] : app.releases.filter((release) => release.status === 'submitted').map((release) => ({ app, release }))))
    .sort((a, b) => a.release.submittedAt.localeCompare(b.release.submittedAt));

  return (
    <EditorShell
      eyebrow="DUMA Admin"
      title="App review"
      icon={<Package size={18} aria-hidden="true" />}
      actions={<Button variant="outline" size="sm" onClick={() => setGranting(true)}><UserPlus aria-hidden="true" />Grant publisher access</Button>}
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <SegmentedControl
          ariaLabel="Show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'queue', label: state.data ? `Awaiting review · ${pending.length}` : 'Awaiting review' },
            { value: 'apps', label: state.data ? `All apps · ${apps.length}` : 'All apps' },
          ]}
        />
        {state.isPending ? (
          <ListSkeleton rows={4} label="Loading review queue" />
        ) : state.isError ? (
          <ErrorState icon={Package} title="The review queue couldn’t be loaded" description={state.error.message} onRetry={() => void state.refetch()} />
        ) : tab === 'queue' ? (
          pending.length ? (
            <div className="space-y-4">
              {pending.map(({ app, release }) => <ReviewRelease key={release.id} app={app} release={release} />)}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} kind="done" title="Nothing to review" description="New releases appear here when publishers submit them." />
          )
        ) : apps.length ? (
          <ListRowGroup>
            {apps.map((app) => (
              <AppRow key={app.id} app={app} onEdit={() => setEditingId(app.id)} onSuspend={() => setSuspending(app)} />
            ))}
          </ListRowGroup>
        ) : (
          <EmptyState icon={Package} title="No apps registered" description="Grant a publisher access; their apps appear here." />
        )}
      </div>
      {editing && <ListingEditor app={editing} publisher={editing.publisher} admin onClose={() => setEditingId(undefined)} />}
      {suspending && <SuspendApp app={suspending} onClose={() => setSuspending(null)} />}
      {granting && <GrantPublisher onClose={() => setGranting(false)} />}
    </EditorShell>
  );
}
