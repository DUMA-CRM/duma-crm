import { formatDate } from '@/lib/utils/date';

/**
 * One tab per question the employee is actually asking. Payslips sit under
 * Documents rather than beside expenses: both are records HR issued about you
 * and look up rarely, where an expense claim is something you are doing now.
 */
export type MyHrTab = 'overview' | 'time-off' | 'attendance' | 'documents' | 'expenses' | 'requests';
export const MY_HR_TABS: MyHrTab[] = ['overview', 'time-off', 'attendance', 'documents', 'expenses', 'requests'];

export const fmt = (date: string) => formatDate(date);

export const money = (value: string | number | null | undefined, currency = 'GBP') => {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(Number.isFinite(n) ? n : 0);
};

export const statusVariant = (status: string): 'success' | 'warning' | 'destructive' | 'muted' =>
  status === 'approved' || status === 'resolved' || status === 'paid'
    ? 'success'
    : status === 'pending' || status === 'open' || status === 'in_progress' || status === 'waiting_employee'
      ? 'warning'
      : status === 'declined'
        ? 'destructive'
        : 'muted';

/**
 * What the employee can see about their own bank record.
 *
 * `known: false` means the read was refused — the bank endpoint is
 * manager-scoped — so the page says it cannot show them rather than implying
 * none are held. Absence of evidence is not shown as evidence of absence.
 */
export interface BankVisibility {
  known: boolean;
  hasBankDetails?: boolean;
  accountHolder?: string | null;
  bankName?: string | null;
  sortCode?: string | null;
  accountNumber?: string | null;
}
