'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Plug, Settings, Zap } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCmsStorage } from '@/lib/modules/cms/client';
import { getEmailConnection } from '@/lib/modules/communications/client';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { getPaymentConnections } from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { formatBytes } from '@/lib/utils/cms';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { type ConnectorAccount, type ConnectorAction, ConnectorCard } from './ConnectorCard';
import { emailConnectorState } from './EmailConnector';
import { PROVIDER_LABELS, paymentsConnectorState } from './PaymentsConnector';
import { CONNECTORS, type ConnectorId, type ConnectorState } from './registry';
import { relativeTime } from './shared';
import { storageConnectorState, storageProviderLabel } from './StorageConnector';

/**
 * The Connectors tab: every integration on one screen with its live status, the
 * account it is using, and one button. Statuses come from the same endpoints the
 * connectors themselves use, so a card never claims something is working when
 * the last check says otherwise.
 */
export function ConnectorsGrid() {
  const router = useRouter();
  const { tenantId, locationId } = useWorkspaceStore();

  const { data: emailConnection } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  // Every reader, paused ones included: the till list (payment-methods) hides
  // paused readers, which made a paused-only location look unconnected and sent
  // "Connect" into the add flow instead of to the reader you already have.
  const { data: paymentMethods } = useQuery({
    queryKey: moduleQueryKeys.payments.key('payment-connections', locationId),
    queryFn: () => getPaymentConnections(locationId!),
    enabled: !!locationId,
  });

  const capabilities = useAuthStore((state) => state.capabilities);
  // Same key as the settings shell, so this is the shell's cached answer.
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    staleTime: 30_000,
  });
  const visible = (definition: (typeof CONNECTORS)[number]) =>
    (!definition.capability || hasCapability(capabilities, definition.capability)) &&
    (!definition.moduleId ||
      (modules.data?.modules.some((module) => module.moduleId === definition.moduleId && module.status === 'enabled') ?? false));
  const storageVisible = visible(CONNECTORS.find((definition) => definition.id === 'media-storage')!);
  const { data: storage } = useQuery({
    queryKey: moduleQueryKeys.cms.key('storage', tenantId),
    queryFn: () => getCmsStorage(tenantId ?? undefined),
    enabled: !!tenantId && storageVisible,
  });

  const open = (id: ConnectorId, mode?: 'connect') => router.push(`/settings/connectors?connector=${id}${mode ? `&mode=${mode}` : ''}`);

  const emailState = emailConnectorState(emailConnection);
  const paymentsState = paymentsConnectorState(paymentMethods);

  const cards = CONNECTORS.filter(visible).map((definition) => {
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
        : { label: 'Connect', icon: Plug, onClick: () => open('email', 'connect') };
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
        : { label: 'Connect', icon: Plug, onClick: () => open('card-payments', 'connect'), disabled: !locationId };
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
            : { label: 'Connect', icon: Plug, onClick: () => open('media-storage', 'connect') };
      return {
        definition,
        state,
        accounts,
        extraAccountCount: Math.max(0, (storage?.connections.length ?? 0) - 1),
        action,
        alert: state === 'attention' ? { title: 'The last check failed', detail: active?.lastError ?? undefined } : undefined,
      };
    }

    return { definition, state: 'unavailable' as ConnectorState, accounts: [] };
  });

  // One grid, most urgent first: broken, then working, then not set up. The status line tells them apart.
  const rank = (state: ConnectorState) => ({ attention: 0, connected: 1, paused: 2, disconnected: 3, unavailable: 4 })[state];
  const live = cards.filter((card) => card.definition.available).sort((a, b) => rank(a.state) - rank(b.state));
  const upcoming = cards.filter((card) => !card.definition.available);

  return (
    <SettingsTabBody>
      {/* No card around these: each tile is already a card, and a wrapper would only box them twice. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {live.map((card, index) => (
          <ConnectorCard key={card.definition.id} {...card} index={index} />
        ))}
      </div>

      {upcoming.length > 0 && (
        <SettingsSection title="Coming soon">
          <ul className="grid gap-2 sm:grid-cols-2">
            {upcoming.map(({ definition }) => {
              const Icon = definition.icon;
              return (
                <li key={definition.id} className="flex items-center gap-3 rounded-lg border border-dashed border-rule/60 px-3.5 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-muted-foreground">{definition.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{definition.tags.slice(0, 2).join(' · ')}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </SettingsSection>
      )}
    </SettingsTabBody>
  );
}
