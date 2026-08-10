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

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
// `null` for a day = closed. Times are local "HH:MM" (24h).
export type DayHours = { open: string; close: string } | null;
export type OpeningHours = Record<Weekday, DayHours>;

export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  timezone: string;
  phone?: string;
  openingHours?: OpeningHours | null;
  /** Net revenue this site aims to take in a trading day. Serialised as a numeric string. */
  dailyRevenueTarget?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface LocationPayload {
  tenantId: string;
  name: string;
  address: string;
  timezone: string;
  phone?: string;
  openingHours?: OpeningHours | null;
  dailyRevenueTarget?: number | null;
  isActive?: boolean;
}

// All locations the caller can access (tenant/location-scoped server-side).
export const getLocations = () => apiFetch<Location[]>('/locations');

export const getLocationsByTenant = (tenantId: string) => apiFetch<Location[]>(`/locations/tenant/${tenantId}`);

export const createLocation = (data: LocationPayload) => apiFetch<Location>('/locations', { method: 'POST', body: JSON.stringify(data) });

export const updateLocation = (id: string, data: Partial<Omit<LocationPayload, 'tenantId'>>) =>
  apiFetch<Location>(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

/**
 * Set (or clear, with null) a location's daily revenue target. Separate from the
 * full PATCH because that one is super_admin only, and a store manager owning
 * their own number is the point of having one.
 */
export const setLocationDailyTarget = (id: string, dailyRevenueTarget: number | null) =>
  apiFetch<Location>(`/locations/${id}/target`, { method: 'PATCH', body: JSON.stringify({ dailyRevenueTarget }) });

export const deleteLocation = (id: string) => apiFetch<void>(`/locations/${id}`, { method: 'DELETE' });
