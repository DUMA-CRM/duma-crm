'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { Plug, Power, Settings, Zap } from '@/components/icons';
import { SettingsTabBody } from '@/components/settings/SettingsShell';

import { canAccessConnector } from '@/lib/auth/connector-access';
import { getAnalyticsConnection } from '@/lib/modules/analytics/client';
import { getCmsStorage } from '@/lib/modules/cms/client';
import { getEmailConnection } from '@/lib/modules/communications/client';
import { disconnectGoogleDrive, getGoogleDriveStatus, startGoogleDriveConnect } from '@/lib/modules/notes/client';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { getPaymentConnections } from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { formatBytes } from '@/lib/utils/cms';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { type ConnectorAccount, type ConnectorAction, ConnectorCard } from './ConnectorCard';
import { emailConnectorState } from './EmailConnector';
import { PROVIDER_LABELS, paymentsConnectorState } from './PaymentsConnector';
import { storageConnectorState, storageProviderLabel } from './StorageConnector';
import { CONNECTORS, type ConnectorId, type ConnectorState } from './registry';
import { relativeTime } from './shared';

/**
 * The Connectors tab: every integration on one screen with its live status, the
 * account it is using, and one button. Statuses come from the same endpoints the
 * connectors themselves use, so a card never claims something is working when
 * the last check says otherwise.
 */
