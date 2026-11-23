'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState } from 'react';

import { AlertTriangle, BookOpen, Package, Pencil, Plus, Send, Store } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ModalActions } from '@/components/shared/FormParts';
import { Logo } from '@/components/shared/Logo';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type PublisherApp, getPublisher, publisherKey, registerApp } from '@/lib/api/marketplace.service';
import { toast } from '@/lib/toast';
import { RELEASE_STATUS, publisherAppState } from '@/lib/utils/marketplace';

import { ListingEditor } from './ListingEditor';
import { ListingIcon } from './ListingMedia';
import { TONE_BADGE } from './MarketplaceStore';
import { ReleaseForm } from './ReleaseForm';

function RegisterApp({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const query = useQueryClient();
  const [slug, setSlug] = useState('');
  const registration = useMutation({
    mutationFn: () => registerApp(slug.trim()),
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: publisherKey });
      toast('success', `${slug.trim()} registered.`);
      onClose();
    },
  });
  return (
    <Modal
      title="Register an app"
      description="Reserve its address in the App Store."
      onClose={() => { if (!registration.isPending) onClose(); }}
      footer={<ModalActions form={formId} submitLabel="Register" pendingLabel="Registering…" pending={registration.isPending} onCancel={onClose} />}
    >
      <form id={formId} onSubmit={(event) => { event.preventDefault(); registration.mutate(); }} className="space-y-3">
        <Input
          label="App slug"
          required
          minLength={3}
          maxLength={64}
          pattern={'[a-z0-9]+(?:-[a-z0-9]+)*'}
          placeholder="publishing-activity"
          className="font-mono"
          value={slug}
          onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
          hint="Lowercase letters, numbers and hyphens. It can’t be changed later."
          error={registration.error?.message}
        />
      </form>
    </Modal>
  );
}

function AppPanel({ app, publisher }: { app: PublisherApp; publisher: string }) {
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const live = app.releases.find((release) => release.status === 'published');
  const newest = app.releases[0];
  const name = app.storeListing?.name ?? newest?.manifest.name ?? app.slug;
  const state = publisherAppState(app);
  const pending = app.releases.some((release) => release.status === 'submitted');
  const suspended = Boolean(app.suspensionReason);

  return (
    <section aria-labelledby={`app-${app.id}`} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <ListingIcon appId={app.id} imageId={app.storeListing?.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 id={`app-${app.id}`} className="truncate text-base font-semibold text-heading">{name}</h2>
            <Badge variant={TONE_BADGE[state.tone]}>{state.label}</Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            <span className="font-mono">{app.slug}</span>
            {live && <> · <span className="font-mono">v{live.version}</span> live</>}
          </p>
        </div>
        {!suspended && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Edit listing</Button>
            <Button size="sm" disabled={pending} title={pending ? 'Wait for the release in review to finish.' : undefined} onClick={() => setSubmitting(true)}>
              <Send aria-hidden="true" />
              {app.releases.length ? 'New release' : 'Submit release'}
            </Button>
          </div>
        )}
      </header>

      {suspended && (
        <p role="status" className="mx-5 mb-4 flex items-start gap-2 rounded-md bg-exception/6 px-3 py-2 text-sm text-exception">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>Suspended by DUMA: {app.suspensionReason}</span>
        </p>
      )}
      {pending && (
        <p className="mx-5 mb-4 rounded-md bg-reference/8 px-3 py-2 text-sm text-reference">
          In review. Install it from the App Store in a demo workspace you manage to test it meanwhile.
        </p>
      )}

      {app.releases.length > 0 ? (
        <ol className="border-t border-border" aria-label="Releases">
          {app.releases.map((release) => {
            const status = RELEASE_STATUS[release.status];
            return (
              <li key={release.id} className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0">
                <span className="w-16 shrink-0 pt-0.5 font-mono text-sm font-semibold text-foreground">v{release.version}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant={TONE_BADGE[status.tone]}>{status.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Submitted <RelativeTime iso={release.submittedAt} />
                      {release.reviewedAt && <> · reviewed <RelativeTime iso={release.reviewedAt} /></>}
                    </span>
                  </div>
                  {release.reviewNote && (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">{release.reviewNote}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
          No releases yet. Submit one to send it to DUMA for review.
        </p>
      )}

      {editing && <ListingEditor app={app} publisher={publisher} onClose={() => setEditing(false)} />}
      {submitting && <ReleaseForm app={app} onClose={() => setSubmitting(false)} />}
    </section>
  );
}

/** The publisher's own console, outside any workspace: register apps, keep the listing, submit releases, read review notes. */
export function PublisherDashboard() {
  const state = useQuery({ queryKey: publisherKey, queryFn: getPublisher, meta: { silentError: true }, staleTime: 0 });
  const [registering, setRegistering] = useState(false);
  const publisher = state.data?.publisher;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/apps" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
            <Logo size={28} className="rounded-[19.4%]" />
            <span className="text-sm font-semibold text-heading">DUMA</span>
          </Link>
          <span className="text-sm text-muted-foreground">Publisher</span>
          <nav className="ml-auto flex items-center gap-1" aria-label="Publisher">
            <Button asChild variant="ghost" size="sm"><Link href="/developers/apps"><BookOpen aria-hidden="true" />Guide</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/apps"><Store aria-hidden="true" />App Store</Link></Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-headline text-heading">Your apps</h1>
            {publisher && <p className="mt-1 text-sm text-muted-foreground">Published as {publisher}</p>}
          </div>
          {publisher && <Button onClick={() => setRegistering(true)}><Plus aria-hidden="true" />Register app</Button>}
        </div>

        {state.isPending ? (
          <ListSkeleton rows={3} label="Loading your apps" />
        ) : state.isError ? (
          <ErrorState icon={Package} title="Your apps couldn’t be loaded" description={state.error.message} onRetry={() => void state.refetch()} />
        ) : !publisher ? (
          <EmptyState icon={Store} kind="gone" title="You’re not a publisher yet"
            description="DUMA grants publisher access to verified accounts. Ask us for an invitation using this account’s email."
            action={{ label: 'Read the developer guide', href: '/developers/apps' }} />
        ) : state.data.apps.length === 0 ? (
          <EmptyState icon={Package} title="Register your first app" description="Reserve its slug, then submit a release for review."
            action={{ label: 'Register app', onClick: () => setRegistering(true), icon: Plus }} />
        ) : (
          <div className="space-y-4">
            {state.data.apps.map((app) => <AppPanel key={app.id} app={app} publisher={publisher} />)}
          </div>
        )}
      </main>
      {registering && <RegisterApp onClose={() => setRegistering(false)} />}
    </div>
  );
}
