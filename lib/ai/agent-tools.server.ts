import 'server-only';

import type {
  CustomerRetention,
  HourlyVolume,
  OrderAnalytics,
  RevenueByLocation,
  StaffHoursAnalytics,
  TopItemAnalytics,
} from '@/lib/api/analytics.service';
import type { InventoryForecast, LowStockAlert } from '@/lib/api/inventory.service';
import type { LossLogResponse } from '@/lib/api/loss.service';
import type { Order, OrderDetail } from '@/lib/api/orders.service';
import type { HelpdeskTicket, LeaveRequest } from '@/lib/api/people-ops.service';
import type { PurchaseOrdersResponse } from '@/lib/api/purchasing.service';
import type { RestockRequestsResponse } from '@/lib/api/restock.service';
import { decodeNotes } from '@/lib/api/restock.service';
import type { ScheduledShift } from '@/lib/api/scheduling.service';
import type { Shift } from '@/lib/api/shifts.service';
import type { StaffRole } from '@/lib/api/staff.service';
import { roleAtLeast } from '@/lib/api/staff.service';
import type { StocktakesResponse } from '@/lib/api/stocktakes.service';
import type { StockTransfersResponse } from '@/lib/api/transfers.service';
import type { Location } from '@/lib/api/workspace.service';
import type { CustomersResponse } from '@/types/customers';

import {
  addDays,
  formatDateTime,
  gbp,
  isIsoDate,
  isWithinHours,
  optionalText,
  percentChange,
  round,
  toNumber,
  zonedIso,
  zonedNow,
} from './agent-format.ts';
import { AgentRuntime, ROLE_LABELS } from './agent-runtime.server';
import type { AgentCard, AgentShortcut } from './agent-types';
import { searchSupportArticles } from './support-search';

type JsonObject = Record<string, unknown>;

