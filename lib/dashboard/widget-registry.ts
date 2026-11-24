import { NATURE_PHOTOS } from './nature-photos.ts';
import type { Capability, ModuleId } from '@/lib/modules/manifest';

export interface DashboardWidgetDefinition {
  key: string;
  moduleId: ModuleId;
  label: string;
  /** The widget gallery's one line, starting with a verb. */
  description: string;
  requiredCapabilities: Capability[];
  /** Modules its data also comes from; all must be on (mirrors the API registry). */
  requiresModules?: ModuleId[];
  sensitive: 'none' | 'financial' | 'customer' | 'people';
  audiences: DashboardAudience[];
  freshness: 'live' | 'minute' | 'on_navigation';
  emptyState: string;
  errorState: string;
  deepLink: string;
}

export type DashboardAudience = 'owner' | 'location_manager' | 'frontline_pos' | 'kitchen' | 'hr_manager' | 'marketing_manager';

const ALL_AUDIENCES: DashboardAudience[] = ['owner', 'location_manager', 'frontline_pos', 'kitchen', 'hr_manager', 'marketing_manager'];

const widget = (
  definition: Omit<DashboardWidgetDefinition, 'freshness' | 'emptyState' | 'errorState'> &
    Partial<Pick<DashboardWidgetDefinition, 'freshness' | 'emptyState' | 'errorState'>>,
): DashboardWidgetDefinition => ({
  freshness: 'on_navigation',
  emptyState: `No ${definition.label.toLowerCase()} to show yet.`,
  errorState: `${definition.label} could not be loaded.`,
  ...definition,
});

