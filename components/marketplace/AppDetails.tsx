'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  ChevronLeft, ChevronRight, ExternalLink, FlaskConical, KeyRound, LifeBuoy, type IconComponent, Package, Power, Shield, Trash2,
} from '@/components/icons';
import { ActionRow, ActionRows, RowTile } from '@/components/cms/rows';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { LoadingState } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { type StoreApp, listingImageUrl } from '@/lib/api/marketplace.service';
import { ACTION_LABEL, appPlaces, appState, primaryAction, shownRelease, updateAvailable } from '@/lib/utils/marketplace';

import { AppAccess, useInstallFlow } from './InstallFlow';
import { ListingIcon, ListingImageView } from './ListingMedia';
import { TONE_BADGE, openHref, useMarketplace } from './MarketplaceStore';

function Screenshots({ app, name }: { app: StoreApp; name: string }) {
  const shots = app.storeListing?.screenshots ?? [];
  const [shown, setShown] = useState<number | null>(null);
  const count = shots.length;
  const step = (by: number) => setShown((index) => (index === null ? null : (index + by + count) % count));
  const open = shown !== null;
  useEffect(() => {
    if (!open || count < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setShown((index) => (index === null ? null : (index - 1 + count) % count));
      if (event.key === 'ArrowRight') setShown((index) => (index === null ? null : (index + 1) % count));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, count]);
  if (count === 0) return null;
  return (
    <section aria-label="Screenshots" className="min-w-0">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {shots.map((id, index) => (
          <button
            key={id}
            type="button"
            onClick={() => setShown(index)}
            aria-label={`View screenshot ${index + 1} of ${shots.length}`}
            className="w-[min(32rem,85%)] shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-band shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ListingImageView src={listingImageUrl(app.id, id)} alt="" className="aspect-video w-full object-contain" />
          </button>
        ))}
      </div>
      {shown !== null && (
        <Modal
          title={`${name} · ${shown + 1} of ${shots.length}`}
          size="2xl"
          onClose={() => setShown(null)}
          actions={shots.length > 1 && (
            <>
              <Button type="button" variant="ghost" size="icon" aria-label="Previous screenshot" onClick={() => step(-1)}><ChevronLeft aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Next screenshot" onClick={() => step(1)}><ChevronRight aria-hidden="true" /></Button>
            </>
          )}
        >
          <ListingImageView src={listingImageUrl(app.id, shots[shown]!)} alt={`Screenshot ${shown + 1}`}
            className="max-h-[70vh] w-full rounded-md bg-band object-contain" />
        </Modal>
      )}
    </section>
  );
}

function Detail({ icon, label, children }: { icon: IconComponent; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <RowTile icon={icon} />
      <div className="min-w-0">
        <p className="text-label font-semibold uppercase text-muted-foreground">{label}</p>
        <div className="truncate text-sm font-semibold text-foreground">{children}</div>
      </div>
    </div>
  );
}

function OutLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary hover:underline">
      {children}
      <ExternalLink size={12} aria-hidden="true" className="text-muted-foreground" />
    </a>
  );
}

