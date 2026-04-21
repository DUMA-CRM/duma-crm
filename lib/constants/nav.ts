import {
  LayoutDashboard,
  Users,
  Monitor,
  Package,
  ShoppingBag,
  Users2,
  BarChart3,
  Coffee,
  Star,
  Settings,
  HelpCircle,
  Building2,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'POS Terminal', href: '/pos', icon: Monitor },
  { label: 'Menu', href: '/menu', icon: UtensilsCrossed },
  { label: 'Inventory', href: '/inventory', icon: Package },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Staff', href: '/staff', icon: Users2 },
  { label: 'Workspaces', href: '/workspaces', icon: Building2 },
];

export const analyticsNavItems: NavItem[] = [
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Roast Profiles', href: '/roast-profiles', icon: Coffee },
  { label: 'Loyalty', href: '/loyalty', icon: Star },
];

export const footerNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Support', href: '/support', icon: HelpCircle },
];
