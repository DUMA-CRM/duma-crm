import { type VatContext, computeCosting } from '../menu/costing.ts';

/**
 * The public menu margin calculator (/tools/margin-calculator). Margin itself
 * is never worked out here — lib/menu/costing.ts is the one place it is — so
 * the free tool gives exactly the figure the product shows on a recipe. This
 * file only turns what a visitor types into numbers, and searches for a price
 * using computeCosting as the judge.
 */

/**
 * A money amount as typed: "3.20", "£3.20", " 3 ", "0.125". Commas are read
 * as thousands separators ("1,250.00"). Empty, negative or unreadable input
 * is `null`, so the calculator can tell "not entered" from "zero".
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[£\s,]/g, '');
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Total ingredient cost of a recipe, ignoring lines left blank. */
export function recipeCost(lines: readonly { cost: string }[]): number {
  // Sum in tenths of a penny: ingredient costs are often fractions of a penny
  // (0.125 for a gram of something), and floats would drift on long recipes.
  const milli = lines.reduce((sum, line) => sum + Math.round((parseAmount(line.cost) ?? 0) * 1000), 0);
  return milli / 1000;
}

/** A price rounded up to the next step in pence (10 → £2.41 becomes £2.50), so the margin it reaches is kept. */
export function roundUpPrice(price: number, stepPence: number): number {
  const cents = Math.round(price * 100);
  return (Math.ceil(cents / stepPence) * stepPence) / 100;
}

/**
 * Food cost as a percentage of what the business keeps from the price (net of
 * VAT): the complement of costing.ts's margin. `null` when there is no net
 * revenue to divide by.
 */
export function foodCostPct(costing: { netRevenue: number; marginPct: number }): number | null {
  return costing.netRevenue > 0 ? 100 - costing.marginPct : null;
}

/**
 * The lowest menu price, to the penny, whose margin (as costing.ts works it
 * out, VAT included) reaches `targetPct`. The price is in the same posture as
 * the menu: VAT-inclusive when `ctx.pricesIncludeTax`, otherwise before VAT.
 *
 * `null` when no price can do it: a target of 100% or more with any ingredient
 * cost, or a target below zero. A recipe that costs nothing reaches any target
 * below 100% at any price, so the answer is the lowest price, 1p.
 */
export function priceForTargetMargin({
  cogs,
  targetPct,
  itemVatRate,
  ctx,
}: {
  cogs: number;
  targetPct: number;
  itemVatRate?: string | number | null;
  ctx: VatContext;
}): number | null {
  if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct >= 100 || !Number.isFinite(cogs) || cogs < 0) return null;

  const reaches = (cents: number) => computeCosting({ price: cents / 100, cogs, itemVatRate, ctx }).marginPct >= targetPct;
  const vatRate = computeCosting({ price: 1, cogs: 0, itemVatRate, ctx }).vatRate;

  // A first guess from the algebra, then walk to the exact penny with
  // computeCosting itself, so its cents rounding has the final word.
  const net = cogs / (1 - targetPct / 100);
  const guess = ctx.pricesIncludeTax ? net * (1 + vatRate / 100) : net;
  let cents = Math.max(1, Math.round(guess * 100));

  while (cents > 1 && reaches(cents - 1)) cents -= 1;
  // Bounded: rounding moves the answer by a few pence at most.
  for (let step = 0; step < 1000 && !reaches(cents); step += 1) cents += 1;
  return reaches(cents) ? cents / 100 : null;
}