/** An app's listing: what it is, what it can reach, and — for a workspace admin — installing and managing it. */
export function AppDetails({ slug }: { slug: string }) {
  const router = useRouter();
  const store = useMarketplace({ refetchInterval: 30_000 });
  const flow = useInstallFlow();
  const app = store.data?.apps.find((entry) => entry.slug === slug);
  const back = () => router.push('/apps');

  if (store.isPending || store.isError || !app) {
    return (
      <EditorShell title="App" onClose={back}>
        {store.isPending ? (
          <LoadingState label="Loading app" />
        ) : store.isError ? (
          <ErrorState icon={Package} title="This app couldn’t be loaded" description={store.error.message} onRetry={() => void store.refetch()} />
        ) : (
          <EmptyState icon={Package} kind="gone" title="This app isn’t available" description="It may have been removed from the App Store."
            action={{ label: 'Back to Apps', href: '/apps' }} />
        )}
      </EditorShell>
    );
  }

  const release = shownRelease(app, true)!;
  const installation = app.installation;
  const canManage = store.data.canManage;
  const name = app.storeListing?.name ?? release.name;
  const state = appState(app);
  const action = primaryAction(app, canManage);
  const update = updateAvailable(app);
  const supportUrl = app.storeListing?.supportUrl ?? release.supportUrl;
  const privacyUrl = app.storeListing?.privacyUrl ?? release.privacyUrl;
  // An open app with an update waiting gets both buttons: the update first.
  const showOpen = installation?.canOpen && action !== 'open';
  const showTest = canManage && app.testRelease && !app.suspended && (!installation || installation.test);

  return (
    <EditorShell
      title={name}
      onClose={back}
      leading={<ListingIcon appId={app.id} imageId={app.storeListing?.icon} builtin={release.builtin} size="sm" />}
      meta={(
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{release.builtin ? 'Built by DUMA' : app.publisher}</span>
          {state && <Badge variant={TONE_BADGE[state.tone]}>{state.label}</Badge>}
        </span>
      )}
      actions={(
        <span className="flex gap-2">
          {showOpen && <Button asChild variant="outline"><Link href={openHref(app.slug)}>Open</Link></Button>}
          {action && (action === 'open'
            ? <Button asChild><Link href={openHref(app.slug)}>Open</Link></Button>
            : <Button disabled={flow.pending} onClick={() => flow.start({ app, kind: action })}>{ACTION_LABEL[action]}</Button>)}
        </span>
      )}
    >
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <Screenshots app={app} name={name} />
        <SettingsTabBody
          narrowAside
          aside={(
            <div className="flex flex-col gap-5">
              <RecordGroup id="app-details" title="Details" card>
                <div className="space-y-3">
                  <Detail icon={Package} label="Version">
                    <span className="font-mono">{release.version}</span>
                    {update && app.latest && <span className="font-normal text-muted-foreground"> · {app.latest.version} available</span>}
                  </Detail>
                  <Detail icon={Shield} label="Privacy"><OutLink href={privacyUrl}>Privacy policy</OutLink></Detail>
                  <Detail icon={LifeBuoy} label="Support"><OutLink href={supportUrl}>Get help</OutLink></Detail>
                </div>
              </RecordGroup>
              {canManage && installation && (
                <RecordGroup id="app-manage" title="Manage" card>
                  <ActionRows danger={<ActionRow icon={Trash2} label="Uninstall" danger disabled={flow.pending} onClick={() => flow.start({ app, kind: 'uninstall' })} />}>
                    {installation.status === 'active' && (
                      <ActionRow icon={Power} label="Disable" disabled={flow.pending} onClick={() => flow.start({ app, kind: 'disable' })} />
                    )}
                    {installation.status === 'disabled' && !installation.test && !app.suspended && (
                      <ActionRow icon={Power} label="Enable" disabled={flow.pending} onClick={() => flow.start({ app, kind: 'enable' })} />
                    )}
                    {installation.status === 'active' && !installation.test && !installation.release.builtin && !app.suspended && (
                      <ActionRow icon={KeyRound} label="Rotate credentials" disabled={flow.pending} onClick={() => flow.start({ app, kind: 'rotate' })} />
                    )}
                  </ActionRows>
                </RecordGroup>
              )}
            </div>
          )}
        >
          {app.suspended && (
            <p role="status" className="rounded-lg border border-exception/30 bg-exception/6 px-4 py-3 text-sm text-exception">
              DUMA has suspended this app. It can’t run or be installed until it’s restored.
            </p>
          )}
          <RecordGroup id="app-about" title="About" card>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{app.storeListing?.description ?? release.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">Works in {appPlaces(release).join(', ') || 'DUMA'}</p>
          </RecordGroup>
          <RecordGroup id="app-access" title="Access" card footnote={release.builtin ? undefined : 'Apps run in an isolated frame and get only what’s listed here.'}>
            <AppAccess item={release} />
          </RecordGroup>
          {showTest && app.testRelease && (
            <RecordGroup
              id="app-test"
              title="Release in review"
              card
              actions={!installation?.test || installation.release.id !== app.testRelease.id ? (
                <Button size="sm" variant="outline" disabled={flow.pending} onClick={() => flow.start({ app, kind: 'test' })}>
                  <FlaskConical aria-hidden="true" />
                  Test it
                </Button>
              ) : undefined}
              footnote="Test installs run only in demo workspaces, for the publisher and DUMA reviewers."
            >
              <p className="text-sm">
                <span className="font-mono font-semibold">v{app.testRelease.version}</span>
                <span className="text-muted-foreground"> · {installation?.test && installation.release.id === app.testRelease.id ? 'installed for testing' : 'not yet published'}</span>
              </p>
            </RecordGroup>
          )}
        </SettingsTabBody>
      </div>
      {flow.dialogs}
    </EditorShell>
  );
}
