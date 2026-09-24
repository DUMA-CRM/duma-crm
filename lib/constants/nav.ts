import {
  BarChart3,
  CalendarDays,
  ChefHat,
  HeartHandshake,
  HelpCircle,
  History,
  type IconComponent,
  LayoutDashboard,
  Mail,
  Monitor,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  UsersRound,
  UtensilsCrossed,
} from '@/components/icons';

import { type Capability, hasAnyCapability } from '@/lib/auth/capabilities';
import { MODULE_IDS, type ModuleId } from '@/lib/modules/manifest';
import type { TenantModuleState } from '@/lib/modules/organization/client';

export interface NavItem {
  module: ModuleId;
  label: string;
  href: string;
  icon: IconComponent;
  // Capabilities that make this item visible — holding any one is enough.
  // Omit to show the item to every signed-in user (POS, KDS, own rota, own HR).
  //
  // This replaces the old `minRole` rank threshold plus its `roles` allow-list
  // escape hatch. Both existed because a rank could not express rules like
  // "hr_manager and franchise_owner, but not store_manager" — a capability
  // states the requirement directly, and matches what the API enforces on the
  // page's own data, so the nav can no longer disagree with the API.
  capabilities?: Capability[];
  /** Optional surface switch inside a module's `configuration.surfaces`. */
  surface?: string;
  children?: Omit<NavItem, 'children'>[];
}

export const mainNavItems: NavItem[] = [
  { module: 'analytics', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { module: 'people', label: 'My HR', href: '/my-hr', icon: HeartHandshake },
  // Everyone's own rota. The team rota and shift cover live in the staff workspace.
  { module: 'workforce', label: 'My Rota', href: '/scheduling', icon: CalendarDays },
  // `marketing_manager` reaches this for the first time here — the old rank
  // threshold hid it from the role whose job it is.
  { module: 'customers', label: 'Customers', href: '/customers', icon: Users, capabilities: ['customers:read'] },
  { module: 'communications', label: 'Communications', href: '/communications', icon: Mail, capabilities: ['email:read'] },
  { module: 'ordering', label: 'POS Terminal', href: '/pos', icon: Monitor, capabilities: ['orders:create'], surface: 'pos' },
  { module: 'ordering', label: 'Fulfilment', href: '/kds', icon: ChefHat, capabilities: ['orders:status'], surface: 'fulfilment' },
  { module: 'catalog', label: 'Products', href: '/menu', icon: UtensilsCrossed, capabilities: ['menu:write', 'recipes:write'] },
  // One entry: stock, restock demand, purchase orders, suppliers and stocktakes
  // are tabs of /inventory.
  // `stock:read` rather than `inventory:read` — till staff hold the latter so
  // they can record waste, and gating on it would put Inventory in the POS nav.
  { module: 'inventory', label: 'Inventory', href: '/inventory', icon: Package, capabilities: ['stock:read'] },
  { module: 'ordering', label: 'Orders', href: '/orders', icon: ShoppingBag, capabilities: ['orders:read'] },
  // One entry: team, rota, shifts, leave, helpdesk and payroll are tabs of the
  // staff workspace, each on its own route.
  { module: 'people', label: 'Staff', href: '/staff', icon: UsersRound, capabilities: ['staff:read', 'hr.people:read'] },
  // Workspaces and locations are a tab of Settings — organisation structure is
  // set up once, so it belongs with the other administration, not in the
  // day-to-day nav.
];

export const analyticsNavItems: NavItem[] = [
  { module: 'analytics', label: 'Reports', href: '/reports', icon: BarChart3, capabilities: ['analytics:read'] },
  // Subject access and erasure requests, moved out of the Customers page: a
  // workload with statutory deadlines is not a way of browsing customers, and
  // burying it behind a list made it easy to forget a clock was running.
  { module: 'compliance', label: 'Compliance', href: '/compliance', icon: ShieldCheck, capabilities: ['privacy:read'] },
  // `auditor` reaches this for the first time — the role existed to read the
  // audit log and the old franchise_owner rank threshold shut it out.
  { module: 'compliance', label: 'Audit Log', href: '/audit-log', icon: History, capabilities: ['audit:read'] },
];

export const footerNavItems: NavItem[] = [
  { module: 'organization', label: 'Settings', href: '/settings', icon: Settings },
  { module: 'support', label: 'Support', href: '/support', icon: HelpCircle },
];

// Filter a nav list down to what the signed-in user can reach. A parent with
// children stays visible if it (or any child) is accessible; if the parent's own
// page isn't accessible its link is repointed to the first accessible child.
const DEFAULT_MODULE_STATE: TenantModuleState[] = MODULE_IDS.map((moduleId) => ({
  moduleId,
  status: 'enabled',
  configurationVersion: 1,
  configuration: {},
}));

export function filterNavByCapability(
  items: NavItem[],
  capabilities: readonly string[],
  moduleState: readonly TenantModuleState[] = DEFAULT_MODULE_STATE,
): NavItem[] {
  // No declared capabilities means the item is for everyone. Otherwise holding
  // any one of them is enough. super_admin needs no special case — it holds
  // every capability, so it passes every check naturally.
  const canSee = (item: Pick<NavItem, 'module' | 'capabilities' | 'surface'>) => {
    const state = moduleState.find((candidate) => candidate.moduleId === item.module);
    if (!state || state.status !== 'enabled') return false;
    if (item.surface) {
      const surfaces = state.configuration.surfaces;
      if (surfaces && typeof surfaces === 'object' && !Array.isArray(surfaces)) {
        if ((surfaces as Record<string, unknown>)[item.surface] === false) return false;
      }
    }
    return !item.capabilities || item.capabilities.length === 0 || hasAnyCapability(capabilities, ...item.capabilities);
  };

  return items.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter(canSee);
      const selfOk = canSee(item);
      if (children.length === 0) return selfOk ? [{ ...item, children: undefined }] : [];
      return [{ ...item, href: selfOk ? item.href : children[0].href, children }];
    }
    return canSee(item) ? [item] : [];
  });
}
