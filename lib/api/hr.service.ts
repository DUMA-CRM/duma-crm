import { apiFetch } from './client';

// ── Enums ───────────────────────────────────────────────────────────────────

export type EmploymentType = 'full_time' | 'part_time' | 'contractor' | 'zero_hours';

// ── Employees ─────────────────────────────────────────────────────────────────

export interface HrEmployee {
  id: string;
  userId: string;
  tenantId: string;
  jobTitle: string;
  department?: string;
  employmentType: EmploymentType;
  startDate: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeePayload {
  userId: string;
  jobTitle: string;
  department?: string;
  employmentType: EmploymentType;
  startDate: string;
  dateOfBirth?: string;
}

export interface UpdateEmployeePayload {
  jobTitle?: string;
  department?: string;
  employmentType?: EmploymentType;
  startDate?: string;
  dateOfBirth?: string;
}

export interface UpdateMyEmployeePayload {
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}

export const getMyEmployee = () => apiFetch<HrEmployee>('/hr/employees/me');

export const updateMyEmployee = (data: UpdateMyEmployeePayload) =>
  apiFetch<HrEmployee>('/hr/employees/me', { method: 'PATCH', body: JSON.stringify(data) });

export const getEmployees = () => apiFetch<HrEmployee[]>('/hr/employees');

export const getEmployee = (userId: string) => apiFetch<HrEmployee>(`/hr/employees/${userId}`);

export const createEmployee = (data: CreateEmployeePayload) =>
  apiFetch<HrEmployee>('/hr/employees', { method: 'POST', body: JSON.stringify(data) });

export const updateEmployee = (userId: string, data: UpdateEmployeePayload) =>
  apiFetch<HrEmployee>(`/hr/employees/${userId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const offboardEmployee = (userId: string) =>
  apiFetch<{ success: boolean; userId: string }>(`/hr/employees/${userId}`, { method: 'DELETE' });

