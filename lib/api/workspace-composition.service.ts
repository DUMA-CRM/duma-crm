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
  isBlocking: boolean;
}

export interface WorkspaceSetupSession {
  id: string;
  tenantId: string;
  version: number;
  status: 'in_progress' | 'completed' | 'cancelled';
  completedAt?: string | null;
  requirements: SetupRequirement[];
  tasks: SetupTask[];
}

export const getDashboardLayouts = (tenantId: string) => apiFetch<DashboardLayoutRevision[]>(`/dashboard-layouts/${tenantId}`);

export const publishDashboardLayout = (tenantId: string, audienceKey: string, name: string) =>
  apiFetch<DashboardLayoutRevision>(`/dashboard-layouts/${tenantId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ audienceKey, name, widgets: [] }),
  });

export const getWorkspaceSetup = (tenantId: string) => apiFetch<WorkspaceSetupSession | null>(`/workspace-setup/${tenantId}`);

export const startWorkspaceSetup = (tenantId: string) =>
  apiFetch<WorkspaceSetupSession>(`/workspace-setup/${tenantId}/start`, { method: 'POST' });

export const updateSetupRequirement = (tenantId: string, requirementId: string, isSatisfied: boolean) =>
  apiFetch<SetupRequirement>(`/workspace-setup/${tenantId}/requirements/${requirementId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isSatisfied, evidence: {} }),
  });

export const updateSetupTask = (tenantId: string, taskId: string, status: SetupTask['status']) =>
  apiFetch<SetupTask>(`/workspace-setup/${tenantId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const completeWorkspaceSetup = (tenantId: string) =>
  apiFetch<WorkspaceSetupSession>(`/workspace-setup/${tenantId}/complete`, { method: 'POST' });
