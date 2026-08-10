'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Tooltip } from '@/components/shared/Tooltip';

import type { NavItem } from '@/lib/constants/nav';
import { cn } from '@/lib/utils/cn';
import { useSidebarStore } from '@/stores/sidebarStore';

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavItemProps = NavItem & { badge?: number };

function AccentBar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('absolute top-2 bottom-2 w-0.75 bg-sidebar-primary rounded-l-sm pointer-events-none', className)}
    />
  );
}

function CollapsedNavItem({ href, label, icon: Icon, children, badge }: NavItemProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { closeMobile } = useSidebarStore();

  const active = isActivePath(pathname, href);
  const childActive = children?.some((c) => isActivePath(pathname, c.href)) ?? false;
  const open = active || childActive;
  const parentHighlighted = active && !childActive;

  return (
    <div className="flex flex-col items-center">
      <Tooltip label={badge ? `${label} (${badge})` : label}>
        <Link
          href={href}
          prefetch={false}
          onPointerEnter={() => router.prefetch(href)}
          onFocus={() => router.prefetch(href)}
          onClick={closeMobile}
          aria-current={parentHighlighted ? 'page' : undefined}
          className={cn(
            'relative w-9 h-9 flex items-center justify-center rounded-md mx-auto',
            'text-sidebar-foreground/65 transition-colors duration-150',
            !childActive && !parentHighlighted && 'hover:bg-sidebar-accent hover:text-sidebar-foreground',
            parentHighlighted && 'bg-sidebar-accent text-sidebar-foreground font-semibold',
            childActive && 'bg-sidebar-accent/70 text-sidebar-foreground hover:bg-sidebar-accent!',
            open && children?.length && 'rounded-b-none',
          )}
        >
          <Icon aria-hidden="true" className="shrink-0" size={18} />
          {!!badge && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground text-micro font-semibold ring-2 ring-sidebar">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </Link>
      </Tooltip>

      {open && !!children?.length && (
        <div className="rounded-b-md bg-sidebar-accent/50 overflow-hidden flex flex-col">
          {children.map((child) => {
            const isChildActive = isActivePath(pathname, child.href);
            const ChildIcon = child.icon;

            return (
              <Tooltip key={child.href} label={child.label}>
                <Link
                  href={child.href}
                  prefetch={false}
                  onPointerEnter={() => router.prefetch(child.href)}
                  onFocus={() => router.prefetch(child.href)}
                  onClick={closeMobile}
                  aria-current={isChildActive ? 'page' : undefined}
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-sm',
                    'text-sidebar-foreground/65 transition-colors duration-150',
                    'hover:rounded-none!',
                    !isChildActive && 'hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    isChildActive && 'bg-sidebar-accent text-sidebar-foreground font-semibold rounded-none!',
                  )}
                >
                  <ChildIcon aria-hidden="true" className="shrink-0" size={18} />
                </Link>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExpandedNavItem({ href, label, icon: Icon, children, badge }: NavItemProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { closeMobile } = useSidebarStore();

  const active = isActivePath(pathname, href);
  const childActive = children?.some((c) => isActivePath(pathname, c.href)) ?? false;
  const open = active || childActive;
  const hasChildren = !!children?.length;
  const parentHighlighted = active && !childActive;
  const leafHighlighted = active && !hasChildren;

  return (
    <div>
      <div className="relative">
        <Link
          href={href}
          prefetch={false}
          onPointerEnter={() => router.prefetch(href)}
          onFocus={() => router.prefetch(href)}
          onClick={closeMobile}
          aria-current={parentHighlighted || leafHighlighted ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 px-3 py-[9px] mx-3 rounded-md',
            'text-sm font-medium transition-colors duration-100',
            !parentHighlighted && !childActive && 'text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            // Position is the crosshair: achromatic. Where you are is a marked
            // cell plus the ink bar below — colour is reserved for data, so an
            // active item never competes with a reading on the same screen.
            (parentHighlighted || leafHighlighted) && 'bg-sidebar-accent text-sidebar-foreground font-semibold',
            childActive && 'bg-sidebar-accent/70 text-sidebar-foreground hover:bg-sidebar-accent!',
            open && hasChildren && 'rounded-b-none',
          )}
        >
          <Icon aria-hidden="true" className="shrink-0" size={18} />
          <span className="flex-1 truncate">{label}</span>
          {!!badge && (
            <span
              data-figure
              className="shrink-0 flex h-5 min-w-5 px-1.5 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground text-micro font-semibold"
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </Link>

        {(parentHighlighted || leafHighlighted) && <AccentBar className="right-0" />}
      </div>

      {open && hasChildren && (
        <div className="mx-3 rounded-b-md bg-sidebar-accent/50 flex flex-col">
          {children!.map((child, index) => {
            const isChildActive = isActivePath(pathname, child.href);
            const ChildIcon = child.icon;
            const isLast = index === children!.length - 1;

            return (
              <div key={child.href} className="relative">
                <Link
                  href={child.href}
                  prefetch={false}
                  onPointerEnter={() => router.prefetch(child.href)}
                  onFocus={() => router.prefetch(child.href)}
                  onClick={closeMobile}
                  aria-current={isChildActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-[9px] rounded-none',
                    'text-sm font-medium transition-colors duration-150',
                    isLast && 'rounded-b-md',
                    !isChildActive && 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    isChildActive && 'bg-sidebar-accent text-sidebar-foreground font-semibold',
                  )}
                >
                  <ChildIcon aria-hidden="true" className="shrink-0" size={18} />
                  <span className="flex-1 truncate">{child.label}</span>
                </Link>

                {isChildActive && <AccentBar className="-right-3" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SidebarNavItem(props: NavItemProps) {
  const { collapsed } = useSidebarStore();
  return collapsed ? <CollapsedNavItem {...props} /> : <ExpandedNavItem {...props} />;
}
