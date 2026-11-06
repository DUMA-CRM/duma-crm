'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { InfoRow, InfoRows, RowTile } from '@/components/cms/rows';
import { AlertTriangle, ChevronRight, Code, MapPin, Plug } from '@/components/icons';
import { useSettingsTenantId } from '@/components/settings/SettingsScope';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import { hasAnyCapability } from '@/lib/auth/capabilities';
import { canAccessConnector } from '@/lib/auth/connector-access';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { getAnalyticsConnection } from '@/lib/modules/analytics/client';
import { getCmsStorage } from '@/lib/modules/cms/client';
import { getTelegramConnection, telegramQueryKey } from '@/lib/modules/communications/client';
import { getEmailConnection } from '@/lib/modules/communications/client';
import { type Platform, connections, marketingKey, startConnect } from '@/lib/modules/marketing/client';
import { getGoogleDriveStatus, startGoogleDriveConnect } from '@/lib/modules/notes/client';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { getPaymentConnections } from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { hardwareScope } from '@/lib/pos-hardware/model';
import { toast } from '@/lib/toast';
import { formatBytes } from '@/lib/utils/cms';
import { useAuthStore } from '@/stores/authStore';
import { useTillHardwareStore } from '@/stores/tillHardwareStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { type ConnectorAccount, type ConnectorAction, ConnectorRow } from './ConnectorRow';
import { emailConnectorState } from './EmailConnector';
import { PROVIDER_LABELS, paymentsConnectorState } from './PaymentsConnector';
import { storageConnectorState, storageProviderLabel } from './StorageConnector';
import { telegramConnectorState } from './TelegramConnector';
import { tillHardwareState, tillHardwareSummary } from './TillHardwareConnector';
import { CONNECTORS, type ConnectorId, type ConnectorState } from './registry';
import { relativeTime } from './shared';

/**
 * The Connectors tab: every integration on one screen with its live status, the
 * account it is using, and one thing to do — as rows grouped by what needs you
 * (attention, connected, not set up), with an at-a-glance summary in the side panel. Statuses come from the same endpoints the
 * connectors themselves use, so a card never claims something is working when
 * the last check says otherwise.
 */
