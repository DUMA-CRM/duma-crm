// ---------------------------------------------------------------------------
// Stocktake arithmetic: reading a typed count, what a difference means, and
// the summary a manager checks before applying. Pure and tested.
// ---------------------------------------------------------------------------

/**
 * A typed count as the API will take it (duma-api stocktakes: 0–999999, two
 * decimals): a number, null for blank ("not counted"), or 'invalid'.
 */
export function parseCount(value: string): number | null | 'invalid' {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid';
  const n = Number(trimmed);
  return n > 999_999 ? 'invalid' : n;
}

export type VarianceTone = 'match' | 'over' | 'short';

export interface Variance {
  delta: number;
  tone: VarianceTone;
  /** More than 10% out, or stock found where none was expected — worth a recount. */
  large: boolean;
}

export function variance(expected: number, counted: number): Variance {
  const delta = Math.round((counted - expected) * 100) / 100;
  const tone: VarianceTone = delta === 0 ? 'match' : delta > 0 ? 'over' : 'short';
  const large = delta !== 0 && (expected === 0 || Math.abs(delta) / expected > 0.1);
  return { delta, tone, large };
}

/** A quantity without trailing zeros: 12, 0.5, 1.25. */
export const formatQty = (n: number) => String(Math.round(n * 100) / 100);

/** "+2", "−0.5", "0" — a real minus sign so columns of differences read cleanly. */
export const formatDelta = (n: number) => (n > 0 ? `+${formatQty(n)}` : n < 0 ? `−${formatQty(-n)}` : '0');

export interface CountLine {
  stockItemId: string;
  expected: number;
  /** null when not counted yet. */
  counted: number | null;
  /** Last known cost per unit, when the item has one. */
  cost?: number | null;
}

export interface StocktakeSummary {
  total: number;
  counted: number;
  uncounted: number;
  matched: number;
  over: number;
  short: number;
  /** Counted lines that differ from expected. */
  differences: number;
  /** Value of all differences in pence, over only the lines with a known cost. */
  valuePence: number;
  /** Differing lines with no cost, so the value is a floor rather than the whole. */
  unpriced: number;
}

export function summarise(lines: CountLine[]): StocktakeSummary {
  const summary: StocktakeSummary = { total: lines.length, counted: 0, uncounted: 0, matched: 0, over: 0, short: 0, differences: 0, valuePence: 0, unpriced: 0 };
  for (const line of lines) {
    if (line.counted === null) {
      summary.uncounted += 1;
      continue;
    }
    summary.counted += 1;
    const { delta, tone } = variance(line.expected, line.counted);
    if (tone === 'match') {
      summary.matched += 1;
      continue;
    }
    summary[tone] += 1;
    summary.differences += 1;
    if (line.cost == null || !Number.isFinite(line.cost)) summary.unpriced += 1;
    else summary.valuePence += Math.round(delta * line.cost * 100);
  }
  return summary;
}

export type CountView = 'all' | 'todo' | 'counted' | 'differences';

export function inView(view: CountView, expected: number, counted: number | null): boolean {
  if (view === 'all') return true;
  if (view === 'todo') return counted === null;
  if (counted === null) return false;
  return view === 'counted' || variance(expected, counted).tone !== 'match';
}

/** Differences worst first — by value where known, then by relative size. */
export function byImpact<T extends CountLine>(lines: T[]): T[] {
  const weight = (line: T) => {
    if (line.counted === null) return -1;
    const { delta } = variance(line.expected, line.counted);
    if (line.cost != null) return Math.abs(delta * line.cost) + 1e6;
    return line.expected > 0 ? Math.abs(delta) / line.expected : Math.abs(delta);
  };
  return [...lines].sort((a, b) => weight(b) - weight(a));
}

/** "42 min", "1 h 5 min" — how long a count took. Null when it has no end. */
export function countDuration(startedAt: string, endedAt?: string | null): string | null {
  if (!endedAt) return null;
  const minutes = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
