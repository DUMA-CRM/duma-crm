'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  AlertTriangle, Copy, FileText, Globe, ImageIcon, ImagePlus, type IconComponent, KeyRound, LayoutDashboard, LayoutGrid, Loader2,
  Lock, Receipt, Webhook,
} from '@/components/icons';
import { RowTile, RowWarning } from '@/components/shared/rows';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import {
  APP_PLACEMENTS, type AppSurface, type InstallCredentials, type Listing, type StoreApp, changeInstallation, marketplaceKey,
} from '@/lib/api/marketplace.service';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { toast } from '@/lib/toast';

import { ListingIcon } from './ListingMedia';

const SURFACE_ICON: Record<AppSurface, IconComponent> = {
  dashboard: LayoutDashboard,
  'order.detail': Receipt,
  'menu.photo': ImagePlus,
  'media.preview': ImageIcon,
};

const EVENT_LABEL: Record<Listing['events'][number], string> = {
  'entry.published': 'published',
  'entry.unpublished': 'unpublished',
  'entry.deleted': 'deleted',
  'asset.changed': 'media changed',
};

type Access = Pick<Listing, 'builtin' | 'pageOrigin' | 'extensions' | 'scopes' | 'webhookOrigin' | 'events'>;

const host = (origin: string) => origin.replace(/^https:\/\//, '');

/** What a release can reach, one row per grant, in the words an owner decides on. */
export function accessRows(item: Access): { icon: IconComponent; title: string; detail: string }[] {
  return [
    ...(item.builtin ? [{ icon: LayoutGrid, title: 'Adds a page to Apps', detail: 'Built into DUMA. What you enter stays on the page.' }] : []),
    ...(item.pageOrigin ? [{ icon: Globe, title: 'Adds a page to Apps', detail: `Loaded from ${host(item.pageOrigin)}` }] : []),
    ...(item.extensions ?? []).map(({ surface, title, origin }) => ({
      icon: SURFACE_ICON[surface],
      title: `${APP_PLACEMENTS[surface].label}: ${title}`,
      detail: `${APP_PLACEMENTS[surface].access} · ${host(origin)}`,
    })),
    ...(item.scopes.includes('cms.published:read')
      ? [{ icon: FileText, title: 'Reads published Content', detail: 'Entry types, slugs and publish dates. Not drafts.' }]
      : []),
    ...(item.webhookOrigin
      ? [{ icon: Webhook, title: 'Gets Content notifications', detail: `When an entry is ${item.events.map((event) => EVENT_LABEL[event]).join(', ')} · ${host(item.webhookOrigin)}` }]
      : []),
  ];
}

export function AppAccess({ item }: { item: Access }) {
  const rows = accessRows(item);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No access to workspace data.</p>;
  return (
    <ul className="space-y-3">
      {rows.map(({ icon, title, detail }) => (
        <li key={title} className="flex items-start gap-3">
          <RowTile icon={icon} />
          <span className="min-w-0 pt-0.5">
            <span className="block text-sm font-semibold text-foreground">{title}</span>
            <span className="block break-words text-xs text-muted-foreground">{detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export type InstallKind = 'install' | 'update' | 'test' | 'enable' | 'rotate' | 'disable' | 'uninstall';
export type InstallRequest = { app: StoreApp; kind: InstallKind };

const KIND_LABEL: Record<InstallKind, string> = {
  install: 'Install',
  update: 'Update',
  test: 'Install test release',
  enable: 'Enable',
  rotate: 'Rotate credentials',
  disable: 'Disable',
  uninstall: 'Uninstall',
};

/** The release a request switches the workspace to; none for disable and uninstall. */
function targetRelease({ app, kind }: InstallRequest): { release: Listing; test: boolean } | null {
  if (kind === 'test') return app.testRelease ? { release: app.testRelease, test: true } : null;
  if (kind === 'install' || kind === 'update') return app.latest ? { release: app.latest, test: false } : null;
  if (kind === 'enable' || kind === 'rotate') return app.installation ? { release: app.installation.release, test: false } : null;
  return null;
}

function InstallationKeys({ credentials, onClose }: { credentials: InstallCredentials; onClose: () => void }) {
  const values = [
    { label: 'Installation ID', value: credentials.installationId },
    { label: 'Installation token', value: credentials.token },
    { label: 'Webhook signing secret', value: credentials.webhookSecret },
  ];
  return (
    <Modal
      title="Connect the app"
      description="Paste these into the app’s own settings."
      onClose={onClose}
      size="lg"
      footer={<Button className="w-full" size="lg" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        <RowWarning>The token and signing secret are shown once. Copy them before you close this.</RowWarning>
        {values.map(({ label, value }) => value && (
          <div key={label} className="space-y-1.5">
            <p className="text-label font-semibold uppercase text-muted-foreground">{label}</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-band/40 py-1 pr-1 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={value}>{value}</code>
              <Button type="button" variant="ghost" size="sm" aria-label={`Copy ${label.toLowerCase()}`} onClick={() => {
                void navigator.clipboard.writeText(value).then(() => toast('success', `${label} copied.`), () => toast('error', 'Select and copy the value.'));
              }}>
                <Copy aria-hidden="true" />
                Copy
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function InstallConsent({ request, workspaceName, pending, error, onConfirm, onClose }: {
  request: InstallRequest;
  workspaceName: string | undefined;
  pending: boolean;
  error: Error | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { app, kind } = request;
  const target = targetRelease(request)!;
  const name = app.storeListing?.name ?? target.release.name;
  const reconnects = kind !== 'install' && kind !== 'test' && !target.release.builtin;
  const privacyUrl = app.storeListing?.privacyUrl ?? target.release.privacyUrl;
  return (
    <Modal
      title={`${KIND_LABEL[kind]} ${name}?`}
      onClose={() => { if (!pending) onClose(); }}
      size="lg"
      footer={(
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button type="button" size="lg" className="flex-1" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {KIND_LABEL[kind]}
          </Button>
        </div>
      )}
    >
      <div className="space-y-5 break-words">
        <div className="flex items-center gap-3">
          <ListingIcon appId={app.id} imageId={app.storeListing?.icon} builtin={target.release.builtin} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-heading">{name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {app.publisher} · v{target.release.version}{workspaceName ? ` · for ${workspaceName}` : ''}
            </p>
          </div>
        </div>
        <section aria-labelledby="install-access">
          <h3 id="install-access" className="mb-3 text-sm font-semibold text-heading">It will be able to</h3>
          <AppAccess item={target.release} />
        </section>
        {target.test && <RowWarning>A release still in review. It runs only in this demo workspace.</RowWarning>}
        {reconnects && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <KeyRound size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            This issues new credentials. Update the app’s settings to reconnect it.
          </p>
        )}
        {!target.release.builtin && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              It runs in an isolated frame and gets only what’s listed. {app.publisher} handles what it receives under its{' '}
              <a className="font-medium text-foreground underline underline-offset-2" href={privacyUrl} target="_blank" rel="noreferrer">privacy policy</a>.
            </span>
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-exception">
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            {error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Every install change in one place: the consent dialog, the call, the
 * one-time credentials, and invalidating the store (which the sidebar and the
 * extension slots share). `start` opens it; render `dialogs` once.
 */
export function useInstallFlow() {
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;
  const client = useQueryClient();
  const [request, setRequest] = useState<InstallRequest | null>(null);
  const [credentials, setCredentials] = useState<InstallCredentials | null>(null);
  const change = useMutation({
    mutationFn: (current: InstallRequest) => {
      const { app, kind } = current;
      const target = targetRelease(current);
      if (target) {
        return changeInstallation(workspaceId!, app.slug, {
          action: 'activate', releaseId: target.release.id, expectedRevision: app.installation?.revision ?? null,
          ...(target.test ? { test: true } : {}),
        });
      }
      return changeInstallation(workspaceId!, app.slug, { action: kind === 'disable' ? 'disable' : 'uninstall', expectedRevision: app.installation!.revision });
    },
    onSuccess: (result, current) => {
      setRequest(null);
      if (result.token) setCredentials(result);
      else {
        const name = current.app.storeListing?.name ?? shownName(current.app);
        toast('success', DONE[current.kind](name));
      }
    },
    // A conflict means the store moved under us: refresh it either way.
    onSettled: () => client.invalidateQueries({ queryKey: marketplaceKey(workspaceId) }),
  });

  const start = (next: InstallRequest) => {
    change.reset();
    setRequest(next);
  };
  const close = () => setRequest(null);
  const destructive = request && (request.kind === 'disable' || request.kind === 'uninstall');
  const builtin = request?.app.installation?.release.builtin;

  const dialogs = (
    <>
      {request && !destructive && (
        <InstallConsent request={request} workspaceName={workspace?.name} pending={change.isPending} error={change.error}
          onConfirm={() => change.mutate(request)} onClose={close} />
      )}
      {request && destructive && (
        <ConfirmModal
          title={`${KIND_LABEL[request.kind]} ${request.app.storeListing?.name ?? shownName(request.app)}?`}
          message={(
            <div className="space-y-2">
              <p>
                {builtin
                  ? request.kind === 'disable' ? 'It leaves the Apps menu until it’s enabled again.' : 'It leaves the Apps menu. You can install it again any time.'
                  : 'DUMA revokes its credentials and stops its pages, widgets and notifications. Data it already received is covered by the publisher’s privacy policy.'}
              </p>
              {change.error && <p role="alert" className="text-exception">{change.error.message}</p>}
            </div>
          )}
          confirmLabel={KIND_LABEL[request.kind]}
          pendingLabel={request.kind === 'disable' ? 'Disabling…' : 'Uninstalling…'}
          isPending={change.isPending}
          onConfirm={() => change.mutate(request)}
          onClose={() => { if (!change.isPending) close(); }}
        />
      )}
      {credentials && <InstallationKeys credentials={credentials} onClose={() => setCredentials(null)} />}
    </>
  );
  return { start, dialogs, pending: change.isPending };
}

const shownName = (app: StoreApp) => (app.latest ?? app.installation?.release ?? app.testRelease)?.name ?? app.slug;

const DONE: Record<InstallKind, (name: string) => string> = {
  install: (name) => `${name} installed.`,
  update: (name) => `${name} updated.`,
  test: (name) => `Test release of ${name} installed.`,
  enable: (name) => `${name} enabled.`,
  rotate: (name) => `New credentials issued for ${name}.`,
  disable: (name) => `${name} disabled.`,
  uninstall: (name) => `${name} uninstalled.`,
};
