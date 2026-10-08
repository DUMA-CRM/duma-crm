'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { ArrowRight, ChefHat, LayoutDashboard, type IconComponent, Monitor, Timer } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';

import { type Capability, hasCapability } from '@/lib/auth/capabilities';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import type { ModuleId } from '@/lib/modules/manifest';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { CHIME_SOUNDS } from '@/lib/utils/chime';
import { useAuthStore } from '@/stores/authStore';
import { useKdsStore } from '@/stores/kdsStore';
import { usePosSettingsStore } from '@/stores/posSettingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { useMounted } from './shared';

interface PageTile {
  href: string;
  title: string;
  description: string;
  icon: IconComponent;
  capability?: Capability;
  module: ModuleId;
  summary: string[];
}

/**
 * One big tile per app page that can be tailored. Each opens that page's own
 * settings; everything here is kept on the device, because a till at the
 * espresso bar and one at the pastry counter want different layouts.
 */
export function ConfigurationHome() {
  const mounted = useMounted();
  const capabilities = useAuthStore((state) => state.capabilities);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    staleTime: 30_000,
  });
  const pos = usePosSettingsStore();
  const kds = useKdsStore();

  const all: PageTile[] = [
    {
      href: '/settings/configuration/dashboard',
      title: 'Dashboard',
      description: 'Choose the operational panels you see and arrange them around the way you work.',
      icon: LayoutDashboard,
      module: 'organization',
      summary: ['Show or hide panels', 'Set their order'],
    },
    {
      href: '/settings/configuration/pos',
      title: 'Till',
      description: 'What the sell screen shows: search, categories, favourites, tile style and stock warnings.',
      icon: Monitor,
      module: 'pos',
      capability: 'orders:create',
      summary: [
        pos.menuLayout === 'categories' ? 'Categories first' : 'Items first',
        pos.favourites === 'pinned' ? 'Pinned favourites' : pos.favourites === 'top' ? 'Best sellers' : 'No favourites',
        pos.tileStyle === 'compact' ? 'Compact tiles' : 'Photo tiles',
        ...(pos.showSearch ? [] : ['Search hidden']),
        ...(pos.stockHighlight ? ['Stock warnings'] : []),
      ],
    },
    {
      href: '/settings/configuration/orders',
      title: 'Orders',
      description: 'When an order counts as late — in minutes for food, in hours or days for parcels, or not at all.',
      icon: Timer,
      module: 'ordering',
      summary: ['Late-order timing'],
    },
    {
      href: '/settings/configuration/kitchen',
      title: 'Kitchen screen',
      description: 'Lanes or tiles, ticket and text size, tap-to-strike, all-day count, the toolbar and the order sound.',
      icon: ChefHat,
      module: 'kds',
      capability: 'orders:status',
      summary: [
        kds.layout === 'tiles' ? 'Tiles' : 'Lanes',
        kds.cardSize === 'compact' ? 'Compact tickets' : 'Comfortable tickets',
        ...(kds.textSize !== 'standard' ? [kds.textSize === 'xlarge' ? 'Extra large text' : 'Large text'] : []),
        ...(kds.showToolbar ? [] : ['Toolbar hidden']),
        kds.soundOn ? `Chime: ${CHIME_SOUNDS.find((sound) => sound.value === kds.sound)?.label ?? 'Chime'}` : 'Chime off',
      ],
    },
  ];
  const enabledModules = new Set(modules.data?.modules.filter((module) => module.status === 'enabled').map((module) => module.moduleId));
  const tiles = all.filter(
    (tile) =>
      (!tile.capability || hasCapability(capabilities, tile.capability)) &&
      (!modules.data || enabledModules.has(tile.module)),
  );

  return (
    <SettingsTabBody>
      {tiles.length > 0 && (
        <SettingsSection
          title="Device screens"
          description="Tailor the pages your team works from. These choices stay on this device, so every till and kitchen screen can suit its station."
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                className="group flex min-h-44 flex-col rounded-lg border border-rule/60 bg-page p-4 transition-[border-color,background-color,transform] duration-150 hover:border-primary/35 hover:bg-band/45 active:scale-[0.99]"
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="flex size-10 items-center justify-center rounded-md border border-rule/60 bg-field text-primary" aria-hidden="true">
                    <tile.icon size={19} />
                  </span>
                  <ArrowRight size={17} aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </span>
                <span className="mt-3 text-base font-semibold text-foreground">{tile.title}</span>
                <span className="mt-1 text-sm leading-relaxed text-muted-foreground">{tile.description}</span>
                {mounted && (
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-4">
                    {tile.summary.map((item) => (
                      <span key={item} className="rounded-sm border border-rule/60 bg-field px-2 py-1 text-xs font-medium text-muted-foreground">
                        {item}
                      </span>
                    ))}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </SettingsSection>
      )}
    </SettingsTabBody>
  );
}
