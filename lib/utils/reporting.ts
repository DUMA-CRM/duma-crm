import type { CustomerRetention, DailyOrderAnalytics, OrderAnalytics } from '@/lib/api/analytics.service';

import { formatCompact, formatMoney, orderMetrics, percentageChange } from './dashboard';

export type ReportMetricUnit = 'money' | 'count' | 'percent' | 'money-precise';

export type ReportMetricKey =
  | 'netRevenue'
  | 'orders'
  | 'averageOrderValue'
  | 'completedOrders'
  | 'completionRate'
  | 'cancelledOrders'
  | 'cancellationRate'
  | 'knownCustomers'
  | 'newCustomers'
  | 'returningCustomers'
  | 'repeatRate'
  | 'posOrders'
  | 'mobileOrders'
  | 'posValue'
  | 'mobileValue';

export interface ReportMetricDefinition {
  key: ReportMetricKey;
  label: string;
  shortLabel: string;
  description: string;
  unit: ReportMetricUnit;
  category: 'Sales' | 'Operations' | 'Customers' | 'Channels';
  lowerIsBetter?: boolean;
  hasDailySeries?: boolean;
}

export const REPORT_METRICS: ReportMetricDefinition[] = [
  {
    key: 'netRevenue',
    label: 'Net revenue',
    shortLabel: 'Revenue',
    description: 'Non-cancelled sales less item and modifier refunds attributed to the original sale date.',
    unit: 'money',
    category: 'Sales',
    hasDailySeries: true,
  },
  {
    key: 'orders',
    label: 'Non-cancelled orders',
    shortLabel: 'Orders',
    description: 'All orders in the period except orders currently marked cancelled.',
    unit: 'count',
    category: 'Sales',
    hasDailySeries: true,
  },
  {
    key: 'averageOrderValue',
    label: 'Average order value',
    shortLabel: 'Avg order',
    description: 'Refund-adjusted net revenue divided by non-cancelled orders.',
    unit: 'money-precise',
    category: 'Sales',
    hasDailySeries: true,
  },
  {
    key: 'completedOrders',
    label: 'Completed orders',
    shortLabel: 'Completed',
    description: 'Orders currently in the done state.',
    unit: 'count',
    category: 'Operations',
  },
  {
    key: 'completionRate',
    label: 'Completion rate',
    shortLabel: 'Completion',
    description: 'Completed orders as a share of all non-cancelled orders.',
    unit: 'percent',
    category: 'Operations',
  },
  {
    key: 'cancelledOrders',
    label: 'Cancelled orders',
    shortLabel: 'Cancelled',
    description: 'Orders currently marked cancelled.',
    unit: 'count',
    category: 'Operations',
    lowerIsBetter: true,
  },
  {
    key: 'cancellationRate',
    label: 'Cancellation rate',
    shortLabel: 'Cancellation',
    description: 'Cancelled orders as a share of all recorded orders.',
    unit: 'percent',
    category: 'Operations',
    lowerIsBetter: true,
  },
  {
    key: 'knownCustomers',
    label: 'Known customers',
    shortLabel: 'Known customers',
    description: 'Identified customers with at least one order in the period.',
    unit: 'count',
    category: 'Customers',
  },
  {
    key: 'newCustomers',
    label: 'New customers',
    shortLabel: 'New customers',
    description: 'Known customers whose first-ever order falls in the period.',
    unit: 'count',
    category: 'Customers',
  },
  {
    key: 'returningCustomers',
    label: 'Returning customers',
    shortLabel: 'Returning',
    description: 'Known customers whose first-ever order predates the period.',
    unit: 'count',
    category: 'Customers',
  },
  {
    key: 'repeatRate',
    label: 'Returning-customer rate',
    shortLabel: 'Repeat rate',
    description: 'Returning customers as a share of known customers ordering in the period.',
    unit: 'percent',
    category: 'Customers',
  },
  {
    key: 'posOrders',
    label: 'POS orders',
    shortLabel: 'POS orders',
    description: 'Recorded orders created through the POS channel.',
    unit: 'count',
    category: 'Channels',
  },
  {
    key: 'mobileOrders',
    label: 'Mobile orders',
    shortLabel: 'Mobile orders',
    description: 'Recorded orders created through the mobile channel.',
    unit: 'count',
    category: 'Channels',
  },
  {
    key: 'posValue',
    label: 'POS recorded value',
    shortLabel: 'POS value',
    description: 'Recorded order value attributed to POS orders, including any subsequently cancelled orders.',
    unit: 'money',
    category: 'Channels',
  },
  {
    key: 'mobileValue',
    label: 'Mobile recorded value',
    shortLabel: 'Mobile value',
    description: 'Recorded order value attributed to mobile orders, including any subsequently cancelled orders.',
    unit: 'money',
    category: 'Channels',
  },
];

