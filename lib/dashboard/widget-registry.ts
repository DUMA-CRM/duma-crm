import type { Capability, ModuleId } from '@/lib/modules/manifest';

export interface DashboardWidgetDefinition {
  key: string;
  moduleId: ModuleId;
  label: string;
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
    key: 'analytics.exceptions',
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
    moduleId: 'analytics',
    label: 'Live service',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'none',
    audiences: ['owner', 'location_manager'],
    freshness: 'live',
    deepLink: '/orders',
  }),
  widget({
    key: 'analytics.kpis',
    moduleId: 'analytics',
    label: 'Today in numbers',
    requiredCapabilities: ['analytics:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    freshness: 'minute',
    deepLink: '/reports',
  }),
  widget({
    key: 'analytics.orders-hourly',
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
    moduleId: 'workforce',
    label: 'My workday',
    requiredCapabilities: ['shifts:read'],
    sensitive: 'people',
    audiences: ['frontline_pos', 'hr_manager'],
    deepLink: '/schedule',
  }),
  widget({
    key: 'organization.readiness',
    moduleId: 'organization',
    label: 'Workspace readiness',
    requiredCapabilities: ['settings:read'],
    sensitive: 'none',
    audiences: ['owner'],
    deepLink: '/settings/workspaces',
  }),
  widget({
    key: 'ordering.pos-launch',
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
    moduleId: 'kds',
    label: 'Run fulfilment',
    requiredCapabilities: ['orders:status'],
    sensitive: 'none',
    audiences: ['frontline_pos', 'kitchen'],
    freshness: 'live',
    deepLink: '/kds',
  }),
  widget({
    key: 'people.team-launch',
    moduleId: 'people',
    label: 'People workspace',
    requiredCapabilities: ['hr.people:read'],
    sensitive: 'people',
    audiences: ['owner', 'hr_manager'],
    deepLink: '/staff',
  }),
  widget({
    key: 'customers.relationships-launch',
    moduleId: 'customers',
    label: 'Customer relationships',
    requiredCapabilities: ['customers:read'],
    sensitive: 'customer',
    audiences: ['owner', 'marketing_manager'],
    deepLink: '/customers',
  }),
  widget({
    key: 'communications.outreach-launch',
    moduleId: 'communications',
    label: 'Customer outreach',
    requiredCapabilities: ['email:read'],
    sensitive: 'customer',
    audiences: ['owner', 'marketing_manager'],
    deepLink: '/communications',
  }),
  widget({
    key: 'compliance.audit-launch',
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
    moduleId: 'workforce',
    label: 'Team today',
    requiredCapabilities: ['scheduling:read'],
    sensitive: 'people',
    audiences: ['owner', 'location_manager', 'hr_manager'],
    freshness: 'minute',
    deepLink: '/staff/shifts',
  }),
  widget({
    key: 'purchasing.overview',
    moduleId: 'purchasing',
    label: 'Purchasing',
    requiredCapabilities: ['purchasing:read'],
    sensitive: 'financial',
    audiences: ['owner', 'location_manager'],
    deepLink: '/inventory/purchasing',
  }),
  widget({
    key: 'payments.tenders',
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
    moduleId: 'customers',
    label: 'Customers',
    requiredCapabilities: ['customers:read'],
    sensitive: 'customer',
    audiences: ['owner', 'marketing_manager'],
    deepLink: '/customers',
  }),
  widget({
    key: 'cms.content',
    moduleId: 'cms',
    label: 'Website content',
    requiredCapabilities: ['cms:read'],
    sensitive: 'none',
    audiences: ['owner', 'marketing_manager'],
    deepLink: '/content',
  }),
];

export const widgetDefinition = (key: string) => DASHBOARD_WIDGETS.find((widget) => widget.key === key);

export const ANALYTICS_WIDGET_KEYS = new Set(
  DASHBOARD_WIDGETS.filter((widget) => widget.moduleId === 'analytics').map((widget) => widget.key),
);
export const LAUNCH_WIDGET_KEYS = new Set(
  DASHBOARD_WIDGETS.filter((widget) => !['analytics', 'workforce'].includes(widget.moduleId)).map((widget) => widget.key),
);

export function widgetsForModule(moduleId: ModuleId): string[] {
  return DASHBOARD_WIDGETS.filter((widget) => widget.moduleId === moduleId).map((widget) => widget.key);
}
