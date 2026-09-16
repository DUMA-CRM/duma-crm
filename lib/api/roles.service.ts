import { apiFetch } from './client';

export interface AccessRole {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description: string | null;
  capabilities: string[];
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleCatalog {
  roles: AccessRole[];
  capabilityGroups: Record<string, string[]>;
  grantableCapabilities: string[];
}

export interface RoleInput {
  name: string;
  description?: string | null;
  capabilities: string[];
  tenantId?: string;
}

export const getRoles = (tenantId?: string) => {
  const query = tenantId ? `?${new URLSearchParams({ tenantId })}` : '';
  return apiFetch<RoleCatalog>(`/roles${query}`);
};

export const createRole = (input: RoleInput) => apiFetch<AccessRole>('/roles', {
  method: 'POST',
  body: JSON.stringify(input),
});

export const updateRole = (id: string, input: Partial<Omit<RoleInput, 'tenantId'>>, tenantId?: string) => {
  const query = tenantId ? `?${new URLSearchParams({ tenantId })}` : '';
  return apiFetch<AccessRole>(`/roles/${id}${query}`, { method: 'PATCH', body: JSON.stringify(input) });
};

export const deleteRole = (id: string, tenantId?: string) => {
  const query = tenantId ? `?${new URLSearchParams({ tenantId })}` : '';
  return apiFetch<void>(`/roles/${id}${query}`, { method: 'DELETE' });
};
