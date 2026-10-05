/**
 * Targets and prime cost for the reports: how a period did against the sites'
 * daily sales targets, and what was left after food and labour. Pure, so the
 * figures a manager steers by are tested rather than eyeballed.
 */

// ── Targets ──────────────────────────────────────────────────────────────────

export interface TargetSite {
  id: string;
  isActive?: boolean;
  /** Net sales a site aims for in a trading day, as the API serialises it. */
  dailyRevenueTarget?: string | number | null;
}

export interface PeriodTarget {
  /** The daily target across the sites in scope. */
  daily: number;
  /** Sites in scope that have a target, and that don't. */
  sites: number;
  missing: number;
}

/**
 * The daily target for the report's scope: one site's, or the sum of every
 * active site's. Null when no site in scope has one — a target nobody set is
 * not a target of zero.
 */
export function periodTarget(locations: TargetSite[], locationId: string): PeriodTarget | null {
  const scope = locationId ? locations.filter((site) => site.id === locationId) : locations.filter((site) => site.isActive !== false);
  const targets = scope.map((site) => Number(site.dailyRevenueTarget)).filter((value) => Number.isFinite(value) && value > 0);
  if (targets.length === 0) return null;
  return { daily: targets.reduce((sum, value) => sum + value, 0), sites: targets.length, missing: scope.length - targets.length };
}

/** Days that met the target, of the days that have happened — a day still to come can't have missed. */
export function targetDays(days: { date: string; value: number }[], daily: number, todayKey: string): { hit: number; of: number } {
  const past = days.filter((day) => day.date.slice(0, 10) <= todayKey);
  return { hit: past.filter((day) => day.value >= daily).length, of: past.length };
}

// ── Prime cost ───────────────────────────────────────────────────────────────

export interface ProfitInput {
  /** All net sales in the period, VAT excluded. */
  salesExVat: number;
  /** The part of those sales whose items have a fully costed recipe. */
  costedSalesExVat: number;
  /** What the ingredients of those costed sales cost. */
  costedCost: number;
  /** Estimated labour cost; null when it couldn't be read. */
  labour: number | null;
}

export interface ProfitSummary {
  salesExVat: number;
  /** Food cost for all sales, scaled from the costed share at the costed rate. */
  foodCost: number;
  foodCostPct: number;
  grossProfit: number;
  labour: number | null;
  labourPct: number | null;
  /** Food plus labour — the number a restaurant is run on. */
  primeCost: number | null;
  primeCostPct: number | null;
  /** Share of sales the food cost is measured on (0–1). Below ~0.6 the estimate is shaky. */
  coverage: number;
}

/**
 * Sales, food cost, gross profit, labour and prime cost for a period. Food cost
 * is measured on the items with costed recipes and applied to all sales at that
 * rate — honest only as far as `coverage` reaches, which is why it's returned.
 */
export function profitSummary(input: ProfitInput): ProfitSummary | null {
  const { salesExVat, costedSalesExVat, costedCost, labour } = input;
  if (!(salesExVat > 0) || !(costedSalesExVat > 0)) return null;
  const foodCostPct = costedCost / costedSalesExVat;
  const foodCost = foodCostPct * salesExVat;
  const primeCost = labour === null ? null : foodCost + labour;
  return {
    salesExVat,
    foodCost,
    foodCostPct,
    grossProfit: salesExVat - foodCost,
    labour,
    labourPct: labour === null ? null : labour / salesExVat,
    primeCost,
    primeCostPct: primeCost === null ? null : primeCost / salesExVat,
    coverage: Math.min(1, costedSalesExVat / salesExVat),
  };
}

export type PrimeCostBand = 'healthy' | 'watch' | 'high';

/** The industry rule of thumb: at or under 60% is healthy, up to 65% worth watching, above that too high. */
export function primeCostBand(pct: number): PrimeCostBand {
  return pct <= 0.6 ? 'healthy' : pct <= 0.65 ? 'watch' : 'high';
}
