import type { CustomerRetention, DailyOrderAnalytics, OrderAnalytics } from '@/lib/api/analytics.service';

import { type TrustedOrderMetrics, formatCompact, formatMoney, percentageChange } from './dashboard';

export type MetricKey = 'revenue' | 'orders' | 'average' | 'retention';

export const METRIC_KEYS: MetricKey[] = ['revenue', 'orders', 'average', 'retention'];

export const METRIC_META: Record<MetricKey, { label: string; icon: 'revenue' | 'orders' | 'average' | 'retention' }> = {
  revenue: { label: 'Net revenue', icon: 'revenue' },
  orders: { label: 'Orders', icon: 'orders' },
  average: { label: 'Average order', icon: 'average' },
  retention: { label: 'Returning customers', icon: 'retention' },
};

export function isMetricKey(value: string): value is MetricKey {
  return (METRIC_KEYS as string[]).includes(value);
}

export interface DetailRow {
  label: string;
  value: string;
  note?: string;
}

export interface MetricDetail {
  title: string;
  description: string;
  definition: string;
  /** The current headline value for this metric, formatted. */
  headline: string;
  values: DetailRow[];
  breakdown: DetailRow[];
}

interface BuildArgs {
  metric: MetricKey;
  current: TrustedOrderMetrics;
  previous: TrustedOrderMetrics;
  analytics?: OrderAnalytics;
  retention?: CustomerRetention;
  previousRetention?: CustomerRetention;
  comparisonAvailable: boolean;
  liveOrders: number;
  periodLabel: string;
  comparisonLabel: string;
}

/**
 * Computes the human-readable detail (headline, stat tiles, breakdown, copy) for
 * one report metric. Pure — shared by the reports KPI cards' detail page.
 */
