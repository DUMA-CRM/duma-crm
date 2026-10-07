'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { BookOpen, KeyRound, Loader2, Plus, RotateCcw, Send, Sparkles, Trash2, Webhook } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { ActionButton, CopyButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  CMS_WEBHOOK_EVENTS,
  type CmsApiKey,
  type CmsApiKeyKind,
  type CmsWebhook,
  type CmsWebhookEvent,
  createCmsApiKey,
  createCmsWebhook,
  deleteCmsWebhook,
  exportCmsContent,
  getCmsApiKeys,
  getCmsContentTypes,
  getCmsLocales,
  getCmsSettings,
  getCmsWebhookDeliveries,
  getCmsWebhooks,
  redeliverCmsWebhook,
  revokeCmsApiKey,
  rotateCmsWebhookSecret,
  testCmsWebhook,
  updateCmsSettings,
  updateCmsWebhook,
} from '@/lib/modules/cms/client';
import { buildAiPrompt, deliveryBase } from '@/lib/utils/cms-docs';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { SecretReveal } from './SecretReveal';
import { FIELD_LABEL_CLASS, TEXTAREA_CLASS, cmsKeys, copyText, invalidateCms } from './shared';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';

const EVENT_LABELS: Record<CmsWebhookEvent, string> = {
  'entry.published': 'Entry published',
  'entry.unpublished': 'Entry unpublished',
  'entry.deleted': 'Entry deleted',
  'asset.changed': 'Media changed',
};

/** For a `CopyButton`, which answers success in place — only a failure needs a toast. */
async function copy(text: string) {
  const copied = await copyText(text);
  if (!copied) toast('error', 'Copy failed — select the text instead.');
  return copied;
}

/**
 * API keys and webhooks, laid out like a Settings tab. How to use them lives
 * in the API docs tab; the aside here points there and hands over the AI brief.
 */
export function DevelopersPanel({ onOpenDocs }: { onOpenDocs: () => void }) {
  return (
    <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      <SettingsTabBody aside={<BuildSection onOpenDocs={onOpenDocs} />}>
        <ApiKeysSection />
        <WebhooksSection />
        <FilePrivacySection />
        <BackupSection />
      </SettingsTabBody>
    </motion.div>
  );
}

/** The tile every row here opens with — the same shape as Settings → Devices. */
function RowTile({ icon: Icon, active, tone = 'primary' }: { icon: typeof KeyRound; active: boolean; tone?: 'primary' | 'warning' }) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-md',
        !active ? 'bg-band text-muted-foreground' : tone === 'warning' ? 'bg-measured/12 text-measured' : 'bg-primary/10 text-primary',
      )}
    >
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}

const rowClass = (muted: boolean, arrived = false) =>
  cn(
    'flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-3',
    muted ? 'border-rule/40 bg-background/30 opacity-70' : 'border-rule/50 bg-background/60',
    arrived && 'row-arrive',
  );

/** How long a create button shows its "done" tick before the secret takes over. */
const DONE_BEAT_MS = 650;

// ─── API keys ────────────────────────────────────────────────────────────────

