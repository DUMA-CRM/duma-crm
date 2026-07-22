import type { OrderAnalytics } from '@/lib/api/analytics.service';

export type DashboardRange = 'today' | '7d' | '30d';

export interface DateWindow {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  label: string;
  comparisonLabel: string;
}

function zonedParts(date: Date, timeZone: string) {
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

function localMidnightUtc(date: Date, timeZone: string) {
  const { year, month, day } = zonedParts(date, timeZone);
  const guess = new Date(Date.UTC(year, month - 1, day));
  const inZone = zonedParts(guess, timeZone);
  const represented = Date.UTC(inZone.year, inZone.month - 1, inZone.day, inZone.hour, inZone.minute, inZone.second);
  return new Date(guess.getTime() - (represented - guess.getTime()));
}

export function getDateWindow(range: DashboardRange, timeZone: string, now = new Date()): DateWindow {
  const end = now;
  const startToday = localMidnightUtc(now, timeZone);
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const from = new Date(startToday);
  from.setUTCDate(from.getUTCDate() - (days - 1));

  const duration = end.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration);

  return {
    from: from.toISOString(),
    to: end.toISOString(),
    previousFrom: previousFrom.toISOString(),
    previousTo: previousTo.toISOString(),
    label: range === 'today' ? 'Today' : `Last ${days} days`,
    comparisonLabel: range === 'today' ? 'vs yesterday' : 'vs previous period',
  };
}

export interface TrustedOrderMetrics {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  cancelledOrders: number;
  cancellationRate: number;
}

export function orderMetrics(data?: OrderAnalytics): TrustedOrderMetrics {
  if (!data) return { revenue: 0, orders: 0, averageOrderValue: 0, cancelledOrders: 0, cancellationRate: 0 };
  const cancelled = data.byStatus.find((row) => row.status === 'cancelled');
  const cancelledOrders = Number(cancelled?.count ?? 0);
  const cancelledRevenue = Number(cancelled?.revenue ?? 0);
  const totalOrders = Number(data.summary.totalOrders ?? 0);
  const orders = Math.max(0, totalOrders - cancelledOrders);
  const revenue = Math.max(0, Number(data.summary.totalRevenue ?? 0) - cancelledRevenue);
  return {
    revenue,
    orders,
    averageOrderValue: orders ? revenue / orders : 0,
    cancelledOrders,
    cancellationRate: totalOrders ? (cancelledOrders / totalOrders) * 100 : 0,
  };
}

export function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatMoney(value: number, digits = 0) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
