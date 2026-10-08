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

/** Why a module is pulled in: `requiredBy` needs it, reached through `path`. Mirrors duma-api `ModuleDependencyExplanation`. */
export interface ModuleDependency {
  moduleId: ModuleId;
  kind: 'required' | 'recommended';
  requiredBy: ModuleId;
  path: ModuleId[];
}

/** An enabled module that stops another being disabled. Mirrors duma-api `ModuleDisablementBlocker`. */
export interface ModuleBlocker {
  moduleId: ModuleId;
  path: ModuleId[];
}

export interface ModuleChangePreview {
  moduleId: ModuleId;
  expectedConfigurationVersion: number;
  current: Pick<TenantModuleState, 'status' | 'configuration'>;
  proposed: Pick<TenantModuleState, 'status' | 'configuration'>;
  canApply: boolean;
  // Objects, not ids: the API explains each one. Typed as ids, they rendered as a crash.
  blockers: { foundation: boolean; requiredBy: ModuleBlocker[] };
  changes: Array<{ moduleId: ModuleId; status: 'enabled' | 'disabled' }>;
  additions: ModuleDependency[];
  recommendations: ModuleDependency[];
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
  additions: ModuleDependency[];
  recommendations: ModuleDependency[];
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

/**
 * Change one module's configuration without changing whether it is on — e.g.
 * the catalog's `vocabulary` (menu, retail, mixed). Optimistic concurrency:
 * a configuration changed elsewhere since it was read fails with 409.
 */
export const updateTenantModuleConfiguration = (
  tenantId: string,
  moduleId: ModuleId,
  current: Pick<TenantModuleState, 'configuration' | 'configurationVersion'>,
  patch: Record<string, unknown>,
  reason: string,
) =>
  apiFetch<ModuleChangeResult>(`/modules/tenants/${tenantId}/${moduleId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'enabled',
      configuration: { ...current.configuration, ...patch },
      expectedConfigurationVersion: current.configurationVersion,
      reason,
    }),
  });
