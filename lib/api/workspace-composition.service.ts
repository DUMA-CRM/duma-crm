import { apiFetch } from './client';

export interface DashboardWidgetPlacement {
  id: string;
  widgetKey: string;
  moduleId: string;
  moduleVersion: number;
  gridColumn: number;
  gridRow: number;
  width: number;
  height: number;
  configuration: Record<string, unknown>;
  definition?: {
    key: string;
    moduleId: string;
    label: string;
    requiredCapabilities: string[];
    sensitive: 'none' | 'financial' | 'customer' | 'people';
    audiences: Array<'owner' | 'location_manager' | 'frontline_pos' | 'kitchen' | 'hr_manager' | 'marketing_manager'>;
    freshness: 'live' | 'minute' | 'on_navigation';
    emptyState: string;
    errorState: string;
    deepLink: string;
  };
}

export interface ResolvedDashboardLayout {
  tenantId: string;
  audienceKey: 'owner' | 'location_manager' | 'frontline_pos' | 'kitchen' | 'hr_manager' | 'marketing_manager';
  source: 'system' | 'workspace' | 'personal';
  layoutId: string | null;
  version: number;
  layers: {
    system: { version: number; widgetCount: number };
    workspace: { layoutId: string; version: number; widgetCount: number; applied: boolean } | null;
    personal: { layoutId: string; version: number; widgetCount: number } | null;
  };
  availableWidgets: DashboardWidgetPlacement[];
  widgets: DashboardWidgetPlacement[];
}

export interface DashboardLayoutRevision {
  id: string;
  tenantId: string;
  audienceKey: string;
  name: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string | null;
  widgets: DashboardWidgetPlacement[];
}

export interface SetupRequirement {
  id: string;
  requirementKey: string;
  label: string;
  isRequired: boolean;
  isSatisfied: boolean;
}

export interface SetupTask {
  id: string;
  taskKey: string;
  title: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'skipped';
  moduleId: string;
  description?: string | null;
  blockerReason?: string | null;
  deepLink: string;
  requiredBeforeGoLive: boolean;
}

export interface WorkspaceSetupSession {
  id: string;
  tenantId: string;
  version: number;
  status: 'in_progress' | 'completed' | 'cancelled';
  completedAt?: string | null;
  requirements: SetupRequirement[];
  tasks: SetupTask[];
  readiness: {
    ready: boolean;
    blockingCount: number;
    completedCount: number;
    totalCount: number;
    computedAt: string;
  };
}

export const getDashboardLayouts = (tenantId: string) => apiFetch<DashboardLayoutRevision[]>(`/dashboard-layouts/${tenantId}`);

export const getResolvedDashboardLayout = (tenantId?: string | null) =>
  apiFetch<ResolvedDashboardLayout>(`/dashboard-layouts/resolved${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`);

export const publishPersonalDashboardLayout = (
  tenantId: string,
  widgets: Array<Pick<DashboardWidgetPlacement, 'widgetKey' | 'gridColumn' | 'gridRow' | 'width' | 'height'>>,
) =>
  apiFetch(`/dashboard-layouts/personal`, {
    method: 'POST',
    body: JSON.stringify({ tenantId, widgets }),
  });

export const resetPersonalDashboardLayout = (tenantId: string) =>
  apiFetch<void>(`/dashboard-layouts/personal?tenantId=${encodeURIComponent(tenantId)}`, { method: 'DELETE' });

export const publishDashboardLayout = (tenantId: string, audienceKey: string, name: string) =>
  apiFetch<DashboardLayoutRevision>(`/dashboard-layouts/${tenantId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ audienceKey, name, widgets: [] }),
  });

export const getWorkspaceSetup = (tenantId: string) => apiFetch<WorkspaceSetupSession | null>(`/workspace-setup/${tenantId}`);

export const startWorkspaceSetup = (tenantId: string) =>
  apiFetch<WorkspaceSetupSession>(`/workspace-setup/${tenantId}/start`, { method: 'POST' });

export const completeWorkspaceSetup = (tenantId: string) =>
  apiFetch<WorkspaceSetupSession>(`/workspace-setup/${tenantId}/complete`, { method: 'POST' });
