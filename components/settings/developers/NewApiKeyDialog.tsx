'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { PickerRow } from '@/components/cms/rows';
import { TEXTAREA_CLASS, cmsKeys, invalidateCms } from '@/components/cms/shared';
import { BookOpen, CalendarDays, Globe, Layers, Lock, MapPin, Settings, ShoppingBag } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { ActionButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type ApiKeyKind,
  type ApiKeyScope,
  type WorkspaceApiKey,
  createWorkspaceApiKey,
  updateWorkspaceApiKey,
} from '@/lib/api/api-keys.service';
import { PUBLIC_APIS, type PublicApiId, SCOPES, grantableScopes, isContentApi, kindAllows } from '@/lib/developers/api-reference';
import { getCmsContentTypes } from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { DONE_BEAT_MS } from './rows';
import type { DeveloperAccess } from './useDeveloperAccess';

const KIND_HINT: Record<ApiKeyKind, string> = {
  publishable: 'Safe in a browser. Reads published content and the catalogue — nothing else.',
  secret: 'Your server only. Can read and change data within the access you give it.',
};

const API_ICON: Record<PublicApiId, IconComponent> = { store: ShoppingBag, content: BookOpen, manage: Layers, management: Settings };

type Row = `api:${PublicApiId}` | 'location' | 'types' | 'origins' | 'expires';

/**
 * A new workspace key, or an existing one edited or replaced. The access is
 * the registry's scopes, one row per API that opens its switches; ones this
 * person can't grant are shown off and locked, with the reason.
 */
