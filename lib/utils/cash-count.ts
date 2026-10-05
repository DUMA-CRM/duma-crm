/**
 * Counting a till drawer: the notes and coins of a currency, their total, and
 * how a count compares with what the till expected. Pure, so the arithmetic
 * behind a close — which can't be reopened — is tested rather than trusted.
 *
 * Everything is in minor units (pence, cents) so a drawer of 2p coins adds up
 * exactly; it becomes a decimal only at the API boundary.
 */

export interface Denomination {
  /** Face value in minor units: 5000 for a £50 note, 2 for a 2p coin. */
  value: number;
  kind: 'note' | 'coin';
  label: string;
}

const coin = (value: number, suffix: string): Denomination => ({ value, kind: 'coin', label: `${value}${suffix}` });

function build(symbol: string, notes: number[], bigCoins: number[], coins: number[], suffix: string): Denomination[] {
  return [
    ...notes.map((value) => ({ value: value * 100, kind: 'note' as const, label: `${symbol}${value}` })),
    ...bigCoins.map((value) => ({ value: value * 100, kind: 'coin' as const, label: `${symbol}${value}` })),
    ...coins.map((value) => coin(value, suffix)),
  ];
}

const DENOMINATIONS: Record<string, Denomination[]> = {
  GBP: build('£', [50, 20, 10, 5], [2, 1], [50, 20, 10, 5, 2, 1], 'p'),
  EUR: build('€', [200, 100, 50, 20, 10, 5], [2, 1], [50, 20, 10, 5, 2, 1], 'c'),
  USD: build('$', [100, 50, 20, 10, 5, 1], [], [25, 10, 5, 1], '¢'),
};

/** The notes and coins to count for a currency, largest first; null when we don't know them (enter a total instead). */
export function denominationsFor(currency: string): Denomination[] | null {
  return DENOMINATIONS[currency.toUpperCase()] ?? null;
}

/** How many of each denomination, keyed by face value in minor units. */
export type Counts = Record<number, number>;

/** The drawer's total, in minor units. Ignores blanks and anything that isn't a whole, non-negative count. */
export function countMinor(counts: Counts): number {
  return Object.entries(counts).reduce((sum, [value, quantity]) => {
    const pieces = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
    return sum + Number(value) * pieces;
  }, 0);
}

/**
 * A typed amount as minor units: "123.45", "£1,234.5", " 20 " — or null when
 * it isn't a non-negative amount with at most two decimal places.
 */
export function parseMinor(text: string): number | null {
  const cleaned = text.replace(/[\s,£€$]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** A decimal amount from the API ("100.00") as minor units. */
export function toMinor(amount: string | number | null | undefined): number {
  return Math.round((Number(amount ?? 0) || 0) * 100);
}

/**
 * Any difference at or above this, either way, needs a note before the day
 * closes — the habit Toast enforces. Below it, a coin miscounted isn't worth
 * the friction. In minor units: £1.00.
 */
export const EXPLAIN_FROM_MINOR = 100;

export type Balance = 'balanced' | 'over' | 'short';

/** Counted against expected: balanced to the penny, over (a surplus) or short. */
export function balanceOf(countedMinor: number, expectedMinor: number): { balance: Balance; difference: number } {
  const difference = countedMinor - expectedMinor;
  return { balance: difference === 0 ? 'balanced' : difference > 0 ? 'over' : 'short', difference };
}

/** True when a difference is big enough that the close needs an explanation. */
export function needsExplanation(...differences: number[]): boolean {
  return differences.some((difference) => Math.abs(difference) >= EXPLAIN_FROM_MINOR);
}
