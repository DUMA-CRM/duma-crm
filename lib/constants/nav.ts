import {
  BarChart3,
  CalendarDays,
  ChefHat,
  HeartHandshake,
  HelpCircle,
  History,
  type IconComponent,
  Layers,
  LayoutDashboard,
  Mail,
  Monitor,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Users,
  UsersRound,
  UtensilsCrossed,
} from '@/components/icons';

import { type Capability, hasAnyCapability } from '@/lib/auth/capabilities';
import { MODULE_IDS, type ModuleId } from '@/lib/modules/manifest';
import type { TenantModuleState } from '@/lib/modules/organization/client';
import { catalogVocabulary } from '@/lib/utils/catalog-vocabulary';

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
  /** What a shop that sells products calls this — used when its module's `configuration.vocabulary` is `retail`. */
  retail?: { label: string; icon: IconComponent };
  children?: Omit<NavItem, 'children'>[];
}

/*
  One list, no headings, in the order a day runs: what's happening now (till,
  kitchen, orders), what you sell (menu, stock), who you sell to (customers,
  communications), who does the work (staff, then your own rota and HR), and
  how it went — which keeps its "Reports" heading in `analyticsNavItems`.
  Neighbours are related, so the order does the grouping a heading would.

  Labels are the page titles — "POS Terminal", "Fulfilment" and "Products" used
  to open pages titled Till, Kitchen and Menu.
*/
export const mainNavItems: NavItem[] = [
  // Every workspace has one: it builds itself from the modules switched on.
  { module: 'organization', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { module: 'pos', label: 'Till', href: '/pos', icon: Monitor, capabilities: ['orders:create'] },
  // Its own module since 0101: a shop that ships parcels has no kitchen.
  { module: 'kds', label: 'Kitchen', href: '/kds', icon: ChefHat, capabilities: ['orders:status'] },
  { module: 'ordering', label: 'Orders', href: '/orders', icon: ShoppingBag, capabilities: ['orders:read'] },
  // No End of day entry: opening and closing the trading day is done in the
  // till, at the drawer (2026-10-04). Reports keeps the read-only history.
  // A shop reads Products (see `retail`): setup records the catalog's vocabulary.
  // One line: tests/module-ownership reads nav items with a single-line pattern.
  // prettier-ignore
  { module: 'catalog', label: 'Menu', href: '/menu', icon: UtensilsCrossed, capabilities: ['menu:write', 'recipes:write'], retail: { label: 'Products', icon: Tag } },
  // One entry: stock, restock demand, purchase orders, suppliers and
  // stocktakes are tabs of /inventory. `stock:read` rather than
  // `inventory:read` — till staff hold the latter so they can record waste,
  // and gating on it would put Inventory in the POS nav.
  { module: 'inventory', label: 'Inventory', href: '/inventory', icon: Package, capabilities: ['stock:read'] },
  // `marketing_manager` reaches this — the old rank threshold hid it from
  // the role whose job it is.
  { module: 'customers', label: 'Customers', href: '/customers', icon: Users, capabilities: ['customers:read'] },
  { module: 'communications', label: 'Communications', href: '/communications', icon: Mail, capabilities: ['email:read'] },
  // Website and app content, served to the tenant's own sites over an API key.
  { module: 'cms', label: 'Content', href: '/content', icon: Layers, capabilities: ['cms:read'] },
  // One entry: team, rota, shifts, leave, helpdesk and payroll are tabs of
  // the staff workspace, each on its own route.
  { module: 'people', label: 'Staff', href: '/staff', icon: UsersRound, capabilities: ['staff:read', 'hr.people:read'] },
  // Everyone's own rota and HR — beside the team they belong to, not at the
  // top of a manager's nav. The team rota and shift cover live in Staff.
  { module: 'workforce', label: 'My rota', href: '/scheduling', icon: CalendarDays },
  { module: 'people', label: 'My HR', href: '/my-hr', icon: HeartHandshake },
  // Workspaces and locations are a tab of Settings — organisation structure is
  // set up once, so it belongs with the other administration in the footer.
];

// Under a "Reports" heading in the sidebar — looking back at the business,
// rather than running it.
export const analyticsNavItems: NavItem[] = [
  { module: 'analytics', label: 'Reports', href: '/reports', icon: BarChart3, capabilities: ['analytics:read'] },
  // Subject access and erasure requests, out of Customers: a workload with
  // statutory deadlines is not a way of browsing customers.
  { module: 'compliance', label: 'Compliance', href: '/compliance', icon: ShieldCheck, capabilities: ['privacy:read'] },
  // `auditor` reaches this — the role exists to read the audit log.
  { module: 'audit', label: 'Audit log', href: '/audit-log', icon: History, capabilities: ['audit:read'] },
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

  // A shop sees its own words — Products, not Menu.
  const retail = catalogVocabulary(moduleState) !== 'menu';
  const worded = <T extends Pick<NavItem, 'label' | 'icon' | 'retail'>>(item: T): T =>
    retail && item.retail ? { ...item, label: item.retail.label, icon: item.retail.icon } : item;

  return items.flatMap((item) => {
    item = worded(item);
    if (item.children) {
      const children = item.children.filter(canSee);
      const selfOk = canSee(item);
      if (children.length === 0) return selfOk ? [{ ...item, children: undefined }] : [];
      return [{ ...item, href: selfOk ? item.href : children[0].href, children }];
    }
    return canSee(item) ? [item] : [];
  });
}
