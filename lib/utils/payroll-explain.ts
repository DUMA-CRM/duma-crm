// ---------------------------------------------------------------------------
// Why one person's gross pay is the number it is.
//
// The API computes this in `src/lib/payroll.ts` and returns only the result, so
// a manager looking at a preview row sees a figure with no account of itself.
// These helpers re-derive the account from the timesheet the API also exposes.
//
// They describe the rules; they do not re-implement them. If a figure here
// disagrees with the API's, the API is right and this is the bug — which is
// why `reconciles` exists.
// ---------------------------------------------------------------------------
import type { TimesheetShift } from '@/lib/modules/people/client';
import type { PayrollPeriod, PayrollPreviewLine } from '@/lib/modules/people/client';

const round2 = (value: number) => Math.round(value * 100) / 100;

export interface ShiftExplanation {
  shift: TimesheetShift;
  /** Clocked but beyond the rostered slot, so unpaid. */
  overtimeHours: number;
  /**
   * The rest of the gap between clocked and payable — the automatic unpaid
   * break, deducted once a shift passes the employee's threshold.
   */
  breakHours: number;
  /**
   * No rostered shift to cap against. The API treats the cap as **zero** in
   * that case, not "uncapped", so the whole shift is unpaid. This is the least
   * obvious rule in payroll and the one most likely to be read as a bug.
   */
  unrostered: boolean;
}

export function explainShift(shift: TimesheetShift): ShiftExplanation {
  const unpaid = Math.max(0, shift.rawHours - shift.paidHours);
  const overtime = Math.max(0, shift.overtimeHours);
  return {
    shift,
    overtimeHours: round2(overtime),
    // Whatever is unpaid and not overtime is the break deduction.
    breakHours: round2(Math.max(0, unpaid - overtime)),
    unrostered: shift.scheduled === null && shift.rawHours > 0,
  };
}

export type PayBasis = 'hourly' | 'salaried' | 'missing-rate';

export interface PayExplanation {
  basis: PayBasis;
  /** Hours the rate is applied to. Always 0 for a salaried employee. */
  payableHours: number;
  /** Clocked hours that earn nothing, and why. */
  unpaidHours: number;
  overtimeHours: number;
  breakHours: number;
  unrosteredShifts: number;
  shifts: ShiftExplanation[];
  /** The divisor a salaried employee's annual pay is split by for this period. */
  salaryDivisor: number | null;
}

/**
 * Assemble the account of one preview line.
 *
 * `shifts` is the timesheet for the same window. It may be absent — the
 * timesheet is a second request — in which case the totals still describe the
 * line, and only the per-shift detail is missing.
 */
export function explainPay(line: PayrollPreviewLine, period: PayrollPeriod, shifts: TimesheetShift[] = []): PayExplanation {
  const explained = shifts.map(explainShift);

  const basis: PayBasis =
    line.payType === 'salaried' ? 'salaried' : line.hourlyRate == null || line.hourlyRate <= 0 ? 'missing-rate' : 'hourly';

  return {
    basis,
    payableHours: round2(line.paidHours),
    unpaidHours: round2(Math.max(0, line.rawHours - line.paidHours)),
    overtimeHours: round2(explained.reduce((sum, item) => sum + item.overtimeHours, 0)),
    breakHours: round2(explained.reduce((sum, item) => sum + item.breakHours, 0)),
    unrosteredShifts: explained.filter((item) => item.unrostered).length,
    shifts: explained,
    salaryDivisor: line.payType === 'salaried' ? (period === 'weekly' ? 52 : 12) : null,
  };
}

/**
 * Does `paidHours × rate` actually come to the gross the API returned?
 *
 * A mismatch means the two sides disagree about someone's pay, which is worth
 * saying out loud rather than quietly rendering whichever number came last.
 * Salaried lines are exempt — their gross is a share of annual salary and has
 * nothing to do with hours.
 */
export function reconciles(line: PayrollPreviewLine): boolean {
  if (line.payType === 'salaried' || line.hourlyRate == null) return true;
  return Math.abs(round2(line.paidHours * line.hourlyRate) - round2(line.grossPay)) < 0.01;
}
