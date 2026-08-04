import {
  BarChart3,
  Building2,
  CalendarDays,
  ChefHat,
  HeartHandshake,
  HelpCircle,
  type IconComponent,
  LayoutDashboard,
  Mail,
  Monitor,
  Package,
  Settings,
  ShoppingBag,
  Users,
  UsersRound,
  UtensilsCrossed,
} from '@/components/icons';

import { type StaffRole, roleAtLeast } from '@/lib/api/staff.service';

export interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
  // Minimum role required to see this item. Omit = visible to everyone (incl. barista).
  // Semantics mirror the API's requireMinRole (rank-based).
  minRole?: StaffRole;
  // Explicit role allow-list (super_admin always included). Use when a rank
  // threshold can't express the rule — e.g. money features that hr_manager and
  // franchise_owner see but store_manager (which out-ranks hr_manager) must not.
  roles?: StaffRole[];
  children?: Omit<NavItem, 'children'>[];
}

export const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My HR', href: '/my-hr', icon: HeartHandshake },
  // Everyone's own rota. The team rota and shift cover live in the staff workspace.
  { label: 'My Rota', href: '/scheduling', icon: CalendarDays },
  // One entry: the directory and privacy requests are tabs of the customer workspace.
  { label: 'Customers', href: '/customers', icon: Users, minRole: 'store_manager' },
  {
    label: 'Communications',
    href: '/communications',
    icon: Mail,
    roles: ['franchise_owner', 'store_manager', 'marketing_manager'],
  },
  { label: 'POS Terminal', href: '/pos', icon: Monitor },
  { label: 'KDS Terminal', href: '/kds', icon: ChefHat },
  { label: 'Menu', href: '/menu', icon: UtensilsCrossed, minRole: 'store_manager' },
  // One entry: stock, restock demand, purchase orders, suppliers and stocktakes
  // are tabs of /inventory.
  { label: 'Inventory', href: '/inventory', icon: Package, minRole: 'store_manager' },
  { label: 'Orders', href: '/orders', icon: ShoppingBag, minRole: 'store_manager' },
  // One entry: team, rota, shifts, leave, helpdesk and payroll are tabs of the
  // staff workspace, each on its own route.
  { label: 'Staff', href: '/staff', icon: UsersRound, roles: ['franchise_owner', 'store_manager', 'hr_manager'] },
  { label: 'Workspaces', href: '/workspaces', icon: Building2, minRole: 'franchise_owner' },
];

export const analyticsNavItems: NavItem[] = [{ label: 'Reports', href: '/reports', icon: BarChart3, minRole: 'store_manager' }];

export const footerNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Support', href: '/support', icon: HelpCircle },
];

// Filter a nav list down to what `role` can access. A parent with children stays
// visible if it (or any child) is accessible; if the parent's own page isn't
// accessible its link is repointed to the first accessible child.
export function filterNavByRole(items: NavItem[], role: StaffRole | null): NavItem[] {
  // An explicit `roles` list wins over the rank threshold (super_admin always allowed).
  const canSee = (item: Pick<NavItem, 'minRole' | 'roles'>) => {
    if (item.roles) return role === 'super_admin' || (!!role && item.roles.includes(role));
    return !item.minRole || roleAtLeast(role, item.minRole);
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
