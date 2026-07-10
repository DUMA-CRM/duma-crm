'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
      className={cn(
        'absolute top-1.5 bottom-1.5 w-0.75 bg-primary rounded-l-sm pointer-events-none',
        className,
      )}
    />
  );
}

function CollapsedNavItem({ href, label, icon: Icon, children, badge }: NavItemProps) {
  const pathname = usePathname();
  const { closeMobile } = useSidebarStore();

  const active = isActivePath(pathname, href);
  const childActive = children?.some((c) => isActivePath(pathname, c.href)) ?? false;
  const open = active || childActive;
  const parentHighlighted = active && !childActive;

  return (
    <div className="flex flex-col items-center">
      <Link
        href={href}
        onClick={closeMobile}
        title={badge ? `${label} (${badge})` : label}
        aria-current={parentHighlighted ? 'page' : undefined}
        className={cn(
          'relative w-9 h-9 flex items-center justify-center rounded-lg mx-auto',
          'text-muted-foreground transition-colors duration-150',
          !childActive && !parentHighlighted && 'hover:bg-surface-offset hover:text-foreground',
          parentHighlighted && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15',
          childActive && 'bg-muted/50 text-foreground hover:bg-muted!',
          open && children?.length && 'rounded-b-none',
        )}
      >
        <Icon aria-hidden="true" className="shrink-0" size={18} />
        {!!badge && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-white text-[9px] font-bold tabular-nums ring-2 ring-card">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>

      {open && !!children?.length && (
        <div className="rounded-b-lg bg-muted/50 overflow-hidden flex flex-col">
          {children.map((child) => {
            const isChildActive = isActivePath(pathname, child.href);
            const ChildIcon = child.icon;

            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={closeMobile}
                title={child.label}
                aria-current={isChildActive ? 'page' : undefined}
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded-lg',
                  'text-muted-foreground transition-colors duration-150',
                  'hover:rounded-none!',
                  !isChildActive && 'hover:bg-surface-offset hover:text-foreground',
                  isChildActive && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15 rounded-none!',
                )}
              >
                <ChildIcon aria-hidden="true" className="shrink-0" size={18} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExpandedNavItem({ href, label, icon: Icon, children, badge }: NavItemProps) {
  const pathname = usePathname();
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
          onClick={closeMobile}
          aria-current={parentHighlighted || leafHighlighted ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 px-3 py-[9px] mx-3 rounded-lg',
            'text-[13px] font-medium transition-colors duration-150',
            !parentHighlighted && !childActive && 'text-muted-foreground hover:bg-surface-offset hover:text-foreground',
            (parentHighlighted || leafHighlighted) && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15',
            childActive && 'bg-muted/50 text-foreground hover:bg-muted!',
            open && hasChildren && 'rounded-b-none',
          )}
        >
          <Icon aria-hidden="true" className="shrink-0" size={18} />
          <span className="flex-1 truncate">{label}</span>
          {!!badge && (
            <span className="shrink-0 flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold tabular-nums">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </Link>

        {(parentHighlighted || leafHighlighted) && <AccentBar className="right-0" />}
      </div>

      {open && hasChildren && (
        <div className="mx-3 rounded-b-lg bg-muted/50 flex flex-col">
          {children!.map((child, index) => {
            const isChildActive = isActivePath(pathname, child.href);
            const ChildIcon = child.icon;
            const isLast = index === children!.length - 1;

            return (
              <div key={child.href} className="relative">
                <Link
                  href={child.href}
                  onClick={closeMobile}
                  aria-current={isChildActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-[9px] rounded-none',
                    'text-[13px] font-medium transition-colors duration-150',
                    isLast && 'rounded-b-lg',
                    !isChildActive && 'text-muted-foreground hover:bg-surface-offset hover:text-foreground',
                    isChildActive && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15',
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
