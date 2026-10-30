'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';

import { EnableAdminConnector } from '@/components/admin/EnableAdminConnector';
import { useSettingsScope, useSettingsTenantId } from '@/components/settings/SettingsScope';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';

import { canAccessConnector } from '@/lib/auth/connector-access';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';

import { AnalyticsConnectWizard, AnalyticsConnectorPage } from './AnalyticsConnector';
import { ConnectorsGrid } from './ConnectorsGrid';
import { EmailConnectWizard, EmailConnectorPage } from './EmailConnector';
import { PaymentsConnectWizard, PaymentsConnectorPage } from './PaymentsConnector';
import { StorageConnectWizard } from './StorageConnector';
import { StorageConnectorPage } from './StorageConnectorPage';
import { TelegramConnectWizard, TelegramConnectorPage } from './TelegramConnector';
import { ADMIN_CONNECTOR_IDS, CONNECTORS_BY_ID, type ConnectorId } from './registry';

/**
 * Connectors is URL-driven: `?connector=email` opens its manage page and
 * `&mode=connect` opens the step-by-step setup. Both replace the settings shell
 * rather than nesting inside it, so the back button closes them, links are
 * shareable, and a refresh keeps you where you were. The settings layout's
 * shell steps aside while either is open.
 */
export function ConnectorsRoute() {
  const router = useRouter();
  const scope = useSettingsScope();
  const LIST = scope?.connectorsPath ?? '/settings/connectors';
  const capabilities = useAuthStore((state) => state.capabilities);
  const tenantId = useSettingsTenantId();
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    staleTime: 30_000,
  });
  const searchParams = useSearchParams();
  const connector = searchParams.get('connector') as ConnectorId | null;
  const connecting = searchParams.get('mode') === 'connect';

  const toList = () => router.push(LIST);
  const toManage = (id: ConnectorId) => router.replace(`${LIST}?connector=${id}`);
  const toConnect = (id: ConnectorId) => router.push(`${LIST}?connector=${id}&mode=connect`);

  if (scope && connector && !ADMIN_CONNECTOR_IDS.includes(connector)) {
    return (
      <EditorShell title="Connections" onClose={() => router.push('/admin/settings')}>
        <ErrorState title="This connection belongs in workspace or personal settings" />
      </EditorShell>
    );
  }
  const definition = connector ? CONNECTORS_BY_ID[connector] : undefined;
  if (definition?.moduleId && modules.isPending) {
    return (
      <EditorShell title={definition.name} onClose={toList}>
        <TilesSkeleton count={1} label="Checking connection access" />
      </EditorShell>
    );
  }
  if (definition?.moduleId && modules.isError) {
    return (
      <EditorShell title={definition.name} onClose={toList}>
        <ErrorState title="Couldn’t check connection access" onRetry={() => void modules.refetch()} />
      </EditorShell>
    );
  }
  if (
    scope &&
    definition?.moduleId &&
    !modules.data?.modules.some((item) => item.moduleId === definition.moduleId && item.status === 'enabled')
  ) {
    return <EnableAdminConnector tenantId={scope.tenantId} moduleId={definition.moduleId} name={definition.name} onClose={toList} />;
  }
  if (definition && !canAccessConnector(capabilities, definition, modules.data?.modules)) {
    return (
      <EditorShell title={definition.name} onClose={toList}>
        <ErrorState
          title="You don’t have access to this connection"
          description="Ask a workspace administrator for access, or return to Connections."
        />
      </EditorShell>
    );
  }

  if (connector === 'telegram') {
    return connecting ? (
      <TelegramConnectWizard onClose={toList} onDone={() => toManage('telegram')} />
    ) : (
      <TelegramConnectorPage onClose={toList} onConnect={() => toConnect('telegram')} />
    );
  }

  if (connector === 'email') {
    return connecting ? (
      <EmailConnectWizard onClose={toList} onDone={() => toManage('email')} />
    ) : (
      <EmailConnectorPage onClose={toList} onReconnect={() => toConnect('email')} />
    );
  }

  if (connector === 'card-payments') {
    return connecting ? (
      <PaymentsConnectWizard onClose={toList} onDone={() => toManage('card-payments')} />
    ) : (
      <PaymentsConnectorPage onClose={toList} onAdd={() => toConnect('card-payments')} />
    );
  }

  if (connector === 'media-storage') {
    return connecting ? (
      <StorageConnectWizard onClose={toList} onDone={() => toManage('media-storage')} />
    ) : (
      <StorageConnectorPage onClose={toList} onConnect={() => toConnect('media-storage')} />
    );
  }

  if (connector === 'analytics') {
    return connecting ? (
      <AnalyticsConnectWizard onClose={toList} onDone={() => toManage('analytics')} />
    ) : (
      <AnalyticsConnectorPage onClose={toList} onConnect={() => toConnect('analytics')} />
    );
  }

  return scope ? (
    <EditorShell title="Connections" onClose={() => router.push('/admin/settings')}>
      <ConnectorsGrid />
    </EditorShell>
  ) : (
    <ConnectorsGrid />
  );
}
