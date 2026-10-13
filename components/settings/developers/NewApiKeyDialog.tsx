'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { FIELD_LABEL_CLASS, TEXTAREA_CLASS, cmsKeys, invalidateCms } from '@/components/cms/shared';
import { Globe, Lock } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { ActionButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type ApiKeyKind, type ApiKeyScope, type WorkspaceApiKey, createWorkspaceApiKey } from '@/lib/api/api-keys.service';
import { PUBLIC_APIS, SCOPES, grantableScopes, isContentApi, kindAllows } from '@/lib/developers/api-reference';
import { getCmsContentTypes } from '@/lib/modules/cms/client';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { DONE_BEAT_MS } from './rows';
import type { DeveloperAccess } from './useDeveloperAccess';

const KIND_COPY: Record<ApiKeyKind, { where: string; can: string }> = {
  publishable: { where: 'Safe in a browser', can: 'Reads published content and the catalogue — nothing else, whatever it is given.' },
  secret: { where: 'Your server only', can: 'Can also read drafts, record orders and add subscribers, as its scopes allow.' },
};

/**
 * A new workspace key. The access list is the registry's scopes, grouped by
 * API: those this person can't grant are shown but locked, so the choice is
 * visible and the reason is too.
 */
export function NewApiKeyDialog({
  access,
  locations,
  onClose,
  onCreated,
}: {
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

  const [kind, setKind] = useState<ApiKeyKind>('publishable');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(() => initial('publishable'));
  const [name, setName] = useState('Website');
  const [locationId, setLocationId] = useState(locations.length === 1 ? locations[0]!.id : '');
  const [types, setTypes] = useState<string[]>([]);
  const [origins, setOrigins] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [done, setDone] = useState(false);

  // A content-type limit covers reading and writing entries alike.
  const limitsTypes = scopes.includes('content:read') || scopes.includes('content:write');

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
  const sellsFrom = recordsOrders || scopes.includes('catalog:read');

  const create = useMutation({
    mutationFn: () =>
      createWorkspaceApiKey(
        {
          name: name.trim(),
          kind,
          scopes,
          locationId: sellsFrom ? locationId || null : null,
          contentTypeKeys: limitsTypes && types.length > 0 ? types : null,
          allowedOrigins: originList.length > 0 ? originList : null,
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        },
        tenantId,
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      invalidateCms(queryClient);
      setDone(true);
      // Hand over even if the dialog was closed meanwhile — the token is shown only once.
      setTimeout(() => onCreated({ key: result.apiKey, token: result.token }), reduceMotion ? 0 : DONE_BEAT_MS);
    },
    onError: (error) => toast('error', error.message),
  });

  const blocked = !name.trim() || scopes.length === 0 || Boolean(badOrigin) || (recordsOrders && !locationId);
  const toggle = (scope: ApiKeyScope) =>
    setScopes((current) => (current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]));

  return (
    <Modal
      title="New API key"
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
            pendingLabel="Creating…"
            doneLabel="Key created"
            onClick={() => create.mutate()}
          >
            Create key
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-5">
        <Input label="Name" placeholder="Website" value={name} autoFocus onChange={(event) => setName(event.target.value)} />

        <div className="space-y-2">
          <SegmentedControl<ApiKeyKind>
            ariaLabel="Kind of key"
            className="w-full [&>button]:flex-1"
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
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{KIND_COPY[kind].where}.</span> {KIND_COPY[kind].can}
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className={FIELD_LABEL_CLASS}>Access</legend>
          {PUBLIC_APIS.filter((api) => !isContentApi(api.id) || access.contentOn).map((api) => (
            <div key={api.id} className="overflow-hidden rounded-lg border border-rule/60">
              <p className="border-b border-rule/50 bg-band/40 px-3 py-1.5 text-xs font-semibold text-foreground">{api.name}</p>
              <ul className="divide-y divide-rule/40">
                {(Object.keys(SCOPES) as ApiKeyScope[])
                  .filter((scope) => SCOPES[scope].api === api.id)
                  .map((scope) => {
                    const allowedByKind = kindAllows(kind, scope);
                    const grantable = offered(kind).includes(scope);
                    const locked = !allowedByKind || !grantable;
                    return (
                      <li key={scope}>
                        <label
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 text-sm',
                            locked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                          )}
                        >
                          <input type="checkbox" checked={scopes.includes(scope)} disabled={locked} onChange={() => toggle(scope)} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-foreground">{SCOPES[scope].label}</span>
                            <span className="block text-xs text-muted-foreground">{SCOPES[scope].detail}</span>
                          </span>
                          <span className="shrink-0 text-right font-mono text-[0.6875rem] text-muted-foreground">
                            {!allowedByKind ? 'secret only' : !grantable ? 'not yours to grant' : scope}
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          {offered(kind).length === 0 && (
            <p className="text-xs text-exception">
              You can’t grant any access on a {kind} key — ask someone who manages workspace settings.
            </p>
          )}
        </fieldset>

        {sellsFrom && (
          <div className="space-y-1.5">
            <p className={FIELD_LABEL_CLASS}>Sells from</p>
            <Select
              ariaLabel="Sells from"
              className="w-full"
              value={locationId}
              onValueChange={setLocationId}
              options={[
                { value: '', label: recordsOrders ? 'Choose a location' : 'Any — no stock shown' },
                ...locations.map((row) => ({ value: row.id, label: row.name })),
              ]}
            />
            <p className="text-xs text-muted-foreground">Its prices and stock are what the website shows; its orders land there.</p>
          </div>
        )}

        {limitsTypes && (typesQuery.data?.length ?? 0) > 0 && (
          <fieldset>
            <legend className={FIELD_LABEL_CLASS}>Content types</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {typesQuery.data!.map((type) => {
                const on = types.includes(type.key);
                return (
                  <button
                    key={type.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTypes(on ? types.filter((item) => item !== type.key) : [...types, type.key])}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-rule hover:bg-band',
                    )}
                  >
                    {type.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {types.length === 0
                ? 'None selected — the key can read every type, including ones added later.'
                : 'The key can read only these.'}
            </p>
          </fieldset>
        )}

        <div className="space-y-1.5">
          <label htmlFor="api-key-origins" className={FIELD_LABEL_CLASS}>
            Websites allowed to use it (optional)
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
            {badOrigin
              ? `“${badOrigin}” isn’t an address like https://www.yourshop.com`
              : 'Browsers on other sites are refused. Server-side requests are unaffected.'}
          </p>
        </div>

        <Input label="Expires (optional)" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
      </div>
    </Modal>
  );
}