export interface ToolResult {
  output: unknown;
  /** One line for the "Checked" trail under the answer. */
  evidence?: string;
  shortcuts?: AgentShortcut[];
  cards?: AgentCard[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  minRole: StaffRole;
  parameters: JsonObject;
  /** Short present-tense line shown while the tool runs. */
  step: string;
  run(args: JsonObject, runtime: AgentRuntime): Promise<ToolResult>;
}

function schema(properties: JsonObject): JsonObject {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const nullableString = (description: string) => ({ type: ['string', 'null'], description });
const DATE = 'Inclusive YYYY-MM-DD calendar date.';

function page(label: string, href: string, description: string, locationId?: string): AgentShortcut {
  return { label, href, description, ...(locationId ? { locationId, kind: 'filtered' as const } : { kind: 'page' as const }) };
}

function limit(value: unknown, fallback: number, max: number) {
  const parsed = toNumber(value, fallback);
  return Math.min(Math.max(Math.round(parsed) || fallback, 1), max);
}

function rangeQuery(args: JsonObject, runtime: AgentRuntime, fallbackDays = 30) {
  const query = new URLSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const from = isIsoDate(args.from) ? args.from : new Date(Date.now() - fallbackDays * 86_400_000).toISOString().slice(0, 10);
  query.set('from', from);
  query.set('to', isIsoDate(args.to) ? args.to : today);
  const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
  if (locationId) query.set('locationId', locationId);
  return query;
}

function trendOf(change: number | null) {
  if (change == null || Math.abs(change) < 0.5) return 'flat' as const;
  return change > 0 ? ('up' as const) : ('down' as const);
}

// ── Product documentation ────────────────────────────────────────────────────

const searchSupport: ToolDefinition = {
  name: 'search_support',
  description:
    'Search DUMA product documentation. Use for questions about how the app works, workflows, setup, or why a screen behaves a certain way.',
  minRole: 'barista',
  step: 'Searching DUMA guides',
  parameters: schema({ query: { type: 'string', description: 'A concise description of the workflow or product question.' } }),
  async run(args) {
    const query = optionalText(args.query, 300);
    if (!query) return { output: { error: 'A support search query is required.' } };
    const results = searchSupportArticles(query);
    return {
      output: results,
      evidence: results.length
        ? `Support: ${results.map((article) => `“${article.title}”`).join(', ')}`
        : 'Support search (no matching article)',
      shortcuts: results.map((article) => ({
        label: article.title,
        href: `/support/${article.slug}`,
        description: `${article.category} guide · updated ${article.updated}`,
        kind: 'support' as const,
      })),
    };
  },
};

// ── Workspace reference data ─────────────────────────────────────────────────

/**
 * Trading hours as the shop floor experiences them: today resolved in the
 * location's own timezone, so "what time do we close" needs no arithmetic from
 * the model and no guess about which weekday the server is on.
 */
function tradingHours(location: Location) {
  const timeZone = location.timezone || 'Europe/London';
  const { weekday, date, time } = zonedNow(timeZone);
  const hours = location.openingHours;
  if (!hours) {
    return {
      today: { date, weekday, localTimeNow: time, hoursSet: false as const },
      note: 'No opening hours have been set for this location in Settings → Locations.',
    };
  }

  const todayHours = hours[weekday] ?? null;
  const overnight = Boolean(todayHours) && todayHours!.close <= todayHours!.open;
  return {
    today: todayHours
      ? {
          date,
          weekday,
          localTimeNow: time,
          opens: todayHours.open,
          closes: todayHours.close,
          closesNextDay: overnight,
          isOpenNow: isWithinHours(time, todayHours.open, todayHours.close),
        }
      : { date, weekday, localTimeNow: time, closedAllDay: true as const },
    week: hours,
  };
}

const listLocations: ToolDefinition = {
  name: 'list_locations',
  description:
    'List the locations the operator can access, with their address, phone, timezone and trading hours — today’s opening and closing time, whether the site is open right now, and the full weekly pattern. Use this for any question about when a site opens or closes.',
  minRole: 'barista',
  step: 'Checking locations and trading hours',
  parameters: schema({}),
  async run(_args, runtime) {
    const locations = await runtime.locations();
    const open = locations.filter((location) => {
      const hours = tradingHours(location).today;
      return 'isOpenNow' in hours && hours.isOpenNow;
    }).length;

    return {
      output: locations.map((location) => ({
        id: location.id,
        name: location.name,
        address: location.address,
        phone: location.phone ?? null,
        timezone: location.timezone,
        ...tradingHours(location),
      })),
      evidence: `${locations.length} accessible location${locations.length === 1 ? '' : 's'}, ${open} open now`,
      shortcuts: [
        ...locations.slice(0, 5).map(({ id, name }) => page(`Open ${name}`, '/dashboard', 'Switches the active location', id)),
        page('Edit trading hours', '/settings/workspaces', 'Settings · Locations'),
      ],
    };
  },
};

const listSuppliers: ToolDefinition = {
  name: 'list_suppliers',
  description: 'List active suppliers with their contact details.',
  minRole: 'barista',
  step: 'Checking suppliers',
  parameters: schema({}),
  async run(_args, runtime) {
    const suppliers = await runtime.suppliers();
    return {
      output: suppliers.map(({ id, name, contactName, email, phone, notes }) => ({
        id,
        name,
        contactName: contactName ?? null,
        email: email ?? null,
        phone: phone ?? null,
        notes: notes?.slice(0, 200) ?? null,
      })),
      evidence: `${suppliers.length} active supplier${suppliers.length === 1 ? '' : 's'}`,
      shortcuts: [page('Open suppliers', '/inventory?tab=suppliers', 'Inventory · Suppliers')],
    };
  },
};

const listStockItems: ToolDefinition = {
  name: 'list_stock_items',
  description: 'Find active stock items with their units, last known costs and default reorder quantities.',
  minRole: 'barista',
  step: 'Checking stock items',
  parameters: schema({ query: { type: 'string', description: 'Case-insensitive item name search; use an empty string to list all.' } }),
  async run(args, runtime) {
    const query = optionalText(args.query, 60).toLocaleLowerCase('en-GB');
    const items = (await runtime.stockItems())
      .filter((item) => !query || item.name.toLocaleLowerCase('en-GB').includes(query))
      .slice(0, 100);
    return {
      output: items.map(({ id, name, unit, category, costPerUnit, defaultReorderQuantity }) => ({
        id,
        name,
        unit,
        category,
        lastKnownUnitCostGbp: costPerUnit == null ? null : toNumber(costPerUnit),
        defaultReorderQuantity: defaultReorderQuantity == null ? null : toNumber(defaultReorderQuantity),
      })),
      evidence: `${items.length} stock item${items.length === 1 ? '' : 's'}${query ? ` matching “${query}”` : ''}`,
      shortcuts: [page('Open stock', '/inventory', 'Inventory · Stock')],
    };
  },
};

const listMenuItems: ToolDefinition = {
  name: 'list_menu_items',
  description: 'List menu items with their brand-wide price, category and availability.',
  minRole: 'barista',
  step: 'Reading the menu',
  parameters: schema({ query: { type: 'string', description: 'Case-insensitive name search; empty string lists all.' } }),
  async run(args, runtime) {
    const query = optionalText(args.query, 60).toLocaleLowerCase('en-GB');
    const items = (await runtime.menuItems())
      .filter((item) => !query || item.name.toLocaleLowerCase('en-GB').includes(query))
      .slice(0, 120);
    const unavailable = items.filter((item) => !item.isAvailable).length;
    return {
      output: items.map(({ id, name, category, price, isAvailable }) => ({ id, name, category, priceGbp: toNumber(price), isAvailable })),
      evidence: `${items.length} menu item${items.length === 1 ? '' : 's'}${unavailable ? `, ${unavailable} hidden` : ''}`,
      shortcuts: [page('Open menu', '/menu', 'Menu')],
    };
  },
};

const listStaff: ToolDefinition = {
  name: 'list_staff',
  description: 'List active staff with their role and scope. Use to resolve a person’s name to a user id.',
  minRole: 'store_manager',
  step: 'Checking the team',
  parameters: schema({}),
  async run(_args, runtime) {
    const staff = await runtime.staff();
    return {
      output: staff.map(({ userId, name, email, role, scope, locationIds }) => ({
        userId,
        name: name ?? null,
        email: email ?? null,
        role,
        roleLabel: ROLE_LABELS[role] ?? role,
        scope,
        locationIds: locationIds ?? [],
      })),
      evidence: `${staff.length} active team member${staff.length === 1 ? '' : 's'}`,
      shortcuts: [page('Open team', '/staff', 'Team')],
    };
  },
};

// ── Sales and analytics ──────────────────────────────────────────────────────

function summarise(analytics: OrderAnalytics) {
  return {
    orders: analytics.summary.totalOrders,
    grossRevenueGbp: toNumber(analytics.summary.grossRevenue),
    netRevenueGbp: toNumber(analytics.summary.totalRevenue),
    averageOrderValueGbp: round(toNumber(analytics.summary.avgOrderValue), 2),
    refundsGbp: toNumber(analytics.summary.refundsBySaleDate),
  };
}

function itemRows(rows: TopItemAnalytics[], query: unknown) {
  const normalized = typeof query === 'string' ? query.trim().toLocaleLowerCase('en-GB') : '';
  const matched = normalized ? rows.filter((row) => row.name.toLocaleLowerCase('en-GB').includes(normalized)) : rows;
  return matched.map((row) => ({
    id: row.menuItemId,
    name: row.name,
    quantity: toNumber(row.totalQuantity),
    revenueGbp: toNumber(row.totalRevenue),
    orders: row.orderCount,
  }));
}

const getSalesReport: ToolDefinition = {
  name: 'get_sales_report',
  description:
    'Compare orders, revenue and item sales across two date ranges. Use the calendar anchors in the brief rather than guessing dates.',
  minRole: 'barista',
  step: 'Reading live sales data',
  parameters: schema({
    currentFrom: { type: 'string', description: DATE },
    currentTo: { type: 'string', description: DATE },
    previousFrom: { type: 'string', description: DATE },
    previousTo: { type: 'string', description: DATE },
    locationId: nullableString('Restrict to one location, or null for everything accessible.'),
    itemQuery: nullableString('Optional item name such as latte. Null returns the item ranking.'),
  }),
  async run(args, runtime) {
    const { currentFrom, currentTo, previousFrom, previousTo } = args;
    if (![currentFrom, currentTo, previousFrom, previousTo].every(isIsoDate)) {
      return { output: { error: 'All report dates must be real YYYY-MM-DD dates.' } };
    }
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : undefined;
    const range = (from: string, to: string, itemLimit?: string) => {
      const query = new URLSearchParams({ from, to });
      if (locationId) query.set('locationId', locationId);
      if (itemLimit) query.set('limit', itemLimit);
      return query;
    };

    const [current, previous, currentItems, previousItems] = await Promise.all([
      runtime.get<OrderAnalytics>(`/analytics/orders?${range(currentFrom as string, currentTo as string)}`),
      runtime.get<OrderAnalytics>(`/analytics/orders?${range(previousFrom as string, previousTo as string)}`),
      runtime.get<TopItemAnalytics[]>(`/analytics/top-items?${range(currentFrom as string, currentTo as string, '100')}`),
      runtime.get<TopItemAnalytics[]>(`/analytics/top-items?${range(previousFrom as string, previousTo as string, '100')}`),
    ]);

    const currentSummary = summarise(current);
    const previousSummary = summarise(previous);
    const currentRows = itemRows(currentItems, args.itemQuery);
    const previousRows = itemRows(previousItems, args.itemQuery);
    const changes = {
      orders: percentChange(currentSummary.orders, previousSummary.orders),
      netRevenue: percentChange(currentSummary.netRevenueGbp, previousSummary.netRevenueGbp),
      averageOrderValue: percentChange(currentSummary.averageOrderValueGbp, previousSummary.averageOrderValueGbp),
    };
    const delta = (change: number | null) => (change == null ? undefined : `${change > 0 ? '+' : ''}${change}% vs previous`);

    return {
      output: {
        currentPeriod: { from: currentFrom, to: currentTo, ...currentSummary },
        previousPeriod: { from: previousFrom, to: previousTo, ...previousSummary },
        changesPercent: changes,
        currentItems: currentRows.slice(0, 40),
        previousItems: previousRows.slice(0, 40),
        lowestSellingRecordedItems: [...currentRows]
          .filter((row) => row.quantity > 0)
          .sort((a, b) => a.quantity - b.quantity)
          .slice(0, 8),
        caveat: 'Lowest-selling only covers items returned by the sales endpoint; products with zero sales may be absent.',
      },
      evidence: `Sales ${String(currentFrom)}–${String(currentTo)} vs ${String(previousFrom)}–${String(previousTo)}`,
      cards: [
        {
          title: `${currentFrom} → ${currentTo}`,
          caption: `Compared with ${previousFrom} → ${previousTo}`,
          metrics: [
            {
              label: 'Net revenue',
              value: gbp(currentSummary.netRevenueGbp),
              hint: delta(changes.netRevenue),
              trend: trendOf(changes.netRevenue),
            },
            { label: 'Orders', value: String(currentSummary.orders), hint: delta(changes.orders), trend: trendOf(changes.orders) },
            {
              label: 'Avg order',
              value: gbp(currentSummary.averageOrderValueGbp),
              hint: delta(changes.averageOrderValue),
              trend: trendOf(changes.averageOrderValue),
            },
            ...(currentSummary.refundsGbp > 0
              ? [{ label: 'Refunds', value: gbp(currentSummary.refundsGbp), tone: 'warning' as const }]
              : []),
          ],
        },
      ],
      shortcuts: [
        page('Open report comparison', '/reports/compare', locationId ? 'Switches the active location' : 'Reports · Compare', locationId),
      ],
    };
  },
};

const getBusinessAnalytics: ToolDefinition = {
  name: 'get_business_analytics',
  description:
    'Read one analytics view over a date range: hourly_volume (trade by hour of day), revenue_by_location, customer_retention (new vs returning), or staff_hours (worked hours per person).',
  minRole: 'barista',
  step: 'Reading analytics',
  parameters: schema({
    metric: { type: 'string', enum: ['hourly_volume', 'revenue_by_location', 'customer_retention', 'staff_hours'] },
    from: { type: 'string', description: DATE },
    to: { type: 'string', description: DATE },
    locationId: nullableString('Restrict to one location, or null.'),
  }),
  async run(args, runtime) {
    const query = rangeQuery(args, runtime);
    const metric = String(args.metric);

    if (metric === 'hourly_volume') {
      const rows = await runtime.get<HourlyVolume[]>(`/analytics/hourly-volume?${query}`);
      const busiest = [...rows].sort((a, b) => b.orderCount - a.orderCount)[0];
      return {
        output: rows.map((row) => ({ hour: row.hour, orders: row.orderCount, revenueGbp: toNumber(row.totalRevenue) })),
        evidence: `Hourly volume ${query.get('from')}–${query.get('to')}`,
        cards: busiest
          ? [
              {
                title: 'Trade by hour',
                caption: `${query.get('from')} → ${query.get('to')}`,
                metrics: [
                  { label: 'Busiest hour', value: `${String(busiest.hour).padStart(2, '0')}:00` },
                  { label: 'Orders then', value: String(busiest.orderCount) },
                  { label: 'Revenue then', value: gbp(busiest.totalRevenue) },
                ],
              },
            ]
          : [],
        shortcuts: [page('Open reports', '/reports', 'Reports')],
      };
    }

    if (metric === 'revenue_by_location') {
      const rows = await runtime.get<RevenueByLocation[]>(`/analytics/revenue-by-location?${query}`);
      return {
        output: rows.map((row) => ({
          locationId: row.locationId,
          name: row.locationName,
          netRevenueGbp: toNumber(row.totalRevenue),
          grossRevenueGbp: toNumber(row.grossRevenue),
          refundedGbp: toNumber(row.refundedAmount),
          orders: row.orderCount,
        })),
        evidence: `Revenue by location ${query.get('from')}–${query.get('to')}`,
        shortcuts: [page('Open reports', '/reports', 'Reports')],
      };
    }

    if (metric === 'customer_retention') {
      const retention = await runtime.get<CustomerRetention>(`/analytics/customer-retention?${query}`);
      return {
        output: retention,
        evidence: `Customer retention ${query.get('from')}–${query.get('to')}`,
        cards: [
          {
            title: 'Customers',
            caption: `${query.get('from')} → ${query.get('to')}`,
            metrics: [
              { label: 'New', value: String(retention.newCustomers) },
              { label: 'Returning', value: String(retention.returningCustomers) },
              { label: 'Repeat rate', value: `${round(retention.repeatRate, 1)}%` },
            ],
          },
        ],
        shortcuts: [page('Open customers', '/customers', 'Customers')],
      };
    }

    const [rows, names] = await Promise.all([runtime.get<StaffHoursAnalytics[]>(`/analytics/staff-hours?${query}`), runtime.staffNames()]);
    return {
      output: rows.map((row) => ({
        userId: row.userId,
        name: row.userName || names.get(row.userId) || row.userId,
        shifts: row.totalShifts,
        hours: round(row.totalHours, 1),
      })),
      evidence: `Staff hours ${query.get('from')}–${query.get('to')}`,
      shortcuts: [page('Open the rota', '/staff/rota', 'Team · Rota')],
    };
  },
};

// ── Orders ───────────────────────────────────────────────────────────────────

const listOrders: ToolDefinition = {
  name: 'list_orders',
  description:
    'List recent orders with their status, total and time. Use before proposing a status change or investigating a specific sale.',
  minRole: 'barista',
  step: 'Reading orders',
  parameters: schema({
    status: nullableString('pending, preparing, ready, done, cancelled, or null for all.'),
    from: nullableString(DATE),
    to: nullableString(DATE),
    locationId: nullableString('Restrict to one location, or null for the active one.'),
    limit: { type: ['number', 'null'], description: 'How many orders to return, up to 50.' },
  }),
  async run(args, runtime) {
    const query = new URLSearchParams({ limit: String(limit(args.limit, 20, 50)) });
    const status = optionalText(args.status, 20);
    if (['pending', 'preparing', 'ready', 'done', 'cancelled'].includes(status)) query.set('status', status);
    if (isIsoDate(args.from)) query.set('from', args.from);
    if (isIsoDate(args.to)) query.set('to', args.to);
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
    if (locationId) query.set('locationId', locationId);

    const response = await runtime.get<{ data?: Order[]; total?: number }>(`/orders?${query}`);
    const orders = response.data ?? [];
    return {
      output: {
        total: response.total ?? orders.length,
        orders: orders.map((order) => ({
          id: order.id,
          status: order.status,
          source: order.source,
          totalGbp: toNumber(order.totalAmount),
          createdAt: order.createdAt,
          itemCount: order.items?.length ?? null,
        })),
      },
      evidence: `${orders.length} order${orders.length === 1 ? '' : 's'}${status ? ` with status ${status}` : ''}`,
      shortcuts: [page('Open orders', '/orders', 'Orders')],
    };
  },
};

const getOrderDetail: ToolDefinition = {
  name: 'get_order',
  description: 'Read one order in full: items, modifiers, payment, refunds, void reason and status history.',
  minRole: 'barista',
  step: 'Opening the order',
  parameters: schema({ orderId: { type: 'string' } }),
  async run(args, runtime) {
    const orderId = optionalText(args.orderId, 60);
    if (!orderId) return { output: { error: 'An order id is required.' } };
    const order = await runtime.get<OrderDetail>(`/orders/${orderId}`);
    return {
      output: {
        id: order.id,
        status: order.status,
        refundStatus: order.refundStatus ?? 'none',
        totalGbp: toNumber(order.totalAmount),
        discountGbp: toNumber(order.discountAmount),
        paymentMethod: order.paymentMethod,
        source: order.source,
        createdAt: order.createdAt,
        notes: order.notes ?? null,
        voidReason: order.voidReason ?? null,
        items: (order.items ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPriceGbp: toNumber(item.unitPrice),
          modifiers: (item.modifiers ?? []).map((modifier) => modifier.name),
        })),
        refunds: (order.refunds ?? []).map((refund) => ({
          amountGbp: toNumber(refund.amount),
          reason: refund.reason,
          createdAt: refund.createdAt,
        })),
        inventoryWarnings: order.inventoryWarnings ?? [],
      },
      evidence: `Order #${orderId.slice(0, 8)}`,
      shortcuts: [page('Open orders', '/orders', 'Orders')],
    };
  },
};

