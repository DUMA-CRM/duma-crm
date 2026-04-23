import { apiFetch } from './client';

export type StaffRole = 'super_admin' | 'franchise_owner' | 'store_manager' | 'barista' | 'hr_manager' | 'marketing_manager' | 'auditor';
export type StaffScope = 'global' | 'franchise' | 'location';

export interface StaffProfile {
  id: string;
  userId: string;
  tenantId: string;
  name?: string;
  email?: string;
  role: StaffRole;
  scope: StaffScope;
  isActive: boolean;
  locationIds?: string[];
  createdAt: string;
}

export interface CreateStaffPayload {
  email: string;
  name: string;
  password: string;
  tenantId: string;
  role: StaffRole;
  scope: StaffScope;
  locationIds?: string[];
}

export interface UpdateStaffPayload {
  role?: StaffRole;
  scope?: StaffScope;
  locationIds?: string[];
  isActive?: boolean;
}

export const getStaff = (tenantId?: string) => {
  const qs = tenantId ? `?tenantId=${tenantId}` : '';
  return apiFetch<StaffProfile[]>(`/staff${qs}`);
};

export const getStaffMember = (userId: string) => apiFetch<StaffProfile>(`/staff/${userId}`);

export const createStaff = (data: CreateStaffPayload) => apiFetch<StaffProfile>('/staff', { method: 'POST', body: JSON.stringify(data) });

export const updateStaff = (userId: string, data: UpdateStaffPayload) =>
  apiFetch<StaffProfile>(`/staff/${userId}`, { method: 'PATCH', body: JSON.stringify(data) });
