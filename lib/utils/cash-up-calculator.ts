/**
 * The public cash-up calculator (/tools/cash-up-calculator). Counting the
 * drawer, and over / short, come from lib/utils/cash-count.ts — the arithmetic
 * DUMA's own till cash-up uses — so this file only adds what a paper cash-up
 * sheet does on top: cash paid out of the drawer, and what to bank.
 *
 * Everything is in minor units (pence), as in cash-count.ts.
 */

/**
 * What should be in the drawer: the float it started with, plus the cash the
 * till took, less cash paid out of it (milk from the shop, a window cleaner).
 * DUMA's cash-up expects float + cash sales; paid-outs are the paper sheet's
 * extra line, and are 0 when left blank.
 */
export function expectedCashMinor({
  floatMinor,
  cashSalesMinor,
  paidOutMinor = 0,
}: {
  floatMinor: number;
  cashSalesMinor: number;
  paidOutMinor?: number;
}): number {
  return floatMinor + cashSalesMinor - paidOutMinor;
}

/**
 * What goes to the bank: everything counted, less the float left in the
 * drawer for tomorrow. Never negative — a drawer holding less than the float
 * banks nothing, and tomorrow's float is short instead.
 */
export function bankingMinor(countedMinor: number, keepFloatMinor: number): number {
  return Math.max(0, countedMinor - keepFloatMinor);
}
