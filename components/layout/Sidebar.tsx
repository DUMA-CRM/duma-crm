'use client';

import { useQuery } from '@tanstack/react-query';
import { Coffee, LogOut } from 'lucide-react';

import { Tooltip } from '@/components/shared/Tooltip';
import { getOrders } from '@/lib/api/orders.service';
import type { StaffRole } from '@/lib/api/staff.service';
import { analyticsNavItems, filterNavByRole, footerNavItems, mainNavItems } from '@/lib/constants/nav';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { SidebarNavItem } from './SidebarNavItem';

export function Sidebar({ role }: { role: StaffRole | null }) {
  const { collapsed, mobileOpen, closeMobile } = useSidebarStore();
  const { logout } = useAuth();
  const { locationId } = useWorkspaceStore();

  const mainItems = filterNavByRole(mainNavItems, role);
  const analyticsItems = filterNavByRole(analyticsNavItems, role);

  // Badge the Orders nav item with the number of active (not done/cancelled) orders.
  // Shares the ['orders-all', locationId] cache entry with the dashboard and
  // orders pages so the same 200-row list isn't fetched three times.
  const showOrders = mainItems.some((item) => item.href === '/orders');
  const { data: ordersData } = useQuery({
    queryKey: ['orders-all', locationId],
    queryFn: () => getOrders({ limit: 200, locationId: locationId ?? undefined }),
    enabled: showOrders,
    refetchInterval: 60_000,
  });
  const activeOrders = (ordersData?.data ?? []).filter((o) => o.status !== 'done' && o.status !== 'cancelled').length;
  const badges: Record<string, number> = { '/orders': activeOrders };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={closeMobile} aria-hidden="true" />}

      <aside
        aria-label="Primary navigation"
        className={cn(
          'fixed top-0 left-0 h-screen z-50 flex flex-col shrink-0',
          'bg-card border-r border-border overflow-x-clip overflow-y-hidden',
          'transition-[width,transform] duration-300 ease-out',
          collapsed ? 'w-15' : 'w-55',
          'lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── Brand ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-4 pt-2.5 pb-4 shrink-0 whitespace-nowrap overflow-hidden">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shrink-0">
            <Coffee size={15} strokeWidth={2.5} aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-base font-bold leading-tight text-foreground tracking-tight">DUMA</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-0.5 font-semibold">Business</p>
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
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 pt-5 pb-1.5 whitespace-nowrap">
                Analytics
              </p>
            ) : (
              <div className="mx-3 my-2 border-t border-border" />
            ))}

          {analyticsItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="py-2 border-t border-border flex flex-col gap-0.5 shrink-0">
          {footerNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}

          {/* Sign out */}
          {collapsed ? (
            <Tooltip label="Sign out" className="mx-auto">
              <button
                onClick={logout}
                aria-label="Sign out"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150"
              >
                <LogOut aria-hidden="true" className="shrink-0" size={18} />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={logout}
              className="w-[calc(100%-24px)] mx-3 flex items-center gap-2.5 px-3 py-2.25 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150"
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
