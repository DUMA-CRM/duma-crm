/**
 * Menu engineering: each item placed by popularity (units sold) against
 * profitability (margin %), split at the medians — the Kasavana–Smith matrix
 * every menu-engineering tool uses. Items without a costed recipe have no
 * margin and are left out of the matrix rather than placed as if free to make.
 *
 * Moved here from `TopItemsReportPage` (2026-10-04) so it is tested.
 */

export type MenuQuadrant = 'star' | 'workhorse' | 'opportunity' | 'low';

export const QUADRANT: Record<MenuQuadrant, { label: string; advice: string }> = {
  star: { label: 'Stars', advice: 'Popular and profitable — keep them prominent.' },
  workhorse: { label: 'Workhorses', advice: 'Popular, thinner margin — check the cost or the price.' },
  opportunity: { label: 'Opportunities', advice: 'Profitable but slow — promote them or move them up the menu.' },
  low: { label: 'Low performers', advice: 'Neither — rework or retire them.' },
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export interface EngineeringInput {
  units: number;
  /** Margin %, or null when the item has no complete recipe cost. */
  margin: number | null;
}

/** Each costed item's quadrant, by index; uncosted items map to null. */
export function classifyMenu<T extends EngineeringInput>(
  items: T[],
): { quadrants: (MenuQuadrant | null)[]; medianUnits: number; medianMargin: number } {
  const costed = items.filter((item) => item.margin !== null);
  const medianUnits = median(costed.map((item) => item.units));
  const medianMargin = median(costed.map((item) => item.margin as number));
  const quadrants = items.map((item) => {
    if (item.margin === null) return null;
    const popular = item.units >= medianUnits;
    const profitable = item.margin >= medianMargin;
    return popular ? (profitable ? 'star' : 'workhorse') : profitable ? 'opportunity' : 'low';
  });
  return { quadrants, medianUnits, medianMargin };
}
