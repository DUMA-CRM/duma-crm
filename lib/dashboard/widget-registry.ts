import type { Capability, ModuleId } from '@/lib/modules/manifest';

export interface DashboardWidgetDefinition {
  key: string;
  moduleId: ModuleId;
  label: string;
  requiredCapabilities: Capability[];
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
    moduleId: 'ordering',
    label: 'Take an order',
    requiredCapabilities: ['orders:create'],
    sensitive: 'none',
    audiences: ['frontline_pos'],
    freshness: 'live',
    deepLink: '/pos',
  }),
  widget({
    key: 'ordering.fulfilment-launch',
    moduleId: 'ordering',
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
    moduleId: 'compliance',
    label: 'Audit trail',
    requiredCapabilities: ['audit:read'],
    sensitive: 'none',
    audiences: ['owner'],
    deepLink: '/audit-log',
  }),
];

export const ANALYTICS_WIDGET_KEYS = new Set(
  DASHBOARD_WIDGETS.filter((widget) => widget.moduleId === 'analytics').map((widget) => widget.key),
);
export const LAUNCH_WIDGET_KEYS = new Set(
  DASHBOARD_WIDGETS.filter((widget) => !['analytics', 'workforce'].includes(widget.moduleId)).map((widget) => widget.key),
);

export function widgetsForModule(moduleId: ModuleId): string[] {
  return DASHBOARD_WIDGETS.filter((widget) => widget.moduleId === moduleId).map((widget) => widget.key);
}
