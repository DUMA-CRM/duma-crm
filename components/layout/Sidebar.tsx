'use client';

import { useQueries } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { LogOut, X } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { Tooltip } from '@/components/shared/Tooltip';

import { adminNavItems } from '@/lib/constants/admin-nav';
import { analyticsNavItems, filterNavByCapability, footerNavItems, mainNavItems } from '@/lib/constants/nav';
import { useAuth } from '@/lib/hooks/useAuth';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { getOrders } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useLoginIntroStore } from '@/stores/loginIntroStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ContextSwitcher } from './ContextSwitcher';
import { LocationPicker } from './LocationPicker';
import { SidebarNavItem } from './SidebarNavItem';

export function Sidebar({ capabilities }: { capabilities: readonly string[] }) {
  const { collapsed, mobileOpen, closeMobile } = useSidebarStore();
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mobileViewport, setMobileViewport] = useState(false);
  // True until the sign-in intro's mark has finished flying into the brand slot.
  const introPending = useLoginIntroStore((s) => s.pending);
  const { logout } = useAuth();
  const { locationId, tenantId } = useWorkspaceStore();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setMobileViewport(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobile();
        return;
      }
      if (event.key !== 'Tab' || !sidebarRef.current) return;

      const focusable = sidebarRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onResize() {
      if (window.matchMedia('(min-width: 1024px)').matches) closeMobile();
    }

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [closeMobile, mobileOpen]);

  // Prefer the store once AuthInitializer has hydrated it, so a role change
  // reflected by a refetch updates the nav without a full reload. The prop is
  // the server-rendered value and covers the first paint.
  const hydrated = useAuthStore((state) => state.isLoaded);
  const storeCapabilities = useAuthStore((state) => state.capabilities);
  const effective = hydrated ? storeCapabilities : capabilities;

  // The tab's own workspace context — never another workspace's modules, and
  // nothing at all (no operational links) until it has loaded. DUMA Admin has
  // no workspace: its navigation is the platform's.
  const { context, workspace } = useWorkspaceContext();
  const platformContext = context.kind === 'platform';
  const effectiveModuleState = workspace?.modules ?? [];
  const mainItems = platformContext ? adminNavItems : workspace ? filterNavByCapability(mainNavItems, effective, effectiveModuleState) : [];
  const analyticsItems = workspace ? filterNavByCapability(analyticsNavItems, effective, effectiveModuleState) : [];
  const footerItems = workspace ? filterNavByCapability(footerNavItems, effective, effectiveModuleState) : [];

  // Badge the kitchen queue with the exact active count. Three count-only
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
      queryKey: moduleQueryKeys.ordering.key('orders-nav-count', status, tenantId, locationId),
      queryFn: () => getOrders({ limit: 100, status, paymentStatus: 'paid', locationId: locationId ?? undefined }),
      enabled: showOrders && badgeEnabled,
      staleTime: 60_000,
      refetchInterval: 60_000,
    })),
  });
  const activeOrders = activeOrderQueries.reduce(
    (total, query) =>
      total +
      (query.data?.data.filter((order) => !order.kitchenReleaseAt || new Date(order.kitchenReleaseAt).getTime() <= Date.now()).length ?? 0),
    0,
  );
  // One badge for one fact: the kitchen queue is what the count is waiting on,
  // so it sits on KDS. Orders carries it only when KDS is not in the nav.
  const showKds = mainItems.some((item) => item.href === '/kds');
  const badges: Record<string, number> = { [showKds ? '/kds' : '/orders']: activeOrders };

  return (
    <>
      <aside
        ref={sidebarRef}
        id="primary-navigation"
        aria-label="Primary navigation"
        inert={mobileViewport && !mobileOpen}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        className={cn(
          // h-dvh, not h-screen: 100vh includes the browser chrome on a shop
          // tablet, which pushed Sign out below the visible viewport.
          'fixed inset-0 z-50 flex h-dvh w-full shrink-0 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          'bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-x-clip overflow-y-hidden',
          'transition-[width,transform] duration-300 ease-out',
          collapsed ? 'lg:static lg:w-15' : 'lg:static lg:w-55',
          'lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── Brand ─────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-2.5 overflow-hidden whitespace-nowrap border-b border-sidebar-border px-4 pb-4 pt-3 lg:border-0 lg:px-2.5 lg:pt-2.5">
          {/* data-brand-mark is the flight target for the post-sign-in intro.
              While that intro is running this slot holds empty space: the mark
              flying toward it IS this mark, and showing both makes the arrival
              pointless. `invisible` rather than conditional rendering, so the box
              keeps its size and the intro can still measure where to land. */}
          <span data-brand-mark className={cn('inline-flex shrink-0', introPending && 'invisible')}>
            <Logo size={36} variant="onDark" className="rounded-md shadow-sm" />
          </span>
          {(!collapsed || mobileOpen) && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-base font-semibold leading-tight text-sidebar-foreground tracking-title">DUMA</p>
              <p className="text-micro text-sidebar-foreground/65 leading-none mt-0.5 font-semibold">Business OS</p>
            </div>
          )}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeMobile}
            aria-label="Close navigation menu"
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring lg:hidden"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* ── Context: DUMA Admin or a workspace ───────────── */}
        <div className="shrink-0 border-b border-sidebar-border py-2">
          <ContextSwitcher />
        </div>

        {/* ── Navigation ───────────────────────────────────── */}
        <nav aria-label="Main menu" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto py-3">
          {mainItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} badge={badges[item.href]} mobileMenu={mobileOpen} />
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
            <SidebarNavItem key={item.href} {...item} mobileMenu={mobileOpen} />
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border py-3 lg:py-2">
          {/* Everything above is scoped to this location, so the bottom cluster
              opens with it — one place, every breakpoint. */}
          {context.kind === 'workspace' && (
            <div className={cn('mb-1 border-b border-sidebar-border pb-3 lg:pb-2', collapsed && !mobileOpen && 'flex justify-center')}>
              <LocationPicker />
            </div>
          )}

          {footerItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} mobileMenu={mobileOpen} />
          ))}

          {/* Sign out */}
          {collapsed && !mobileOpen ? (
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
              className={cn(
                'w-[calc(100%-24px)] mx-3 flex items-center gap-2.5 px-3 rounded-md text-sm font-medium text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150',
                mobileOpen ? 'py-3' : 'py-2.25',
              )}
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
