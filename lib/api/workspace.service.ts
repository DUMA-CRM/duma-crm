import { apiFetch } from './client';

// ── Tenants ───────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  locationCount?: number;
  createdAt: string;
}

export interface TenantPayload {
  name: string;
  slug: string;
}

export const getTenants = () => apiFetch<Tenant[]>('/tenants');

export const createTenant = (data: TenantPayload) => apiFetch<Tenant>('/tenants', { method: 'POST', body: JSON.stringify(data) });

export const updateTenant = (id: string, data: Partial<TenantPayload>) =>
  apiFetch<Tenant>(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

// ── Locations ─────────────────────────────────────────────────────────────────

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  timezone: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface LocationPayload {
  tenantId: string;
  name: string;
  address: string;
  timezone: string;
  phone?: string;
  isActive?: boolean;
}

export const getLocationsByTenant = (tenantId: string) => apiFetch<Location[]>(`/locations/tenant/${tenantId}`);

export const createLocation = (data: LocationPayload) => apiFetch<Location>('/locations', { method: 'POST', body: JSON.stringify(data) });

export const updateLocation = (id: string, data: Partial<Omit<LocationPayload, 'tenantId'>>) =>
  apiFetch<Location>(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteLocation = (id: string) => apiFetch<void>(`/locations/${id}`, { method: 'DELETE' });
