/**
 * The one place margin is calculated.
 *
 * It used to be three places — the recipe editor, the menu profitability report
 * and the top-items report each did `price - cogs`, which ignores VAT. On a
 * VAT-registered tenant with tax-inclusive prices that overstates margin by the
 * whole VAT fraction: a £3.20 flat white costing £0.60 showed £2.60 margin when
 * the business actually keeps £2.67 of the price and so earns £2.07.
 *
 * The VAT arithmetic mirrors the API's order pipeline (duma-api
 * src/lib/order-tax.ts `calculateOrderLineTax`) exactly — same cents rounding,
 * same inclusive/exclusive branch, and the same `vatRegistered` rule: an
 * unregistered business extracts no VAT and keeps the entire price — so a
 * margin shown here reconciles with the tax the till records.
 *
 * (This used to describe a deliberate divergence: the API extracted VAT even
 * for unregistered tenants. The API now honours `vatRegistered` too, so the two
 * agree; verified against duma-api on 2026-11-24.)
 */
import type { TradingSettings } from '@/lib/modules/organization/client';

/** Tenant-level tax posture. */
export interface VatContext {
  /** True when displayed prices already contain VAT (the default). */
  pricesIncludeTax: boolean;
  /** Fallback rate as a percentage, e.g. 20 for 20%. */
  defaultVatRate: number;
  /** When false there is no VAT to account for at all. */
  vatRegistered: boolean;
}

/**
 * What to assume before trading settings have loaded. Matches the API's own
 * fallbacks, except that an unknown `vatRegistered` is taken as false. Not registered means
 * no VAT is deducted, so an unloaded state never invents a cost.
 */
export const DEFAULT_VAT_CONTEXT: VatContext = {
  pricesIncludeTax: true,
  defaultVatRate: 20,
  vatRegistered: false,
};

/** Narrow the trading-settings payload to just the tax posture. */
/**
 * Narrowed to the three fields it reads, not the whole settings record.
 *
 * VAT context has nothing to do with payroll schedules or receipt footers, and
 * taking the full type meant every caller — tests included — had to construct
 * fields this function never looks at.
 */
export function vatContextFrom(
  settings: Pick<TradingSettings, 'pricesIncludeTax' | 'defaultVatRate' | 'vatRegistered'> | null | undefined,
): VatContext {
  if (!settings) return DEFAULT_VAT_CONTEXT;
  return {
    // The API treats anything other than an explicit false as inclusive.
    pricesIncludeTax: settings.pricesIncludeTax !== false,
    defaultVatRate: Number(settings.defaultVatRate ?? 20) || 0,
    vatRegistered: settings.vatRegistered === true,
  };
}

/**
 * The rate that actually applies to one item: its own override, else the tenant
 * default, else nothing at all when the tenant is not VAT registered.
 */
export function effectiveVatRate(itemVatRate: string | number | null | undefined, ctx: VatContext): number {
  if (!ctx.vatRegistered) return 0;
  const own = itemVatRate == null || itemVatRate === '' ? null : Number(itemVatRate);
  const rate = own != null && Number.isFinite(own) ? own : ctx.defaultVatRate;
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

// Cents throughout, matching the API. Working in floats would drift a penny
// against the till on exactly the items people check by hand.
const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

/** The part of a recipe line the cost needs — `GET /menu-items/:id/recipe` and the batch read alike. */
export interface RecipeCostLine {
  quantity: string | number;
  /** Set on a size override, which replaces the default line rather than adding to it. */
  sizeModifierId?: string | null;
  stockItem?: { costPerUnit?: string | number | null } | null;
}

export interface RecipeCost {
  /** False when no default ingredients are linked — cost is unknown, not zero. */
  hasRecipe: boolean;
  /** True only when every default ingredient carries a cost, so the total can be trusted. */
  costComplete: boolean;
  /** Ingredient cost of one default serving; null unless `costComplete`. */
  cost: number | null;
}

/**
 * What one serving costs in ingredients, from its recipe — the one place a
 * plate is costed, for the menu's Profit view and the profit reports alike.
 *
 * Only the default lines count: size overrides are alternatives to them, not
 * additions. A recipe with any uncosted ingredient has no cost at all rather
 * than a flattering partial one. The sum is trimmed to a millionth so float
 * artefacts (0.30000000000000004) never reach a comparison; `computeCosting`
 * rounds to the penny.
 */
export function recipeCost(lines: readonly RecipeCostLine[] | null | undefined): RecipeCost {
  const defaults = (lines ?? []).filter((line) => line.sizeModifierId == null);
  const hasRecipe = defaults.length > 0;
  const costComplete = hasRecipe && defaults.every((line) => line.stockItem?.costPerUnit != null);
  if (!costComplete) return { hasRecipe, costComplete, cost: null };
  const sum = defaults.reduce((total, line) => total + (Number(line.quantity) || 0) * (Number(line.stockItem?.costPerUnit) || 0), 0);
  return { hasRecipe, costComplete, cost: Math.round(sum * 1_000_000) / 1_000_000 };
}

export interface Costing {
  /** The price as configured on the menu item (plus any modifier adjustments). */
  price: number;
  /** VAT contained in the price, or added on top when prices exclude tax. */
  vat: number;
  /** What the customer actually pays. Differs from `price` only when prices exclude tax. */
  grossCharged: number;
  /** What the business keeps before ingredients — the honest basis for margin. */
  netRevenue: number;
  /** Ingredient cost. */
  cogs: number;
  /** netRevenue − cogs. */
  margin: number;
  /** Margin as a percentage of net revenue. Zero when there is no revenue. */
  marginPct: number;
  /** The rate applied, as a percentage. 0 when not VAT registered. */
  vatRate: number;
}

/**
 * Resolve one item (or one modifier combination) into its full cost picture.
 *
 * `price` is the sale price including any selected modifiers' adjustments; the
 * caller sums those, because which modifiers apply is a UI concern.
 */
export function computeCosting({
  price,
  cogs,
  itemVatRate,
  ctx,
}: {
  price: number;
  cogs: number;
  itemVatRate?: string | number | null;
  ctx: VatContext;
}): Costing {
  const vatRate = effectiveVatRate(itemVatRate, ctx);
  const priceCents = toCents(Number.isFinite(price) ? price : 0);

  // Identical branch to orders.ts: inclusive prices have VAT carved out of
  // them, exclusive prices have it added on top.
  const vatCents =
    vatRate <= 0
      ? 0
      : ctx.pricesIncludeTax
        ? Math.round((priceCents * vatRate) / (100 + vatRate))
        : Math.round((priceCents * vatRate) / 100);

  // Either way the business keeps the net amount; only the customer-facing
  // total changes between the two postures.
  const netCents = ctx.pricesIncludeTax ? priceCents - vatCents : priceCents;
  const grossCents = ctx.pricesIncludeTax ? priceCents : priceCents + vatCents;

  // Subtract in cents and convert once. Doing it the other way round leaves
  // artefacts like 29.700000000000003 that leak into comparisons.
  const cogsCents = toCents(Number.isFinite(cogs) ? cogs : 0);
  const netRevenue = fromCents(netCents);
  const margin = fromCents(netCents - cogsCents);

  return {
    price: fromCents(priceCents),
    vat: fromCents(vatCents),
    grossCharged: fromCents(grossCents),
    netRevenue,
    cogs: fromCents(cogsCents),
    margin,
    marginPct: netCents > 0 ? ((netCents - cogsCents) / netCents) * 100 : 0,
    vatRate,
  };
}