function ApiKeysSection() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; name: string; token: string; kind: CmsApiKeyKind } | null>(null);
  // The row just created, lit up once the secret is put away.
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<CmsApiKey | null>(null);
  const query = useQuery({ queryKey: cmsKeys.apiKeys(tenantId), queryFn: () => getCmsApiKeys(tenantId ?? undefined), enabled: !!tenantId });

  const revoke = useMutation({
    mutationFn: (key: CmsApiKey) => revokeCmsApiKey(key.id, tenantId ?? undefined),
    onSuccess: () => {
      invalidateCms(queryClient);
      setRevoking(null);
      toast('success', 'Key revoked. Requests using it now fail.');
    },
    onError: (error) => toast('error', error.message),
  });

  // Live keys first, newest first; revoked and expired ones sink to the bottom.
  const keys = [...(query.data ?? [])].sort(
    (a, b) => Number(a.state !== 'active') - Number(b.state !== 'active') || b.createdAt.localeCompare(a.createdAt),
  );
  const active = keys.filter((key) => key.state === 'active').length;

  return (
    <SettingsSection
      title="API keys"
      description="How a website or app reads your content. Delivery keys see published entries only and are safe in a browser; preview keys see drafts too and belong on a server."
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" /> New key
        </Button>
      }
      footnote="Only a fingerprint of each key is stored, so a key is shown once, when it is created. Revoking takes effect within 30 seconds."
    >
      {query.isPending ? (
        <TilesSkeleton count={2} label="Loading API keys" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load your API keys" onRetry={() => void query.refetch()} />
      ) : keys.length === 0 ? (
        <EmptyState
          compact
          icon={KeyRound}
          title="No API keys yet"
          description="Create one to fetch content from your website."
          action={{ label: 'Create a key', onClick: () => setCreating(true), icon: Plus }}
        />
      ) : (
        <>
          <p className="mb-2 text-xs tabular-nums text-muted-foreground">
            {active} active {active === 1 ? 'key' : 'keys'}
          </p>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {keys.map((key, index) => {
                const live = key.state === 'active';
                return (
                  <motion.li
                    key={key.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : index * 0.04 } }}
                    exit={{ opacity: 0, x: 16 }}
                    className={rowClass(!live, key.id === arrivedId)}
                  >
                    <RowTile icon={KeyRound} active={live} tone={key.kind === 'preview' ? 'warning' : 'primary'} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="truncate">{key.name}</span>
                        <Badge variant={key.kind === 'preview' ? 'warning' : 'reference'}>
                          {key.kind === 'preview' ? 'Preview' : 'Delivery'}
                        </Badge>
                        {!live && <Badge variant="muted">{key.state === 'revoked' ? 'Revoked' : 'Expired'}</Badge>}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{key.tokenPrefix}…</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {key.contentTypeKeys ? key.contentTypeKeys.join(', ') : 'All content types'}
                        {key.allowedOrigins
                          ? ` · ${key.allowedOrigins.length} ${key.allowedOrigins.length === 1 ? 'website' : 'websites'}`
                          : ''}
                        {' · '}
                        {key.lastUsedAt ? (
                          <>
                            used <RelativeTime iso={key.lastUsedAt} />
                          </>
                        ) : (
                          'never used'
                        )}
                        {key.expiresAt && live ? (
                          <>
                            {' · '}expires <RelativeTime iso={key.expiresAt} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    {live && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-exception"
                        onClick={() => setRevoking(key)}
                      >
                        Revoke
                      </Button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </>
      )}

      {creating && (
        <CreateKeyDialog
          onClose={() => setCreating(false)}
          onCreated={(id, name, token, kind) => {
            setCreating(false);
            setRevealed({ id, name, token, kind });
          }}
        />
      )}
      {revealed && (
        <SecretReveal
          title={`${revealed.name} is ready`}
          label="API key"
          icon={KeyRound}
          secret={revealed.token}
          warning={
            revealed.kind === 'preview'
              ? 'This preview key can read unpublished drafts. Keep it on your server — never ship it to a browser.'
              : 'Copy it now. Only a fingerprint is stored, so it can never be shown again.'
          }
          onClose={() => {
            setArrivedId(revealed.id);
            setRevealed(null);
          }}
        />
      )}
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
    </SettingsSection>
  );
}

function CreateKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string, name: string, token: string, kind: CmsApiKeyKind) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CmsApiKeyKind>('delivery');
  const [types, setTypes] = useState<string[]>([]);
  const [origins, setOrigins] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const create = useMutation({
    mutationFn: () =>
      createCmsApiKey(
        {
          name: name.trim(),
          kind,
          contentTypeKeys: types.length > 0 ? types : null,
          allowedOrigins: origins
            .split(/[\s,]+/)
            .map((value) => value.trim().replace(/\/$/, ''))
            .filter(Boolean),
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        },
        tenantId ?? undefined,
      ),
    onSuccess: (result) => {
      invalidateCms(queryClient);
      setDone(true);
      // Hand over even if the dialog was closed meanwhile — the token is shown only once.
      setTimeout(() => onCreated(result.apiKey.id, result.apiKey.name, result.token, result.apiKey.kind), reduceMotion ? 0 : DONE_BEAT_MS);
    },
    onError: (error) => toast('error', error.message),
  });

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
            disabled={!name.trim()}
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
      <div className="space-y-4">
        <Input label="Name" placeholder="Marketing website" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Key type">
          {(
            [
              ['delivery', 'Delivery', 'Published content only. Fine in a browser.'],
              ['preview', 'Preview', 'Drafts too. Server-side only.'],
            ] as const
          ).map(([value, label, detail]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                'rounded-md border px-3 py-2 text-left',
                kind === value ? 'border-primary bg-primary/6' : 'border-rule/60 hover:bg-band/50',
              )}
            >
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{detail}</span>
            </button>
          ))}
        </div>
        {(typesQuery.data?.length ?? 0) > 0 && (
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
        <div>
          <label htmlFor="cms-key-origins" className={FIELD_LABEL_CLASS}>
            Allowed websites (optional)
          </label>
          <textarea
            id="cms-key-origins"
            rows={2}
            className={cn(TEXTAREA_CLASS, 'mt-1 font-mono text-xs')}
            placeholder="https://www.example.com"
            value={origins}
            onChange={(event) => setOrigins(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Browsers on other sites are refused. Server-side requests are unaffected.</p>
        </div>
        <Input label="Expires (optional)" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
      </div>
    </Modal>
  );
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

function WebhooksSection() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; name: string; secret: string } | null>(null);
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CmsWebhook | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: cmsKeys.webhooks(tenantId),
    queryFn: () => getCmsWebhooks(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const toggle = useMutation({
    mutationFn: (hook: CmsWebhook) => updateCmsWebhook(hook.id, { isActive: !hook.isActive }, tenantId ?? undefined),
    onSuccess: () => invalidateCms(queryClient),
    onError: (error) => toast('error', error.message),
  });
  const test = useMutation({
    mutationFn: (hook: CmsWebhook) => testCmsWebhook(hook.id, tenantId ?? undefined),
    onSuccess: (result) =>
      toast(result.ok ? 'success' : 'error', result.ok ? 'Ping delivered.' : `Ping failed: ${result.error ?? `HTTP ${result.status}`}`),
    onError: (error) => toast('error', error.message),
  });
  const rotate = useMutation({
    mutationFn: (hook: CmsWebhook) => rotateCmsWebhookSecret(hook.id, tenantId ?? undefined),
    onSuccess: (result) => {
      invalidateCms(queryClient);
      setRevealed({ id: result.webhook.id, name: result.webhook.name, secret: result.secret });
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (hook: CmsWebhook) => deleteCmsWebhook(hook.id, tenantId ?? undefined),
    onSuccess: () => {
      invalidateCms(queryClient);
      setDeleting(null);
      toast('success', 'Webhook deleted.');
    },
    onError: (error) => toast('error', error.message),
  });

  const hooks = query.data ?? [];

  return (
    <SettingsSection
      title="Webhooks"
      description="Call your website’s rebuild or cache-purge URL whenever content changes, so edits go live without a redeploy."
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" /> New webhook
        </Button>
      }
      footnote="Failed deliveries retry with backoff, up to 8 attempts. Open Deliveries to see each attempt and send one again."
    >
      {query.isPending ? (
        <TilesSkeleton count={2} label="Loading webhooks" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load your webhooks" onRetry={() => void query.refetch()} />
      ) : hooks.length === 0 ? (
        <EmptyState
          compact
          icon={Webhook}
          title="No webhooks yet"
          description="Add one to rebuild your site when you publish."
          action={{ label: 'Add a webhook', onClick: () => setCreating(true), icon: Plus }}
        />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {hooks.map((hook, index) => {
              const last = hook.lastDelivery;
              return (
                <motion.li
                  key={hook.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : index * 0.04 } }}
                  exit={{ opacity: 0, x: 16 }}
                  className={rowClass(!hook.isActive, hook.id === arrivedId)}
                >
                  <RowTile icon={Webhook} active={hook.isActive} tone={last?.status === 'failed' ? 'warning' : 'primary'} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="truncate">{hook.name}</span>
                      {last && (
                        <Badge variant={last.status === 'succeeded' ? 'success' : last.status === 'failed' ? 'destructive' : 'muted'}>
                          {last.status === 'succeeded' ? 'Delivering' : last.status === 'failed' ? 'Failing' : 'Retrying'}
                        </Badge>
                      )}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{hook.url}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {hook.events.map((event) => EVENT_LABELS[event]).join(' · ')}
                      {last ? (
                        <>
                          {' · '}last sent <RelativeTime iso={last.at} />
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex w-full items-center justify-end gap-0.5 sm:w-auto">
                    <Switch
                      checked={hook.isActive}
                      label={`${hook.name} active`}
                      disabled={toggle.isPending}
                      onChange={() => toggle.mutate(hook)}
                    />
                    <Button variant="ghost" size="sm" className="ml-1.5 gap-1" disabled={test.isPending} onClick={() => test.mutate(hook)}>
                      {test.isPending && test.variables?.id === hook.id ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Send aria-hidden="true" />
                      )}
                      Test
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setOpenId(hook.id)}>
                      Deliveries
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      aria-label={`Rotate ${hook.name} signing secret`}
                      title="Rotate signing secret"
                      disabled={rotate.isPending}
                      onClick={() => rotate.mutate(hook)}
                    >
                      <RotateCcw aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-exception"
                      aria-label={`Delete ${hook.name}`}
                      onClick={() => setDeleting(hook)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {creating && (
        <CreateWebhookDialog
          onClose={() => setCreating(false)}
          onCreated={(id, name, secret) => {
            setCreating(false);
            setRevealed({ id, name, secret });
          }}
        />
      )}
      {revealed && (
        <SecretReveal
          title={`Signing secret for ${revealed.name}`}
          label="Signing secret"
          icon={Webhook}
          secret={revealed.secret}
          warning="Store this in your receiver to verify signatures. It is encrypted at rest and cannot be shown again — rotate it if lost."
          onClose={() => {
            setArrivedId(revealed.id);
            setRevealed(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.name}?`}
          message="No further events are sent to it, and its delivery history is removed."
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
      {openId && <DeliveriesDrawer webhookId={openId} onClose={() => setOpenId(null)} />}
    </SettingsSection>
  );
}

function CreateWebhookDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string, name: string, secret: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<CmsWebhookEvent[]>(['entry.published', 'entry.unpublished', 'entry.deleted']);
  const [urlError, setUrlError] = useState<string | undefined>();

  const create = useMutation({
    mutationFn: () => createCmsWebhook({ name: name.trim(), url: url.trim(), events }, tenantId ?? undefined),
    onSuccess: (result) => {
      invalidateCms(queryClient);
      setDone(true);
      // Hand over even if the dialog was closed meanwhile — the secret is shown only once.
      setTimeout(() => onCreated(result.webhook.id, result.webhook.name, result.secret), reduceMotion ? 0 : DONE_BEAT_MS);
    },
    onError: (error) => {
      setUrlError(/url|address|https|resolve/i.test(error.message) ? error.message : undefined);
      toast('error', error.message);
    },
  });

  return (
    <Modal
      title="New webhook"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={done} onClick={onClose}>
            Cancel
          </Button>
          <ActionButton
            className="min-w-40"
            disabled={!name.trim() || !url.trim() || events.length === 0}
            pending={create.isPending}
            done={done}
            pendingLabel="Creating…"
            doneLabel="Webhook created"
            onClick={() => create.mutate()}
          >
            Create webhook
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Name" placeholder="Rebuild website" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
        <Input
          label="URL"
          type="url"
          placeholder="https://api.vercel.com/v1/integrations/deploy/…"
          value={url}
          error={urlError}
          hint="Must be https and reachable on the public internet"
          onChange={(event) => {
            setUrl(event.target.value);
            setUrlError(undefined);
          }}
        />
        <fieldset>
          <legend className={FIELD_LABEL_CLASS}>Send on</legend>
          <div className="mt-1.5 space-y-1.5">
            {CMS_WEBHOOK_EVENTS.map((event) => (
              <label key={event} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={events.includes(event)}
                  onChange={() => setEvents(events.includes(event) ? events.filter((item) => item !== event) : [...events, event])}
                />
                {EVENT_LABELS[event]} <span className="font-mono text-xs text-muted-foreground">{event}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

function DeliveriesDrawer({ webhookId, onClose }: { webhookId: string; onClose: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: cmsKeys.deliveries(webhookId),
    queryFn: () => getCmsWebhookDeliveries(webhookId, tenantId),
    refetchInterval: 15_000,
  });
  const redeliver = useMutation({
    mutationFn: (deliveryId: string) => redeliverCmsWebhook(webhookId, deliveryId, tenantId),
    onSuccess: (delivery) => {
      invalidateCms(queryClient);
      toast(
        delivery.status === 'succeeded' ? 'success' : 'error',
        delivery.status === 'succeeded' ? 'Delivered.' : `Still failing: ${delivery.lastError ?? 'no response'}`,
      );
    },
    onError: (error) => toast('error', error.message),
  });

  return (
    <Drawer title="Recent deliveries" description="The last 50 events sent to this webhook." onClose={onClose}>
      {query.isError ? (
        <ErrorState title="Couldn’t load deliveries" onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <LoadingState label="Loading deliveries" compact />
      ) : query.data.length === 0 ? (
        <EmptyState compact icon={Webhook} title="Nothing sent yet" description="Publish an entry, or use Test, to see deliveries here." />
      ) : (
        <ul className="space-y-2">
          {query.data.map((delivery) => (
            <li key={delivery.id} className="rounded-lg border border-rule/50 bg-background/60 px-3.5 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{delivery.eventType}</span>
                <Badge variant={delivery.status === 'succeeded' ? 'success' : delivery.status === 'failed' ? 'destructive' : 'muted'}>
                  {delivery.status === 'succeeded'
                    ? `OK${delivery.responseStatus ? ` ${delivery.responseStatus}` : ''}`
                    : delivery.status === 'failed'
                      ? 'Failed'
                      : 'Retrying'}
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  <RelativeTime iso={delivery.createdAt} /> · {delivery.attemptCount} {delivery.attemptCount === 1 ? 'attempt' : 'attempts'}
                </span>
                {delivery.status !== 'succeeded' && (
                  <Button size="xs" variant="outline" disabled={redeliver.isPending} onClick={() => redeliver.mutate(delivery.id)}>
                    Redeliver
                  </Button>
                )}
              </div>
              {delivery.lastError && <p className="mt-1 wrap-break-word text-xs text-exception">{delivery.lastError}</p>}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

// ─── Aside ───────────────────────────────────────────────────────────────────

function BuildSection({ onOpenDocs }: { onOpenDocs: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const localesQuery = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const base = deliveryBase(API_ORIGIN);

  return (
    <SettingsSection
      title="Build with the API"
      description="Endpoints, query syntax, your models as TypeScript, and webhook verification — all in the API docs."
      footnote="The AI brief describes this workspace’s models and the whole API, and contains no keys."
    >
      <div className="flex items-center gap-2 rounded-md border border-rule/50 bg-background/60 py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{base}</code>
        <CopyButton
          iconOnly
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          label="Copy base URL"
          copiedLabel="Base URL copied"
          onCopy={() => copy(base)}
        />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <CopyButton
          variant="default"
          icon={<Sparkles aria-hidden="true" />}
          label="Copy prompt for AI"
          copiedLabel="Prompt copied"
          onCopy={() => copy(buildAiPrompt({ apiOrigin: API_ORIGIN, types: typesQuery.data ?? [], locales: localesQuery.data ?? [] }))}
        />
        <Button variant="outline" className="gap-1.5" onClick={onOpenDocs}>
          <BookOpen aria-hidden="true" /> Open the API docs
        </Button>
      </div>
    </SettingsSection>
  );
}

// ─── File privacy ────────────────────────────────────────────────────────────

/**
 * Whether files only drafts use can be fetched by their URL. Off by default:
 * a file linked from outside the CMS (a logo in a site's code) would stop
 * loading. Applies to DUMA's file URLs; a file on a bucket's own public URL
 * is as public as that bucket.
 */
function FilePrivacySection() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: cmsKeys.settings(tenantId),
    queryFn: () => getCmsSettings(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const save = useMutation({
    mutationFn: (privateUnpublishedAssets: boolean) => updateCmsSettings({ privateUnpublishedAssets }, tenantId ?? undefined),
    onSuccess: (settings) => {
      invalidateCms(queryClient);
      toast('success', settings.privateUnpublishedAssets ? 'Draft-only files are now private.' : 'All files are reachable by URL again.');
    },
    onError: (error) => toast('error', error.message),
  });
  return (
    <SettingsSection title="File privacy">
      {query.isError ? (
        <ErrorState title="Couldn’t load file privacy" onRetry={() => void query.refetch()} />
      ) : (
        <div className={rowClass(false)}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Keep draft-only files private</span>
            <span className="block text-xs text-muted-foreground">
              A file’s URL stops working until a published entry uses it, so unreleased images can’t be found by guessing. Files linked from
              outside the CMS stop loading too. Files on a connected bucket’s own public URL follow that bucket’s rules.
            </span>
          </span>
          <Switch
            label="Keep draft-only files private"
            checked={query.data?.privateUnpublishedAssets ?? false}
            disabled={!query.data || save.isPending}
            onChange={(value) => save.mutate(value)}
          />
        </div>
      )}
    </SettingsSection>
  );
}

// ─── Backup ──────────────────────────────────────────────────────────────────

/** One JSON file with every model, language, entry and media record — a backup, or the start of a move. */
function BackupSection() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const blob = await exportCmsContent(tenantId ?? undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `duma-content-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'The export failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <SettingsSection title="Backup">
      <div className={rowClass(false)}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Export all content</span>
          <span className="block text-xs text-muted-foreground">
            Every model, language and entry (drafts and live), and each media file’s details and URL, as one JSON file. Files themselves
            stay where they are.
          </span>
        </span>
        <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => void download()}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null} {busy ? 'Exporting…' : 'Export JSON'}
        </Button>
      </div>
    </SettingsSection>
  );
}
