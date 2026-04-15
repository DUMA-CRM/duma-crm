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
        // Base
        'flex items-center rounded-md text-sm font-medium',
        'transition-colors duration-150',
        // Expanded — normal padded row
        !collapsed && 'gap-3 px-3 py-2 w-full',
        // Collapsed — fixed 36×36 centered square, no padding
        collapsed && 'w-9 h-9 justify-center mx-auto',
        // States
        'text-muted-foreground hover:bg-surface-offset hover:text-foreground',
        isActive && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15',
        isActive && !collapsed && 'border-r-4 border-primary',
      )}
    >
      <Icon aria-hidden="true" className="shrink-0" size={18} />

      {!collapsed && <span className="flex-1 truncate">{label}</span>}
    </Link>
  );
}
