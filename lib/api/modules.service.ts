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

export const getCurrentTenantModules = (tenantId?: string, cookieHeader?: string) =>
  apiFetch<CurrentTenantModules>(
    `/modules/current${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`,
    cookieHeader ? { cookieHeader } : {},
  );
