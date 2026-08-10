'use client';

import { useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { LogOut } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { Tooltip } from '@/components/shared/Tooltip';

import { getOrders } from '@/lib/api/orders.service';
import type { StaffRole } from '@/lib/api/staff.service';
import { analyticsNavItems, filterNavByRole, footerNavItems, mainNavItems } from '@/lib/constants/nav';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { useLoginIntroStore } from '@/stores/loginIntroStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { LocationPicker } from './LocationPicker';
import { SidebarNavItem } from './SidebarNavItem';

export function Sidebar({ role }: { role: StaffRole | null }) {
  const { collapsed, mobileOpen, closeMobile } = useSidebarStore();
  // True until the sign-in intro's mark has finished flying into the brand slot.
  const introPending = useLoginIntroStore((s) => s.pending);
  const { logout } = useAuth();
  const { locationId } = useWorkspaceStore();

  const mainItems = filterNavByRole(mainNavItems, role);
  const analyticsItems = filterNavByRole(analyticsNavItems, role);

  // Badge the Orders nav item with the exact active count. Three count-only
  // responses are much smaller than downloading 200 complete orders globally
  // on every CRM screen.
  const showOrders = mainItems.some((item) => item.href === '/orders');
  const [badgeEnabled, setBadgeEnabled] = useState(false);
  useEffect(() => {
    if (!showOrders) return;
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setBadgeEnabled(true), { timeout: 2_000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(() => setBadgeEnabled(true), 1_500);
    return () => globalThis.clearTimeout(id);
  }, [showOrders]);
  const activeOrderQueries = useQueries({
    queries: (['pending', 'preparing', 'ready'] as const).map((status) => ({
      queryKey: ['orders-nav-count', status, locationId],
      queryFn: () => getOrders({ limit: 1, status, locationId: locationId ?? undefined }),
      enabled: showOrders && badgeEnabled,
      staleTime: 60_000,
      refetchInterval: 60_000,
    })),
  });
  const activeOrders = activeOrderQueries.reduce((total, query) => total + (query.data?.total ?? 0), 0);
  const badges: Record<string, number> = { '/orders': activeOrders, '/kds': activeOrders };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && <div className="fixed inset-0 bg-foreground/25 z-40 lg:hidden" onClick={closeMobile} aria-hidden="true" />}

      <aside
        aria-label="Primary navigation"
        className={cn(
          // h-dvh, not h-screen: 100vh includes the browser chrome on a shop
          // tablet, which pushed Sign out below the visible viewport.
          'fixed top-0 left-0 h-dvh z-50 flex flex-col shrink-0',
          'bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-x-clip overflow-y-hidden',
          'transition-[width,transform] duration-300 ease-out',
          collapsed ? 'w-15' : 'w-55',
          'lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── Brand ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-2.5 pt-2.5 pb-4 shrink-0 whitespace-nowrap overflow-hidden">
          {/* data-brand-mark is the flight target for the post-sign-in intro.
              While that intro is running this slot holds empty space: the mark
              flying toward it IS this mark, and showing both makes the arrival
              pointless. `invisible` rather than conditional rendering, so the box
              keeps its size and the intro can still measure where to land. */}
          <span data-brand-mark className={cn('inline-flex shrink-0', introPending && 'invisible')}>
            <Logo size={36} variant="onDark" className="rounded-md shadow-sm" />
          </span>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-base font-semibold leading-tight text-sidebar-foreground tracking-title">DUMA</p>
              <p className="text-micro text-sidebar-foreground/65 leading-none mt-0.5 font-semibold">Coffee operations</p>
            </div>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────────── */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
          {mainItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} badge={badges[item.href]} />
          ))}

          {analyticsItems.length > 0 &&
            (!collapsed ? (
              <p className="text-micro font-semibold text-sidebar-foreground/55 tracking-label px-6 pt-5 pb-1.5 whitespace-nowrap">
                Reports
              </p>
            ) : (
              <div className="mx-3 my-2 border-t border-sidebar-border" />
            ))}

          {analyticsItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="py-2 border-t border-sidebar-border flex flex-col gap-0.5 shrink-0">
          {/* Everything above is scoped to this location, so the bottom cluster
              opens with it — one place, every breakpoint. */}
          <div className={cn('pb-2 mb-1 border-b border-sidebar-border', collapsed && 'flex justify-center')}>
            <LocationPicker />
          </div>

          {footerNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}

          {/* Sign out */}
          {collapsed ? (
            <Tooltip label="Sign out" className="mx-auto">
              <button
                onClick={logout}
                aria-label="Sign out"
                className="w-9 h-9 flex items-center justify-center rounded-md text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
              >
                <LogOut aria-hidden="true" className="shrink-0" size={18} />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={logout}
              className="w-[calc(100%-24px)] mx-3 flex items-center gap-2.5 px-3 py-2.25 rounded-md text-sm font-medium text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
            >
              <LogOut aria-hidden="true" className="shrink-0" size={18} />
              <span className="flex-1 truncate text-left">Sign out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
