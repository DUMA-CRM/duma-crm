'use client';

import { Coffee, LogOut } from 'lucide-react';

import { analyticsNavItems, footerNavItems, mainNavItems } from '@/lib/constants/nav';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { useSidebarStore } from '@/stores/sidebarStore';

import { SidebarNavItem } from './SidebarNavItem';

export function Sidebar() {
  const { collapsed, mobileOpen, closeMobile } = useSidebarStore();
  const { logout } = useAuth();

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
          collapsed ? 'w-[60px]' : 'w-[220px]',
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-0.5 font-semibold">Coffee CRM</p>
            </div>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────────── */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
          {mainNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}

          {/* Analytics section divider */}
          {!collapsed ? (
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 pt-5 pb-1.5 whitespace-nowrap">
              Analytics
            </p>
          ) : (
            <div className="mx-3 my-2 border-t border-border" />
          )}

          {analyticsNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="py-2 border-t border-border flex flex-col gap-0.5 shrink-0">
          {footerNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}

          {/* Sign out */}
          <div className="relative">
            <button
              onClick={logout}
              title={collapsed ? 'Sign out' : undefined}
              className={cn(
                'w-full flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150',
                'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                !collapsed && 'gap-2.5 px-3 py-2.25 mx-3 w-[calc(100%-24px)]',
                collapsed && 'w-9 h-9 justify-center mx-auto',
              )}
            >
              <LogOut aria-hidden="true" className="shrink-0" size={18} />
              {!collapsed && <span className="flex-1 truncate text-left">Sign out</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
