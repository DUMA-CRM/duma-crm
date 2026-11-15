'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { SecretReveal } from '@/components/cms/SecretReveal';
import { RowMenu, RowWarning } from '@/components/cms/rows';
import { cmsKeys, invalidateCms } from '@/components/cms/shared';
import { Ban, Globe, KeyRound, Lock, Pencil, Plus, RefreshCw } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { type WorkspaceApiKey, getWorkspaceApiKeys, revokeWorkspaceApiKey } from '@/lib/api/api-keys.service';
import { type CmsApiKey, getCmsApiKeys, revokeCmsApiKey } from '@/lib/api/cms.service';
import { getLocations } from '@/lib/api/workspace.service';
import { SCOPES, canManageKey, grantableScopes, isContentApi, keyNeedsLocation } from '@/lib/developers/api-reference';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/utils/date';
import { keySummary, keyUsage } from '@/lib/utils/developers';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { NewApiKeyDialog } from './NewApiKeyDialog';
import { DetailRow, Facts } from './rows';
import type { DeveloperAccess } from './useDeveloperAccess';

/**
 * The workspace's API keys — one list for every public API. A key's scopes
 * say which APIs it opens; each person sees every key but changes only those
 * they could have granted (the API checks the same rule). Each key is a row
 * that opens its details; its actions sit behind the row's ⋯. The list is the
 * section — a `RecordGroup`, no card around it.
 */
export function ApiKeysSection({ access }: { access: DeveloperAccess }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [keyAction, setKeyAction] = useState<{ key: WorkspaceApiKey; editing: boolean } | null>(null);
  const [revealed, setRevealed] = useState<{ key: WorkspaceApiKey; token: string } | null>(null);
  const [revoking, setRevoking] = useState<WorkspaceApiKey | null>(null);
  // One key open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const keysQuery = useQuery({
    queryKey: ['api-keys', tenantId ?? null],
    queryFn: () => getWorkspaceApiKeys(tenantId),
    enabled: !!tenantId,
  });
  const locationsQuery = useQuery({ queryKey: ['locations', 'mine'], queryFn: getLocations });
  const locationName = (id: string | null) =>
    id ? (locationsQuery.data?.find((row) => row.id === id)?.name ?? 'A removed location') : null;

  const revoke = useMutation({
    mutationFn: (key: WorkspaceApiKey) => revokeWorkspaceApiKey(key.id, tenantId),
    onSuccess: (key) => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      invalidateCms(queryClient);
      setRevoking(null);
      toast('success', `${key.name} revoked — it stops working within 30 seconds.`);
    },
    onError: (error) => toast('error', error.message),
  });

  const canCreate = grantableScopes('secret', access.capabilities).some((scope) => access.contentOn || !isContentApi(SCOPES[scope].api));
  // Live keys first, newest first; revoked and expired ones fold away beneath.
  const keys = [...(keysQuery.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = keys.filter((key) => key.state === 'active');
  const retired = keys.filter((key) => key.state !== 'active');
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));

  const keyRow = (key: WorkspaceApiKey) => {
    const live = key.state === 'active';
    const manageable = live && canManageKey(key.scopes, access.capabilities);
    const needsLocation = live && keyNeedsLocation(key);
    return (
      <DetailRow
        key={key.id}
        icon={key.kind === 'secret' ? Lock : Globe}
        tone={needsLocation ? 'warning' : 'primary'}
        title={key.name}
        meta={keySummary(key)}
        value={live ? keyUsage(key.lastUsedAt) : key.state === 'revoked' ? 'Revoked' : 'Expired'}
        valueTone={needsLocation ? 'warning' : undefined}
        quiet={!live || !key.lastUsedAt}
        muted={!live}
        open={open === key.id}
        onToggle={() => toggle(key.id)}
        control={
          manageable ? (
            <RowMenu
              label={`${key.name} actions`}
              items={[
                { icon: Pencil, label: 'Edit', onClick: () => setKeyAction({ key, editing: true }) },
                { icon: RefreshCw, label: 'Replace with a new key', onClick: () => setKeyAction({ key, editing: false }) },
                { icon: Ban, label: 'Revoke', onClick: () => setRevoking(key), danger: true },
              ]}
            />
          ) : undefined
        }
      >
        <KeyDetails apiKey={key} location={locationName(key.locationId)} />
        {needsLocation && (
          <RowWarning>
            Choose where it sells from before it can record orders
            {manageable && (
              <>
                {' — '}
                <button type="button" className="underline underline-offset-2" onClick={() => setKeyAction({ key, editing: true })}>
                  edit the key
                </button>
              </>
            )}
            .
          </RowWarning>
        )}
      </DetailRow>
    );
  };

  return (
    <>
      <RecordGroup
        id="api-keys"
        title="API keys"
        footnote="Make one key per website or app, so you can revoke one alone. A key is shown once, when it’s made."
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" /> New key
            </Button>
          ) : undefined
        }
      >
        {keysQuery.isPending ? (
          <ListSkeleton rows={2} label="Loading API keys" />
        ) : keysQuery.isError ? (
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <ErrorState title="Couldn’t load your API keys" onRetry={() => void keysQuery.refetch()} />
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <EmptyState
              compact
              icon={KeyRound}
              title="No keys yet"
              description="A publishable key reads your menu and content from a website; a secret key lets your server record orders."
              action={canCreate ? { label: 'New key', onClick: () => setCreating(true), icon: Plus } : undefined}
            />
          </div>
        ) : (
          <ListRowGroup>
            {active.length === 0 && (
              <li className="border-b border-border px-3.5 py-3 text-sm text-muted-foreground last:border-b-0">
                No working keys — every key here is revoked or expired.
              </li>
            )}
            {active.map(keyRow)}
            {retired.length > 0 && (
              <>
                <li className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={showRetired}
                    onClick={() => setShowRetired((value) => !value)}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-band/40 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    {showRetired ? 'Hide' : 'Show'} {retired.length} revoked or expired
                  </button>
                </li>
                {showRetired && retired.map(keyRow)}
              </>
            )}
          </ListRowGroup>
        )}

        {(creating || keyAction) && (
          <NewApiKeyDialog
            access={access}
            locations={locationsQuery.data ?? []}
            initialKey={keyAction?.key}
            editing={keyAction?.editing}
            onClose={() => {
              setCreating(false);
              setKeyAction(null);
            }}
            onCreated={(result) => {
              setCreating(false);
              setKeyAction(null);
              setRevealed(result);
            }}
          />
        )}
        {revealed && (
          <SecretReveal
            title={`${revealed.key.name} is ready`}
            label="API key"
            icon={revealed.key.kind === 'secret' ? Lock : Globe}
            secret={revealed.token}
            warning={
              revealed.key.kind === 'secret'
                ? 'This key can act for your business. Keep it on your server, in an environment variable — never in a browser or an app. It can’t be shown again.'
                : 'Copy it now — only a fingerprint is stored, so it can’t be shown again.'
            }
            onClose={() => {
              setOpen(revealed.key.id);
              setRevealed(null);
            }}
          />
        )}
        {revoking && (
          <ConfirmModal
            title={`Revoke ${revoking.name}?`}
            message="Anything using this key stops working within 30 seconds. This can’t be undone — you’d make a new key instead."
            confirmLabel="Revoke"
            pendingLabel="Revoking…"
            isPending={revoke.isPending}
            onConfirm={() => revoke.mutate(revoking)}
            onClose={() => setRevoking(null)}
          />
        )}
      </RecordGroup>

      {access.canManageContent && <LegacyContentKeys />}
    </>
  );
}

