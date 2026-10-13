'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { SecretReveal } from '@/components/cms/SecretReveal';
import { FIELD_LABEL_CLASS, cmsKeys, invalidateCms } from '@/components/cms/shared';
import { Loader2, Plus, RotateCcw, Send, Trash2, Webhook } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  CMS_WEBHOOK_EVENTS,
  type CmsWebhook,
  type CmsWebhookEvent,
  createCmsWebhook,
  deleteCmsWebhook,
  getCmsWebhookDeliveries,
  getCmsWebhooks,
  redeliverCmsWebhook,
  rotateCmsWebhookSecret,
  testCmsWebhook,
  updateCmsWebhook,
} from '@/lib/modules/cms/client';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { DONE_BEAT_MS, RowTile, rowClass } from './rows';

const EVENT_LABELS: Record<CmsWebhookEvent, string> = {
  'entry.published': 'Entry published',
  'entry.unpublished': 'Entry unpublished',
  'entry.deleted': 'Entry deleted',
  'asset.changed': 'Media changed',
};

/** Signed POSTs to a website when its content changes — Content events today. */
export function WebhooksSection() {
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
      description="Call your website’s rebuild or cache-purge URL whenever content is published, unpublished or deleted, so edits go live without a redeploy."
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
