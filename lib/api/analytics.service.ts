import { apiFetch } from './client';

export interface AnalyticsRangeParams {
  from: string;
  to: string;
  locationId?: string;
}

export interface OrderAnalyticsSummary {
  totalOrders: number;
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

function rangeQuery(params: AnalyticsRangeParams) {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.locationId) query.set('locationId', params.locationId);
  return query;
}

export const getOrderAnalytics = (params: AnalyticsRangeParams) =>
  apiFetch<OrderAnalytics>(`/analytics/orders?${rangeQuery(params)}`);

export const getTopItems = (params: AnalyticsRangeParams, limit = 6) => {
  const query = rangeQuery(params);
  query.set('limit', String(limit));
  return apiFetch<TopItemAnalytics[]>(`/analytics/top-items?${query}`);
};

export const getRevenueByLocation = (params: AnalyticsRangeParams) =>
  apiFetch<RevenueByLocation[]>(`/analytics/revenue-by-location?${rangeQuery(params)}`);

export const getHourlyVolume = (params: AnalyticsRangeParams) =>
  apiFetch<HourlyVolume[]>(`/analytics/hourly-volume?${rangeQuery(params)}`);

export const getCustomerRetention = (params: AnalyticsRangeParams) =>
  apiFetch<CustomerRetention>(`/analytics/customer-retention?${rangeQuery(params)}`);
