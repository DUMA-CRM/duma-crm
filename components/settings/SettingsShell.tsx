'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import {
  Building2,
  Code,
  type IconComponent,
  KeyRound,
  LayoutGrid,
  Plug,
  QrCode,
  Receipt,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { SectionTabs } from '@/components/shared/SectionTabs';

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
  /** Any one of these shows the tab. Empty means everyone. Mirrors each route's server guard. */
  anyOf: Capability[];
  /** Module-owned settings disappear with their module. */
  moduleId?: WorkspaceModuleId;
}

// Personal first, then the business an owner runs, then its channels.
export const SETTINGS_TABS: readonly SettingsTab[] = [
  {
    href: '/settings',
    label: 'Profile',
    icon: UserRound,
    anyOf: [],
  },
  {
    href: '/settings/security',
    label: 'Security',
    icon: ShieldCheck,
    anyOf: [],
  },
  {
    // Per-device layout for the pages that support it — the till, the kitchen screen.
    href: '/settings/configuration',
    label: 'Configuration',
    icon: SlidersHorizontal,
    anyOf: [],
  },
  {
    href: '/settings/workspaces',
    label: 'Workspace',
    icon: Building2,
    anyOf: ['settings:write'],
  },
  {
    href: '/settings/roles',
    label: 'Roles & access',
    icon: KeyRound,
    anyOf: ['staff:access'],
  },
  {
    href: '/settings/modules',
    label: 'Modules',
    icon: LayoutGrid,
    anyOf: ['settings:write'],
  },
  {
    href: '/settings/trading',
    label: 'Trading & tax',
    icon: Receipt,
    anyOf: ['settings:write'],
  },
  {
    href: '/settings/connectors',
    label: 'Connectors',
    icon: Plug,
    anyOf: ['email.connections:write', 'payments.connections:write', 'cms.keys:write'],
  },
  {
    // Storefront API keys: the business's own website selling through DUMA.
    href: '/settings/developers',
    label: 'Developers',
    icon: Code,
    anyOf: ['settings:write'],
  },
  {
    href: '/settings/qr-ordering',
    label: 'QR ordering',
    icon: QrCode,
    anyOf: ['qr-ordering:read', 'qr-ordering:write'],
    moduleId: 'qr-ordering',
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
      (tab.anyOf.length === 0 || hasAnyCapability(capabilities, ...tab.anyOf)) &&
      (!tab.moduleId || !modules.data || moduleIsEnabled(tab.moduleId)),
  );
  const active = activeTab(pathname, tabs);

  useEffect(() => {
    if (!modules.data || !pathname.startsWith('/settings/qr-ordering') || qrOrderingEnabled) return;
    router.replace(hasAnyCapability(capabilities, 'settings:write') ? '/settings/modules' : '/settings');
  }, [capabilities, modules.data, pathname, qrOrderingEnabled, router]);

  if (pathname.startsWith('/settings/connectors') && searchParams.get('connector')) return <>{children}</>;

  return (
    <EditorShell
      eyebrow="Account"
      title="Settings"
      // A gear, not the user's face — the Profile tab already shows that, a few pixels below.
      leading={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
          <Settings size={17} aria-hidden="true" />
        </span>
      }
      subheader={
        // The same tab bar every full-page view uses; it animates its own active tab.
        <SectionTabs
          ariaLabel="Settings sections"
          tabs={tabs.map((tab) => ({ value: tab.href, label: tab.label, icon: tab.icon }))}
          value={active?.href ?? '/settings'}
          onChange={(href) => router.push(href)}
        />
      }
    >
      <motion.div
        key={active?.href ?? pathname}
        className="w-full"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      >
        {/* No heading: the active tab already names the page. */}
        {children}
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
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  /** Keep the aside in view while the main column scrolls (a live preview). */
  stickyAside?: boolean;
  /** A fixed, narrower aside for a summary rail, giving the main column the width (the recipe editor). */
  narrowAside?: boolean;
}) {
  if (!aside) return <div className="flex flex-col gap-5">{children}</div>;
  return (
    <div
      className={cn(
        'grid items-start gap-5',
        narrowAside
          ? 'lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]'
          : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]',
      )}
    >
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <div className={cn('flex min-w-0 flex-col gap-5', stickyAside && 'lg:sticky lg:top-5')}>{aside}</div>
    </div>
  );
}
