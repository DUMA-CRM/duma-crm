'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { SecretReveal } from '@/components/cms/SecretReveal';
import { RowTile } from '@/components/cms/rows';
import { TEXTAREA_CLASS, copyText } from '@/components/cms/shared';
import { Code, Globe, KeyRound, Lock, MapPin, Plus, ShoppingBag } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { CopyButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type ApiKeyKind,
  type WorkspaceApiKey,
  createWorkspaceApiKey,
  getWorkspaceApiKeys,
  revokeWorkspaceApiKey,
} from '@/lib/api/api-keys.service';
import { getLocations } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';
const STORE_BASE = `${API_ORIGIN.replace(/\/$/, '')}/v1/store`;

const KIND_COPY: Record<ApiKeyKind, { label: string; where: string; can: string }> = {
  publishable: {
    label: 'Publishable',
    where: 'Safe in a browser',
    can: 'Reads products, sizes, prices and stock.',
  },
  secret: {
    label: 'Secret',
    where: 'Your server only',
    can: 'Also records paid orders, customers and newsletter sign-ups.',
  },
};

/**
 * Settings → Developers: the keys a business's own website uses to sell
 * through DUMA — read the catalogue, record paid orders, add subscribers.
 */
export function StorefrontKeysPanel() {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ key: WorkspaceApiKey; token: string } | null>(null);
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
      setRevoking(null);
      toast('success', `${key.name} revoked — it stops working within 30 seconds.`);
    },
    onError: (error) => toast('error', error.message),
  });

  const keys = keysQuery.data ?? [];
  const active = keys.filter((key) => key.state === 'active');
  const retired = keys.filter((key) => key.state !== 'active');

  return (
    <SettingsTabBody aside={<ConnectGuide />} narrowAside>
      <SettingsSection
        title="Storefront API keys"
        description="Let your own website or app sell through DUMA: show your products, record paid orders, and add newsletter subscribers."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" /> New key
          </Button>
        }
      >
        {keysQuery.isPending ? (
          <TilesSkeleton count={2} label="Loading API keys" />
        ) : keysQuery.isError ? (
          <ErrorState title="Couldn’t load your API keys" onRetry={() => void keysQuery.refetch()} />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Connect your website"
            description="Create a secret key for your website’s server to record orders, and a publishable key if its pages read products in the browser."
            action={{ label: 'New key', onClick: () => setCreating(true), icon: Plus }}
          />
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {active.map((key) => (
                <KeyRow key={key.id} apiKey={key} location={locationName(key.locationId)} onRevoke={() => setRevoking(key)} />
              ))}
            </ul>
            {retired.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                  {retired.length} revoked or expired
                </summary>
                <ul className="mt-2 space-y-2 opacity-70">
                  {retired.map((key) => (
                    <KeyRow key={key.id} apiKey={key} location={locationName(key.locationId)} />
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </SettingsSection>

      {creating && (
        <NewKeyDialog
          tenantId={tenantId}
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
              ? 'This key records orders and customers. Keep it on your server, in an environment variable — never in a browser or an app bundle. It can’t be shown again.'
              : 'Copy it now — only a fingerprint is stored, so it can’t be shown again.'
          }
          onClose={() => setRevealed(null)}
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
    </SettingsTabBody>
  );
}

function KeyRow({ apiKey, location, onRevoke }: { apiKey: WorkspaceApiKey; location: string | null; onRevoke?: () => void }) {
  const copy = KIND_COPY[apiKey.kind];
  const needsLocation = apiKey.kind === 'secret' && !apiKey.locationId && apiKey.state === 'active';
  return (
    <li className="flex items-center gap-3 rounded-lg border border-rule/50 bg-control px-3 py-2.5">
      <RowTile icon={apiKey.kind === 'secret' ? Lock : Globe} tone={needsLocation ? 'warning' : 'default'} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
          {apiKey.name}
          <span className="rounded-sm bg-band px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">{copy.label}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{apiKey.tokenPrefix}…</span>
          {location && (
            <>
              {' · '}
              <MapPin size={11} className="-mt-0.5 inline" aria-hidden="true" /> {location}
            </>
          )}
          {' · '}
          {apiKey.state !== 'active' ? (
            apiKey.state === 'revoked' ? (
              'Revoked'
            ) : (
              'Expired'
            )
          ) : apiKey.lastUsedAt ? (
            <>
              Used <RelativeTime iso={apiKey.lastUsedAt} />
            </>
          ) : (
            'Never used'
          )}
        </p>
        {needsLocation && (
          <p className="mt-0.5 text-xs font-medium text-measured">Choose where it sells from before it can record orders.</p>
        )}
      </div>
      {onRevoke && (
        <Button size="sm" variant="ghost" className="shrink-0 text-exception hover:text-exception" onClick={onRevoke}>
          Revoke
        </Button>
      )}
    </li>
  );
}

function NewKeyDialog({
  tenantId,
  locations,
  onClose,
  onCreated,
}: {
  tenantId?: string;
  locations: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated: (result: { key: WorkspaceApiKey; token: string }) => void;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ApiKeyKind>('secret');
  const [name, setName] = useState('Website');
  const [locationId, setLocationId] = useState(locations.length === 1 ? locations[0]!.id : '');
  const [origins, setOrigins] = useState('');

  const originList = origins
    .split(/[\s,]+/)
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const badOrigin = originList.find((value) => !/^https?:\/\/[^/\s]+$/.test(value));

  const create = useMutation({
    mutationFn: () =>
      createWorkspaceApiKey(
        {
          name: name.trim(),
          kind,
          locationId: locationId || null,
          allowedOrigins: kind === 'publishable' && originList.length > 0 ? originList : null,
        },
        tenantId,
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      onCreated({ key: result.apiKey, token: result.token });
    },
    onError: (error) => toast('error', error.message),
  });

  const blocked = !name.trim() || Boolean(badOrigin) || (kind === 'secret' && !locationId);

  return (
    <Modal
      title="New storefront key"
      onClose={onClose}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button className="min-w-28" disabled={blocked || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create key'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <SegmentedControl<ApiKeyKind>
            ariaLabel="Kind of key"
            className="w-full [&>button]:flex-1"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'secret', label: 'Secret', icon: Lock },
              { value: 'publishable', label: 'Publishable', icon: Globe },
            ]}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{KIND_COPY[kind].where}.</span> {KIND_COPY[kind].can}
          </p>
        </div>
        <Input label="Name" value={name} placeholder="Website" onChange={(event) => setName(event.target.value)} />
        <div className="space-y-1.5">
          <p className="text-label uppercase text-muted-foreground">Sells from</p>
          <Select
            ariaLabel="Sells from"
            className="w-full"
            value={locationId}
            onValueChange={setLocationId}
            options={[
              { value: '', label: kind === 'secret' ? 'Choose a location' : 'Any — no stock shown' },
              ...locations.map((row) => ({ value: row.id, label: row.name })),
            ]}
          />
          <p className="text-xs text-muted-foreground">Its prices and stock are what the website shows; its orders land there.</p>
        </div>
        {kind === 'publishable' && (
          <div className="space-y-1.5">
            <label htmlFor="api-key-origins" className="text-label uppercase text-muted-foreground">
              Websites allowed to use it
            </label>
            <textarea
              id="api-key-origins"
              rows={2}
              className={cn(TEXTAREA_CLASS, 'font-mono text-xs')}
              placeholder="https://www.yourshop.com"
              value={origins}
              onChange={(event) => setOrigins(event.target.value)}
            />
            <p className={cn('text-xs', badOrigin ? 'text-exception' : 'text-muted-foreground')}>
              {badOrigin ? `“${badOrigin}” isn’t an address like https://www.yourshop.com` : 'Optional. Leave blank for any website.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** The aside: where the website points, and the four calls a shop needs. */
function ConnectGuide() {
  const calls: Array<{ method: 'GET' | 'POST'; path: string; what: string; secret?: boolean }> = [
    { method: 'GET', path: '/products', what: 'Products, sizes, prices, stock' },
    { method: 'GET', path: '/products/:slug', what: 'One product' },
    { method: 'POST', path: '/orders', what: 'A paid order', secret: true },
    { method: 'POST', path: '/newsletter', what: 'A newsletter sign-up', secret: true },
  ];
  return (
    <SettingsSection title="Connect your website">
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-rule/60 bg-control py-1.5 pl-3 pr-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{STORE_BASE}</code>
          <CopyButton
            iconOnly
            label="Copy base URL"
            copiedLabel="Copied"
            onCopy={async () => {
              const ok = await copyText(STORE_BASE);
              if (!ok) toast('error', 'Copy failed — select the address instead.');
              return ok;
            }}
          />
        </div>
        <ul className="divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-control">
          {calls.map((call) => (
            <li key={call.path + call.method} className="flex items-center gap-2.5 px-3 py-2">
              <span
                className={cn(
                  'w-11 shrink-0 rounded-sm px-1.5 py-0.5 text-center font-mono text-[0.6875rem] font-semibold',
                  call.method === 'GET' ? 'bg-reference/12 text-reference' : 'bg-momentum/12 text-momentum',
                )}
              >
                {call.method}
              </span>
              <span className="min-w-0 flex-1">
                <code className="block truncate font-mono text-xs text-foreground">{call.path}</code>
                <span className="block truncate text-xs text-muted-foreground">{call.what}</span>
              </span>
              {call.secret && (
                <Tooltip side="top" align="end" label="Secret key, from your server">
                  <Lock size={13} className="shrink-0 text-muted-foreground" aria-label="Secret key only" />
                </Tooltip>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2.5 rounded-lg border border-rule/50 bg-band/35 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          <Code size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Send the key as <code className="font-mono text-foreground">Authorization: Bearer dk_…</code>. Orders arrive paid — your website
            takes the payment — and take stock off at once; a size that has run out is refused with{' '}
            <code className="font-mono text-foreground">409</code>.
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound size={12} aria-hidden="true" /> Content for your pages has its own keys, in Content → API &amp; webhooks.
        </p>
      </div>
    </SettingsSection>
  );
}