// ── Inventory ────────────────────────────────────────────────────────────────

const getInventoryStatus: ToolDefinition = {
  name: 'get_inventory_status',
  description:
    'Read stock health for a location: what is below its low threshold, days of cover remaining and the recommended reorder quantity. Returns the locationStockId needed to change thresholds.',
  minRole: 'barista',
  step: 'Checking stock levels',
  parameters: schema({
    locationId: nullableString('Restrict to one location, or null for the active one.'),
    onlyLow: { type: ['boolean', 'null'], description: 'True returns only items at or below their threshold.' },
  }),
  async run(args, runtime) {
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
    const query = locationId ? `?${new URLSearchParams({ locationId })}` : '';
    const [alerts, forecast] = await Promise.all([
      runtime.get<LowStockAlert[]>(`/location-stock/alerts${query}`),
      runtime
        .get<
          InventoryForecast[]
        >(`/analytics/inventory-forecast?${new URLSearchParams({ lookbackDays: '30', ...(locationId ? { locationId } : {}) })}`)
        .catch(() => [] as InventoryForecast[]),
    ]);

    const critical = forecast.filter((row) => row.isCritical);
    const rows = (args.onlyLow === false ? forecast : forecast.filter((row) => row.isLow || row.isCritical)).slice(0, 40);

    return {
      output: {
        lowStockAlerts: alerts.slice(0, 40).map((alert) => ({
          locationStockId: alert.id,
          locationId: alert.locationId,
          locationName: alert.location?.name ?? null,
          stockItemId: alert.stockItemId,
          name: alert.stockItem?.name ?? null,
          unit: alert.stockItem?.unit ?? null,
          quantity: toNumber(alert.quantity),
          lowThreshold: toNumber(alert.lowThreshold),
        })),
        forecast: rows.map((row) => ({
          locationStockId: row.locationStockId,
          name: row.stockItemName,
          unit: row.unit,
          quantity: toNumber(row.currentQuantity),
          avgDailyUse: round(row.avgDailyConsumption, 2),
          daysOfCover: round(row.daysOfStockRemaining, 1),
          predictedStockoutDate: row.predictedStockoutDate,
          recommendedReorderQuantity: round(row.recommendedReorderQuantity, 2),
          isCritical: row.isCritical,
        })),
      },
      evidence: `${alerts.length} low-stock alert${alerts.length === 1 ? '' : 's'}${critical.length ? `, ${critical.length} critical` : ''}`,
      cards:
        alerts.length || critical.length
          ? [
              {
                title: 'Stock health',
                caption: (await runtime.locationName(locationId)) || 'All accessible locations',
                metrics: [
                  { label: 'Below threshold', value: String(alerts.length), tone: alerts.length ? 'warning' : 'positive' },
                  { label: 'Critical cover', value: String(critical.length), tone: critical.length ? 'negative' : 'positive' },
                  ...(critical[0]
                    ? [
                        {
                          label: 'Runs out first',
                          value: critical[0].stockItemName,
                          hint: `${round(critical[0].daysOfStockRemaining, 1)} days`,
                        },
                      ]
                    : []),
                ],
              },
            ]
          : [],
      shortcuts: [page('Open stock', '/inventory', 'Switches the active location', locationId ?? undefined)],
    };
  },
};

