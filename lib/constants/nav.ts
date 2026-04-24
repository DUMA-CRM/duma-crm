import {
  BarChart3,
  Building2,
  Coffee,
  HelpCircle,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Users,
  Users2,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: Omit<NavItem, 'children'>[];
}

export const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'POS Terminal', href: '/pos', icon: Monitor },
  {
    label: 'Menu',
    href: '/menu',
    icon: UtensilsCrossed,
    children: [
      { href: '/menu/location-pricing', label: 'Location Pricing', icon: Utensils },
    ],
  },
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
