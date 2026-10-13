'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { SecretReveal } from '@/components/cms/SecretReveal';
import { cmsKeys, invalidateCms } from '@/components/cms/shared';
import { Globe, KeyRound, Lock, MapPin, Plus } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type WorkspaceApiKey, getWorkspaceApiKeys, revokeWorkspaceApiKey } from '@/lib/api/api-keys.service';
import { type CmsApiKey, getCmsApiKeys, revokeCmsApiKey } from '@/lib/api/cms.service';
import { getLocations } from '@/lib/api/workspace.service';
import { apisOf, canManageKey, grantableScopes, keyNeedsLocation } from '@/lib/developers/api-reference';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { NewApiKeyDialog } from './NewApiKeyDialog';
import { RowTile, rowClass } from './rows';
import type { DeveloperAccess } from './useDeveloperAccess';

/**
 * The workspace's API keys — one list for every public API. A key's scopes
 * say which APIs it opens; each person sees every key but changes only those
 * they could have granted (the API checks the same rule).
 */
export function ApiKeysSection({ access }: { access: DeveloperAccess }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ key: WorkspaceApiKey; token: string } | null>(null);
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<WorkspaceApiKey | null>(null);

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

  const canCreate = grantableScopes('secret', access.capabilities).some((scope) => access.contentOn || !scope.startsWith('content:'));
  // Live keys first, newest first; revoked and expired ones sink into a fold.
  const keys = [...(keysQuery.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = keys.filter((key) => key.state === 'active');
  const retired = keys.filter((key) => key.state !== 'active');

  return (
    <SettingsSection
      title="API keys"
      description="One key per website or app, for every DUMA API its scopes allow — content, the catalogue, orders, sign-ups. Publishable keys only read and are safe in a browser; secret keys belong on a server."
      actions={
        canCreate ? (
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> New key
          </Button>
        ) : undefined
      }
      footnote="Only a fingerprint of each key is stored, so a key is shown once, when it is created. Revoking takes effect within 30 seconds."
    >
      {keysQuery.isPending ? (
        <TilesSkeleton count={2} label="Loading API keys" />
      ) : keysQuery.isError ? (
        <ErrorState title="Couldn’t load your API keys" onRetry={() => void keysQuery.refetch()} />
      ) : keys.length === 0 ? (
        <EmptyState
          compact
          icon={KeyRound}
          title="Connect your website"
          description="Create a publishable key for pages that read in the browser, and a secret key for your server to record orders or read drafts."
          action={canCreate ? { label: 'New key', onClick: () => setCreating(true), icon: Plus } : undefined}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs tabular-nums text-muted-foreground">
            {active.length} active {active.length === 1 ? 'key' : 'keys'}
          </p>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {active.map((key, index) => (
                <motion.li
                  key={key.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : index * 0.04 } }}
                  exit={{ opacity: 0, x: 16 }}
                  className={rowClass(false, key.id === arrivedId)}
                >
                  <KeyRow
                    apiKey={key}
                    location={locationName(key.locationId)}
                    onRevoke={canManageKey(key.scopes, access.capabilities) ? () => setRevoking(key) : undefined}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {retired.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                {retired.length} revoked or expired
              </summary>
              <ul className="mt-2 space-y-2">
                {retired.map((key) => (
                  <li key={key.id} className={rowClass(true)}>
                    <KeyRow apiKey={key} location={locationName(key.locationId)} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {access.canManageContent && <LegacyContentKeys />}

      {creating && (
        <NewApiKeyDialog
          access={access}
          locations={locationsQuery.data ?? []}
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false);
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
              ? 'This key can act for your business — record orders, read drafts. Keep it on your server, in an environment variable — never in a browser or an app bundle. It can’t be shown again.'
              : 'Copy it now — only a fingerprint is stored, so it can’t be shown again.'
          }
          onClose={() => {
            setArrivedId(revealed.key.id);
            setRevealed(null);
          }}
        />
      )}
      {revoking && (
        <ConfirmModal
          title={`Revoke ${revoking.name}?`}
          message="Anything using this key stops working within 30 seconds. This can’t be undone — you’d create a new key instead."
          confirmLabel="Revoke"
          pendingLabel="Revoking…"
          isPending={revoke.isPending}
          onConfirm={() => revoke.mutate(revoking)}
          onClose={() => setRevoking(null)}
        />
      )}
    </SettingsSection>
  );
}

function KeyRow({ apiKey, location, onRevoke }: { apiKey: WorkspaceApiKey; location: string | null; onRevoke?: () => void }) {
  const live = apiKey.state === 'active';
  const needsLocation = live && keyNeedsLocation(apiKey);
  const sellsFrom = apiKey.scopes.includes('catalog:read') || apiKey.scopes.includes('orders:write');
  const details = [
    apiKey.scopes.includes('content:read') ? (apiKey.contentTypeKeys ? `Content: ${apiKey.contentTypeKeys.join(', ')}` : null) : null,
    apiKey.scopes.includes('content:preview') ? 'Reads drafts' : null,
    apiKey.allowedOrigins ? `${apiKey.allowedOrigins.length} ${apiKey.allowedOrigins.length === 1 ? 'website' : 'websites'}` : null,
  ].filter(Boolean);
  return (
    <>
      <RowTile icon={apiKey.kind === 'secret' ? Lock : Globe} active={live} tone={needsLocation ? 'warning' : 'primary'} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          <span className="truncate">{apiKey.name}</span>
          <Badge variant={apiKey.kind === 'secret' ? 'warning' : 'reference'}>{apiKey.kind === 'secret' ? 'Secret' : 'Publishable'}</Badge>
          {apisOf(apiKey.scopes).map((api) => (
            <Badge key={api.id} variant="muted">
              {api.name.replace(/ API$/, '')}
            </Badge>
          ))}
          {!live && <Badge variant="muted">{apiKey.state === 'revoked' ? 'Revoked' : 'Expired'}</Badge>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{apiKey.tokenPrefix}…</span>
          {sellsFrom && location && (
            <>
              {' · '}
              <MapPin size={11} className="-mt-0.5 inline" aria-hidden="true" /> {location}
            </>
          )}
          {details.length > 0 && ` · ${details.join(' · ')}`}
          {' · '}
          {apiKey.lastUsedAt ? (
            <>
              used <RelativeTime iso={apiKey.lastUsedAt} />
            </>
          ) : (
            'never used'
          )}
          {apiKey.expiresAt && live ? (
            <>
              {' · '}expires <RelativeTime iso={apiKey.expiresAt} />
            </>
          ) : null}
        </p>
        {needsLocation && (
          <p className="mt-0.5 text-xs font-medium text-measured">Choose where it sells from before it can record orders.</p>
        )}
      </div>
      {onRevoke && (
        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-exception" onClick={onRevoke}>
          Revoke
        </Button>
      )}
    </>
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

  if (query.isError) {
    return (
      <div className="mt-4">
        <ErrorState title="Couldn’t load older content keys" onRetry={() => void query.refetch()} />
      </div>
    );
  }
  const live = (query.data ?? []).filter((key) => key.state === 'active');
  if (live.length === 0) return null;

  return (
    <details className="group mt-4 border-t border-rule/40 pt-3">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
        {live.length} older content {live.length === 1 ? 'key' : 'keys'} — still working; replace with a key above, then revoke
      </summary>
      <ul className="mt-2 space-y-2">
        {live.map((key) => (
          <li key={key.id} className={rowClass(false)}>
            <RowTile icon={KeyRound} active tone={key.kind === 'preview' ? 'warning' : 'primary'} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                <span className="truncate">{key.name}</span>
                <Badge variant={key.kind === 'preview' ? 'warning' : 'reference'}>{key.kind === 'preview' ? 'Preview' : 'Delivery'}</Badge>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{key.tokenPrefix}…</span>
                {' · '}
                {key.contentTypeKeys ? key.contentTypeKeys.join(', ') : 'All content types'}
                {' · '}
                {key.lastUsedAt ? (
                  <>
                    used <RelativeTime iso={key.lastUsedAt} />
                  </>
                ) : (
                  'never used'
                )}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-exception" onClick={() => setRevoking(key)}>
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      {revoking && (
        <ConfirmModal
          title={`Revoke ${revoking.name}?`}
          message="Every website or build using this key stops receiving content. This cannot be undone — create a new key to replace it."
          confirmLabel="Revoke"
          pendingLabel="Revoking…"
          isPending={revoke.isPending}
          onConfirm={() => revoke.mutate(revoking)}
          onClose={() => setRevoking(null)}
        />
      )}
    </details>
  );
}
