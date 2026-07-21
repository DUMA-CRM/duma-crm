import { apiFetch } from './client';

import type { EmploymentType, PayType } from './hr.service';
import type { StaffRole, StaffScope } from './staff.service';

// One-shot employee onboarding: account + access + employment + pay + bank.

export interface OnboardPayload {
  // Account & access
  email: string;
  name: string;
  password: string;
  role: Exclude<StaffRole, 'super_admin'>;
  scope: StaffScope;
  locationIds?: string[];
  tenantId?: string;

  // Employment
  jobTitle: string;
  department?: string;
  employmentType: EmploymentType;
  startDate: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;

  // Pay
  payType: PayType;
  hourlyRate?: number | null;
  annualSalary?: number | null;
  unpaidBreakMins?: number;
  breakThresholdMins?: number;

  // UK statutory + bank
  niNumber?: string;
  taxCode?: string;
  accountHolder?: string;
  bankName?: string;
  sortCode?: string;
  accountNumber?: string;
}

export interface OnboardResult {
  userId: string;
  email: string;
  name: string;
}

export const onboardEmployee = (data: OnboardPayload) =>
  apiFetch<OnboardResult>('/onboarding', { method: 'POST', body: JSON.stringify(data) });
