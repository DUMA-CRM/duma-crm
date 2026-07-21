import { apiFetch } from './client';

import type { PayType } from './hr.service';

export type PayrollPeriod = 'weekly' | 'monthly';

export interface PayrollPreviewLine {
  userId: string;
  name: string;
  jobTitle: string;
  payType: PayType;
  hourlyRate: number | null;
  rawHours: number;
  paidHours: number;
  grossPay: number;
}

export interface PayrollPreview {
  lines: PayrollPreviewLine[];
  totals: { employees: number; gross: number };
}

export interface PayrollRunLine {
  id: string;
  runId: string;
  userId: string;
  employeeName: string | null;
  payType: PayType;
  hoursWorked: string;
  paidHours: string;
  hourlyRate: string | null;
  grossPay: string;
}

export interface PayrollRun {
  id: string;
  tenantId: string;
  period: PayrollPeriod;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'finalised';
  finalisedAt: string | null;
  createdAt: string;
  lines: PayrollRunLine[];
}

export const getPayrollPreview = (period: PayrollPeriod, from: string, to: string) =>
  apiFetch<PayrollPreview>(`/payroll/preview?period=${period}&from=${from}&to=${to}`);

export const createPayrollRun = (data: { period: PayrollPeriod; periodStart: string; periodEnd: string }) =>
  apiFetch<PayrollRun>('/payroll/runs', { method: 'POST', body: JSON.stringify(data) });

export const getPayrollRuns = () => apiFetch<PayrollRun[]>('/payroll/runs');