export function ConnectorsGrid() {
  const router = useRouter();
  const { tenantId, locationId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);

  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    staleTime: 30_000,
  });
  const visible = (definition: (typeof CONNECTORS)[number]) => canAccessConnector(capabilities, definition, modules.data?.modules);

  const { data: emailConnection } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId && visible(CONNECTORS.find((definition) => definition.id === 'email')!),
    retry: false,
    meta: { silentForbidden: true },
  });
  // Every reader, paused ones included: the till list (payment-methods) hides
  // paused readers, which made a paused-only location look unconnected and sent
  // "Connect" into the add flow instead of to the reader you already have.
  const { data: paymentMethods } = useQuery({
    queryKey: moduleQueryKeys.payments.key('payment-connections', locationId),
    queryFn: () => getPaymentConnections(locationId!),
    enabled: !!locationId && visible(CONNECTORS.find((definition) => definition.id === 'card-payments')!),
    meta: { silentForbidden: true },
  });

  const storageVisible = visible(CONNECTORS.find((definition) => definition.id === 'media-storage')!);
  const { data: storage } = useQuery({
    queryKey: moduleQueryKeys.cms.key('storage', tenantId),
    queryFn: () => getCmsStorage(tenantId ?? undefined),
    enabled: !!tenantId && storageVisible,
  });
  const analyticsVisible = visible(CONNECTORS.find((definition) => definition.id === 'analytics')!);
  const { data: analyticsConnection } = useQuery({
    queryKey: moduleQueryKeys.analytics.key('external-connection', tenantId),
    queryFn: () => getAnalyticsConnection(tenantId ?? undefined),
    enabled: !!tenantId && analyticsVisible,
    retry: false,
  });

  // Google Drive is each person's own: connected from here, used from Notes.
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const googleKey = moduleQueryKeys.notes.key('google-status');
  const driveVisible = visible(CONNECTORS.find((definition) => definition.id === 'google-drive')!);
  const { data: google } = useQuery({ queryKey: googleKey, queryFn: getGoogleDriveStatus, enabled: driveVisible, retry: false });
  const connectGoogle = useMutation({
    mutationFn: startGoogleDriveConnect,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast('error', error.message),
  });
  const disconnectGoogle = useMutation({
    mutationFn: disconnectGoogleDrive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.all });
      toast('success', 'Google Drive disconnected. Your notes stopped syncing; the Docs stay in your Drive.');
    },
    onError: (error) => toast('error', error.message),
  });
  // Back from Google's consent screen (the API's callback redirects here).
  useEffect(() => {
    const outcome = searchParams.get('google');
    if (!outcome) return;
    if (outcome === 'connected') toast('success', 'Google Drive connected. Choose “Sync to Google Docs” on any note.');
    else toast('error', searchParams.get('reason') ?? 'Google Drive didn’t connect.');
    void queryClient.invalidateQueries({ queryKey: googleKey });
    router.replace('/settings/connectors');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the redirect
  }, []);

  const open = (id: ConnectorId, mode?: 'connect') => router.push(`/settings/connectors?connector=${id}${mode ? `&mode=${mode}` : ''}`);

  const emailState = emailConnectorState(emailConnection);
  const paymentsState = paymentsConnectorState(paymentMethods);

  const cards = CONNECTORS.filter(visible)
    .filter((definition) => definition.id !== 'google-drive' || google?.configured === true)
    .map((definition) => {
    if (definition.id === 'email') {
      const checked = relativeTime(emailConnection?.lastTestedAt);
      const accounts: ConnectorAccount[] = emailConnection
        ? [
            {
              label: emailConnection.fromEmail || emailConnection.username,
              meta: emailState === 'paused' ? 'Sending is paused' : checked ? `Checked ${checked}` : 'Not checked yet',
            },
          ]
        : [];
      const action: ConnectorAction = emailConnection
        ? emailState === 'attention'
          ? { label: 'Re-connect', icon: Zap, onClick: () => open('email', 'connect') }
          : { label: 'Manage', icon: Settings, onClick: () => open('email'), variant: 'outline' }
        : { label: 'Choose a provider', icon: Plug, onClick: () => open('email', 'connect') };
      return {
        definition,
        state: emailState,
        accounts,
        action,
        alert:
          emailState === 'attention'
            ? {
                title: 'The last check failed',
                detail: emailConnection?.lastTestError ?? 'Re-enter the mailbox password to restore sending.',
              }
            : undefined,
      };
    }

    if (definition.id === 'card-payments') {
      const all = paymentMethods ?? [];
      // Name an active reader first, so a paused backup doesn't headline the card.
      const [first, ...rest] = [...all.filter((reader) => reader.isActive !== false), ...all.filter((reader) => reader.isActive === false)];
      const accounts: ConnectorAccount[] = first ? [{ label: first.displayName, meta: PROVIDER_LABELS[first.provider] }] : [];
      const action: ConnectorAction = first
        ? { label: 'Manage', icon: Settings, onClick: () => open('card-payments'), variant: 'outline' }
        : { label: 'Choose a provider', icon: Plug, onClick: () => open('card-payments', 'connect'), disabled: !locationId };
      return { definition, state: paymentsState, accounts, extraAccountCount: rest.length, action };
    }

    if (definition.id === 'media-storage') {
      const state = storageConnectorState(storage);
      const active = storage?.connections.find((connection) => connection.isActive);
      const accounts: ConnectorAccount[] = !storage
        ? []
        : active
          ? [{ label: active.displayName, meta: storageProviderLabel(active) }]
          : [{ label: 'DUMA storage', meta: `${formatBytes(storage.builtIn.usedBytes)} of ${formatBytes(storage.builtIn.quotaBytes)} free tier used` }];
      const action: ConnectorAction =
        state === 'attention'
          ? { label: 'Fix', icon: Zap, onClick: () => open('media-storage') }
          : (storage?.connections.length ?? 0) > 0
            ? { label: 'Manage', icon: Settings, onClick: () => open('media-storage'), variant: 'outline' }
            : { label: 'Choose a provider', icon: Plug, onClick: () => open('media-storage', 'connect') };
      return {
        definition,
        state,
        accounts,
        extraAccountCount: Math.max(0, (storage?.connections.length ?? 0) - 1),
        action,
        alert: state === 'attention' ? { title: 'The last check failed', detail: active?.lastError ?? undefined } : undefined,
      };
    }

    if (definition.id === 'google-drive') {
      const canSync = google?.canSync === true;
      // Connected before sync existed (read-only access), or Google stopped accepting it: reconnect.
      const state: ConnectorState = !google?.status || google.status === 'revoked' ? 'disconnected' : canSync ? 'connected' : 'attention';
      const accounts: ConnectorAccount[] = google?.email && state !== 'disconnected' ? [{ label: google.email, meta: 'Only you' }] : [];
      const action: ConnectorAction =
        state === 'connected'
          ? { label: 'Disconnect', icon: Power, onClick: () => disconnectGoogle.mutate(), variant: 'outline', disabled: disconnectGoogle.isPending }
          : {
              label: state === 'attention' ? 'Re-connect' : 'Connect',
              icon: state === 'attention' ? Zap : Plug,
              onClick: () => connectGoogle.mutate(),
              disabled: connectGoogle.isPending,
            };
      return {
        definition,
        state,
        accounts,
        action,
        alert:
          state === 'attention'
            ? {
                title: google?.status === 'error' ? 'Google stopped accepting the connection' : 'DUMA needs permission to save Docs',
                detail: google?.lastError ?? 'Connect again and allow DUMA to create files in your Drive.',
              }
            : undefined,
      };
    }

    if (definition.id === 'analytics') {
      const connected = Boolean(analyticsConnection);
      return {
        definition,
        state: connected ? ('connected' as ConnectorState) : ('disconnected' as ConnectorState),
        accounts: connected
          ? [{ label: analyticsConnection!.displayName, meta: analyticsConnection!.provider === 'umami' ? 'Umami' : 'PostHog' }]
          : [],
        action: connected
          ? { label: 'Manage', icon: Settings, onClick: () => open('analytics'), variant: 'outline' as const }
          : { label: 'Choose a provider', icon: Plug, onClick: () => open('analytics', 'connect') },
      };
    }

    return { definition, state: 'unavailable' as ConnectorState, accounts: [] };
  });

  // One grid, most urgent first: broken, then working, then not set up. The status line tells them apart.
  const rank = (state: ConnectorState) => ({ attention: 0, connected: 1, paused: 2, disconnected: 3, unavailable: 4 })[state];
  const live = cards.filter((card) => card.definition.available).sort((a, b) => rank(a.state) - rank(b.state));

  return (
    <SettingsTabBody>
      {/* No card around these: each tile is already a card, and a wrapper would only box them twice. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {live.map((card, index) => (
          <ConnectorCard key={card.definition.id} {...card} index={index} />
        ))}
      </div>

    </SettingsTabBody>
  );
}
