import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ClipboardList,
  Coffee,
  HelpCircle,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  Package,
  PackageMinus,
  PackagePlus,
  Settings,
  ShoppingBag,
  Star,
  TrendingUp,
  Truck,
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
    children: [{ href: '/menu/location-pricing', label: 'Location Pricing', icon: Utensils }],
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Package,
    children: [
      { href: '/inventory/stock-control', label: 'Stock Control', icon: Boxes },
      { href: '/inventory/demand-forecast', label: 'Demand Forecast', icon: TrendingUp },
      { href: '/inventory/low-stock-alerts', label: 'Low Stock Alerts', icon: Bell },
      { href: '/inventory/delivery-log', label: 'Delivery Log', icon: Truck },
      { href: '/inventory/loss-log', label: 'Loss Log', icon: PackageMinus },
      { href: '/inventory/transfers', label: 'Transfers', icon: ArrowLeftRight },
      { href: '/inventory/stock-details', label: 'Stock Details', icon: ClipboardList },
      { href: '/inventory/supplier-management', label: 'Supplier Management', icon: Building2 },
      { href: '/inventory/restock-requests', label: 'Restock Requests', icon: PackagePlus },
    ],
  },
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