const listPurchaseOrders: ToolDefinition = {
  name: 'list_purchase_orders',
  description: 'List purchase orders with supplier, status, expected date and value.',
  minRole: 'store_manager',
  step: 'Reading purchase orders',
  parameters: schema({
    status: nullableString('draft, submitted, partially_received, received, cancelled, or null.'),
    locationId: nullableString('Restrict to one location, or null for the active one.'),
  }),
  async run(args, runtime) {
    const query = new URLSearchParams({ limit: '25' });
    const status = optionalText(args.status, 30);
    if (['draft', 'submitted', 'partially_received', 'received', 'cancelled'].includes(status)) query.set('status', status);
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
    if (locationId) query.set('locationId', locationId);

    const response = await runtime.get<PurchaseOrdersResponse>(`/purchase-orders?${query}`);
    const orders = response.data ?? [];
    return {
      output: orders.map((order) => ({
        id: order.id,
        reference: order.reference,
        status: order.status,
        supplier: order.supplier?.name ?? null,
        location: order.location?.name ?? null,
        expectedAt: order.expectedAt ?? null,
        valueGbp: round(
          (order.lines ?? []).reduce((sum, line) => sum + toNumber(line.quantityOrdered) * toNumber(line.unitCost), 0),
          2,
        ),
        lines: (order.lines ?? []).length,
      })),
      evidence: `${orders.length} purchase order${orders.length === 1 ? '' : 's'}${status ? ` (${status})` : ''}`,
      shortcuts: [page('Open purchase orders', '/inventory?tab=orders', 'Inventory · Purchase orders')],
    };
  },
};