export const REPORT_METRIC_MAP = Object.fromEntries(REPORT_METRICS.map((metric) => [metric.key, metric])) as Record<
  ReportMetricKey,
  ReportMetricDefinition
>;

export interface ReportSnapshot {
  values: Record<ReportMetricKey, number>;
}

const statusCount = (data: OrderAnalytics | undefined, status: string) =>
  Number(data?.byStatus.find((row) => row.status === status)?.count ?? 0);

const sourceRow = (data: OrderAnalytics | undefined, source: string) => data?.bySource.find((row) => row.source === source);

export function buildReportSnapshot(orders?: OrderAnalytics, retention?: CustomerRetention): ReportSnapshot {
  const trusted = orderMetrics(orders);
  const completedOrders = statusCount(orders, 'done');
  const pos = sourceRow(orders, 'pos');
  const mobile = sourceRow(orders, 'mobile');

  return {
    values: {
      netRevenue: trusted.revenue,
      orders: trusted.orders,
      averageOrderValue: trusted.averageOrderValue,
      completedOrders,
      completionRate: trusted.orders ? (completedOrders / trusted.orders) * 100 : 0,
      cancelledOrders: trusted.cancelledOrders,
      cancellationRate: trusted.cancellationRate,
      knownCustomers: Number(retention?.totalWithOrders ?? 0),
      newCustomers: Number(retention?.newCustomers ?? 0),
      returningCustomers: Number(retention?.returningCustomers ?? 0),
      repeatRate: Number(retention?.repeatRate ?? 0),
      posOrders: Number(pos?.count ?? 0),
      mobileOrders: Number(mobile?.count ?? 0),
      posValue: Number(pos?.revenue ?? 0),
      mobileValue: Number(mobile?.revenue ?? 0),
    },
  };
}

export function formatReportMetric(key: ReportMetricKey, value: number) {
  const unit = REPORT_METRIC_MAP[key].unit;
  if (unit === 'money') return formatMoney(value);
  if (unit === 'money-precise') return formatMoney(value, 2);
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  return formatCompact(value);
}

export function metricChange(key: ReportMetricKey, current: number, comparison: number) {
  if (REPORT_METRIC_MAP[key].unit === 'percent') return current - comparison;
  return percentageChange(current, comparison);
}

export function metricChangeLabel(key: ReportMetricKey, change: number | null) {
  if (change === null) return 'New';
  const suffix = REPORT_METRIC_MAP[key].unit === 'percent' ? ' pts' : '%';
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}${suffix}`;
}

export function dailyMetricValues(key: ReportMetricKey, rows: DailyOrderAnalytics[]) {
  if (key === 'orders') return rows.map((row) => Number(row.count ?? 0));
  if (key === 'averageOrderValue') {
    return rows.map((row) => (row.count ? Number(row.revenue ?? 0) / row.count : 0));
  }
  if (key === 'netRevenue') return rows.map((row) => Number(row.revenue ?? 0));
  return [];
}

export function isoDateInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function zonedMidnight(value: string, timeZone: string) {
  const desiredParts = dateParts(value);
  const desired = Date.UTC(desiredParts.year, desiredParts.month - 1, desiredParts.day, 0, 0, 0);
  let result = new Date(desired);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const representedParts = zoneParts(result, timeZone);
    const represented = Date.UTC(
      representedParts.year,
      representedParts.month - 1,
      representedParts.day,
      representedParts.hour,
      representedParts.minute,
      representedParts.second,
    );
    const correction = desired - represented;
    if (correction === 0) break;
    result = new Date(result.getTime() + correction);
  }

  return result;
}

function addDays(value: string, days: number) {
  const parts = dateParts(value);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function reportDateRange(from: string, to: string, timeZone: string) {
  const start = zonedMidnight(from, timeZone);
  const end = new Date(zonedMidnight(addDays(to, 1), timeZone).getTime() - 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function trailingDateRange(days: number, timeZone: string, now = new Date()) {
  const to = isoDateInZone(now, timeZone);
  return { from: addDays(to, -(days - 1)), to };
}

export function previousDateRange(from: string, to: string) {
  const days = Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

export function previousYearDateRange(from: string, to: string) {
  const shift = (value: string) => {
    const parts = dateParts(value);
    const date = new Date(Date.UTC(parts.year - 1, parts.month - 1, parts.day));
    return date.toISOString().slice(0, 10);
  };
  return { from: shift(from), to: shift(to) };
}

export function shortDateLabel(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
