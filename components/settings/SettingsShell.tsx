'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Code,
  type IconComponent,
  KeyRound,
  LayoutGrid,
  Plug,
  QrCode,
  Receipt,
  Settings,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { SectionTabs } from '@/components/shared/SectionTabs';
import { SettingsAreaContent } from '@/components/settings/SettingsAreaContent';

import { type Capability, hasAnyCapability } from '@/lib/auth/capabilities';
import { type WorkspaceModuleId, getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface SettingsTab {
  href: string;
  label: string;
  icon: IconComponent;
  area: SettingsAreaId;
  /** Any one of these shows the tab. Empty means everyone. Mirrors each route's server guard. */
  anyOf: Capability[];
  /** Reserved for the platform super admin, regardless of workspace capabilities. */
  superAdminOnly?: boolean;
  /** Module-owned settings disappear with their module. */
  moduleId?: WorkspaceModuleId;
}

export type SettingsAreaId = 'account' | 'workspace' | 'operations' | 'connections' | 'developers';

interface SettingsArea {
  id: SettingsAreaId;
  label: string;
  icon: IconComponent;
  href: string;
  description: string;
}

// Five stable destinations. Each area combines its related settings in one view.
export const SETTINGS_AREAS: readonly SettingsArea[] = [
  { id: 'account', label: 'Account', icon: UserRound, href: '/settings/account', description: 'Profile, appearance, sign-in and active sessions.' },
  { id: 'workspace', label: 'Workspace', icon: Building2, href: '/settings/workspaces', description: 'Business details, brand and locations.' },
  { id: 'operations', label: 'Operations', icon: LayoutGrid, href: '/settings/configuration', description: 'Modules, screens, Ask DUMA, receipts and tax.' },
  { id: 'connections', label: 'Connections', icon: Plug, href: '/settings/connectors', description: 'Integrations, card readers and connected services.' },
  { id: 'developers', label: 'Developers', icon: Code, href: '/settings/developers', description: 'API keys, webhooks, MCP and documentation.' },
];

export const SETTINGS_TABS: readonly SettingsTab[] = [
  {
    href: '/settings',
    label: 'Profile',
    icon: UserRound,
    area: 'account',
    anyOf: [],
  },
  {
    href: '/settings/workspaces',
    label: 'Business & locations',
    icon: Building2,
    area: 'workspace',
    anyOf: ['settings:write'],
  },
  {
    href: '/settings/modules',
    label: 'Modules',
    icon: LayoutGrid,
    area: 'operations',
    anyOf: ['settings:write'],
  },
  {
    href: '/settings/configuration',
    label: 'Dashboard & screens',
    icon: SlidersHorizontal,
    area: 'operations',
    anyOf: [],
  },
  {
    href: '/settings/qr-ordering',
    label: 'QR ordering',
    icon: QrCode,
    area: 'operations',
    anyOf: ['qr-ordering:read', 'qr-ordering:write'],
    moduleId: 'qr-ordering',
  },
  {
    href: '/settings/trading',
    label: 'Receipts & tax',
    icon: Receipt,
    area: 'operations',
    anyOf: ['settings:write'],
  },
  {
    href: '/settings/connectors',
    label: 'Integrations',
    icon: Plug,
    area: 'connections',
    anyOf: ['email.connections:write', 'payments.connections:write', 'cms.keys:write', 'notes:write'],
  },
  {
    href: '/settings/security',
    label: 'Sign-in & active sessions',
    icon: ShieldCheck,
    area: 'account',
    anyOf: [],
  },
  {
    href: '/settings/roles',
    label: 'Roles & access',
    icon: KeyRound,
    area: 'workspace',
    anyOf: ['staff:access'],
    superAdminOnly: true,
  },
  {
    href: '/settings/assistant',
    label: 'Ask DUMA',
    icon: Sparkles,
    area: 'operations',
    anyOf: [],
  },
  {
    // Every public API in one place: keys, webhooks and the API reference.
    href: '/settings/developers',
    label: 'Keys & webhooks',
    icon: Code,
    area: 'developers',
    anyOf: ['settings:write', 'cms.keys:write'],
  },
];

function activeTab(pathname: string, tabs: readonly SettingsTab[]) {
  // Longest match wins, so /settings/security is not claimed by /settings.
  return [...tabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
}

/**
 * The settings frame: the app's own EditorShell and SectionTabs, mounted once in
 * the settings layout so they survive tab changes — the tab indicator slides
 * instead of being redrawn, and only the body below animates in.
 *
 * A connector's manage page or setup wizard (`?connector=`) is a full screen of
 * its own with a back button, so the frame steps aside for it.
 */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const capabilities = useAuthStore((state) => state.capabilities);
  const role = useAuthStore((state) => state.role);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const router = useRouter();

  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    staleTime: 30_000,
  });
  const moduleIsEnabled = (moduleId: WorkspaceModuleId) =>
    modules.data?.modules.some((module) => module.moduleId === moduleId && module.status === 'enabled') ?? false;
  const qrOrderingEnabled = moduleIsEnabled('qr-ordering');
  const tabs = SETTINGS_TABS.filter(
    (tab) =>
      (!tab.superAdminOnly || role === 'super_admin') &&
      (tab.anyOf.length === 0 || hasAnyCapability(capabilities, ...tab.anyOf)) &&
      (!tab.moduleId || !modules.data || moduleIsEnabled(tab.moduleId)),
  );
  const active = activeTab(pathname, tabs);
  const activeArea = active ? SETTINGS_AREAS.find((area) => area.id === active.area) : undefined;
  const isOperationsDetail = activeArea?.id === 'operations' && pathname !== '/settings/configuration';
  const pageTitles: Record<string, string> = {
    '/settings/configuration/dashboard': 'Dashboard',
    '/settings/configuration/pos': 'Till',
    '/settings/configuration/orders': 'Orders',
    '/settings/configuration/kitchen': 'Kitchen screen',
    '/settings/developers/docs': 'API reference',
    '/settings/profile': 'Profile & appearance',
    '/settings/security': 'Sign-in & active sessions',
    '/settings/roles': 'Roles & access',
  };
  const pageTitle = pathname === '/settings'
    ? 'Settings'
    : pageTitles[pathname] ?? (isOperationsDetail ? active?.label : activeArea?.label) ?? 'Settings';

  useEffect(() => {
    if (!modules.data || !pathname.startsWith('/settings/qr-ordering') || qrOrderingEnabled) return;
    router.replace(hasAnyCapability(capabilities, 'settings:write') ? '/settings/modules' : '/settings');
  }, [capabilities, modules.data, pathname, qrOrderingEnabled, router]);

  if (pathname.startsWith('/settings/connectors') && searchParams.get('connector')) return <>{children}</>;

  return (
    <EditorShell
      title={pageTitle}
      onClose={isOperationsDetail ? () => router.push('/settings/configuration') : undefined}
      // A gear, not the user's face — the Profile tab already shows that, a few pixels below.
      leading={isOperationsDetail ? undefined : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
          <Settings size={17} aria-hidden="true" />
        </span>
      )}
      subheader={
        <>
          <div className="hidden lg:block">
            <SectionTabs
              ariaLabel="Settings areas"
              tabs={SETTINGS_AREAS.filter((area) => tabs.some((tab) => tab.area === area.id)).map((area) => ({
                value: area.id, label: area.label, icon: area.icon,
              }))}
              value={activeArea?.id ?? 'account'}
              onChange={(areaId) => {
                const area = SETTINGS_AREAS.find((entry) => entry.id === areaId);
                if (area) router.push(area.href);
              }}
            />
          </div>
          {pathname !== '/settings' && !isOperationsDetail && (
            <Link href="/settings" className="flex min-h-12 items-center gap-2 border-b border-rule px-4 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden">
              <ArrowLeft size={16} aria-hidden="true" /> All settings
            </Link>
          )}
        </>
      }
    >
      <motion.div
        key={pathname}
        className="w-full"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      >
        {pathname === '/settings' ? (
          <>
            <nav aria-label="Settings categories" className="divide-y divide-rule rounded-lg border border-rule bg-field lg:hidden">
              {SETTINGS_AREAS.filter((area) => tabs.some((tab) => tab.area === area.id)).map((area) => (
                <Link key={area.id} href={area.href} className="flex min-h-20 items-center gap-3 p-4 hover:bg-band/45 focus-visible:outline-2 focus-visible:outline-ring">
                  <area.icon size={20} aria-hidden="true" className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-foreground">{area.label}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{area.description}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </nav>
            <div className="hidden lg:block"><SettingsAreaContent area="account" /></div>
          </>
        ) : (activeArea?.id === 'operations' && pathname !== '/settings/configuration') || pathname === '/settings/security' || pathname === '/settings/profile' || pathname === '/settings/roles' ? (
          <div className="space-y-5">
            {!isOperationsDetail && !pathname.startsWith('/settings/configuration/') && (
              <Link href={activeArea?.href ?? '/settings'} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                <ArrowLeft size={16} aria-hidden="true" /> {activeArea?.label ?? 'Settings'}
              </Link>
            )}
            {children}
          </div>
        ) : activeArea ? <SettingsAreaContent area={activeArea.id} /> : children}
      </motion.div>
    </EditorShell>
  );
}

/**
 * Lays a tab's sections out. Sections are direct children so they inherit the
 * shell's stagger; `columns` packs them into two independent stacks on wide
 * screens rather than a grid whose rows would leave gaps under short panels.
 */
export function SettingsTabBody({
  children,
  aside,
  stickyAside = false,
  narrowAside = false,
  asideLeft = false,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  /** Keep the aside in view while the main column scrolls (a live preview). */
  stickyAside?: boolean;
  /** A fixed, narrower aside for a summary rail, giving the main column the width (the recipe editor). */
  narrowAside?: boolean;
  /** Put the aside on the left on wide screens (Developers). It still follows the main column when stacked. */
  asideLeft?: boolean;
}) {
  if (!aside) return <div className="flex flex-col gap-5">{children}</div>;
  return (
    <div
      className={cn(
        'grid items-start gap-5',
        narrowAside
          ? asideLeft
            ? 'lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]'
            : 'lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]'
          : asideLeft
            ? 'lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]'
            : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]',
      )}
    >
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <div className={cn('flex min-w-0 flex-col gap-5', stickyAside && 'lg:sticky lg:top-5', asideLeft && 'lg:order-first')}>{aside}</div>
    </div>
  );
}