const listRestockRequests: ToolDefinition = {
  name: 'list_restock_requests',
  description: 'List internal restock requests with their status, quantity and priority.',
  minRole: 'barista',
  step: 'Reading restock requests',
  parameters: schema({ status: nullableString('pending, approved, fulfilled, rejected, or null.') }),
  async run(args, runtime) {
    const query = new URLSearchParams({ limit: '30' });
    const status = optionalText(args.status, 20);
    if (['pending', 'approved', 'fulfilled', 'rejected'].includes(status)) query.set('status', status);
    if (runtime.locationId) query.set('locationId', runtime.locationId);

    const response = await runtime.get<RestockRequestsResponse>(`/restock-requests?${query}`);
    const requests = response.data ?? [];
    return {
      output: requests.map((request) => {
        const decoded = decodeNotes(request.notes);
        return {
          id: request.id,
          item: request.stockItem?.name ?? request.stockItemId,
          unit: request.stockItem?.unit ?? null,
          quantity: toNumber(request.requestedQty),
          status: request.status,
          priority: decoded.priority,
          notes: decoded.notes || null,
          createdAt: request.createdAt,
        };
      }),
      evidence: `${requests.length} restock request${requests.length === 1 ? '' : 's'}${status ? ` (${status})` : ''}`,
      shortcuts: [page('Open restock requests', '/inventory?tab=demand', 'Inventory · Demand')],
    };
  },
};

