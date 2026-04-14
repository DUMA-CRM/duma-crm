'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/constants/nav';
import { useSidebarStore } from '@/stores/sidebarStore';
import { cn } from '@/lib/utils/cn';

export function SidebarNavItem({ href, label, icon: Icon }: NavItem) {
  const pathname = usePathname();
  const { collapsed, closeMobile } = useSidebarStore();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={closeMobile}
      title={collapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium',
        'text-muted hover:bg-surface-offset hover:text-foreground',
        'transition-colors duration-150',
        isActive && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15 border-r-4 border-primary',
      )}
    >
      <Icon size={18} className="shrink-0" aria-hidden="true" />

      {!collapsed && <span className="flex-1 truncate">{label}</span>}
    </Link>
  );
}
