import {
  BarChart3,
  Building2,
  CalendarDays,
  Coffee,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  Package,
  PackagePlus,
  Settings,
  ShoppingBag,
  Star,
  Users,
  Users2,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react';

import { type StaffRole, roleAtLeast } from '@/lib/api/staff.service';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  // Minimum role required to see this item. Omit = visible to everyone (incl. barista).
  // Semantics mirror the API's requireMinRole (rank-based).
  minRole?: StaffRole;
  children?: Omit<NavItem, 'children'>[];
}

export const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Customers', href: '/customers', icon: Users, minRole: 'store_manager' },
  { label: 'POS Terminal', href: '/pos', icon: Monitor },
  { label: 'Menu', href: '/menu', icon: UtensilsCrossed, minRole: 'store_manager' },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Package,
    minRole: 'store_manager',
    children: [
      { href: '/inventory/restock-requests', label: 'Restock', icon: PackagePlus, minRole: 'store_manager' },
    ],
  },
  { label: 'Orders', href: '/orders', icon: ShoppingBag, minRole: 'store_manager' },
  {
    label: 'Staff',
    href: '/staff',
    icon: UsersRound,
    children: [
      { href: '/scheduling', label: 'Schedule', icon: CalendarDays },
    ],
  },
  { label: 'Training', href: '/training', icon: GraduationCap },
  { label: 'Workspaces', href: '/workspaces', icon: Building2, minRole: 'franchise_owner' },
];

export const analyticsNavItems: NavItem[] = [
  { label: 'Reports', href: '/reports', icon: BarChart3, minRole: 'store_manager' },
  { label: 'Roast Profiles', href: '/roast-profiles', icon: Coffee, minRole: 'store_manager' },
  { label: 'Loyalty', href: '/loyalty', icon: Star, minRole: 'store_manager' },
];

export const footerNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Support', href: '/support', icon: HelpCircle },
];

// Filter a nav list down to what `role` can access. A parent with children stays
// visible if it (or any child) is accessible; if the parent's own page isn't
// accessible its link is repointed to the first accessible child.
export function filterNavByRole(items: NavItem[], role: StaffRole | null): NavItem[] {
  const canSee = (min?: StaffRole) => !min || roleAtLeast(role, min);

  return items.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter((c) => canSee(c.minRole));
      const selfOk = canSee(item.minRole);
      if (children.length === 0) return selfOk ? [{ ...item, children: undefined }] : [];
      return [{ ...item, href: selfOk ? item.href : children[0].href, children }];
    }
    return canSee(item.minRole) ? [item] : [];
  });
}