/** What an opened key row says: its prefix, what it may do, and where. */
function KeyDetails({ apiKey, location }: { apiKey: WorkspaceApiKey; location: string | null }) {
  return (
    <Facts
      rows={[
        [
          'Key',
          <code key="k" className="font-mono">
            {apiKey.tokenPrefix}…
          </code>,
        ],
        ['Can', apiKey.scopes.map((scope) => SCOPES[scope]?.label ?? scope).join(' · ')],
        ['Location', location ?? 'Every location'],
        apiKey.contentTypeKeys && ['Content types', apiKey.contentTypeKeys.join(', ')],
        apiKey.allowedOrigins && ['Websites', apiKey.allowedOrigins.join(', ')],
        ['Created', formatDate(apiKey.createdAt)],
        apiKey.expiresAt && [apiKey.state === 'expired' ? 'Expired' : 'Expires', formatDate(apiKey.expiresAt)],
      ]}
    />
  );
}

/**
 * Content keys made before keys were unified (`dcms_…`). They keep working
 * for the Content API, and can no longer be created — only revoked here.
 */
function LegacyContentKeys() {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<CmsApiKey | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const query = useQuery({ queryKey: cmsKeys.apiKeys(tenantId ?? null), queryFn: () => getCmsApiKeys(tenantId) });
  const revoke = useMutation({
    mutationFn: (key: CmsApiKey) => revokeCmsApiKey(key.id, tenantId),
    onSuccess: () => {
      invalidateCms(queryClient);
      setRevoking(null);
      toast('success', 'Key revoked. Requests using it now fail.');
    },
    onError: (error) => toast('error', error.message),
  });

  const live = (query.data ?? []).filter((key) => key.state === 'active');
  if (!query.isError && live.length === 0) return null;

  return (
    <RecordGroup
      id="older-content-keys"
      title="Older content keys"
      footnote="These still work. Replace each with an API key, then revoke it."
    >
      {query.isError ? (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <ErrorState title="Couldn’t load older content keys" onRetry={() => void query.refetch()} />
        </div>
      ) : (
        <ListRowGroup>
          {live.map((key) => (
            <DetailRow
              key={key.id}
              icon={KeyRound}
              title={key.name}
              meta={key.kind === 'preview' ? 'Content drafts' : 'Content'}
              value={keyUsage(key.lastUsedAt)}
              quiet={!key.lastUsedAt}
              open={open === key.id}
              onToggle={() => setOpen((current) => (current === key.id ? null : key.id))}
              control={
                <RowMenu
                  label={`${key.name} actions`}
                  items={[{ icon: Ban, label: 'Revoke', onClick: () => setRevoking(key), danger: true }]}
                />
              }
            >
              <Facts
                rows={[
                  [
                    'Key',
                    <code key="k" className="font-mono">
                      {key.tokenPrefix}…
                    </code>,
                  ],
                  ['Content types', key.contentTypeKeys ? key.contentTypeKeys.join(', ') : 'All'],
                ]}
              />
            </DetailRow>
          ))}
        </ListRowGroup>
      )}
      {revoking && (
        <ConfirmModal
          title={`Revoke ${revoking.name}?`}
          message="Every website or build using this key stops receiving content. This can’t be undone — make a new key to replace it."
          confirmLabel="Revoke"
          pendingLabel="Revoking…"
          isPending={revoke.isPending}
          onConfirm={() => revoke.mutate(revoking)}
          onClose={() => setRevoking(null)}
        />
      )}
    </RecordGroup>
  );
}
