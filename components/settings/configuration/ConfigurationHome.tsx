'use client';

import { useQuery } from '@tanstack/react-query';

import {
  CalendarCheck,
  ChefHat,
  type IconComponent,
  LayoutDashboard,
  LayoutGrid,
  Monitor,
  Package,
  QrCode,
  Receipt,
  ShoppingBag,
} from '@/components/icons';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';

import { type Capability, hasAnyCapability } from '@/lib/auth/capabilities';
import type { ModuleId } from '@/lib/modules/manifest';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Destination = {
  href: string;
  title: string;
  icon: IconComponent;
  group: 'workspace' | 'screens';
  /** Where a screen's settings are kept — the one thing its title can't say. */
  scope?: string;
  capabilities?: Capability[];
  module?: ModuleId;
  /** The row's accessible name, when "Configure …" doesn't describe it. */
  targetLabel?: string;
  /** Edit modes that need a tablet's width or more, as in the avatar menu. */
  wideOnly?: boolean;
};

/**
 * Operations settings: one row per editor, in two short lists — what the
 * workspace shares | how your own screens look, each saying where it is kept.
 *
 * On-screen settings open that screen in its edit mode (`?edit=1`) — the same
 * edit the avatar menu offers on the page itself. Each row shows under the same
 * rule as the page: its module is on and you can open it.
 */
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
      href: '/apps?tab=installed',
      title: 'Installed apps',
      icon: Package,
      group: 'workspace',
    },
    {
      href: '/settings/modules',
      title: 'Modules',
      icon: LayoutGrid,
      group: 'workspace',
      capabilities: ['settings:write'],
    },
    {
      href: '/settings/trading',
      title: 'Receipts & tax',
      icon: Receipt,
      group: 'workspace',
      capabilities: ['settings:write'],
    },
    {
      href: '/settings/qr-ordering',
      title: 'QR ordering',
      icon: QrCode,
      group: 'workspace',
      module: 'qr-ordering',
      capabilities: ['qr-ordering:read', 'qr-ordering:write'],
    },
    {
      href: '/dashboard?edit=1',
      title: 'Dashboard',
      icon: LayoutDashboard,
      group: 'screens',
      scope: 'Your account',
      targetLabel: 'Edit dashboard',
      wideOnly: true,
    },
    {
      href: '/pos?edit=1',
      title: 'Till',
      icon: Monitor,
      group: 'screens',
      scope: 'This device',
      module: 'pos',
      capabilities: ['orders:create'],
      targetLabel: 'Edit till',
    },
    {
      href: '/kds?edit=1',
      title: 'Kitchen',
      icon: ChefHat,
      group: 'screens',
      scope: 'This device',
      module: 'kds',
      capabilities: ['orders:status'],
      targetLabel: 'Edit kitchen screen',
    },
    {
      href: '/orders?edit=1',
      title: 'Orders',
      icon: ShoppingBag,
      group: 'screens',
      scope: 'Whole workspace',
      module: 'ordering',
      capabilities: ['orders:read'],
      targetLabel: 'Edit orders',
    },
    {
      href: '/reservations?edit=1',
      title: 'Reservations',
      icon: CalendarCheck,
      group: 'screens',
      scope: 'This device',
      module: 'reservations',
      capabilities: ['reservations:read'],
      targetLabel: 'Edit reservations overview',
      wideOnly: true,
    },
  ];
  const allowed = destinations.filter((item) => !item.capabilities || hasAnyCapability(capabilities, ...item.capabilities));
  const enabled = new Set(modules.data?.modules.filter((item) => item.status === 'enabled').map((item) => item.moduleId));

  if (!tenantId) return <p className="text-sm text-muted-foreground">Choose a workspace to see its operations settings.</p>;

  const groups = [
    { id: 'workspace', title: 'Workspace' },
    // The till's, the kitchen screen's and the order rules live on their own pages; these rows open them in edit mode.
    { id: 'screens', title: 'On-screen settings' },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      {modules.isError && (
        <ErrorState
          title="Some settings couldn’t be loaded"
          description="Your workspace’s enabled modules couldn’t be checked. Try again to see all available settings."
          onRetry={() => void modules.refetch()}
        />
      )}
      {/* What the workspace shares | each screen's own settings, opened in that screen's edit mode. */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {groups.map((group) => {
          const items = allowed.filter((item) => item.group === group.id && (!item.module || enabled.has(item.module)));
          const pending = modules.isPending && allowed.some((item) => item.group === group.id && item.module);
          if (!items.length && !pending) return null;
          const section = (
            <RecordGroup key={group.id} id={`operations-${group.id}`} title={group.title}>
              <ListRowGroup>
                {items.map((item) => (
                  <ListRow
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    meta={item.scope}
                    targetLabel={item.targetLabel ?? `Configure ${item.title}`}
                    className={item.wideOnly ? 'hidden md:flex' : undefined}
                  />
                ))}
                {pending && (
                  <li role="status" aria-label="Loading available settings" className="flex items-center gap-3 px-3.5 py-3">
                    <Bone className="size-9 shrink-0 rounded-md" />
                    <Bone className="h-3.5 w-32" />
                  </li>
                )}
              </ListRowGroup>
            </RecordGroup>
          );
          // A phone can't use the wide-only edit modes, so a list of nothing else stays off it.
          return !pending && items.every((item) => item.wideOnly) ? (
            <div key={group.id} className="hidden md:block">
              {section}
            </div>
          ) : (
            section
          );
        })}
      </div>
    </div>
  );
}
