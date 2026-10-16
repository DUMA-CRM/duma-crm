'use client';

import { useQuery } from '@tanstack/react-query';

import { ChefHat, LayoutDashboard, LayoutGrid, Monitor, QrCode, Receipt, Sparkles, Timer } from '@/components/icons';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';

import { type Capability, hasAnyCapability } from '@/lib/auth/capabilities';
import type { ModuleId } from '@/lib/modules/manifest';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { SettingsDestination, type SettingsDestinationProps } from './SettingsDestination';

type Destination = SettingsDestinationProps & {
  group: 'workspace' | 'screens';
  capabilities?: Capability[];
  module?: ModuleId;
};

/** Each tile opens one editor; scope labels distinguish shared and personal changes. */
export function ConfigurationHome() {
  const capabilities = useAuthStore((state) => state.capabilities);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
  const destinations: Destination[] = [
    {
      href: '/settings/assistant',
      title: 'Ask DUMA',
      description: 'Choose the AI provider used on this device.',
      icon: Sparkles,
      group: 'screens',
    },
    {
      href: '/settings/modules',
      title: 'Modules',
      description: 'Choose the tools your business uses.',
      icon: LayoutGrid,
      group: 'workspace',
      capabilities: ['settings:write'],
    },
    {
      href: '/settings/trading',
      title: 'Receipts & tax',
      description: 'Receipt details, currency and tax rules.',
      icon: Receipt,
      group: 'workspace',
      capabilities: ['settings:write'],
    },
    {
      href: '/settings/configuration/orders',
      title: 'Orders',
      description: 'Set when an order is marked late.',
      icon: Timer,
      group: 'workspace',
      module: 'ordering',
    },
    {
      href: '/settings/qr-ordering',
      title: 'QR ordering',
      description: 'Set up how customers order by QR code.',
      icon: QrCode,
      group: 'workspace',
      module: 'qr-ordering',
      capabilities: ['qr-ordering:read', 'qr-ordering:write'],
    },
    {
      href: '/settings/configuration/dashboard',
      title: 'Dashboard',
      description: 'Choose and arrange your panels.',
      icon: LayoutDashboard,
      group: 'screens',
    },
    {
      href: '/settings/configuration/pos',
      title: 'Till',
      description: 'Menu layout, favourites and stock warnings.',
      icon: Monitor,
      group: 'screens',
      module: 'pos',
      capabilities: ['orders:create'],
    },
    {
      href: '/settings/configuration/kitchen',
      title: 'Kitchen screen',
      description: 'Tickets, display options and order alerts.',
      icon: ChefHat,
      group: 'screens',
      module: 'kds',
      capabilities: ['orders:status'],
    },
  ];
  const allowed = destinations.filter((item) => !item.capabilities || hasAnyCapability(capabilities, ...item.capabilities));
  const enabled = new Set(modules.data?.modules.filter((item) => item.status === 'enabled').map((item) => item.moduleId));

  if (!tenantId) return <p className="text-sm text-muted-foreground">Choose a workspace to see its operations settings.</p>;

  return (
    <div className="space-y-6">
      {modules.isError && (
        <ErrorState
          title="Some settings couldn’t be loaded"
          description="Your workspace’s enabled modules couldn’t be checked. Try again to see all available settings."
          onRetry={() => void modules.refetch()}
        />
      )}
      {(
        [
          { id: 'workspace', title: 'Workspace settings' },
          { id: 'screens', title: 'Screen preferences' },
        ] as const
      ).map((group) => {
        const items = allowed.filter((item) => item.group === group.id && (!item.module || enabled.has(item.module)));
        const pending = modules.isPending && allowed.some((item) => item.group === group.id && item.module);
        if (!items.length && !pending) return null;
        return (
          <section key={group.id} aria-labelledby={`operations-${group.id}`}>
            <div className="mb-3">
              <h2 id={`operations-${group.id}`} className="text-base font-semibold text-foreground">
                {group.title}
              </h2>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((item) => (
                <SettingsDestination key={item.href} {...item} titleOnly={group.id === 'screens'} />
              ))}
              {pending && (
                <div
                  role="status"
                  aria-label="Loading available settings"
                  className="flex min-h-18 items-center gap-3 rounded-lg border border-rule/60 bg-field px-3 py-3"
                >
                  <Bone className="size-[42px] shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Bone className="h-4 w-28" />
                    <Bone className="h-3 w-3/4" />
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
