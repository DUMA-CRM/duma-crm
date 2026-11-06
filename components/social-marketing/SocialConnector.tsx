'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BrandTile, InfoRow, InfoRows, RowMenu, RowWarning, SectionInfo } from '@/components/cms/rows';
import { CalendarDays, Megaphone, Plug, RefreshCw, ShieldCheck, Trash2, UserPlus, Users } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ConnectorManagePage } from '@/components/settings/connectors/ConnectorManagePage';
import { CONNECTOR_BRANDS } from '@/components/settings/connectors/brands';
import { CONNECTORS_BY_ID } from '@/components/settings/connectors/registry';
import { panelClass } from '@/components/settings/connectors/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type Account,
  LABELS,
  type Platform,
  checkAccount,
  connections,
  disconnect,
  marketingKey,
  posts,
  startConnect,
} from '@/lib/modules/marketing/client';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** What to know before signing in, per provider — shown before the first account and beside "connect another". */
const BEFORE: Record<Platform, string> = {
  youtube: 'Google signs in with the account this browser uses. To connect a different channel, choose another account on Google’s screen.',
  facebook: 'Sign in with access to the Facebook Pages you want to publish to. Every Page you allow appears here as its own destination.',
  instagram: 'Use an Instagram professional account (Business or Creator).',
  tiktok: 'Sign in with the TikTok account your business posts from.',
};

/** Adding a second destination, in each provider's own words. */
const ANOTHER: Record<Platform, string> = {
  youtube: 'Connect a different channel',
  facebook: 'Connect more Pages',
  instagram: 'Connect another account',
  tiktok: 'Connect another account',
};

const DAY = 86_400_000;

/**
 * A social provider's connection: the accounts the workspace publishes to,
 * each with its own state and its own disconnect, in the shared manage layout.
 */
