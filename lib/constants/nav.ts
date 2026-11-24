import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  ChefHat,
  ClipboardList,
  HelpCircle,
  type IconComponent,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Megaphone,
  Monitor,
  NotebookPen,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tag,
  TicketPercent,
  Users,
  UsersRound,
  UtensilsCrossed,
} from '@/components/icons';

import type { NavEntry, NavGroup as NavGroupOf } from '@/lib/utils/nav-access';

export { filterNavByCapability, filterNavGroups, isNavPathActive } from '@/lib/utils/nav-access';

/** One sidebar entry. The access rules — modules, capabilities, `alsoFor` — are in lib/utils/nav-access.ts. */
export type NavItem = NavEntry<IconComponent>;
export type NavGroup = NavGroupOf<NavItem>;

/*
  The sidebar reads top to bottom as the business does. Dashboard stands alone
  at the top; then five headed groups:

    Service       — running the day: till, kitchen, orders, the door
    Menu & stock  — what you sell and what it's made from
    Customers     — who you sell to and how you reach them
    Team          — the staff workspace, then your own rota and HR (My work)
    Workspace     — content, notes, reports and compliance: looking after and
                    looking back at the business rather than running a shift

  Apps, Settings and Support sit in the footer under the location picker: they
  configure the workspace rather than work in it. Installed apps show as
  children of Apps.

  Headings were dropped on 2026-10-05 for a flat, ordered list with only a
  "Reports" heading; the owner reinstated grouping when the list outgrew what
  order alone could make scannable. Each heading renders the way "Reports" did,
  becomes a rule when the sidebar is collapsed, and disappears when every item
  under it is hidden for this person or workspace.

  Each entry is one page. Features that used to have their own entry are tabs
  now: Automation is in Communications, the audit log in Compliance, loyalty in
  Promotions, and My rota + My HR are My work. Labels are the page titles.

  One line per item, so an entry can be found with a single-line pattern; long
  lines carry `prettier-ignore` rather than wrapping.
*/
export const mainNavGroups: NavGroup[] = [
  {
    items: [
      // Every workspace has one: it builds itself from the modules switched on.
      { module: 'organization', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    heading: 'Service',
    items: [
      { module: 'pos', label: 'Till', href: '/pos', icon: Monitor, capabilities: ['orders:create'] },
      // Its own module since 0101: a shop that ships parcels has no kitchen.
      { module: 'kds', label: 'Kitchen', href: '/kds', icon: ChefHat, capabilities: ['orders:status'] },
      { module: 'ordering', label: 'Orders', href: '/orders', icon: ShoppingBag, capabilities: ['orders:read'] },
      // Bookings, the floor and the waitlist — run at the door, beside the till.
      { module: 'reservations', label: 'Reservations', href: '/reservations', icon: CalendarCheck, capabilities: ['reservations:read'] },
      // No End of day entry: opening and closing the trading day is done in the
      // till, at the drawer (2026-10-04). Reports keeps the read-only history.
    ],
  },
  {
    heading: 'Menu & stock',
    items: [
      // A shop reads Products (see `retail`): setup records the catalog's vocabulary.
      // prettier-ignore
      { module: 'catalog', label: 'Menu', href: '/menu', icon: UtensilsCrossed, capabilities: ['menu:read', 'menu:write', 'recipes:write'], retail: { label: 'Products', icon: Tag } },
      // One entry: stock, restock demand, purchase orders, suppliers and
      // stocktakes are tabs of /inventory. `stock:read` rather than
      // `inventory:read` — till staff hold the latter so they can record waste,
      // and gating on it would put Inventory in the POS nav.
      { module: 'inventory', label: 'Inventory', href: '/inventory', icon: Package, capabilities: ['stock:read'] },
    ],
  },
  {
    heading: 'Customers',
    items: [
      // `marketing_manager` reaches this — the old rank threshold hid it from
      // the role whose job it is.
      { module: 'customers', label: 'Customers', href: '/customers', icon: Users, capabilities: ['customers:read'] },
      // Customer email: templates, automations, history and suppressions are tabs.
      { module: 'communications', label: 'Communications', href: '/communications', icon: Mail, capabilities: ['email:read'] },
      // Promo codes the till and checkout honour, then Loyalty and Refer a friend
      // as tabs. Loyalty is the customers module's, so someone who can read
      // customers but not promo codes still reaches it here.
      // prettier-ignore
      { module: 'promotions', label: 'Promotions', href: '/promotions', icon: TicketPercent, capabilities: ['promotions:read'], alsoFor: [{ module: 'customers', capabilities: ['customers:points'], href: '/promotions/loyalty' }] },
      // Posts scheduled to the workspace's social accounts.
      { module: 'marketing', label: 'Social posts', href: '/marketing', icon: Megaphone, capabilities: ['marketing:read'] },
      // Sign-ups, enquiries and feedback, on DUMA's own page, an embed or the API.
      { module: 'forms', label: 'Forms', href: '/forms', icon: ClipboardList, capabilities: ['forms:read'] },
    ],
  },
  {
    heading: 'Team',
    items: [
      // One entry: team, rota, shifts, time off, helpdesk and payroll are tabs of
      // the staff workspace, each on its own route.
      { module: 'people', label: 'Staff', href: '/staff', icon: UsersRound, capabilities: ['staff:read', 'hr.people:read'] },
      // Everyone's own rota (workforce) and HR (people) on one page, beside the
      // team they belong to. Shown when either module is on; without workforce
      // there is no rota tab, so the link opens the HR overview.
      // prettier-ignore
      { module: 'workforce', label: 'My work', href: '/my-work', icon: CalendarClock, alsoFor: [{ module: 'people', href: '/my-work?tab=overview' }] },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      // Website and app content, served to the tenant's own sites over an API key.
      { module: 'cms', label: 'Content', href: '/content', icon: Layers, capabilities: ['cms:read'] },
      // The team's knowledge base and everyone's own notes.
      { module: 'notes', label: 'Notes', href: '/notes', icon: NotebookPen, capabilities: ['notes:read'] },
      { module: 'analytics', label: 'Reports', href: '/reports', icon: BarChart3, capabilities: ['analytics:read'] },
      // Subject access and erasure requests, then the audit log as a tab — a
      // workload with statutory deadlines and the record of who changed what.
      // `auditor` reaches it through the audit log alone.
      // prettier-ignore
      { module: 'compliance', label: 'Compliance', href: '/compliance', icon: ShieldCheck, capabilities: ['privacy:read'], alsoFor: [{ module: 'audit', capabilities: ['audit:read'], href: '/compliance?tab=audit-log' }] },
    ],
  },
];

// Under the location picker. Workspaces and locations are a tab of Settings —
// organisation structure is set up once, so it belongs with the administration.
export const footerNavItems: NavItem[] = [
  // Installed apps are added as its children by the sidebar.
  { module: 'organization', label: 'Apps', href: '/apps', icon: LayoutGrid },
  { module: 'organization', label: 'Settings', href: '/settings', icon: Settings },
  { module: 'support', label: 'Support', href: '/support', icon: HelpCircle },
];
