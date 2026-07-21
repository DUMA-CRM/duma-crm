import { apiFetch } from './client';

// ── Enums ───────────────────────────────────────────────────────────────────

export type EmploymentType = 'full_time' | 'part_time' | 'contractor' | 'zero_hours';
export type PayType = 'hourly' | 'salaried';

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
  // Present only when the caller may see pay (owner/HR); flagged by the API.
  canSeeMoney?: boolean;
  payType?: PayType;
  hourlyRate?: string | null;
  annualSalary?: string | null;
  unpaidBreakMins?: number;
  breakThresholdMins?: number;
  taxCode?: string | null;
  hasNiNumber?: boolean;
  niNumber?: string | null; // masked unless fetched with reveal
}

export interface EmployeeBankDetails {
  accountHolder?: string | null;
  bankName?: string | null;
  hasBankDetails: boolean;
  sortCode?: string | null; // masked unless reveal
  accountNumber?: string | null;
}

export interface TimesheetShift {
  id: string;
  locationId: string;
  locationName: string | null;
  clockedIn: string;
  clockedOut: string | null;
  rawHours: number; // total clocked
  paidHours: number; // capped at scheduled, less unpaid break
  overtimeHours: number; // clocked beyond scheduled — unpaid
  scheduled: { startsAt: string; endsAt: string } | null;
}

export interface EmployeeHours {
  shifts: TimesheetShift[];
  totals: { shiftCount: number; rawHours: number; paidHours: number; overtimeHours: number; avgShiftHours: number };
}

// Pay + statutory fields, shared by admin create/patch.
export interface EmployeePayFields {
  payType?: PayType;
  hourlyRate?: number | null;
  annualSalary?: number | null;
  unpaidBreakMins?: number;
  breakThresholdMins?: number;
  niNumber?: string | null;
  taxCode?: string | null;
}

export interface CreateEmployeePayload extends EmployeePayFields {
  userId: string;
  jobTitle: string;
  department?: string;
  employmentType: EmploymentType;
  startDate: string;
  dateOfBirth?: string;
}

export interface UpdateEmployeePayload extends EmployeePayFields {
  jobTitle?: string;
  department?: string;
  employmentType?: EmploymentType;
  startDate?: string;
  dateOfBirth?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
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

export const getEmployee = (userId: string, reveal = false) =>
  apiFetch<HrEmployee>(`/hr/employees/${userId}${reveal ? '?reveal=true' : ''}`);

export const getEmployeeHours = (userId: string, from?: string, to?: string) => {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const qs = q.toString();
  return apiFetch<EmployeeHours>(`/hr/employees/${userId}/hours${qs ? `?${qs}` : ''}`);
};

export const getEmployeeBank = (userId: string, reveal = false) =>
  apiFetch<EmployeeBankDetails>(`/hr/employees/${userId}/bank${reveal ? '?reveal=true' : ''}`);

export interface BankDetailsPayload {
  accountHolder?: string | null;
  bankName?: string | null;
  sortCode?: string | null;
  accountNumber?: string | null;
}

export const setEmployeeBank = (userId: string, data: BankDetailsPayload) =>
  apiFetch<{ success: boolean }>(`/hr/employees/${userId}/bank`, { method: 'PUT', body: JSON.stringify(data) });

export const createEmployee = (data: CreateEmployeePayload) =>
  apiFetch<HrEmployee>('/hr/employees', { method: 'POST', body: JSON.stringify(data) });

export const updateEmployee = (userId: string, data: UpdateEmployeePayload) =>
  apiFetch<HrEmployee>(`/hr/employees/${userId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const offboardEmployee = (userId: string) =>
  apiFetch<{ success: boolean; userId: string }>(`/hr/employees/${userId}`, { method: 'DELETE' });

