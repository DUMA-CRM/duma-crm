import { apiFetch } from './client';

export interface AnalyticsRangeParams {
  from: string;
  to: string;
  locationId?: string;
}

export interface OrderAnalyticsSummary {
  totalOrders: number;
  grossRevenue: string | null;
  refundsBySaleDate: string | null;
  refundsByRefundDate: string | null;
  totalRevenue: string | null;
  avgOrderValue: string | null;
}

export interface OrderAnalyticsBreakdown {
  status?: string;
  source?: string;
  count: number;
  revenue: string | null;
}

export interface DailyOrderAnalytics {
  date: string;
  count: number;
  grossRevenue?: string | null;
  refunded?: string | null;
  revenue: string | null;
}

export interface OrderAnalytics {
  summary: OrderAnalyticsSummary;
  byStatus: OrderAnalyticsBreakdown[];
  bySource: OrderAnalyticsBreakdown[];
  daily: DailyOrderAnalytics[];
}

export interface TopItemAnalytics {
  menuItemId: string;
  name: string;
  totalQuantity: string | number | null;
  totalRevenue: string | null;
  orderCount: number;
}

export interface RevenueByLocation {
  locationId: string;
  locationName: string | null;
  totalRevenue: string | null;
  grossRevenue?: string | null;
  refundedAmount?: string | null;
  orderCount: number;
}

export interface HourlyVolume {
  hour: number;
  orderCount: number;
  totalRevenue: string | null;
}

export interface CustomerRetention {
  newCustomers: number;
  returningCustomers: number;
  totalWithOrders: number;
  repeatRate: number;
}

export interface StaffHoursAnalytics {
  userId: string;
  userName: string | null;
  totalShifts: number;
  totalMinutes: number;
  totalHours: number;
}

export interface StockSummaryAnalytics {
  stockItemId: string;
  type: string;
  totalQty: string | number | null;
  movementCount: number;
}

function rangeQuery(params: AnalyticsRangeParams) {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.locationId) query.set('locationId', params.locationId);
  return query;
}

export const getOrderAnalytics = (params: AnalyticsRangeParams) => apiFetch<OrderAnalytics>(`/analytics/orders?${rangeQuery(params)}`);

export const getTopItems = async (params: AnalyticsRangeParams, limit = 6) => {
  const query = rangeQuery(params);
  query.set('limit', String(limit));
  const rows = await apiFetch<TopItemAnalytics[]>(`/analytics/top-items?${query}`);

  // Defensive aggregation: older API deployments can return more than one row
  // for a menu item when joined order-line data has multiple matching records.
  // Consumers need one stable row per menuItemId for correct totals and React
  // identity.
  const grouped = new Map<string, TopItemAnalytics>();
  rows.forEach((row) => {
    const current = grouped.get(row.menuItemId);
    if (!current) {
      grouped.set(row.menuItemId, { ...row });
      return;
    }
    current.totalQuantity = Number(current.totalQuantity ?? 0) + Number(row.totalQuantity ?? 0);
    current.totalRevenue = String(Number(current.totalRevenue ?? 0) + Number(row.totalRevenue ?? 0));
    current.orderCount = Number(current.orderCount ?? 0) + Number(row.orderCount ?? 0);
  });

  return [...grouped.values()];
};

export const getRevenueByLocation = (params: AnalyticsRangeParams) =>
  apiFetch<RevenueByLocation[]>(`/analytics/revenue-by-location?${rangeQuery(params)}`);

export const getHourlyVolume = (params: AnalyticsRangeParams) => apiFetch<HourlyVolume[]>(`/analytics/hourly-volume?${rangeQuery(params)}`);

export const getCustomerRetention = (params: AnalyticsRangeParams) =>
  apiFetch<CustomerRetention>(`/analytics/customer-retention?${rangeQuery(params)}`);

export const getStaffHours = (params: AnalyticsRangeParams) =>
  apiFetch<StaffHoursAnalytics[]>(`/analytics/staff-hours?${rangeQuery(params)}`);

export const getStockSummary = (params: AnalyticsRangeParams) =>
  apiFetch<StockSummaryAnalytics[]>(`/analytics/stock/summary?${rangeQuery(params)}`);
