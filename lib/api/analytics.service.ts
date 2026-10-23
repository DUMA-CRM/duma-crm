import { apiFetch } from './client';

export type ExternalAnalyticsProvider = 'umami' | 'posthog';
export interface AnalyticsConnection {
  id: string;
  provider: ExternalAnalyticsProvider;
  displayName: string;
  siteId: string;
  apiUrl: string;
  lastTestedAt: string | null;
}
export interface AnalyticsConnectionInput {
  provider: ExternalAnalyticsProvider;
  displayName: string;
  siteId: string;
  apiUrl?: string;
  /** API key — or, with `username`, the password of a self-hosted Umami user (before Umami 3.4). */
  apiKey: string;
  username?: string;
}
export interface ExternalAnalyticsData {
  provider: ExternalAnalyticsProvider;
  /** Umami only: the website the ID points at. */
  website?: { name: string | null; domain: string | null };
  summary: {
    pageviews: number | null;
    visitors: number | null;
    visits: number | null;
    /** 0–1. */
    bounceRate: number | null;
    avgVisitSeconds: number | null;
  };
  daily: { date: string; pageviews: number; visitors: number }[];
}
const tenantQuery = (tenantId?: string) => (tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '');
export const getAnalyticsConnection = (tenantId?: string) =>
  apiFetch<AnalyticsConnection | null>(`/analytics-connections${tenantQuery(tenantId)}`);