export function ConnectorsGrid() {
  const router = useRouter();
  const tenantId = useSettingsTenantId();
  const locationId = useWorkspaceStore((state) => state.locationId);
  const hardware = useTillHardwareStore((state) =>
    tenantId && locationId ? state.registers[hardwareScope(tenantId, locationId)] : undefined,
  );
  const listPath = '/settings/connectors';
  const capabilities = useAuthStore((state) => state.capabilities);
  const workspace = useCurrentWorkspace();
  // The same rule as the Developers tab.
  const canUseApi = hasAnyCapability(capabilities, 'settings:write', 'cms.keys:write');

  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    staleTime: 30_000,
  });
  const visible = (definition: (typeof CONNECTORS)[number]) => canAccessConnector(capabilities, definition, modules.data?.modules);

  const social = useQuery({
    queryKey: marketingKey(tenantId, 'connections'),
    queryFn: connections,
    enabled: !!tenantId && visible(CONNECTORS.find((d) => d.id === 'youtube')!),
    retry: false,
  });

  // Like Google Drive: a row with nothing connected goes straight to the provider's sign-in.
  const connectSocial = useMutation({
    mutationFn: (provider: Platform) => startConnect(provider),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast('error', error.message),
  });

  const telegram = useQuery({
    queryKey: telegramQueryKey(tenantId),
    queryFn: () => getTelegramConnection(tenantId!),
    enabled: !!tenantId && visible(CONNECTORS.find((d) => d.id === 'telegram')!),
    retry: false,
  });

  const {
    data: emailConnection,
    isLoading: emailLoading,
    isError: emailError,
    refetch: retryEmail,
  } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId && visible(CONNECTORS.find((definition) => definition.id === 'email')!),
    retry: false,
    meta: { silentForbidden: true },
  });
  // Every reader, paused ones included: the till list (payment-methods) hides
  // paused readers, which made a paused-only location look unconnected and sent
  // "Connect" into the add flow instead of to the reader you already have.
  const {
    data: paymentMethods,
    isLoading: paymentsLoading,
    isError: paymentsError,
    refetch: retryPayments,
  } = useQuery({
    queryKey: moduleQueryKeys.payments.key('payment-connections', locationId),
    queryFn: () => getPaymentConnections(locationId!),
    enabled: !!locationId && visible(CONNECTORS.find((definition) => definition.id === 'card-payments')!),
    meta: { silentForbidden: true },
  });

  const paymentsVisible = visible(CONNECTORS.find((definition) => definition.id === 'card-payments')!);
  const storageVisible = visible(CONNECTORS.find((definition) => definition.id === 'media-storage')!);
  const {
    data: storage,
    isLoading: storageLoading,
    isError: storageError,
    refetch: retryStorage,
  } = useQuery({
    queryKey: moduleQueryKeys.cms.key('storage', tenantId),
    queryFn: () => getCmsStorage(tenantId ?? undefined),
    enabled: !!tenantId && storageVisible,
  });
  const analyticsVisible = visible(CONNECTORS.find((definition) => definition.id === 'analytics')!);
  const {
    data: analyticsConnection,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: retryAnalytics,
  } = useQuery({
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
  const {
    data: google,
    isLoading: googleLoading,
    isError: googleError,
    refetch: retryGoogle,
  } = useQuery({
    queryKey: googleKey,
    queryFn: getGoogleDriveStatus,
    enabled: driveVisible,
    retry: false,
  });
  const connectGoogle = useMutation({
    mutationFn: startGoogleDriveConnect,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast('error', error.message),
  });
  // Back from Google's consent screen (the API's callback redirects here).
  useEffect(() => {
    const outcome = searchParams.get('google');
    if (!outcome) return;
    if (outcome === 'connected') toast('success', 'Google Drive connected. Choose “Sync to Google Docs” on any note.');
    else toast('error', searchParams.get('reason') ?? 'Google Drive didn’t connect.');
    void queryClient.invalidateQueries({ queryKey: googleKey });
    router.replace(listPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the redirect
  }, []);

  const open = (id: ConnectorId, mode?: 'connect') => router.push(`${listPath}?connector=${id}${mode ? `&mode=${mode}` : ''}`);

  const emailState = emailConnectorState(emailConnection);
  const paymentsState = paymentsConnectorState(paymentMethods);

  const cards = CONNECTORS.filter(visible)
    .filter((definition) => definition.id !== 'google-drive' || google?.configured === true)
    .map((definition) => {
      if (['youtube', 'facebook', 'instagram', 'tiktok'].includes(definition.id)) {
        const provider = definition.id as Platform;
        const accounts = social.data?.accounts.filter((a) => a.provider === provider) ?? [];
        const live = accounts.filter((a) => a.state === 'connected');
        const lapsed = accounts.length > 0 && live.length === 0;
        const state: ConnectorState = social.isError || lapsed ? 'attention' : live.length ? 'connected' : 'disconnected';
        // Not set up by the DUMA administrator, or read-only: the manage page explains.
        const direct =
          !social.isError &&
          live.length === 0 &&
          social.data?.providers.find((p) => p.provider === provider)?.configured === true &&
          hasAnyCapability(capabilities, 'marketing.connections:write');
        return {
          definition,
          state,
          accounts: accounts.map((a) => ({ label: a.name, meta: a.state === 'connected' ? 'Connected' : 'Needs reconnecting' })),
          loading: social.isLoading,
          action: direct
            ? {
                label: lapsed ? 'Re-connect' : 'Connect',
                onClick: () => connectSocial.mutate(provider),
                disabled: connectSocial.isPending,
              }
            : { label: 'Manage', onClick: () => open(definition.id) },
          alert: social.isError
            ? { title: 'Couldn’t load social accounts' }
            : lapsed
              ? { title: 'Disconnected', detail: 'Connect again to keep publishing here.' }
              : undefined,
        };
      }
      if (definition.id === 'till-hardware') {
        return {
          definition,
          state: tillHardwareState(hardware),
          accounts: hardware ? [{ label: hardware.registerName, meta: tillHardwareSummary(hardware) }] : [],
          action: hardware
            ? { label: 'Manage', onClick: () => open('till-hardware') }
            : { label: 'Set up this till', onClick: () => open('till-hardware', 'connect'), disabled: !locationId },
        };
      }
      if (definition.id === 'telegram') {
        const connection = telegram.data;
        const state: ConnectorState = telegram.isError ? 'attention' : telegramConnectorState(connection);
        return {
          definition,
          state,
          accounts: connection ? [{ label: connection.chatTitle, meta: `@${connection.botUsername}` }] : [],
          action:
            connection || telegram.isError
              ? { label: 'Manage', onClick: () => open('telegram') }
              : { label: 'Connect', onClick: () => open('telegram', 'connect') },
          alert:
            state === 'attention'
              ? { title: telegram.isError ? 'Couldn’t load Telegram' : connection?.lastError || 'Send a test to confirm delivery' }
              : undefined,
        };
      }
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
            ? { label: 'Re-connect', onClick: () => open('email', 'connect') }
            : { label: 'Manage', onClick: () => open('email') }
          : { label: 'Connect', onClick: () => open('email', 'connect') };
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
        const [first, ...rest] = [
          ...all.filter((reader) => reader.isActive !== false),
          ...all.filter((reader) => reader.isActive === false),
        ];
        const accounts: ConnectorAccount[] = first ? [{ label: first.displayName, meta: PROVIDER_LABELS[first.provider] }] : [];
        const action: ConnectorAction = first
          ? { label: 'Manage', onClick: () => open('card-payments') }
          : { label: 'Connect', onClick: () => open('card-payments', 'connect'), disabled: !locationId };
        return { definition, state: paymentsState, accounts, extraAccountCount: rest.length, action };
      }

      if (definition.id === 'media-storage') {
        const state = storageConnectorState(storage);
        const active = storage?.connections.find((connection) => connection.isActive);
        const accounts: ConnectorAccount[] = !storage
          ? []
          : active
            ? [{ label: active.displayName, meta: storageProviderLabel(active) }]
            : [
                {
                  label: 'DUMA storage',
                  meta: `${formatBytes(storage.builtIn.usedBytes)} of ${formatBytes(storage.builtIn.quotaBytes)} free tier used`,
                },
              ];
        const action: ConnectorAction =
          state === 'attention'
            ? { label: 'Fix', onClick: () => open('media-storage') }
            : (storage?.connections.length ?? 0) > 0
              ? { label: 'Manage', onClick: () => open('media-storage') }
              : { label: 'Connect', onClick: () => open('media-storage', 'connect') };
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
            ? { label: 'Manage', onClick: () => open('google-drive') }
            : {
                label: state === 'attention' ? 'Re-connect' : 'Connect',
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
            ? { label: 'Manage', onClick: () => open('analytics') }
            : { label: 'Connect', onClick: () => open('analytics', 'connect') },
        };
      }

      return { definition, state: 'unavailable' as ConnectorState, accounts: [] };
    });

  // Which rows exist depends on the modules, so only that waits for the whole page.
  if (modules.isPending) return <Bone className="h-96 w-full rounded-lg" />;
  if (modules.isError) return <ErrorState title="Couldn’t load your connections" onRetry={() => void modules.refetch()} />;

  // Each status check belongs to its row: a slow one shows a placeholder line, a failed one says so on that row alone.
  const checks: Partial<Record<ConnectorId, { loading: boolean; error: boolean; retry: () => unknown }>> = {
    telegram: { loading: telegram.isLoading, error: telegram.isError, retry: telegram.refetch },
    email: { loading: emailLoading, error: emailError, retry: retryEmail },
    'card-payments': { loading: paymentsLoading, error: paymentsError, retry: retryPayments },
    'media-storage': { loading: storageLoading, error: storageError, retry: retryStorage },
    analytics: { loading: analyticsLoading, error: analyticsError, retry: retryAnalytics },
    'google-drive': { loading: googleLoading, error: googleError, retry: retryGoogle },
    ...Object.fromEntries(
      (['youtube', 'facebook', 'instagram', 'tiktok'] as const).map((id) => [
        id,
        { loading: social.isLoading, error: social.isError, retry: social.refetch },
      ]),
    ),
  };
  const rows = cards.map((card) => {
    const check = checks[card.definition.id];
    if (check?.error)
      return {
        ...card,
        state: 'attention' as ConnectorState,
        accounts: [],
        alert: { title: `Couldn’t check ${card.definition.name}` },
        action: { label: 'Try again', onClick: () => void check.retry() },
      };
    return check?.loading ? { ...card, loading: true } : card;
  });

  // Most urgent first: broken, then working, then not set up — each its own section.
  const live = rows.filter((card) => card.definition.available);
  const soon = rows.filter((card) => !card.definition.available);
  const attention = live.filter((card) => card.state === 'attention');
  const connected = live.filter((card) => card.state === 'connected' || card.state === 'paused');
  const notSetUp = live.filter((card) => card.state === 'disconnected');
  const activeBucket = storage?.connections.find((connection) => connection.isActive);
  const list = (group: typeof live) => (
    <div className="-mx-2 flex flex-col gap-0.5">
      {group.map((card) => (
        <ConnectorRow key={card.definition.id} {...card} />
      ))}
    </div>
  );

  return (
    <SettingsTabBody
      narrowAside
      aside={
        <SettingsSection title="At a glance">
          <InfoRows>
            {paymentsVisible && (
              <>
                <InfoRow icon={MapPin} title="Location">
                  <span className="truncate text-sm font-semibold text-foreground">{workspace.location?.name ?? 'None chosen'}</span>
                </InfoRow>
              </>
            )}
          </InfoRows>
          {paymentsVisible && (
            <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              Card readers belong to one location — switch location to see another’s. Till hardware belongs to this browser and location.
              Other shared connections are workspace-wide.
            </p>
          )}
          {storageVisible && storage && !activeBucket && storage.builtIn.usedBytes >= storage.builtIn.quotaBytes * 0.8 && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
              <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
              <span>The free media storage is nearly full — connect your own bucket under Media storage.</span>
            </p>
          )}
          {hasAnyCapability(capabilities, 'settings:write') && (
            <Link href="/settings/modules" className="mt-4 block text-sm font-medium text-primary hover:underline">
              Manage modules and available connections
            </Link>
          )}
          {canUseApi && (
            <div className="-mx-2 mt-4 flex flex-col gap-0.5">
              <Link
                href="/settings/developers"
                className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50"
              >
                <RowTile icon={Code} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">Build your own</span>
                  <span className="block truncate text-xs text-muted-foreground">API keys, webhooks and MCP</span>
                </span>
                <ChevronRight
                  size={14}
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          )}
        </SettingsSection>
      }
    >
      {live.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No connections available"
          description="Connections appear when their module is on and your role can manage them."
          action={
            hasAnyCapability(capabilities, 'settings:write') ? { label: 'Open module settings', href: '/settings/modules' } : undefined
          }
        />
      ) : (
        <>
          {attention.length > 0 && (
            <SettingsSection title="Needs attention" actions={<Badge variant="destructive">{attention.length}</Badge>}>
              {list(attention)}
            </SettingsSection>
          )}
          {connected.length > 0 && <SettingsSection title="Set up">{list(connected)}</SettingsSection>}
          {notSetUp.length > 0 && <SettingsSection title="Not set up">{list(notSetUp)}</SettingsSection>}
          {soon.length > 0 && <SettingsSection title="Coming soon">{list(soon)}</SettingsSection>}
        </>
      )}
    </SettingsTabBody>
  );
}