export const DASHBOARD_WIDGETS: readonly DashboardWidgetDefinition[] = [
  widget({
    key: 'analytics.greeting',
    description: 'Start with hello, how the day is going in a sentence, and its small wins.',
    moduleId: 'analytics',
    label: 'Your day',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/reports/sales-summary',
  }),
  widget({
    key: 'analytics.exceptions',
    description: 'See late orders, cover gaps and stock running out, the moment they happen.',
    moduleId: 'analytics',
    label: 'What needs attention',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'none',
    audiences: ['owner', 'location_manager'],
    freshness: 'live',
    deepLink: '/orders',
  }),
  widget({
    key: 'analytics.trading',
    description: 'Follow the day’s takings against a typical day and your target.',
    moduleId: 'analytics',
    label: 'Taken today',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'live',
    deepLink: '/orders',
  }),
  widget({
    key: 'analytics.live',
    description: 'Watch the orders in service right now, lane by lane.',
    moduleId: 'analytics',
    label: 'Live service',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'none',
    audiences: ['owner', 'location_manager'],
    freshness: 'live',
    deepLink: '/orders',
  }),
  // Today's figures, one stat tile each. Mirrors duma-api/src/lib/dashboard-widgets.ts.
  widget({
    key: 'analytics.net-sales',
    description: 'See today’s net sales against a typical day by now.',
    moduleId: 'analytics',
    label: 'Net sales',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/reports/sales-summary',
  }),
  widget({
    key: 'analytics.orders',
    description: 'Count today’s orders against a typical day by now.',
    moduleId: 'analytics',
    label: 'Orders',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/orders',
  }),
  widget({
    key: 'analytics.average-order',
    description: 'Track what an order is worth today.',
    moduleId: 'analytics',
    label: 'Average order',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/reports/sales-summary',
  }),
  widget({
    key: 'analytics.labour',
    description: 'See today’s labour as a share of net sales.',
    moduleId: 'analytics',
    label: 'Labour',
    requiredCapabilities: ['analytics:read'],
    requiresModules: ['workforce'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/staff/rota',
  }),
  widget({
    key: 'analytics.refunds',
    description: 'Keep an eye on what has been refunded today.',
    moduleId: 'analytics',
    label: 'Refunds paid',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/reports/refunds',
  }),
  widget({
    key: 'analytics.orders-hourly',
    description: 'See the shape of the day, hour by hour.',
    moduleId: 'analytics',
    label: 'Orders by hour',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/reports',
  }),
  widget({
    key: 'analytics.top-items',
    description: 'See what is selling best today.',
    moduleId: 'analytics',
    label: 'Top items today',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/reports',
  }),
  widget({
    key: 'workforce.my-day',
    description: 'Clock in, clock out and see your shifts this week.',
    moduleId: 'workforce',
    label: 'My workday',
    requiredCapabilities: ['shifts:read'],
    sensitive: 'people',
    audiences: ['frontline_pos', 'hr_manager'],
    deepLink: '/schedule',
  }),
  widget({
    key: 'organization.readiness',
    description: 'Finish setting up your workspace.',
    moduleId: 'organization',
    label: 'Workspace readiness',
    requiredCapabilities: ['settings:read'],
    sensitive: 'none',
    audiences: ['owner'],
    deepLink: '/settings/workspaces',
  }),
  widget({
    key: 'ordering.pos-launch',
    description: 'Open the till and take an order.',
    moduleId: 'pos',
    label: 'Take an order',
    requiredCapabilities: ['orders:create'],
    sensitive: 'none',
    audiences: ['frontline_pos'],
    freshness: 'live',
    deepLink: '/pos',
  }),
  widget({
    key: 'ordering.fulfilment-launch',
    description: 'Open the kitchen display.',
    moduleId: 'kds',
    label: 'Run fulfilment',
    requiredCapabilities: ['orders:status'],
    sensitive: 'none',
    audiences: ['frontline_pos', 'kitchen'],
    freshness: 'live',
    deepLink: '/kds',
  }),
  widget({
    key: 'customers.relationships-launch',
    description: 'Open customer profiles and loyalty.',
    moduleId: 'customers',
    label: 'Customer relationships',
    requiredCapabilities: ['customers:read'],
    sensitive: 'customer',
    audiences: ['owner', 'marketing_manager'],
    deepLink: '/customers',
  }),
  widget({
    key: 'communications.outreach-launch',
    description: 'Open email templates and automations.',
    moduleId: 'communications',
    label: 'Customer outreach',
    requiredCapabilities: ['email:read'],
    sensitive: 'customer',
    audiences: ['owner', 'marketing_manager'],
    deepLink: '/communications',
  }),
  widget({
    key: 'compliance.audit-launch',
    description: 'Open the record of who changed what.',
    moduleId: 'audit',
    label: 'Audit trail',
    requiredCapabilities: ['audit:read'],
    sensitive: 'none',
    audiences: ['owner'],
    deepLink: '/audit-log',
  }),
  // One card per module that had none, so any combination of modules makes a
  // dashboard. Mirrors duma-api/src/lib/dashboard-widgets.ts.
  widget({
    key: 'inventory.stock-health',
    description: 'Know what the shelf is worth and what is running low.',
    moduleId: 'inventory',
    label: 'Stock health',
    requiredCapabilities: ['inventory:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager', 'kitchen'],
    freshness: 'minute',
    deepLink: '/inventory',
  }),
  widget({
    key: 'workforce.team-today',
    description: 'See who is on shift and who hasn’t come in.',
    moduleId: 'workforce',
    label: 'Team today',
    requiredCapabilities: ['scheduling:read'],
    sensitive: 'people',
    audiences: ['owner', 'location_manager', 'hr_manager'],
    freshness: 'minute',
    deepLink: '/staff/rota',
  }),
  widget({
    key: 'purchasing.overview',
    description: 'Track deliveries due and orders to chase.',
    moduleId: 'purchasing',
    label: 'Purchasing',
    requiredCapabilities: ['purchasing:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    deepLink: '/inventory?tab=demand',
  }),
  widget({
    key: 'payments.tenders',
    description: 'See how today was paid for, card by cash.',
    moduleId: 'payments',
    label: 'Takings by tender',
    requiredCapabilities: ['analytics:read'],
    requiresModules: ['analytics'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/reports/payment-methods',
  }),
  widget({
    key: 'customers.overview',
    description: 'Keep track of your customers and who has lapsed.',
    moduleId: 'customers',
    label: 'Customers',
    requiredCapabilities: ['customers:read'],
    sensitive: 'customer',
    audiences: ['owner', 'marketing_manager'],
    deepLink: '/customers',
  }),
  widget({
    key: 'cms.content',
    description: 'See what is live on your website and what is waiting.',
    moduleId: 'cms',
    label: 'Website content',
    requiredCapabilities: ['cms:read'],
    sensitive: 'none',
    audiences: ['owner', 'marketing_manager'],
    deepLink: '/content',
  }),
  // Ambient widgets: something pleasant on the board, not a figure to act on.
  widget({
    key: 'organization.clock',
    description: 'Keep the shop’s time and date in view.',
    moduleId: 'organization',
    label: 'Clock',
    requiredCapabilities: [],
    sensitive: 'none',
    audiences: ALL_AUDIENCES,
    freshness: 'live',
    deepLink: '/dashboard',
  }),
  // Only with photos to show: an empty set would be a widget of nothing.
  ...(NATURE_PHOTOS.length > 0
    ? [
        widget({
          key: 'organization.nature',
          description: 'Brighten the board with a calm landscape, a new one each day.',
          moduleId: 'organization',
          label: 'Nature photo',
          requiredCapabilities: [],
          sensitive: 'none',
          audiences: ALL_AUDIENCES,
          deepLink: '/dashboard',
        }),
      ]
    : []),
  widget({
    key: 'cms.photo',
    description: 'Show a photo from your Media library, a different one each day.',
    moduleId: 'cms',
    label: 'Photo from Media',
    requiredCapabilities: ['cms:read'],
    sensitive: 'none',
    audiences: ALL_AUDIENCES,
    deepLink: '/content?tab=media',
  }),
  widget({
    key: 'notes.pinned',
    description: 'Keep the notes you pinned within reach.',
    moduleId: 'notes',
    label: 'Pinned notes',
    requiredCapabilities: ['notes:read'],
    sensitive: 'none',
    audiences: ALL_AUDIENCES,
    deepLink: '/notes',
  }),
];

export const widgetDefinition = (key: string) => DASHBOARD_WIDGETS.find((widget) => widget.key === key);

export const ANALYTICS_WIDGET_KEYS = new Set(
  DASHBOARD_WIDGETS.filter((widget) => widget.moduleId === 'analytics').map((widget) => widget.key),
);

export function widgetsForModule(moduleId: ModuleId): string[] {
  return DASHBOARD_WIDGETS.filter((widget) => widget.moduleId === moduleId).map((widget) => widget.key);
}
