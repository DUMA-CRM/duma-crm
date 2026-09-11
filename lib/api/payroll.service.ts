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
  // Entered by a human from whatever actually runs payroll — nothing here
  // computes PAYE. `null` means "not entered yet"; `'0.00'` means "nothing
  // deducted". Never conflate the two: a payslip must not assert zero tax
  // because a field is blank. (UI-ADR-011)
  taxDeducted: string | null;
  nationalInsurance: string | null;
  pensionContribution: string | null;
  otherDeductions: string | null;
  netPay: string | null;
}

/** What a line still needs before its run can be issued. */
export const lineIsComplete = (line: PayrollRunLine): boolean =>
  line.taxDeducted !== null && line.nationalInsurance !== null && line.netPay !== null;

export interface PayrollRun {
  id: string;
  tenantId: string;
  period: PayrollPeriod;
  periodStart: string;
  periodEnd: string;
  // `finalised` freezes hours and gross so a later rota edit cannot rewrite
  // history. `issued` is when employees can see their payslips, and is
  // irreversible.
  status: 'draft' | 'finalised' | 'issued' | 'superseded';
  finalisedAt: string | null;
  issuedAt: string | null;
  issuedBy: string | null;
  /** Where the deduction figures came from, e.g. "BrightPay, March 2026". */
  deductionsSource: string | null;
  /** Set aside because another run covers the same period. Kept, never deleted. */
  supersededAt: string | null;
  supersededBy: string | null;
  createdAt: string;
  lines: PayrollRunLine[];
}

export interface DeductionsPayload {
  taxDeducted: string;
  nationalInsurance: string;
  pensionContribution?: string;
  otherDeductions?: string;
  netPay: string;
}

export const getPayrollPreview = (period: PayrollPeriod, from: string, to: string) =>
  apiFetch<PayrollPreview>(`/payroll/preview?period=${period}&from=${from}&to=${to}`);

export const createPayrollRun = (data: { period: PayrollPeriod; periodStart: string; periodEnd: string }) =>
  apiFetch<PayrollRun>('/payroll/runs', { method: 'POST', body: JSON.stringify(data) });

export const getPayrollRuns = () => apiFetch<PayrollRun[]>('/payroll/runs');

export const setPayrollLineDeductions = (runId: string, lineId: string, data: DeductionsPayload) =>
  apiFetch<PayrollRunLine>(`/payroll/runs/${runId}/lines/${lineId}`, { method: 'PATCH', body: JSON.stringify(data) });

/**
 * Set one duplicate aside in favour of another covering the same period.
 *
 * Figures are never merged — summing two snapshots of one period pays the same
 * work twice — so `runId` is the one being set aside and `replacedBy` survives.
 * Refused by the API if either has been issued.
 */
export const supersedePayrollRun = (runId: string, replacedBy: string) =>
  apiFetch<PayrollRun>(`/payroll/runs/${runId}/supersede`, { method: 'POST', body: JSON.stringify({ replacedBy }) });

/** Publishes every line as a payslip. Refused while any line is incomplete. */
export const issuePayrollRun = (runId: string, deductionsSource: string) =>
  apiFetch<PayrollRun>(`/payroll/runs/${runId}/issue`, { method: 'POST', body: JSON.stringify({ deductionsSource }) });
