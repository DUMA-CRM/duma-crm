import type { ModuleId } from '@/lib/modules/manifest';

import { apiFetch } from './client';

export interface TenantModuleState {
  moduleId: ModuleId;
  status: 'enabled' | 'disabled';
  configurationVersion: number;
  configuration: Record<string, unknown>;
}

export interface CurrentTenantModules {
  modules: TenantModuleState[];
}

export interface ModuleChangePreview {
  moduleId: ModuleId;
  expectedConfigurationVersion: number;
  current: Pick<TenantModuleState, 'status' | 'configuration'>;
  proposed: Pick<TenantModuleState, 'status' | 'configuration'>;
  canApply: boolean;
  blockers: { foundation: boolean; requiredBy: ModuleId[] };
  changes: Array<{ moduleId: ModuleId; status: 'enabled' | 'disabled' }>;
  additions: ModuleId[];
  recommendations: ModuleId[];
  blastRadius: {
    capabilities: string[];
    workflows: { backgroundWorkers: string[]; publishedEvents: string[]; consumedEvents: string[] };
    integrations: string[];
    widgets: string[];
    historicalData: { tables: string[]; outcome: 'preserved'; message: string };
  };
}

export interface ModuleChangeResult {
  module: TenantModuleState;
  changes: TenantModuleState[];
  additions: ModuleId[];
  recommendations: ModuleId[];
}

export const getCurrentTenantModules = (tenantId?: string, cookieHeader?: string) =>
  apiFetch<CurrentTenantModules>(
    `/modules/current${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`,
    cookieHeader ? { cookieHeader } : {},
  );

export const getTenantModules = (tenantId: string) => apiFetch<TenantModuleState[]>(`/modules/tenants/${tenantId}`);

export const previewTenantModuleChange = (tenantId: string, moduleId: ModuleId, status: TenantModuleState['status']) =>
  apiFetch<ModuleChangePreview>(`/modules/tenants/${tenantId}/${moduleId}/preview`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });

export const changeTenantModule = (tenantId: string, preview: ModuleChangePreview, reason: string) =>
  apiFetch<ModuleChangeResult>(`/modules/tenants/${tenantId}/${preview.moduleId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: preview.proposed.status,
      configuration: preview.proposed.configuration,
      expectedConfigurationVersion: preview.expectedConfigurationVersion,
      reason,
    }),
  });
