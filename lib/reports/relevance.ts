import type { ReportDefinition, ReportId } from './catalogue.ts';

/**
 * Which reports this workspace has any use for. Capabilities decide who *may*
 * open a report (`anyOf` in the catalogue); this decides whether it would say
 * anything: no Sales by location with one site, no Staff hours without the
 * rota, no Menu engineering for a shop with no recipes.
 *
 * Anything not yet known (modules still loading, trading settings not
 * readable) counts as relevant — hiding a report someone needs is worse than
 * showing one they don't.
 */
export interface ReportContext {
  /** Enabled module ids; null while loading. */
  modules: ReadonlySet<string> | null;
  /** Locations this person can report on. */
  locationCount: number;
  /** Food and drink with recipes — not a shop selling products only. */
  kitchen: boolean;
  /** From trading settings; undefined when unknown. */
  vatRegistered?: boolean;
  /** Distinct order channels: those switched on, plus any sold through in the period. */
  channels: number;
}

export interface Relevance {
  relevant: boolean;
  /** Why not, in a phrase that finishes "Hidden because …". */
  reason?: string;
}

const yes: Relevance = { relevant: true };
const no = (reason: string): Relevance => ({ relevant: false, reason });

/** Order channels a module switches on. Manual CRM orders don't count — every workspace has them. */
const CHANNEL_MODULES: Record<string, string> = { pos: 'pos', 'qr-ordering': 'qr_code' };

/** How many ways a workspace takes orders: its channel modules, joined with what it actually sold through. */
export function channelCount(modules: ReadonlySet<string> | null, observedSources: ReadonlyArray<string | null | undefined>): number {
  const channels = new Set<string>();
  for (const [module, source] of Object.entries(CHANNEL_MODULES)) if (modules?.has(module)) channels.add(source);
  for (const source of observedSources) if (source) channels.add(source);
  return channels.size;
}

export function reportRelevance(id: ReportId, context: ReportContext): Relevance {
  const on = (module: string) => context.modules === null || context.modules.has(module);
  switch (id) {
    case 'sales-by-location':
      return context.locationCount > 1 ? yes : no('there is one location');
    case 'sales-by-channel':
      return context.channels > 1 ? yes : no('orders come through one channel');
    case 'vat':
      return context.vatRegistered === false ? no('the business isn’t VAT registered') : yes;
    case 'menu-engineering':
      if (!context.kitchen) return no('products have no recipes');
      return on('inventory') ? yes : no('Inventory is off, so there are no recipe costs');
    case 'prime-cost':
      if (!context.kitchen) return no('products have no recipes');
      if (!on('inventory')) return no('Inventory is off, so there are no food costs');
      return on('workforce') ? yes : no('Rota is off, so there is no labour cost');
    case 'labour-vs-sales':
    case 'staff-hours':
      return on('workforce') ? yes : no('Rota is off');
    case 'customer-retention':
      return on('customers') ? yes : no('Customers is off');
    case 'stock-usage':
    case 'waste':
      return on('inventory') ? yes : no('Inventory is off');
    case 'purchasing':
      return on('purchasing') ? yes : no('Purchasing is off');
    case 'end-of-day':
      if (!on('pos')) return no('there is no till to cash up');
      return on('payments') ? yes : no('Payments is off');
    default:
      return yes;
  }
}

/** The reports worth showing, and the ones set aside with why. */
export function splitReports<T extends Pick<ReportDefinition, 'id'>>(
  reports: readonly T[],
  context: ReportContext,
): { shown: T[]; hidden: Array<{ report: T; reason: string }> } {
  const shown: T[] = [];
  const hidden: Array<{ report: T; reason: string }> = [];
  for (const report of reports) {
    const relevance = reportRelevance(report.id, context);
    if (relevance.relevant) shown.push(report);
    else hidden.push({ report, reason: relevance.reason! });
  }
  return { shown, hidden };
}
