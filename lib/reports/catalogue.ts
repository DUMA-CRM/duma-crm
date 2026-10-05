import type { Capability } from '@/lib/auth/capabilities';

/**
 * Every report in the app, in one list. The library, the search, favourites
 * and the `/reports/[report]` route all read this — a report that is not here
 * does not exist, and one that is here cannot be missing from the library.
 *
 * Grouped the way Toast, Square and Lightspeed group theirs (2026-10-04
 * redesign): Sales, Payments & tax, Menu, Exceptions, Labour, Customers,
 * Inventory, Cash. Each names the capability its endpoints check, so a card
 * only shows to someone who can open it.
 */

export type ReportCategory = 'sales' | 'profit' | 'payments' | 'menu' | 'exceptions' | 'labour' | 'customers' | 'inventory' | 'cash';

export type ReportId =
  | 'sales-summary'
  | 'sales-by-hour'
  | 'sales-by-channel'
  | 'sales-by-location'
  | 'payment-methods'
  | 'vat'
  | 'item-sales'
  | 'menu-engineering'
  | 'refunds'
  | 'discounts-voids'
  | 'labour-vs-sales'
  | 'staff-hours'
  | 'customer-retention'
  | 'stock-usage'
  | 'waste'
  | 'purchasing'
  | 'end-of-day'
  | 'prime-cost';

export interface ReportDefinition {
  id: ReportId;
  category: ReportCategory;
  title: string;
  /** One line: the question it answers. */
  description: string;
  /** Any one of these opens it — what its endpoints enforce. */
  anyOf: Capability[];
  /** Ignores the location filter (the API has no location scope for it). */
  allLocationsOnly?: boolean;
  /** Ignores the comparison (a list of events rather than a total). */
  noComparison?: boolean;
  /** Search terms beyond the title. */
  keywords?: string[];
}

export const REPORT_CATEGORIES: { id: ReportCategory; label: string; description: string }[] = [
  { id: 'sales', label: 'Sales', description: 'What you took, when, and through which channel.' },
  { id: 'profit', label: 'Profit', description: 'What was left after food and labour.' },
  { id: 'payments', label: 'Payments & tax', description: 'How customers paid, and the VAT in your sales.' },
  { id: 'menu', label: 'Menu', description: 'What sold, and what it earned you.' },
  { id: 'exceptions', label: 'Refunds & exceptions', description: 'Money given back, discounted or voided.' },
  { id: 'labour', label: 'Labour', description: 'What your team cost against what they sold.' },
  { id: 'customers', label: 'Customers', description: 'Who came back.' },
  { id: 'inventory', label: 'Inventory', description: 'Stock used, wasted and bought.' },
  { id: 'cash', label: 'Cash & end of day', description: 'Each day’s close, and whether the till balanced.' },
];

