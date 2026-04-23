'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavItem } from '@/lib/constants/nav';
import { cn } from '@/lib/utils/cn';
import { useSidebarStore } from '@/stores/sidebarStore';

export function SidebarNavItem({ href, label, icon: Icon }: NavItem) {
  const pathname = usePathname();
  const { collapsed, closeMobile } = useSidebarStore();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    // Wrapper spans full nav width so the accent span's right-0 = sidebar right edge
    <div className="relative">
      <Link
        href={href}
        onClick={closeMobile}
        title={collapsed ? label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150',
          // Expanded: visual side margins via mx-3
          !collapsed && 'gap-2.5 px-3 py-[9px] mx-3',
          // Collapsed: fixed centred square
          collapsed && 'w-9 h-9 justify-center mx-auto',
          // Default
          'text-muted-foreground hover:bg-surface-offset hover:text-foreground',
          // Active
          isActive && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15',
        )}
      >
        <Icon aria-hidden="true" className="shrink-0" size={18} />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
      </Link>

      {/* Accent bar — absolutely positioned to wrapper's right edge = sidebar border */}
      {isActive && !collapsed && (
        <span aria-hidden="true" className="absolute right-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-l-sm pointer-events-none" />
      )}
    </div>
  );
}
