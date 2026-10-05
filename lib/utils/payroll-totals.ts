/**
 * Payroll arithmetic for the screens — in cents, so a run of fifty people never
 * shows a float artefact. Mirrors duma-api `src/lib/payroll-items.ts`. Totals
 * are a picture of what was entered; nothing here computes tax.
 */
import type { PayItem } from '../api/payroll.service.ts';

const cents = (amount: string | number | null | undefined) => Math.round(Number(amount ?? 0) * 100);
const decimal = (value: number) => (value / 100).toFixed(2);

export function itemTotals(items: readonly PayItem[] | undefined): { employee: string; employer: string } {
  let employee = 0;
  let employer = 0;
  // Tolerates a line from an API that predates named lines.
  for (const item of items ?? []) {
    if (item.paidBy === 'employer') employer += cents(item.amount);
    else employee += cents(item.amount);
  }
  return { employee: decimal(employee), employer: decimal(employer) };
}

/** Gross less the employee's own lines — what net should be. */
export function expectedNet(grossPay: string, items: readonly PayItem[] | undefined): string {
  return decimal(cents(grossPay) - cents(itemTotals(items).employee));
}

export interface RunTotals {
  people: number;
  entered: number;
  gross: string;
  employeeDeductions: string;
  employerCost: string;
  net: string;
  /** Gross plus employer lines — what the payroll costs the business. */
  totalCost: string;
}

interface LineLike {
  grossPay: string;
  netPay: string | null;
  items?: readonly PayItem[];
}

export function runTotals(lines: readonly LineLike[]): RunTotals {
  let gross = 0;
  let employee = 0;
  let employer = 0;
  let net = 0;
  let entered = 0;
  for (const line of lines) {
    gross += cents(line.grossPay);
    const totals = itemTotals(line.items);
    employee += cents(totals.employee);
    employer += cents(totals.employer);
    if (line.netPay !== null) {
      entered += 1;
      net += cents(line.netPay);
    }
  }
  return {
    people: lines.length,
    entered,
    gross: decimal(gross),
    employeeDeductions: decimal(employee),
    employerCost: decimal(employer),
    net: decimal(net),
    totalCost: decimal(gross + employer),
  };
}

/** Is the entered net more than a penny away from gross less the employee's lines? */
export function netMismatch(grossPay: string, items: readonly PayItem[], netPay: string): string | null {
  const diff = cents(netPay) - cents(expectedNet(grossPay, items));
  return Math.abs(diff) > 1 ? decimal(diff) : null;
}

/** Money in the workspace's currency, however that currency writes itself. */
export function formatMoney(amount: string | number | null | undefined, currency: string, locale = 'en-GB'): string {
  try {
    // The local symbol (₴, zł, €, $) rather than the ISO code — how people read their own money.
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(Number(amount ?? 0));
  } catch {
    return `${Number(amount ?? 0).toFixed(2)} ${currency}`;
  }
}