export const REPORTS: ReportDefinition[] = [
  {
    id: 'sales-summary',
    category: 'sales',
    title: 'Sales summary',
    description: 'Gross and net sales, refunds, orders and average order, day by day.',
    anyOf: ['analytics:read'],
    keywords: ['revenue', 'takings', 'daily', 'net', 'gross', 'average order', 'aov'],
  },
  {
    id: 'sales-by-hour',
    category: 'sales',
    title: 'Sales by hour',
    description: 'When in the day you trade — for building the rota.',
    anyOf: ['analytics:read'],
    keywords: ['hourly', 'peak', 'busy', 'daypart'],
  },
  {
    id: 'sales-by-channel',
    category: 'sales',
    title: 'Sales by channel',
    description: 'Till, QR code and mobile orders side by side.',
    anyOf: ['analytics:read'],
    keywords: ['source', 'pos', 'qr', 'online', 'mobile'],
  },
  {
    id: 'sales-by-location',
    category: 'sales',
    title: 'Sales by location',
    description: 'Each site’s sales, orders and refunds.',
    anyOf: ['analytics:read'],
    allLocationsOnly: true,
    keywords: ['site', 'branch', 'store'],
  },
  {
    id: 'prime-cost',
    category: 'profit',
    title: 'Prime cost',
    description: 'Food and labour as a share of sales — the number a restaurant runs on.',
    // Recipes need `recipes:read` too; without it the report says items are uncosted.
    anyOf: ['analytics:read'],
    keywords: ['profit', 'gross profit', 'gp', 'food cost', 'cogs', 'labour', 'margin', 'p&l', 'cost of sales'],
  },
  {
    id: 'payment-methods',
    category: 'payments',
    title: 'Payment methods',
    description: 'Card, cash and other tenders, net of refunds.',
    anyOf: ['analytics:read'],
    keywords: ['card', 'cash', 'tender', 'settlement'],
  },
  {
    id: 'vat',
    category: 'payments',
    title: 'VAT',
    description: 'VAT charged, split by rate — for your return.',
    anyOf: ['analytics:read'],
    keywords: ['tax', 'hmrc', 'vat return', 'rate'],
  },
  {
    id: 'item-sales',
    category: 'menu',
    title: 'Item & category sales',
    description: 'Units and sales for every item and menu category.',
    anyOf: ['analytics:read'],
    keywords: ['product mix', 'pmix', 'top items', 'best sellers', 'category'],
  },
  {
    id: 'menu-engineering',
    category: 'menu',
    title: 'Menu engineering',
    description: 'Margin against popularity: stars, workhorses, opportunities.',
    anyOf: ['analytics:read'],
    keywords: ['margin', 'profit', 'profitability', 'gp', 'cost', 'cogs', 'contribution'],
  },
  {
    id: 'refunds',
    category: 'exceptions',
    title: 'Refunds',
    description: 'Every refund, its reason and who gave it.',
    anyOf: ['orders:refund'],
    noComparison: true,
    keywords: ['returns', 'money back'],
  },
  {
    id: 'discounts-voids',
    category: 'exceptions',
    title: 'Discounts & voids',
    description: 'Discounts given and orders voided, by reason.',
    anyOf: ['analytics:read'],
    keywords: ['comps', 'cancelled', 'void', 'promotion', 'markdown', 'loyalty'],
  },
  {
    id: 'labour-vs-sales',
    category: 'labour',
    title: 'Labour vs sales',
    description: 'Labour cost, labour %, and sales per labour hour.',
    anyOf: ['analytics:read'],
    keywords: ['wages', 'staff cost', 'splh', 'labour percentage'],
  },
  {
    id: 'staff-hours',
    category: 'labour',
    title: 'Staff hours',
    description: 'Hours and shifts worked by each person.',
    anyOf: ['analytics:read'],
    keywords: ['timesheet', 'hours worked', 'shifts'],
  },
  {
    id: 'customer-retention',
    category: 'customers',
    title: 'Customer retention',
    description: 'New and returning customers, and the repeat rate.',
    anyOf: ['analytics:read'],
    keywords: ['repeat', 'loyalty', 'returning', 'new customers'],
  },
  {
    id: 'stock-usage',
    category: 'inventory',
    title: 'Stock usage',
    description: 'What was used, received and adjusted, item by item.',
    anyOf: ['analytics:read'],
    keywords: ['consumption', 'movements', 'cogs'],
  },
  {
    id: 'waste',
    category: 'inventory',
    title: 'Waste & loss',
    description: 'Stock written off, by reason and item.',
    anyOf: ['loss:read'],
    noComparison: true,
    keywords: ['wastage', 'shrinkage', 'expiry', 'damage', 'theft'],
  },
  {
    id: 'purchasing',
    category: 'inventory',
    title: 'Purchasing',
    description: 'Purchase orders raised and received, by supplier.',
    anyOf: ['purchasing:read'],
    noComparison: true,
    keywords: ['purchase orders', 'suppliers', 'po', 'spend'],
  },
  {
    id: 'end-of-day',
    category: 'cash',
    title: 'End of day',
    description: 'Each day’s cash-up: expected against counted, cash and card.',
    anyOf: ['cashups:read'],
    noComparison: true,
    keywords: ['z report', 'z read', 'cash up', 'till', 'drawer', 'over short', 'float'],
  },
];

export const REPORT_IDS = new Set<string>(REPORTS.map((report) => report.id));

export function findReport(id: string): ReportDefinition | undefined {
  return REPORTS.find((report) => report.id === id);
}

/** Old `/reports/...` paths, kept as links that still land somewhere true. */
export const LEGACY_REPORT_PATHS: Record<string, ReportId | null> = {
  revenue: 'sales-summary',
  orders: 'sales-summary',
  average: 'sales-summary',
  compare: 'sales-summary',
  retention: 'customer-retention',
  labour: 'labour-vs-sales',
  inventory: 'stock-usage',
  purchasing: 'purchasing',
  profitability: 'menu-engineering',
  'top-items': 'item-sales',
  library: null,
};

/** Search by title, description, category and keywords — every word must match somewhere. */
export function searchReports(reports: ReportDefinition[], query: string): ReportDefinition[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return reports;
  return reports.filter((report) => {
    const category = REPORT_CATEGORIES.find((entry) => entry.id === report.category)?.label ?? '';
    const haystack = [report.title, report.description, category, ...(report.keywords ?? [])].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