const getStockOperations: ToolDefinition = {
  name: 'get_stock_operations',
  description: 'Read open stock work: pending transfers between locations and stocktakes in progress.',
  minRole: 'store_manager',
  step: 'Checking stock operations',
  parameters: schema({ locationId: nullableString('Restrict to one location, or null for the active one.') }),
  async run(args, runtime) {
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
    const query = new URLSearchParams({ limit: '20', ...(locationId ? { locationId } : {}) });
    const [transfers, stocktakes] = await Promise.all([
      runtime.get<StockTransfersResponse>(`/stock-transfers?${new URLSearchParams({ ...Object.fromEntries(query), status: 'pending' })}`),
      runtime.get<StocktakesResponse>(`/stocktakes?${new URLSearchParams({ ...Object.fromEntries(query), status: 'in_progress' })}`),
    ]);
    const pendingTransfers = transfers.data ?? [];
    const openStocktakes = stocktakes.data ?? [];
    return {
      output: {
        pendingTransfers: pendingTransfers.map((transfer) => ({
          id: transfer.id,
          from: transfer.fromLocation?.name ?? transfer.fromLocationId,
          to: transfer.toLocation?.name ?? transfer.toLocationId,
          lines: (transfer.lines ?? []).length,
          createdAt: transfer.createdAt,
        })),
        stocktakesInProgress: openStocktakes.map((stocktake) => ({
          id: stocktake.id,
          location: stocktake.location?.name ?? stocktake.locationId,
          startedAt: stocktake.createdAt,
          lines: (stocktake.lines ?? []).length,
        })),
      },
      evidence: `${pendingTransfers.length} pending transfer${pendingTransfers.length === 1 ? '' : 's'}, ${openStocktakes.length} open stocktake${openStocktakes.length === 1 ? '' : 's'}`,
      shortcuts: [page('Open stock', '/inventory', 'Inventory · Stock')],
    };
  },
};