export function NewApiKeyDialog({
  access,
  locations,
  onClose,
  onCreated,
  initialKey,
  editing = false,
  onUpdated,
}: {
  initialKey?: WorkspaceApiKey;
  editing?: boolean;
  onUpdated?: () => void;
  access: DeveloperAccess;
  locations: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated: (result: { key: WorkspaceApiKey; token: string }) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  // Content scopes need the module on: the API would accept them, but nothing could answer.
  const offered = (kind: ApiKeyKind) =>
    grantableScopes(kind, access.capabilities).filter((scope) => access.contentOn || !isContentApi(SCOPES[scope].api));
  // Write scopes are opt-in: offered, never pre-ticked.
  const initial = (kind: ApiKeyKind) => offered(kind).filter((scope) => !SCOPES[scope].optIn);

  const [kind, setKind] = useState<ApiKeyKind>(initialKey?.kind ?? 'publishable');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(() => initialKey?.scopes ?? initial('publishable'));
  const [name, setName] = useState(initialKey ? `${initialKey.name}${editing ? '' : ' replacement'}` : '');
  const [locationId, setLocationId] = useState(initialKey?.locationId ?? '');
  const [types, setTypes] = useState<string[]>(initialKey?.contentTypeKeys ?? []);
  const [origins, setOrigins] = useState(initialKey?.allowedOrigins?.join('\n') ?? '');
  const [expiresAt, setExpiresAt] = useState(initialKey?.expiresAt?.slice(0, 10) ?? '');
  const [open, setOpen] = useState<Row | null>(null);
  const [done, setDone] = useState(false);

  // A content-type limit covers reading and writing entries alike.
  const limitsTypes = scopes.some((scope) => scope.startsWith('content:') || scope.startsWith('media:'));

  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId ?? null),
    queryFn: () => getCmsContentTypes(tenantId),
    enabled: access.canReadContent && limitsTypes,
  });

  const originList = origins
    .split(/[\s,]+/)
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const badOrigin = originList.find((value) => !/^https?:\/\/[^/\s]+$/.test(value));
  const recordsOrders = scopes.includes('orders:write');
  const location = locations.find((row) => row.id === locationId);

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        scopes,
        locationId: locationId || null,
        contentTypeKeys: limitsTypes && types.length > 0 ? types : null,
        allowedOrigins: originList.length > 0 ? originList : null,
        expiresAt:
          expiresAt === initialKey?.expiresAt?.slice(0, 10)
            ? initialKey.expiresAt
            : expiresAt
              ? new Date(`${expiresAt}T23:59:59`).toISOString()
              : null,
      };
      if (editing && initialKey) return { apiKey: await updateWorkspaceApiKey(initialKey.id, payload, tenantId), token: null };
      return createWorkspaceApiKey({ ...payload, kind }, tenantId);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      invalidateCms(queryClient);
      if (result.token === null) {
        toast('success', 'Key updated.');
        onUpdated?.();
        onClose();
        return;
      }
      setDone(true);
      // Hand over even if the dialog was closed meanwhile — the token is shown only once.
      const token = result.token;
      setTimeout(() => onCreated({ key: result.apiKey, token }), reduceMotion ? 0 : DONE_BEAT_MS);
    },
    onError: (error) => toast('error', error.message),
  });

  const blocked = !name.trim() || scopes.length === 0 || Boolean(badOrigin) || (recordsOrders && !locationId);
  const toggleRow = (row: Row) => setOpen((current) => (current === row ? null : row));
  const flip = (scope: ApiKeyScope) =>
    setScopes((current) => (current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]));
  const apis = PUBLIC_APIS.filter((api) => !isContentApi(api.id) || access.contentOn);

  return (
    <Modal
      title={editing ? 'Edit API key' : initialKey ? 'Replace API key' : 'New API key'}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={done} onClick={onClose}>
            Cancel
          </Button>
          <ActionButton
            className="min-w-32"
            disabled={blocked}
            pending={create.isPending}
            done={done}
            pendingLabel={editing ? 'Saving…' : 'Creating…'}
            doneLabel="Key created"
            onClick={() => create.mutate()}
          >
            {editing ? 'Save changes' : 'Create key'}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-5">
        <Input
          label="Name"
          placeholder="Website, Shop server, Claude Code…"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />

        {!editing && (
          <div className="space-y-1.5">
            <ChoiceCards<ApiKeyKind>
              appearance="settings"
              value={kind}
              onChange={(next) => {
                setKind(next);
                // Each kind starts from everything this person may give it.
                setScopes(initial(next));
              }}
              options={[
                { value: 'publishable', label: 'Publishable', icon: Globe },
                { value: 'secret', label: 'Secret', icon: Lock },
              ]}
            />
            <p className="text-xs text-muted-foreground">{KIND_HINT[kind]}</p>
          </div>
        )}

        {initialKey && !editing && (
          <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
            The original key keeps working. Switch your integration to the new one, check it works, then revoke the original.
          </p>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Access</h3>
          {apis.map((api) => {
            const apiScopes = (Object.keys(SCOPES) as ApiKeyScope[]).filter((scope) => SCOPES[scope].api === api.id);
            const on = apiScopes.filter((scope) => scopes.includes(scope)).length;
            const row: Row = `api:${api.id}`;
            return (
              <PickerRow
                key={api.id}
                icon={API_ICON[api.id]}
                title={api.name.replace(/ API$/, '')}
                value={on === 0 ? 'No access' : on === apiScopes.length ? 'Full access' : `${on} of ${apiScopes.length}`}
                muted={on === 0}
                open={open === row}
                onToggle={() => toggleRow(row)}
              >
                <div className="space-y-3 border-l border-rule/50 pl-4">
                  {apiScopes.map((scope) => {
                    const allowedByKind = kindAllows(kind, scope);
                    const grantable = offered(kind).includes(scope);
                    return (
                      <ScopeRow
                        key={scope}
                        title={SCOPES[scope].label}
                        detail={!allowedByKind ? 'Secret keys only' : !grantable ? 'Not yours to grant' : SCOPES[scope].detail}
                        checked={scopes.includes(scope)}
                        locked={!allowedByKind || !grantable}
                        onChange={() => flip(scope)}
                      />
                    );
                  })}
                </div>
              </PickerRow>
            );
          })}
          {offered(kind).length === 0 && (
            <p className="text-xs text-exception">
              You can’t grant any access on a {kind} key — ask someone who manages workspace settings.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Limits</h3>
          <PickerRow
            icon={MapPin}
            title={recordsOrders ? 'Sells from' : 'Location'}
            value={location?.name ?? (recordsOrders ? 'Choose one' : 'Every location')}
            tone={recordsOrders && !locationId ? 'warning' : undefined}
            muted={!location}
            open={open === 'location'}
            onToggle={() => toggleRow('location')}
          >
            <Select
              ariaLabel="Location"
              className="w-full"
              value={locationId}
              onValueChange={setLocationId}
              options={[
                { value: '', label: recordsOrders ? 'Choose a location' : 'Every location' },
                ...locations.map((row) => ({ value: row.id, label: row.name })),
              ]}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Orders need a location to sell from. Workspace management needs a key without one.
            </p>
          </PickerRow>

          {limitsTypes && (typesQuery.data?.length ?? 0) > 0 && (
            <PickerRow
              icon={Layers}
              title="Content types"
              value={types.length === 0 ? 'All' : `${types.length} ${types.length === 1 ? 'type' : 'types'}`}
              muted={types.length === 0}
              open={open === 'types'}
              onToggle={() => toggleRow('types')}
            >
              <div className="flex flex-wrap gap-1.5">
                {typesQuery.data!.map((type) => {
                  const picked = types.includes(type.key);
                  return (
                    <button
                      key={type.key}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => setTypes(picked ? types.filter((item) => item !== type.key) : [...types, type.key])}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs',
                        picked ? 'border-primary bg-primary text-primary-foreground' : 'border-rule hover:bg-band',
                      )}
                    >
                      {type.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {types.length === 0 ? 'Every type, including ones added later.' : 'Entries of other types answer “not found”.'}
              </p>
            </PickerRow>
          )}

          <PickerRow
            icon={Globe}
            title="Websites"
            value={
              badOrigin
                ? 'Check the address'
                : originList.length === 0
                  ? 'Any'
                  : originList.length === 1
                    ? originList[0]!.replace(/^https?:\/\//, '')
                    : `${originList.length} websites`
            }
            tone={badOrigin ? 'danger' : undefined}
            muted={originList.length === 0}
            open={open === 'origins'}
            onToggle={() => toggleRow('origins')}
          >
            <textarea
              aria-label="Websites allowed to use the key"
              rows={2}
              autoFocus
              className={cn(TEXTAREA_CLASS, 'font-mono text-xs')}
              placeholder="https://www.yourshop.com"
              value={origins}
              onChange={(event) => setOrigins(event.target.value)}
            />
            <p className={cn('mt-1.5 text-xs', badOrigin ? 'text-exception' : 'text-muted-foreground')}>
              {badOrigin
                ? `“${badOrigin}” isn’t an address like https://www.yourshop.com`
                : 'Browsers on other sites are refused. Requests from a server aren’t affected.'}
            </p>
          </PickerRow>

          <PickerRow
            icon={CalendarDays}
            title="Expires"
            value={expiresAt ? formatDate(`${expiresAt}T12:00:00`) : 'Never'}
            muted={!expiresAt}
            open={open === 'expires'}
            onToggle={() => toggleRow('expires')}
          >
            <Input aria-label="Expiry date" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              For a contractor or a test — the key stops working at the end of the day.
            </p>
          </PickerRow>
        </section>
      </div>
    </Modal>
  );
}

/** One permission: what it lets the key do, and its switch. */
function ScopeRow({
  title,
  detail,
  checked,
  locked,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  locked: boolean;
  onChange: () => void;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', locked && 'opacity-55')}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={locked} />
    </div>
  );
}
