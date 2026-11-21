'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  APP_PLACEMENTS, type InstallCredentials, type Listing, type StoreApp, changeInstallation, getMarketplace, listingImageUrl, marketplaceKey,
} from '@/lib/api/marketplace.service';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { toast } from '@/lib/toast';

import { ListingIcon, ListingImageView } from './ListingMedia';

export function AppPermissions({ item }: { item: Listing }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {item.builtin && <li>Add a workspace page. Calculator inputs stay on the page.</li>}
      {item.pageOrigin && <li>Add a workspace page from {item.pageOrigin}</li>}
      {item.extensions?.map(({ surface, title, origin }) => (
        <li key={surface}>{title} · {APP_PLACEMENTS[surface].access} · {origin}</li>
      ))}
      {item.scopes.includes('cms.published:read') && <li>Read metadata for published Content entries</li>}
      {item.webhookOrigin && <li>Send {item.events.join(', ')} notifications to {item.webhookOrigin}</li>}
    </ul>
  );
}

export function InstallationKeys({ credentials, onClose }: { credentials: InstallCredentials; onClose: () => void }) {
  const values = [
    { label: 'Installation ID', value: credentials.installationId },
    { label: 'Installation token', value: credentials.token },
    { label: 'Webhook signing secret', value: credentials.webhookSecret },
  ];
  return (
    <Modal title="Installation credentials" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Save these in the app’s server settings. The token and signing secret are shown once.</p>
        {values.map(({ label, value }) => value && (
          <div key={label} className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor={label.replaceAll(' ', '-')}>{label}</label>
            <div className="flex items-center gap-2">
              <Input id={label.replaceAll(' ', '-')} className="font-mono" value={value} readOnly />
              <Button type="button" variant="outline" onClick={() => {
                void navigator.clipboard.writeText(value).then(() => toast('success', 'Copied.'), () => toast('error', 'Select and copy the value.'));
              }}>Copy</Button>
            </div>
          </div>
        ))}
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

type Confirmation = { app: StoreApp; action: 'activate' | 'disable' | 'uninstall'; release?: Listing; test?: boolean; label: string };

export function MarketplaceStore({ installedOnly = false }: { installedOnly?: boolean }) {
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;
  const client = useQueryClient();
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [credentials, setCredentials] = useState<InstallCredentials | null>(null);
  const [detailId, setDetailId] = useState<string>();
  const [search, setSearch] = useState('');
  const store = useQuery({
    queryKey: marketplaceKey(workspaceId), queryFn: () => getMarketplace(workspaceId!),
    enabled: Boolean(workspaceId), meta: { silentError: true }, refetchOnWindowFocus: true,
  });
  const change = useMutation({
    mutationFn: ({ app, action, release, test }: Confirmation) => {
      const current = app.installation;
      return changeInstallation(workspaceId!, app.slug, action === 'activate'
        ? { action, releaseId: release!.id, expectedRevision: current?.revision ?? null, ...(test ? { test } : {}) }
        : { action, expectedRevision: current!.revision });
    },
    onSuccess: (result) => {
      setConfirm(null);
      if (result.token) setCredentials(result);
      else toast('success', confirm?.action === 'activate' && !confirm.app.installation ? 'App installed.' : 'Installation updated.');
      void client.invalidateQueries({ queryKey: marketplaceKey(workspaceId) });
    },
    onError: () => void client.invalidateQueries({ queryKey: marketplaceKey(workspaceId) }),
  });
  const detail = store.data?.apps.find((app) => app.id === detailId);
  const detailRelease = detail && ((installedOnly ? detail.installation?.release : detail.latest) ?? detail.testRelease ?? detail.installation?.release);
  const apps = store.data?.apps.filter((app) => (installedOnly ? app.installation : app.latest || app.testRelease) && (
    !search.trim() || [app.slug, app.publisher, app.storeListing?.name, app.storeListing?.description, app.latest?.name, app.testRelease?.name, app.installation?.release.name]
      .some((value) => value?.toLowerCase().includes(search.trim().toLowerCase()))
  )) ?? [];

  function choose(selection: Confirmation) {
    change.reset();
    setConfirm(selection);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-title">{installedOnly ? 'Installed apps' : 'App Store'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{installedOnly ? 'Manage apps connected to this workspace.' : 'Add widgets, tools, and integrations to your workspace.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/app-publisher">Publisher dashboard</Link></Button>
          <Button asChild variant="outline"><Link href={installedOnly ? '/apps' : '/settings/installed-apps'}>{installedOnly ? 'Browse App Store' : 'Installed apps'}</Link></Button>
        </div>
      </header>
      {!installedOnly && store.data && (
        <Input aria-label="Search apps" placeholder="Search apps" value={search} onChange={(event) => setSearch(event.target.value)} className="max-w-sm" />
      )}
      {store.isError ? (
        <div className="space-y-2" role="alert">
          <p>{store.error.message}</p>
          <Button variant="outline" onClick={() => void store.refetch()}>Try again</Button>
        </div>
      ) : store.isPending ? <p role="status">Loading apps…</p> : apps.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {search ? 'No apps match your search.' : installedOnly ? 'This workspace has no installed apps.' : 'No apps are available yet.'}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((app) => {
            const current = app.installation;
            const item = (installedOnly ? current?.release : app.latest) ?? app.testRelease ?? current?.release;
            if (!item) return null;
            const copy = app.storeListing ?? item;
            const cover = app.storeListing?.screenshots[0];
            const update = current && app.latest && current.release.id !== app.latest.id;
            return (
              <article key={app.id} className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <ListingIcon appId={app.id} imageId={app.storeListing?.icon} builtin={item.builtin} />
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-semibold">{copy.name}</h2>
                    <p className="break-words text-sm text-muted-foreground">{app.publisher}</p>
                    {current && <p className="text-xs text-muted-foreground">
                      {app.suspended ? 'Suspended' : current.status === 'active' ? 'Installed' : 'Disabled'}{current.test ? ' · Test' : ''}
                    </p>}
                    {!current && !app.latest && app.testRelease && <p className="text-xs text-muted-foreground">Submitted for review</p>}
                  </div>
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{copy.description}</p>
                {cover && !installedOnly && (
                  <button type="button" className="block w-full overflow-hidden rounded-lg border border-border bg-band focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`View screenshots of ${copy.name}`} onClick={() => setDetailId(app.id)}>
                    <ListingImageView src={listingImageUrl(app.id, cover)} alt="" className="aspect-video w-full object-contain" />
                  </button>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setDetailId(app.id)}>View details</Button>
                  {current?.canOpen && <Button asChild><Link href={`/apps/${app.slug}`}>Open app</Link></Button>}
                  {store.data.canManage && !app.suspended && app.latest && (!current || update || current.test) && (
                    <Button variant={current?.canOpen ? 'outline' : 'default'} onClick={() => choose({ app, action: 'activate', release: app.latest!, label: current ? 'Update app' : 'Install app' })}>
                      {current ? 'Update' : 'Install'}
                    </Button>
                  )}
                  {store.data.canManage && app.testRelease && (!current || current.test) && (
                    <Button variant="outline" onClick={() => choose({ app, action: 'activate', release: app.testRelease!, test: true, label: 'Test this release' })}>
                      Test release
                    </Button>
                  )}
                  {store.data.canManage && current && (
                    <>
                      {current.status === 'active' && (
                        <Button variant="outline" onClick={() => choose({ app, action: 'disable', label: 'Disable app' })}>Disable</Button>
                      )}
                      {!app.suspended && !current.test && (current.status === 'disabled' || !current.release.builtin) && (
                        <Button variant="outline" onClick={() => choose({ app, action: 'activate', release: current.release, label: current.status === 'disabled' ? 'Enable app' : 'Rotate credentials' })}>
                          {current.status === 'disabled' ? 'Enable' : 'Rotate credentials'}
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => choose({ app, action: 'uninstall', label: 'Uninstall app' })}>Uninstall</Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {detail && detailRelease && (
        <Modal title={detail.storeListing?.name ?? detailRelease.name} description={detail.publisher}
          size="2xl" onClose={() => setDetailId(undefined)}>
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <ListingIcon appId={detail.id} imageId={detail.storeListing?.icon} builtin={detailRelease.builtin} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Version {detailRelease.version}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{detail.storeListing?.description ?? detailRelease.description}</p>
              </div>
            </div>
            {Boolean(detail.storeListing?.screenshots.length) && (
              <section className="space-y-2" aria-label="Screenshots">
                <h2 className="font-semibold">Screenshots</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {detail.storeListing?.screenshots.map((id, index) => (
                    <ListingImageView key={id + index} src={listingImageUrl(detail.id, id)} alt={`Screenshot ${index + 1}`}
                      className="aspect-video w-full rounded-lg border border-border bg-band object-contain" />
                  ))}
                </div>
              </section>
            )}
            <section className="space-y-2">
              <h2 className="font-semibold">Permissions</h2>
              <AppPermissions item={detailRelease} />
              <div className="flex flex-wrap gap-4 text-sm">
                <a className="underline" href={detail.storeListing?.supportUrl ?? detailRelease.supportUrl} target="_blank" rel="noreferrer">Support</a>
                <a className="underline" href={detail.storeListing?.privacyUrl ?? detailRelease.privacyUrl} target="_blank" rel="noreferrer">Privacy policy</a>
              </div>
            </section>
            {detail.installation?.canOpen && <Button asChild><Link href={`/apps/${detail.slug}`}>Open app</Link></Button>}
            {store.data?.canManage && detail.latest && (!detail.installation || detail.installation.test ||
                detail.installation.release.id !== detail.latest.id) && (
              <Button onClick={() => {
                setDetailId(undefined);
                choose({ app: detail, action: 'activate', release: detail.latest!, label: detail.installation ? 'Update app' : 'Install app' });
              }}>{detail.installation ? 'Update' : 'Install'}</Button>
            )}
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.label} onClose={() => { if (!change.isPending) setConfirm(null); }}>
          <div className="space-y-4 break-words">
            {confirm.release ? (
              <>
                <p><strong>{confirm.app.storeListing?.name ?? confirm.release.name}</strong> will be available in {workspace?.name}.</p>
                <AppPermissions item={confirm.release} />
                {confirm.app.installation && !confirm.release.builtin && <p className="text-sm text-muted-foreground">This issues fresh credentials. Update the app’s server settings to reconnect it.</p>}
              </>
            ) : (
              <p className="text-sm">{confirm.app.installation?.release.builtin
                ? 'This app will be removed from the workspace’s Apps menu.'
                : 'DUMA will revoke this app’s credentials and stop its pages, widgets, and notifications. Check the publisher’s privacy policy for data it already received.'}</p>
            )}
            {change.error && <p className="text-sm text-exception" role="alert">{change.error.message}</p>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={change.isPending} variant={confirm.action === 'uninstall' ? 'destructive' : 'default'} onClick={() => change.mutate(confirm)}>{confirm.label}</Button>
              <Button disabled={change.isPending} variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
      {credentials && <InstallationKeys credentials={credentials} onClose={() => { setCredentials(null); change.reset(); }} />}
    </div>
  );
}
