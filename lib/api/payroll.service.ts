import { type LegacyLine, withItems } from '../utils/payroll-legacy';

import { apiFetch } from './client';
import type { PayType } from './hr.service';

/** Every period a run can cover, shortest first. */
export const PAYROLL_PERIODS = ['weekly', 'fortnightly', 'semi_monthly', 'monthly'] as const;
export type PayrollPeriod = (typeof PAYROLL_PERIODS)[number];

export type PayItemKind = 'tax' | 'social' | 'pension' | 'other';
export type PayItemPayer = 'employee' | 'employer';

/**
 * One named deduction or contribution on a payslip, entered by a person from
 * whatever actually computes the tax — "PAYE", "Social Security", "ZUS
 * emerytalne", "Військовий збір". Employer lines are a cost on top of gross and
 * never reduce net. Nothing in this app computes tax, in any country.
 */
export interface PayItem {
  label: string;
  kind: PayItemKind;
  paidBy: PayItemPayer;
  /** Decimal string, 2dp. Negative is allowed: a tax refund through payroll. */
  amount: string;
}

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
  /** The payslip's named deduction lines. Empty with a net pay set means "nothing deducted". */
  items: PayItem[];
  // Set when someone records the line's figures. `null` means "not entered
  // yet" — never read it as zero: a payslip must not assert nothing was
  // deducted because a field is blank. (UI-ADR-011)
  netPay: string | null;
  /** Legacy UK columns, kept on runs from before named lines. Read `items` instead. */
  taxDeducted?: string | null;
  nationalInsurance?: string | null;
}

/** What a line still needs before its run can be issued: its figures, marked by net pay. */
export const lineIsComplete = (line: Pick<PayrollRunLine, 'netPay'>): boolean => line.netPay !== null;

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
  /** Replaces the line's items wholesale. */
  items: PayItem[];
  netPay: string;
}

export const getPayrollPreview = (period: PayrollPeriod, from: string, to: string) =>
  apiFetch<PayrollPreview>(`/payroll/preview?period=${period}&from=${from}&to=${to}`);

export const createPayrollRun = async (data: { period: PayrollPeriod; periodStart: string; periodEnd: string }) =>
  normaliseRun(await apiFetch<PayrollRun>('/payroll/runs', { method: 'POST', body: JSON.stringify(data) }));

const normaliseRun = (run: Omit<PayrollRun, 'lines'> & { lines?: LegacyLine[] }): PayrollRun => ({
  ...run,
  lines: (run.lines ?? []).map(withItems),
});

export const getPayrollRuns = async () => (await apiFetch<PayrollRun[]>('/payroll/runs')).map(normaliseRun);

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

/**
 * The payroll schedule.
 *
 * Read and written through `/payroll/*` rather than `/trading-settings`, which
 * is gated on `settings:write` — authority over currency, VAT and the legal
 * name that the person running payroll has no reason to hold.
 */
export interface PayrollSchedule {
  payrollAutoFinalise: boolean;
  payrollPeriod: PayrollPeriod;
  /** Day of the month, clamped to the last day of shorter months. */
  payrollPayDayOfMonth: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  payrollPayWeekday: number;
  /** Read-only: the job's idempotency key, which the API refuses to accept. */
  payrollLastAutoPeriodEnd: string | null;
  /** ISO 3166-1 alpha-2, or null. Only suggests deduction line names. */
  payrollCountry: string | null;
  /** Read-only here — set in Trading & tax. */
  currency: string;
}

export const getPayrollSchedule = () => apiFetch<PayrollSchedule>('/payroll/settings');

export const savePayrollSchedule = (data: Omit<PayrollSchedule, 'payrollLastAutoPeriodEnd' | 'currency'>) =>
  apiFetch<PayrollSchedule>('/payroll/settings', { method: 'PUT', body: JSON.stringify(data) });