const getLossLog: ToolDefinition = {
  name: 'get_loss_log',
  description: 'Read stock written off over a date range, with reasons — waste, spoilage, breakage or theft.',
  minRole: 'store_manager',
  step: 'Reading the loss log',
  parameters: schema({
    from: nullableString(DATE),
    to: nullableString(DATE),
    locationId: nullableString('Restrict to one location, or null for the active one.'),
  }),
  async run(args, runtime) {
    const query = rangeQuery(args, runtime);
    query.set('limit', '50');
    const response = await runtime.get<LossLogResponse>(`/loss-log?${query}`);
    const records = response.data ?? [];
    const byReason = new Map<string, number>();
    for (const record of records) byReason.set(record.reason ?? 'other', (byReason.get(record.reason ?? 'other') ?? 0) + 1);
    return {
      output: {
        total: response.total ?? records.length,
        byReason: Object.fromEntries(byReason),
        records: records.slice(0, 40).map((record) => ({
          id: record.id,
          item: record.stockItem?.name ?? record.stockItemId,
          unit: record.stockItem?.unit ?? null,
          quantity: Math.abs(toNumber(record.quantity)),
          reason: record.reason ?? 'other',
          location: record.location?.name ?? null,
          notes: record.notes,
          createdAt: record.createdAt,
        })),
      },
      evidence: `${records.length} write-off${records.length === 1 ? '' : 's'} ${query.get('from')}–${query.get('to')}`,
      shortcuts: [page('Open stock', '/inventory', 'Inventory · Stock')],
    };
  },
};

// ── Customers ────────────────────────────────────────────────────────────────

const searchCustomers: ToolDefinition = {
  name: 'search_customers',
  description: 'Find customers by name, phone or email. Returns loyalty tier, points balance and spend.',
  minRole: 'barista',
  step: 'Searching customers',
  parameters: schema({ query: { type: 'string', description: 'Name, phone or email fragment; empty string lists recent customers.' } }),
  async run(args, runtime) {
    const search = optionalText(args.query, 60);
    const query = new URLSearchParams({ limit: '25', ...(search ? { search } : {}) });
    const response = await runtime.get<CustomersResponse>(`/customers?${query}`);
    const customers = response.data ?? [];
    return {
      output: customers.map((customer) => ({
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        phone: customer.phone,
        email: customer.email ?? null,
        tier: customer.tier,
        pointsBalance: customer.pointsBalance,
        totalVisits: customer.totalVisits,
        totalSpentGbp: toNumber(customer.totalSpent),
        lastVisitAt: customer.lastVisitAt ?? null,
        marketingOptIn: customer.marketingOptIn,
      })),
      evidence: `${customers.length} customer${customers.length === 1 ? '' : 's'}${search ? ` matching “${search}”` : ''}`,
      shortcuts: [page('Open customers', '/customers', 'Customers')],
    };
  },
};

// ── People ───────────────────────────────────────────────────────────────────

