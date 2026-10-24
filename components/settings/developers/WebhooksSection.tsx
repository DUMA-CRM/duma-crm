'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { SecretReveal } from '@/components/cms/SecretReveal';
import { InfoRow, PickerRow, RowMenu } from '@/components/cms/rows';
import { cmsKeys, invalidateCms } from '@/components/cms/shared';
import { History, Plus, RotateCcw, Send, Trash2, Webhook } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone, LoadingState } from '@/components/shared/Skeleton';
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
import { toast } from '@/lib/toast';
import { webhookHealth } from '@/lib/utils/developers';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { DONE_BEAT_MS, Facts } from './rows';

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
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; name: string; secret: string } | null>(null);
  const [deleting, setDeleting] = useState<CmsWebhook | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // One webhook open at a time; a tap on the open one closes it.
  const [openRow, setOpenRow] = useState<string | null>(null);
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
  const failing = hooks.filter((hook) => webhookHealth(hook.isActive, hook.lastDelivery).tone === 'danger').length;

  return (
    <SettingsSection
      title="Webhooks"
      description="Tell your website when content changes, so it rebuilds or clears its cache without a redeploy."
      actions={
        <>
          {failing > 0 && <Badge variant="warning">{failing} failing</Badge>}
          <Button variant="outline" className="h-9" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> New webhook
          </Button>
        </>
      }
    >
      {query.isPending ? (
        <div className="space-y-3" role="status" aria-label="Loading webhooks">
          <Bone className="h-8 w-full rounded-md" />
        </div>
      ) : query.isError ? (
        <ErrorState title="Couldn’t load your webhooks" onRetry={() => void query.refetch()} />
      ) : hooks.length === 0 ? (
        <EmptyState
          compact
          icon={Webhook}
          title="No webhooks yet"
          description="Add your site’s deploy hook and it rebuilds whenever you publish."
          action={{ label: 'New webhook', onClick: () => setCreating(true), icon: Plus }}
        />
      ) : (
        <div className="space-y-3">
          {hooks.map((hook) => {
            const health = webhookHealth(hook.isActive, hook.lastDelivery);
            const busy = (mutation: { isPending: boolean; variables?: CmsWebhook }) =>
              mutation.isPending && mutation.variables?.id === hook.id;
            return (
              <PickerRow
                key={hook.id}
                icon={Webhook}
                tone={health.tone}
                title={hook.name}
                description={hook.url.replace(/^https:\/\//, '')}
                value={health.label}
                muted={health.muted}
                open={openRow === hook.id}
                onToggle={() => setOpenRow((current) => (current === hook.id ? null : hook.id))}
                trailing={
                  <>
                    <Switch
                      checked={hook.isActive}
                      label={`${hook.name} on`}
                      disabled={toggle.isPending}
                      onChange={() => toggle.mutate(hook)}
                    />
                    <RowMenu
                      label={`${hook.name} actions`}
                      pending={busy(test) || busy(rotate)}
                      items={[
                        { icon: Send, label: 'Send a test', onClick: () => test.mutate(hook) },
                        { icon: History, label: 'Deliveries', onClick: () => setOpenId(hook.id) },
                        { icon: RotateCcw, label: 'New signing secret', onClick: () => rotate.mutate(hook) },
                        { icon: Trash2, label: 'Delete', onClick: () => setDeleting(hook), danger: true },
                      ]}
                    />
                  </>
                }
              >
                <Facts
                  rows={[
                    [
                      'Address',
                      <span key="u" className="font-mono">
                        {hook.url}
                      </span>,
                    ],
                    ['Sends on', hook.events.map((event) => EVENT_LABELS[event]).join(' · ')],
                    hook.lastDelivery && ['Last sent', <RelativeTime key="t" iso={hook.lastDelivery.at} />],
                  ]}
                />
              </PickerRow>
            );
          })}
        </div>
      )}

      <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
        Each request is signed, so your site can check it came from DUMA. Failed deliveries retry up to 8 times.
      </p>

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
          warning="Store this where your site receives the webhook, to check each request’s signature. It can’t be shown again — make a new one if it’s lost."
          onClose={() => {
            setOpenRow(revealed.id);
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
        <Input
          required
          label="Name"
          placeholder="Rebuild website"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          required
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
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Send when</h3>
          {CMS_WEBHOOK_EVENTS.map((event) => (
            <InfoRow key={event} icon={Webhook} title={EVENT_LABELS[event]}>
              <Switch
                checked={events.includes(event)}
                label={EVENT_LABELS[event]}
                onChange={() => setEvents(events.includes(event) ? events.filter((item) => item !== event) : [...events, event])}
              />
            </InfoRow>
          ))}
        </section>
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
    <Drawer icon={Webhook} title="Recent deliveries" guidance="The last 50 events sent to this webhook." onClose={onClose}>
      {query.isError ? (
        <ErrorState title="Couldn’t load deliveries" onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <LoadingState label="Loading deliveries" compact />
      ) : query.data.length === 0 ? (
        <EmptyState compact icon={Webhook} title="Nothing sent yet" description="Publish an entry, or use Test, to see deliveries here." />
      ) : (
        <ul className="space-y-2">
          {query.data.map((delivery) => (
            <li key={delivery.id} className="rounded-lg border border-rule/50 bg-field px-3.5 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-all font-mono text-xs">{delivery.eventType}</span>
                <Badge variant={delivery.status === 'succeeded' ? 'success' : delivery.status === 'failed' ? 'destructive' : 'muted'}>
                  {delivery.status === 'succeeded'
                    ? `OK${delivery.responseStatus ? ` ${delivery.responseStatus}` : ''}`
                    : delivery.status === 'failed'
                      ? 'Failed'
                      : 'Retrying'}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
