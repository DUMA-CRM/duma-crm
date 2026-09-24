// ---------------------------------------------------------------------------
// Which payroll runs cover the same period, and which of them should survive.
//
// Duplicates exist because until 2026-09-12 nothing stopped two runs covering
// one period. Combining them never merges figures: two snapshots of the same
// work summed together pays that work twice. One survives, the other is set
// aside — so the only real decision is which, and that is what this decides.
// ---------------------------------------------------------------------------
import type { PayrollRun } from '@/lib/modules/people/client';

/** A period, and every run anyone has taken of it. */
export interface PeriodGroup {
  key: string;
  period: PayrollRun['period'];
  periodStart: string;
  periodEnd: string;
  /** Newest first. Includes superseded runs, which are history, not clutter. */
  runs: PayrollRun[];
  /** Runs still considered live — a duplicate is only a problem among these. */
  active: PayrollRun[];
}

export const periodKey = (run: PayrollRun) => `${run.period}:${run.periodStart}:${run.periodEnd}`;

export const isSuperseded = (run: PayrollRun) => run.status === 'superseded';

/** Group runs by the period they cover, newest period first. */
export function groupByPeriod(runs: PayrollRun[]): PeriodGroup[] {
  const groups = new Map<string, PeriodGroup>();

  for (const run of runs) {
    const key = periodKey(run);
    const group = groups.get(key) ?? {
      key,
      period: run.period,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      runs: [],
      active: [],
    };
    group.runs.push(run);
    if (!isSuperseded(run)) group.active.push(run);
    groups.set(key, group);
  }

  const newestFirst = (a: PayrollRun, b: PayrollRun) => (b.finalisedAt ?? b.createdAt).localeCompare(a.finalisedAt ?? a.createdAt);
  for (const group of groups.values()) {
    group.runs.sort(newestFirst);
    group.active.sort(newestFirst);
  }

  return [...groups.values()].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

/** More than one live run for one period: the thing that needs resolving. */
export const hasDuplicates = (group: PeriodGroup) => group.active.length > 1;

/**
 * Which run should survive a combine.
 *
 * In order: an issued run, because employees have already been given it; then
 * the run someone has entered deductions into, because that work would
 * otherwise be thrown away; then the most recently finalised, as the closest
 * account of the period.
 *
 * This is a *suggestion* — the caller still chooses. It exists so the default
 * is never "whichever happened to be first in the list".
 */
export function suggestSurvivor(group: PeriodGroup): PayrollRun | null {
  if (group.active.length === 0) return null;

  const issued = group.active.find((run) => run.status === 'issued');
  if (issued) return issued;

  const withDeductions = group.active.filter((run) =>
    run.lines.some((line) => line.taxDeducted !== null || line.nationalInsurance !== null || line.netPay !== null),
  );
  if (withDeductions.length > 0) return withDeductions[0];

  return group.active[0];
}

/**
 * Can this group be combined at all?
 *
 * An issued run is an itemised pay statement the employee has been given. The
 * API refuses to combine when one is involved, and the UI says why rather than
 * offering a button that will fail.
 */
export function combineBlockedReason(group: PeriodGroup): string | null {
  if (!hasDuplicates(group)) return null;
  const issued = group.active.filter((run) => run.status === 'issued');
  if (issued.length > 0) {
    return issued.length === group.active.length
      ? 'Every run for this period has been issued to employees, so none can be set aside.'
      : 'One of these runs has been issued to employees. An issued payslip cannot be rewritten by combining.';
  }
  return null;
}
