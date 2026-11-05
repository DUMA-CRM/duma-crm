import { Activity, Building2, Gauge, LayoutDashboard, Server } from '@/components/icons';

import type { NavItem } from '@/lib/constants/nav';

/**
 * DUMA Admin's navigation. Shown only in the platform context, where there is
 * no workspace and so no module state to filter by — every entry is a platform
 * page the API gates on a platform role. (The `module` is the page's owner in
 * lib/modules/manifest.ts, kept for the shared NavItem shape.)
 */
export const adminNavItems: NavItem[] = [
  { module: 'identity', label: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
  { module: 'identity', label: 'Workspaces', href: '/admin/workspaces', icon: Building2 },
  { module: 'identity', label: 'Usage', href: '/admin/usage', icon: Gauge },
  { module: 'identity', label: 'System', href: '/admin/system', icon: Server },
  { module: 'identity', label: 'Activity', href: '/admin/activity', icon: Activity },
];

/** Pages that are the person's own, not a workspace's — reachable in DUMA Admin too. */
export const PERSONAL_ROUTES = ['/settings/account', '/settings/profile', '/settings/security', '/updates', '/support'];

export const isAdminRoute = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

export const isPersonalRoute = (pathname: string) =>
  PERSONAL_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

/** Legacy workspace tools now open in the actual internal workspace context. */
export const INTERNAL_WORKSPACE_ROUTES: Record<string, string> = {
  '/admin/content': '/content',
  '/admin/content/storage': '/settings/connectors',
  '/admin/updates': '/content',
  '/admin/settings': '/settings',
  '/admin/settings/connectors': '/settings/connectors',
};