const getSchedule: ToolDefinition = {
  name: 'get_schedule',
  description:
    'Read the rota for a date range plus who is clocked in right now. Defaults to today. Returns draft and published shifts with the person’s name, their local start and end times, and how long anyone on shift has been clocked in.',
  minRole: 'store_manager',
  step: 'Reading the rota',
  parameters: schema({
    from: nullableString(`${DATE} Defaults to today.`),
    to: nullableString(`${DATE} Defaults to the same day as from.`),
    locationId: nullableString('Restrict to one location, or null for the active one.'),
  }),
  async run(args, runtime) {
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
    const timeZone = await runtime.timezone(locationId);
    const today = zonedNow(timeZone).date;
    const from = isIsoDate(args.from) ? args.from : today;
    const to = isIsoDate(args.to) ? args.to : from;

    // The rota endpoints filter on instants, not calendar dates: a bare
    // "to=2026-08-07" means midnight *this morning*, which hides every shift
    // that runs during the day. Send the full local span instead.
    const query = new URLSearchParams({ from: zonedIso(from, '00:00', timeZone), to: zonedIso(addDays(to, 1), '00:00', timeZone) });
    if (locationId) query.set('locationId', locationId);

    const [shifts, active, names] = await Promise.all([
      runtime.get<ScheduledShift[]>(`/scheduled-shifts?${query}`),
      runtime.get<Shift[]>('/shifts/active').catch(() => [] as Shift[]),
      runtime.staffNames(),
    ]);

    // Some endpoints embed the account, some return only a user id; the staff
    // directory closes the gap so nobody is reported as a raw id.
    const who = (userId?: string | null, embedded?: { name?: string; user?: { name?: string; email?: string } } | null) =>
      embedded?.name || embedded?.user?.name || embedded?.user?.email || (userId ? (names.get(userId) ?? userId) : '');

    const onShift = active.filter((shift) => !locationId || shift.locationId === locationId);
    const clockedInNow = onShift.map((shift) => ({
      staff: who(shift.userId, shift.staff) || 'Unknown',
      location: shift.location?.name ?? shift.locationId,
      clockedInAt: shift.clockedIn,
      localClockIn: formatDateTime(shift.clockedIn, timeZone),
      minutesOnShift: Math.max(0, Math.round((Date.now() - Date.parse(shift.clockedIn)) / 60_000)) || 0,
    }));

    return {
      output: {
        range: { from, to, timeZone },
        scheduled: shifts.slice(0, 60).map((shift) => ({
          id: shift.id,
          staff: who(shift.userId, shift.staff) || 'Open shift (unassigned)',
          location: shift.location?.name ?? shift.locationId,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          local: `${formatDateTime(shift.startsAt, timeZone)} → ${formatDateTime(shift.endsAt, timeZone)}`,
          role: shift.role ?? null,
          status: shift.status,
        })),
        clockedInNow,
        note:
          shifts.length === 0 ? 'No shifts are on the rota for this range. Anyone clocked in is working an unrostered shift.' : undefined,
      },
      evidence: `${shifts.length} scheduled shift${shifts.length === 1 ? '' : 's'} ${from}${to === from ? '' : `–${to}`}, ${clockedInNow.length} clocked in`,
      shortcuts: [page('Open the rota', '/staff/rota', 'Switches the active location', locationId ?? undefined)],
    };
  },
};

const listLeaveRequests: ToolDefinition = {
  name: 'list_leave_requests',
  description: 'List staff leave requests and their status, with the request id needed to approve or decline one.',
  minRole: 'store_manager',
  step: 'Reading leave requests',
  parameters: schema({ status: nullableString('pending, approved, declined, cancelled, or null for pending.') }),
  async run(args, runtime) {
    const status = optionalText(args.status, 20) || 'pending';
    const [requests, names] = await Promise.all([
      runtime.get<LeaveRequest[]>(`/hr/leave-requests?status=${encodeURIComponent(status)}`),
      runtime.staffNames(),
    ]);
    return {
      output: requests.slice(0, 40).map((request) => ({
        id: request.id,
        employee: request.employee?.name || names.get(request.userId) || request.userId,
        leaveType: request.leaveType?.name ?? null,
        paid: request.leaveType?.isPaid ?? null,
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: toNumber(request.totalDays),
        status: request.status,
        notes: request.notes ?? null,
      })),
      evidence: `${requests.length} ${status} leave request${requests.length === 1 ? '' : 's'}`,
      shortcuts: [page('Open leave requests', '/staff/requests', 'Team · Requests')],
    };
  },
};

const listHelpdeskTickets: ToolDefinition = {
  name: 'list_helpdesk_tickets',
  description: 'List internal helpdesk tickets raised by staff — HR, payroll, scheduling, IT and workplace issues.',
  minRole: 'store_manager',
  step: 'Reading helpdesk tickets',
  parameters: schema({ status: nullableString('open, in_progress, waiting_employee, resolved, closed, or null.') }),
  async run(args, runtime) {
    const status = optionalText(args.status, 30);
    const query = status ? `?${new URLSearchParams({ status })}` : '';
    const tickets = await runtime.get<HelpdeskTicket[]>(`/helpdesk/manage${query}`);
    return {
      output: tickets.slice(0, 40).map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        raisedBy: ticket.employee?.name ?? ticket.createdBy,
        assignee: ticket.assignee?.name ?? null,
        updatedAt: ticket.updatedAt,
      })),
      evidence: `${tickets.length} helpdesk ticket${tickets.length === 1 ? '' : 's'}${status ? ` (${status})` : ''}`,
      shortcuts: [page('Open helpdesk', '/staff/helpdesk', 'Team · Helpdesk')],
    };
  },
};

export const TOOLS: ToolDefinition[] = [
  searchSupport,
  listLocations,
  listSuppliers,
  listStockItems,
  listMenuItems,
  listStaff,
  getSalesReport,
  getBusinessAnalytics,
  listOrders,
  getOrderDetail,
  getInventoryStatus,
  listPurchaseOrders,
  listRestockRequests,
  getStockOperations,
  getLossLog,
  searchCustomers,
  getSchedule,
  listLeaveRequests,
  listHelpdeskTickets,
];

const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function toolsForRole(role: StaffRole | null | undefined) {
  return TOOLS.filter((tool) => roleAtLeast(role, tool.minRole));
}

export function toolByName(name: string) {
  return TOOL_BY_NAME.get(name);
}
