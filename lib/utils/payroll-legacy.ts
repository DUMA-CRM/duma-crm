import type { PayItem, PayItemKind, PayrollRunLine } from '../api/payroll.service.ts';

/**
 * Old-API lines (before named deduction lines) carry the four UK columns and
 * no `items`. Rebuild the named lines from those columns, exactly as the 0081
 * backfill does, so every screen reads one shape whichever API it talks to.
 */
export type LegacyLine = Omit<PayrollRunLine, 'items'> & {
  items?: PayItem[];
  pensionContribution?: string | null;
  otherDeductions?: string | null;
};

export function withItems(line: LegacyLine): PayrollRunLine {
  if (Array.isArray(line.items)) return line as PayrollRunLine;
  const legacy: [string | null | undefined, string, PayItemKind][] = [
    [line.taxDeducted, 'Income tax', 'tax'],
    [line.nationalInsurance, 'National Insurance', 'social'],
    [line.pensionContribution, 'Pension', 'pension'],
    [line.otherDeductions, 'Other deductions', 'other'],
  ];
  const items = legacy
    .filter(([amount]) => amount !== null && amount !== undefined)
    .map(([amount, label, kind]) => ({ label, kind, paidBy: 'employee' as const, amount: String(amount) }));
  return { ...line, items };
}