export function buildMetricDetail({
  metric,
  current,
  previous,
  analytics,
  retention,
  previousRetention,
  comparisonAvailable,
  liveOrders,
  periodLabel,
  comparisonLabel,
}: BuildArgs): MetricDetail {
  const changeText = (value: number | null | undefined, suffix = '%') =>
    value === undefined
      ? 'Comparison unavailable'
      : value === null
        ? `New ${comparisonLabel}`
        : `${value >= 0 ? '+' : ''}${value.toFixed(1)}${suffix} ${comparisonLabel}`;
  const previousText = (value: string) => (comparisonAvailable ? value : 'Unavailable');
  const comparisonChange = (currentValue: number, previousValue: number) =>
    comparisonAvailable ? percentageChange(currentValue, previousValue) : undefined;
  const peakDay = (analytics?.daily ?? []).reduce<DailyOrderAnalytics | null>(
    (peak, row) => (!peak || Number(row.revenue ?? 0) > Number(peak.revenue ?? 0) ? row : peak),
    null,
  );

  const titles: Record<MetricKey, { title: string; description: string; definition: string }> = {
    revenue: {
      title: 'Net revenue',
      description: `Revenue performance for ${periodLabel.toLowerCase()}.`,
      definition: 'Total recorded order value minus the value of cancelled orders.',
    },
    orders: {
      title: 'Orders',
      description: `Order volume and current service activity for ${periodLabel.toLowerCase()}.`,
      definition: 'All non-cancelled orders created during the selected period. Live orders are pending, preparing, or ready.',
    },
    average: {
      title: 'Average order',
      description: `How much each non-cancelled order was worth during ${periodLabel.toLowerCase()}.`,
      definition: 'Net revenue divided by the number of non-cancelled orders.',
    },
    retention: {
      title: 'Returning customers',
      description: `Known customer mix for ${periodLabel.toLowerCase()}.`,
      definition: 'The share of known customers ordering in this period whose first-ever order was before this period.',
    },
  };

  let headline = '';
  let values: DetailRow[] = [];
  let breakdown: DetailRow[] = [];

  if (metric === 'revenue') {
    headline = formatMoney(current.revenue);
    values = [
      { label: 'Current net revenue', value: formatMoney(current.revenue), note: periodLabel },
      { label: 'Previous period', value: previousText(formatMoney(previous.revenue)), note: comparisonLabel },
      {
        label: 'Change',
        value: changeText(comparisonChange(current.revenue, previous.revenue)),
        note: comparisonAvailable ? formatMoney(current.revenue - previous.revenue) : 'Previous-period data could not be loaded',
      },
      {
        label: 'Cancelled value removed',
        value: formatMoney(Number(analytics?.byStatus.find((row) => row.status === 'cancelled')?.revenue ?? 0)),
      },
    ];
    breakdown = [
      ...(analytics?.bySource ?? []).map((row) => ({
        label: `${row.source === 'pos' ? 'POS' : 'Mobile'} order value`,
        value: formatMoney(Number(row.revenue ?? 0)),
        note: `${row.count} orders`,
      })),
      ...(peakDay
        ? [
            {
              label: 'Highest recorded day',
              value: formatMoney(Number(peakDay.revenue ?? 0)),
              note: new Date(`${peakDay.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
            },
          ]
        : []),
    ];
  } else if (metric === 'orders') {
    headline = formatCompact(current.orders);
    values = [
      { label: 'Orders', value: formatCompact(current.orders), note: 'Cancelled orders excluded' },
      { label: 'Previous period', value: previousText(formatCompact(previous.orders)), note: comparisonLabel },
      { label: 'Currently live', value: formatCompact(liveOrders), note: 'Pending, preparing, or ready' },
      { label: 'Cancellation rate', value: `${current.cancellationRate.toFixed(1)}%`, note: `${current.cancelledOrders} cancelled` },
    ];
    breakdown = (analytics?.byStatus ?? []).map((row) => ({
      label: row.status ? row.status.replaceAll('_', ' ') : 'Unknown status',
      value: `${row.count} orders`,
      note: formatMoney(Number(row.revenue ?? 0)),
    }));
  } else if (metric === 'average') {
    headline = formatMoney(current.averageOrderValue, 2);
    values = [
      { label: 'Average order', value: formatMoney(current.averageOrderValue, 2), note: periodLabel },
      { label: 'Previous average', value: previousText(formatMoney(previous.averageOrderValue, 2)), note: comparisonLabel },
      {
        label: 'Change',
        value: changeText(comparisonChange(current.averageOrderValue, previous.averageOrderValue)),
        note: comparisonAvailable
          ? formatMoney(current.averageOrderValue - previous.averageOrderValue, 2)
          : 'Previous-period data could not be loaded',
      },
      { label: 'Orders in calculation', value: formatCompact(current.orders), note: `${formatMoney(current.revenue)} net revenue` },
    ];
    breakdown = (analytics?.bySource ?? []).map((row) => ({
      label: `${row.source === 'pos' ? 'POS' : 'Mobile'} recorded average`,
      value: formatMoney(row.count ? Number(row.revenue ?? 0) / row.count : 0, 2),
      note: `${row.count} orders`,
    }));
  } else {
    const currentRate = retention?.repeatRate ?? 0;
    const previousRate = previousRetention?.repeatRate ?? 0;
    headline = `${currentRate.toFixed(1)}%`;
    values = [
      { label: 'Returning rate', value: `${currentRate.toFixed(1)}%`, note: periodLabel },
      { label: 'Previous rate', value: previousText(`${previousRate.toFixed(1)}%`), note: comparisonLabel },
      {
        label: 'Change',
        value: changeText(comparisonAvailable ? currentRate - previousRate : undefined, ' pts'),
        note: comparisonAvailable ? 'Percentage-point movement' : 'Previous-period data could not be loaded',
      },
      { label: 'Known customers', value: formatCompact(retention?.totalWithOrders ?? 0), note: 'Customers with orders in this period' },
    ];
    breakdown = [
      {
        label: 'Returning customers',
        value: formatCompact(retention?.returningCustomers ?? 0),
        note: `${currentRate.toFixed(1)}% of known customers`,
      },
      { label: 'New customers', value: formatCompact(retention?.newCustomers ?? 0), note: 'First-ever order in this period' },
    ];
  }

  return { ...titles[metric], headline, values, breakdown };
}
