'use client';

import Link from 'next/link';
import { Plus, Coffee } from 'lucide-react';
import { useSidebarStore } from '@/stores/sidebarStore';
import { SidebarNavItem } from './SidebarNavItem';
import { mainNavItems, analyticsNavItems, footerNavItems } from '@/lib/constants/nav';
import { cn } from '@/lib/utils/cn';

export function Sidebar() {
  const { collapsed, mobileOpen, closeMobile } = useSidebarStore();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={closeMobile} aria-hidden="true" />}

      <aside
        aria-label="Primary navigation"
        className={cn(
          'fixed top-0 left-0 h-screen z-50 flex flex-col shrink-0',
          'bg-surface border-r border-divider overflow-hidden',
          'transition-[width,transform] duration-300 ease-out',
          // Desktop width
          collapsed ? 'w-[60px]' : 'w-[220px]',
          // Mobile slide-in
          'lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── Brand ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-divider shrink-0 overflow-hidden whitespace-nowrap">
          <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center text-white shrink-0">
            <Coffee size={16} strokeWidth={2.5} aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-base font-semibold leading-tight text-foreground">DUMA</p>
              <p className="text-[10px] text-faint uppercase tracking-widest leading-none mt-0.5">Coffee CRM</p>
            </div>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────────── */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {mainNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}

          {!collapsed && <p className="text-[10px] text-faint uppercase tracking-widest px-3 pt-4 pb-1 whitespace-nowrap">Analytics</p>}
          {collapsed && <div className="my-2 border-t border-divider" />}

          {analyticsNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="px-3 pb-3 pt-3 border-t border-divider flex flex-col gap-1">
          {footerNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}
        </div>
      </aside>
    </>
  );
}