export const saveAnalyticsConnection = (input: AnalyticsConnectionInput, tenantId?: string) =>
  apiFetch<AnalyticsConnection>(`/analytics-connections${tenantQuery(tenantId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
export const deleteAnalyticsConnection = (tenantId?: string) =>
  apiFetch<void>(`/analytics-connections${tenantQuery(tenantId)}`, { method: 'DELETE' });
export const getExternalAnalyticsData = (tenantId?: string) =>
  apiFetch<ExternalAnalyticsData>(`/analytics-connections/data${tenantQuery(tenantId)}`);

// ── Website analytics report (2026-10-23) ───────────────────────────────────

export type BreakdownKey =
  | 'pages'
  | 'entries'
  | 'referrers'
  | 'channels'
  | 'campaigns'
  | 'countries'
  | 'devices'
  | 'browsers'
  | 'os'
  | 'events';
export type ReportSection = 'summary' | 'daily' | 'hourly' | 'active' | 'weekly' | 'eventsDaily' | 'eventsHourly' | BreakdownKey;
export interface BreakdownRow {
  key: string;
  value: number;
}
/** Only the sections asked for are present; a section the provider can't answer is `null`. */
export interface WebAnalyticsReport {
  provider: ExternalAnalyticsProvider;
  summary?: ExternalAnalyticsData['summary'];
  daily?: ExternalAnalyticsData['daily'];
  /** Short ranges: hour by hour, keyed `YYYY-MM-DD HH` in the requested timezone. */
  hourly?: { hour: string; pageviews: number; visitors: number }[];
  /** Custom events over time, one row per bucket (`YYYY-MM-DD` or `YYYY-MM-DD HH`) and event. */
  eventSeries?: { bucket: string; event: string; count: number }[];
  /** Visitors in the last five minutes. */
  active?: number | null;
  /** 7 rows, Monday first, of 24 hours. */
  weekly?: number[][] | null;
  breakdowns: Partial<Record<BreakdownKey, BreakdownRow[] | null>>;
}
export interface FunnelStep {
  type: 'page' | 'event';
  value: string;
}
export interface FunnelStepResult extends FunnelStep {
  visitors: number;
}

export const getWebAnalyticsReport = (params: { from: string; to: string; timezone: string; sections: ReportSection[] }) =>
  apiFetch<WebAnalyticsReport>(
    `/analytics-connections/report?${new URLSearchParams({ from: params.from, to: params.to, timezone: params.timezone, sections: params.sections.join(',') })}`,
  );

export const getWebAnalyticsFunnel = (params: { from: string; to: string; steps: FunnelStep[]; window?: number }) =>
  apiFetch<FunnelStepResult[]>(
    `/analytics-connections/funnel?${new URLSearchParams({
      from: params.from,
      to: params.to,
      steps: JSON.stringify(params.steps),
      window: String(params.window ?? 60),
    })}`,
  );

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

export interface BaselineHour {
  hour: number;
  /** Median revenue taken by the END of this hour on a typical same-weekday. */
  cumulativeRevenue: number;
  cumulativeOrders: number;
  /** Median revenue taken within this hour alone — used to interpolate inside it. */
  revenue: number;
  orderCount: number;
}

/** The shape of a typical same-weekday trading day, for judging today against. */
export interface DayBaseline {
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  timezone: string;
  weeks: number;
  /** Trading days that made it into the sample. Below 3, don't draw a pace line. */
  sampleCount: number;
  sampleDates: string[];
  dailyMedianRevenue: number;
  dailyMedianOrders: number;
  byHour: BaselineHour[];
}

/** Aggregate labour for a window. Deliberately carries no per-person figures. */
export interface LabourAnalytics {
  clockedHours: number;
  /** Hours that cost money: capped at the rota slot, less unpaid breaks. */
  paidHours: number;
  /** Clocked outside a rota slot, so not costed. */
  uncostedHours: number;
  estimatedCost: number;
  headcount: number;
  openShifts: number;
  salariedHeadcount: number;
  /** Staff with no usable pay record — the cost is short by whatever they earned. */
  staffMissingPayData: number;
  costComplete: boolean;
}

export interface StockSummaryAnalytics {
  stockItemId: string;
  type: string;
  totalQty: string | number | null;
  movementCount: number;
  /** Positive value of these movements at the cost each was made at (decimal string). */
  totalValue?: string;
  /** Quantity among them with no cost recorded — value it at the item's cost. */
  uncostedQty?: string;
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

export const getHourlyVolume = (params: AnalyticsRangeParams & { timezone?: string }) => {
  const query = rangeQuery(params);
  // Without this the API buckets by UTC hour, which puts a 13:00 peak in the
  // 12:00 column whenever the location is off UTC.
  if (params.timezone) query.set('timezone', params.timezone);
  return apiFetch<HourlyVolume[]>(`/analytics/hourly-volume?${query}`);
};

export const getCustomerRetention = (params: AnalyticsRangeParams) =>
  apiFetch<CustomerRetention>(`/analytics/customer-retention?${rangeQuery(params)}`);

export const getStaffHours = (params: AnalyticsRangeParams) =>
  apiFetch<StaffHoursAnalytics[]>(`/analytics/staff-hours?${rangeQuery(params)}`);

export const getStockSummary = (params: AnalyticsRangeParams) =>
  apiFetch<StockSummaryAnalytics[]>(`/analytics/stock/summary?${rangeQuery(params)}`);

export const getDayBaseline = (params: { weekday?: string; weeks?: number; timezone?: string; locationId?: string }) => {
  const query = new URLSearchParams();
  if (params.weekday) query.set('weekday', params.weekday);
  if (params.weeks) query.set('weeks', String(params.weeks));
  if (params.timezone) query.set('timezone', params.timezone);
  if (params.locationId) query.set('locationId', params.locationId);
  return apiFetch<DayBaseline>(`/analytics/baseline?${query}`);
};

export const getLabourAnalytics = (params: AnalyticsRangeParams) => apiFetch<LabourAnalytics>(`/analytics/labour?${rangeQuery(params)}`);

// ── Sales reports (2026-10-04) ──────────────────────────────────────────────

/** One payment method's sales in the window, net of refunds. `unrecorded` is its own method. */
export interface PaymentMethodSales {
  method: string;
  orders: number;
  gross: number;
  refunded: number;
  revenue: number;
}

export interface VatBucket {
  rate: number;
  gross: number;
  vat: number;
  net: number;
  lines: number;
}

export interface TaxAnalytics {
  vatRegistered: boolean;
  pricesIncludeTax: boolean;
  vatNumber: string | null;
  /** Exact: the VAT recorded on each order when it was taken. */
  recorded: { gross: number; vat: number };
  /** Order lines don't store their rate, so this split uses each item's current rate. */
  byRate: VatBucket[];
  byRateTotal: Omit<VatBucket, 'rate'>;
  byRateBasis: 'current-rate';
}

export interface ExceptionsAnalytics {
  discounts: { label: string; kind: 'discount' | 'markdown'; lines: number; amount: number }[];
  voids: { reason: string; orders: number; amount: number }[];
}

export interface CategorySales {
  categoryId: string | null;
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
}

export const getPaymentMethodSales = (params: AnalyticsRangeParams) =>
  apiFetch<PaymentMethodSales[]>(`/analytics/payments?${rangeQuery(params)}`);

export const getTaxAnalytics = (params: AnalyticsRangeParams) => apiFetch<TaxAnalytics>(`/analytics/tax?${rangeQuery(params)}`);

export const getExceptionsAnalytics = (params: AnalyticsRangeParams) =>
  apiFetch<ExceptionsAnalytics>(`/analytics/exceptions?${rangeQuery(params)}`);

export const getCategorySales = (params: AnalyticsRangeParams) =>
  apiFetch<CategorySales[]>(`/analytics/category-sales?${rangeQuery(params)}`);