export function SocialConnector({ provider, onClose }: { provider: Platform; onClose: () => void }) {
  const tid = useWorkspaceStore((s) => s.tenantId),
    client = useQueryClient(),
    search = useSearchParams();
  const definition = CONNECTORS_BY_ID[provider];
  const brand = CONNECTOR_BRANDS[provider];
  const [removing, setRemoving] = useState<Account | null>(null);
  const canWrite = hasCapability(
    useAuthStore((s) => s.capabilities),
    'marketing.connections:write',
  );
  const q = useQuery({ queryKey: marketingKey(tid, 'connections'), queryFn: connections });
  // What's due to go out in the next 90 days, for "Used by". Rounded to the day so the key holds still.
  const [today] = useState(() => new Date(Math.floor(Date.now() / DAY) * DAY));
  const from = today.toISOString(),
    to = new Date(today.getTime() + 90 * DAY).toISOString();
  const upcoming = useQuery({ queryKey: marketingKey(tid, 'posts', from, to, 1), queryFn: () => posts(from, to, 1), enabled: !!tid });
  const connect = useMutation({
    mutationFn: () => startConnect(provider),
    onSuccess: (r) => window.location.assign(r.url),
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: disconnect,
    onSuccess: () => {
      toast('success', `${removing?.name ?? LABELS[provider]} disconnected.`);
      setRemoving(null);
      void client.invalidateQueries({ queryKey: marketingKey(tid) });
    },
    onError: (error) => toast('error', error.message),
  });
  // Checking proves DUMA can still use an account; signing in only proved it once.
  const check = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => checkAccount(id)));
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failed) throw failed.reason instanceof Error ? failed.reason : new Error('An account didn’t answer.');
      return ids.length;
    },
    onSuccess: (count) => toast('success', count === 1 ? 'The account is working.' : `All ${count} accounts are working.`),
    onError: (error) => toast('error', error.message),
  });
  const config = q.data?.providers.find((p) => p.provider === provider);
  // Back from the provider (the API's callback lands here): say how it went on
  // the list, as Google Drive does, rather than on this page.
  const router = useRouter();
  const outcome = search.get('oauth');
  useEffect(() => {
    if (!outcome) return;
    if (outcome === 'connected') toast('success', `${LABELS[provider]} connected. Choose it as a destination on any post.`);
    // The API sends a reason only in its own words (never a provider's), so it can be shown as is.
    else
      toast('error', search.get('reason') ?? `${LABELS[provider]} didn’t connect. Check the account type and permissions, then try again.`);
    void client.invalidateQueries({ queryKey: marketingKey(tid) });
    router.replace('/settings/connectors');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the redirect
  }, []);

  const accounts = q.data?.accounts.filter((a) => a.provider === provider) ?? [];
  const live = accounts.filter((a) => a.state === 'connected');
  const lapsed = accounts.length > 0 && live.length === 0;
  const ids = new Set(accounts.map((a) => a.id));
  const scheduled = upcoming.data?.data
    .flatMap((post) => post.targets)
    .filter((t) => ids.has(t.connectionId) && t.status === 'scheduled').length;
  const canConnect = canWrite && config?.configured === true;
  const awaitingApproval = provider === 'tiktok' && config && !config.directPost;

  const connectButton = (label: string) =>
    canConnect ? (
      <Button className="gap-1.5" disabled={connect.isPending} onClick={() => connect.mutate()}>
        <Plug size={15} aria-hidden="true" /> {connect.isPending ? 'Opening sign-in…' : label}
      </Button>
    ) : null;

  return (
    <>
      <ConnectorManagePage
        definition={definition}
        brand={brand}
        status={
          !config?.configured
            ? { tone: 'muted', text: 'Not set up by DUMA yet' }
            : live.length
              ? { tone: 'success', text: 'Connected' }
              : lapsed
                ? { tone: 'danger', text: 'Disconnected — connect again to keep publishing' }
                : undefined
        }
        loading={q.isPending}
        error={q.isError ? { title: 'Couldn’t load your social accounts', onRetry: () => void q.refetch() } : undefined}
        notSetUp={
          accounts.length === 0 ? (
            <div className={panelClass}>
              <p className="text-sm text-muted-foreground">
                {config?.configured
                  ? `${definition.description} ${BEFORE[provider]}`
                  : `${LABELS[provider]} needs setting up by the DUMA administrator before anyone can connect it.`}
              </p>
              {awaitingApproval && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Automatic publishing is awaiting TikTok’s approval. You can connect and prepare drafts now.
                </p>
              )}
              {canConnect && <div className="mt-4">{connectButton(`Connect ${LABELS[provider]}`)}</div>}
              {!canWrite && config?.configured && (
                <p className="mt-3 text-xs text-muted-foreground">Ask an owner or marketing manager to connect it.</p>
              )}
            </div>
          ) : undefined
        }
        health={{
          facts: [
            {
              icon: Users,
              title: 'Accounts',
              value: lapsed ? 'None connected' : `${live.length} connected`,
              tone: lapsed ? 'danger' : undefined,
            },
            {
              icon: Megaphone,
              title: 'Publishing',
              value: awaitingApproval ? 'Awaiting TikTok approval' : 'Automatic at the scheduled time',
              tone: awaitingApproval ? 'warning' : undefined,
            },
          ],
          problem: lapsed ? 'Scheduled posts to these accounts are blocked until you connect again.' : null,
          test: live.length
            ? {
                label: live.length === 1 ? 'Check the account' : 'Check accounts',
                icon: RefreshCw,
                pending: check.isPending,
                onTest: () => check.mutate(live.map((account) => account.id)),
              }
            : undefined,
        }}
        usedBy={[
          {
            icon: CalendarDays,
            label: 'Scheduled posts, next 90 days',
            count: scheduled === undefined ? undefined : `${scheduled}${upcoming.data?.hasMore ? '+' : ''}`,
            href: '/marketing',
          },
        ]}
        actions={canConnect ? [{ icon: UserPlus, label: ANOTHER[provider], onClick: () => connect.mutate() }] : []}
        aside={
          <SettingsSection
            title="Permissions"
            actions={
              <SectionInfo label={`You can also remove DUMA from the account’s security settings on ${LABELS[provider]} at any time.`} />
            }
          >
            <InfoRows>
              <InfoRow
                icon={ShieldCheck}
                wrap
                title="What DUMA uses it for"
                description="Publishing the posts you schedule, and showing the account’s name."
              >
                {null}
              </InfoRow>
            </InfoRows>
          </SettingsSection>
        }
        onClose={onClose}
      >
        <SettingsSection title="Accounts" actions={canConnect ? <SectionInfo label={BEFORE[provider]} /> : undefined}>
          <InfoRows>
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3">
                {brand && <BrandTile brand={brand} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{account.remoteId}</p>
                </div>
                <Badge variant={account.state === 'connected' ? 'success' : 'warning'}>
                  {account.state === 'connected' ? 'Connected' : 'Needs reconnecting'}
                </Badge>
                {canWrite && account.state !== 'disconnected' && (
                  <RowMenu
                    label={`${account.name} actions`}
                    items={[
                      ...(account.state === 'connected'
                        ? [{ icon: RefreshCw, label: 'Check', disabled: check.isPending, onClick: () => check.mutate([account.id]) }]
                        : []),
                      { icon: Trash2, label: 'Disconnect', danger: true, onClick: () => setRemoving(account) },
                    ]}
                  />
                )}
              </div>
            ))}
          </InfoRows>
          {lapsed && canConnect && (
            <RowWarning className="mt-4">
              Every {LABELS[provider]} account here is disconnected. Connect again to keep publishing to it.
            </RowWarning>
          )}
          {canConnect && <div className="mt-4">{connectButton(lapsed ? `Connect ${LABELS[provider]} again` : ANOTHER[provider])}</div>}
        </SettingsSection>
      </ConnectorManagePage>

      {removing && (
        <ConfirmModal
          title={`Disconnect ${removing.name}?`}
          message={
            <div className="space-y-2">
              <p>This will happen straight away:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Scheduled posts to {removing.name} are blocked.</li>
                <li>Drafts and publishing history stay in DUMA.</li>
                <li>DUMA stays authorised on {LABELS[provider]} until you remove it there too.</li>
              </ul>
            </div>
          }
          confirmLabel="Disconnect"
          pendingLabel="Disconnecting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing.id)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
