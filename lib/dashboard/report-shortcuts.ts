import { type CapabilitySource, hasAnyCapability } from '../auth/capabilities.ts';
import { REPORTS, type ReportDefinition, type ReportId } from '../reports/catalogue.ts';

/**
 * The reports a manager opens most, most useful first. Only reports that apply
 * to every workspace: the ones Reports hides by context (one location, one
 * channel, not VAT registered, no recipes, no website) are left out, because
 * the dashboard doesn't load that context and a shortcut to a report that
 * says nothing is worse than none.
 */
export const SHORTCUT_ORDER: readonly ReportId[] = [
  'sales-summary',
  'end-of-day',
  'labour-vs-sales',
  'item-sales',
  'payment-methods',
  'refunds',
  'waste',
  'purchasing',
  'staff-hours',
  'customer-retention',
  'sales-by-hour',
  'discounts-voids',
];

export const SHORTCUTS_SHOWN = 5;

/**
 * The viewer's report shortcuts: their starred reports first, then the rest of
 * `SHORTCUT_ORDER`, each only if they hold one of its capabilities — the same
 * rule the Reports library shows a report by.
 */
export function reportShortcuts(
  capabilities: CapabilitySource,
  starred: readonly string[] = [],
  limit = SHORTCUTS_SHOWN,
): ReportDefinition[] {
  const open = (report: ReportDefinition) => hasAnyCapability(capabilities, ...report.anyOf);
  const byId = new Map(REPORTS.map((report) => [report.id as string, report]));
  const picked: ReportDefinition[] = [];
  for (const id of [...starred, ...SHORTCUT_ORDER]) {
    const report = byId.get(id);
    if (report && open(report) && !picked.includes(report)) picked.push(report);
    if (picked.length >= limit) break;
  }
  return picked;
}
