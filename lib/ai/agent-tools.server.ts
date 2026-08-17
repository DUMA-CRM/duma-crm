import 'server-only';

import type {
  CustomerRetention,
  HourlyVolume,
  OrderAnalytics,
  RevenueByLocation,
  StaffHoursAnalytics,
  TopItemAnalytics,
} from '@/lib/api/analytics.service';
import type { AuditLogsResponse } from '@/lib/api/audit.service';
import type { EmailAutomation, EmailConnection, EmailDeliveriesResponse, EmailTemplate } from '@/lib/api/email.service';
import type { HrEmployee } from '@/lib/api/hr.service';
import type { InventoryForecast, LowStockAlert } from '@/lib/api/inventory.service';
import type { LossLogResponse } from '@/lib/api/loss.service';
import type { CashUp } from '@/lib/api/operations.service';
import type { Order, OrderDetail } from '@/lib/api/orders.service';
import type { PayrollPreview, PayrollRun } from '@/lib/api/payroll.service';
import type {
  AbsenceLog,
  AttendanceDay,
  EmployeeDocument,
  ExpenseClaim,
  HelpdeskTicket,
  LeaveEntitlement,
  LeaveRequest,
  Payslip,
} from '@/lib/api/people-ops.service';
import type { PrivacyRequest } from '@/lib/api/privacy.service';
import type { PurchaseOrdersResponse } from '@/lib/api/purchasing.service';
import type { RestockRequestsResponse } from '@/lib/api/restock.service';
import { decodeNotes } from '@/lib/api/restock.service';
import type { ScheduledShift } from '@/lib/api/scheduling.service';
import type { Shift } from '@/lib/api/shifts.service';
import type { StocktakesResponse } from '@/lib/api/stocktakes.service';
import type { StockTransfersResponse } from '@/lib/api/transfers.service';
import type { Location } from '@/lib/api/workspace.service';
import { auditChangeSet, auditSubject } from '@/lib/audit/change';
import { auditActor, auditPhrase, auditRole, auditSeverity, resourceLabel, severityLabel } from '@/lib/audit/narrative';
import { type Capability, hasCapability } from '@/lib/auth/capabilities';
import {
  attendanceTotals,
  groupAttendanceByWeek,
  leaveBalance,
  mergeAbsenceDays,
  myHrActions,
  payslipDeductions,
  payslipReconciles,
} from '@/lib/utils/my-hr';
import type { CustomerSegment, CustomersResponse } from '@/types/customers';

import {
  addDays,
  calendarAnchors,
  formatDateTime,
  gbp,
  isIsoDate,
  isWithinHours,
  optionalText,
  percentChange,
  rangeLabel,
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
  /** Internal provenance retained for diagnostics; it is not rendered in chat. */
  evidence?: string;
  shortcuts?: AgentShortcut[];
  cards?: AgentCard[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** Capability required to offer this tool. Omit when every signed-in user may use it. */
  capability?: Capability;
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

/** "partially_received" → "Partially received", for card titles and empty states. */
const sentence = (value: string) => value.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());

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
  // No capability — product documentation is open to every signed-in user.
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
  // No capability — GET /locations is authenticated but ungated on the API.
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
  capability: 'suppliers:read',
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
      cards: [
        {
          kind: 'list',
          title: 'Active suppliers',
          emptyLabel: 'No active suppliers are set up yet.',
          caption: `${suppliers.length} available`,
          rows: suppliers.slice(0, 6).map((supplier) => ({
            label: supplier.name,
            value: supplier.phone ?? undefined,
            meta: [supplier.contactName, supplier.email].filter(Boolean).join(' · ') || 'No contact details',
          })),
        },
      ],
      shortcuts: [page('Open suppliers', '/inventory?tab=suppliers', 'Inventory · Suppliers')],
    };
  },
};

const listStockItems: ToolDefinition = {
  name: 'list_stock_items',
  description: 'Find active stock items with their units, last known costs and default reorder quantities.',
  // No capability — GET /stock-items is authenticated but ungated on the API.
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
      cards: query
        ? [
            {
              kind: 'list',
              title: `Stock matching “${query}”`,
              emptyTone: 'search' as const,
              emptyLabel: `No stock item matches “${query}”.`,
              caption: items.length > 6 ? `Showing 6 of ${items.length}` : undefined,
              rows: items.slice(0, 6).map((item) => ({
                label: item.name,
                value: item.costPerUnit == null ? undefined : gbp(item.costPerUnit),
                meta: `${item.category} · ${item.unit}`,
              })),
            },
          ]
        : undefined,
      shortcuts: [page('Open stock', '/inventory', 'Inventory · Stock')],
    };
  },
};

const listMenuItems: ToolDefinition = {
  name: 'list_menu_items',
  description: 'List menu items with their brand-wide price, category and availability.',
  // No capability — the menu is readable by every signed-in user.
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
      cards: query
        ? [
            {
              kind: 'list',
              title: `Menu items matching “${query}”`,
              emptyTone: 'search' as const,
              emptyLabel: `No menu item matches “${query}”.`,
              caption: items.length > 6 ? `Showing 6 of ${items.length}` : undefined,
              rows: items.slice(0, 6).map((item) => ({
                label: item.name,
                value: gbp(item.price),
                meta: `${item.category} · ${item.isAvailable ? 'Available' : 'Hidden'}`,
                tone: item.isAvailable ? ('default' as const) : ('warning' as const),
              })),
            },
          ]
        : undefined,
      shortcuts: [page('Open menu', '/menu', 'Menu')],
    };
  },
};

const listStaff: ToolDefinition = {
  name: 'list_staff',
  description: 'List active staff with their role and scope. Use to resolve a person’s name to a user id.',
  capability: 'staff:read',
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
      cards: [
        {
          kind: 'list',
          title: 'Team',
          emptyLabel: 'No active team members in this workspace.',
          caption: staff.length > 6 ? `Showing 6 of ${staff.length}` : undefined,
          rows: staff.slice(0, 6).map((member) => ({
            label: member.name || member.email || 'Unnamed team member',
            value: ROLE_LABELS[member.role] ?? member.role,
            meta: member.email ?? member.scope,
          })),
        },
      ],
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
  capability: 'analytics:read',
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
    const basis = rangeLabel(previousFrom as string, previousTo as string);
    /**
     * `percentChange` returns 0 when both periods are zero, which is true as
     * arithmetic and a lie as a reading: "0% vs previous" claims a comparison
     * that had nothing on either side of it. A delta is only printed when the
     * earlier period actually traded, and it names what it was measured
     * against rather than saying "previous".
     */
    const delta = (change: number | null, previousValue: number) => {
      if (previousValue === 0) return currentSummary.orders === 0 ? 'No trade either period' : `Nothing on ${basis} to compare`;
      if (change == null) return undefined;
      return `${change > 0 ? '+' : ''}${change}% vs ${basis}`;
    };
    const comparable = (previousValue: number) => previousValue !== 0;

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
          title: rangeLabel(currentFrom as string, currentTo as string),
          caption: `vs ${basis}`,
          metrics: [
            {
              label: 'Net revenue',
              value: gbp(currentSummary.netRevenueGbp),
              hint: delta(changes.netRevenue, previousSummary.netRevenueGbp),
              trend: comparable(previousSummary.netRevenueGbp) ? trendOf(changes.netRevenue) : undefined,
            },
            {
              label: 'Orders',
              value: String(currentSummary.orders),
              hint: delta(changes.orders, previousSummary.orders),
              trend: comparable(previousSummary.orders) ? trendOf(changes.orders) : undefined,
            },
            {
              label: 'Avg order',
              value: gbp(currentSummary.averageOrderValueGbp),
              hint: delta(changes.averageOrderValue, previousSummary.averageOrderValueGbp),
              trend: comparable(previousSummary.averageOrderValueGbp) ? trendOf(changes.averageOrderValue) : undefined,
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
  capability: 'analytics:read',
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
                caption: rangeLabel(query.get('from') ?? '', query.get('to') ?? ''),
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
  capability: 'orders:read',
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
      cards: [
        {
          kind: 'list',
          title: status ? `${sentence(status)} orders` : 'Recent orders',
          emptyLabel: status ? `No ${status} orders in this range.` : 'No orders in this range.',
          caption: orders.length > 6 ? `Showing 6 of ${orders.length}` : undefined,
          rows: orders.slice(0, 6).map((order) => ({
            label: `Order #${order.id.slice(0, 8)}`,
            value: gbp(order.totalAmount),
            meta: `${order.status} · ${formatDateTime(order.createdAt, 'Europe/London')}`,
            tone:
              order.status === 'cancelled' ? ('negative' as const) : order.status === 'done' ? ('positive' as const) : ('default' as const),
          })),
        },
      ],
      shortcuts: [page('Open orders', '/orders', 'Orders')],
    };
  },
};

const getOrderDetail: ToolDefinition = {
  name: 'get_order',
  description: 'Read one order in full: items, modifiers, payment, refunds, void reason and status history.',
  capability: 'orders:read',
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
  capability: 'inventory:read',
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
  capability: 'purchasing:read',
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
      cards: [
        {
          kind: 'list',
          title: status ? `${sentence(status)} purchase orders` : 'Purchase orders',
          emptyLabel: status ? `No ${sentence(status).toLowerCase()} purchase orders.` : 'No purchase orders raised yet.',
          caption: orders.length > 6 ? `Showing 6 of ${orders.length}` : undefined,
          rows: orders.slice(0, 6).map((order) => ({
            label: order.reference || `PO #${order.id.slice(0, 8)}`,
            value: gbp((order.lines ?? []).reduce((sum, line) => sum + toNumber(line.quantityOrdered) * toNumber(line.unitCost), 0)),
            meta: [order.supplier?.name, order.status, order.expectedAt?.slice(0, 10)].filter(Boolean).join(' · '),
            tone:
              order.status === 'cancelled'
                ? ('negative' as const)
                : order.status === 'received'
                  ? ('positive' as const)
                  : ('default' as const),
          })),
        },
      ],
      shortcuts: [page('Open purchase orders', '/inventory?tab=orders', 'Inventory · Purchase orders')],
    };
  },
};

const listRestockRequests: ToolDefinition = {
  name: 'list_restock_requests',
  description: 'List internal restock requests with their status, quantity and priority.',
  capability: 'restock:read',
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
      cards: [
        {
          kind: 'list',
          title: status ? `${sentence(status)} restock requests` : 'Restock requests',
          emptyLabel: status ? `No ${status} restock requests.` : 'No restock has been requested.',
          caption: requests.length > 6 ? `Showing 6 of ${requests.length}` : undefined,
          rows: requests.slice(0, 6).map((request) => {
            const decoded = decodeNotes(request.notes);
            return {
              label: request.stockItem?.name ?? request.stockItemId,
              value: `${toNumber(request.requestedQty)} ${request.stockItem?.unit ?? ''}`.trim(),
              meta: `${request.status} · ${decoded.priority}`,
              tone: decoded.priority === 'urgent' ? ('warning' as const) : ('default' as const),
            };
          }),
        },
      ],
      shortcuts: [page('Open restock requests', '/inventory?tab=demand', 'Inventory · Demand')],
    };
  },
};

const getStockOperations: ToolDefinition = {
  name: 'get_stock_operations',
  description: 'Read open stock work: pending transfers between locations and stocktakes in progress.',
  capability: 'stock:read',
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
  capability: 'loss:read',
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
  capability: 'customers:read',
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
      cards: [
        {
          kind: 'list',
          title: search ? `Customers matching “${search}”` : 'Recent customers',
          emptyTone: search ? ('search' as const) : ('none' as const),
          emptyLabel: search ? `No customer matches “${search}”.` : 'No customers on record yet.',
          caption: customers.length > 6 ? `Showing 6 of ${customers.length}` : undefined,
          rows: customers.slice(0, 6).map((customer) => ({
            label: `${customer.firstName} ${customer.lastName}`.trim(),
            value: `${customer.pointsBalance} pts`,
            meta: [customer.tier, customer.email || customer.phone].filter(Boolean).join(' · '),
          })),
        },
      ],
      shortcuts: [page('Open customers', '/customers', 'Customers')],
    };
  },
};

const listCustomerSegments: ToolDefinition = {
  name: 'list_customer_segments',
  description: 'List saved customer segments and the filters each segment uses. Segment membership is evaluated live when opened.',
  capability: 'segments:read',
  step: 'Checking customer segments',
  parameters: schema({}),
  async run(_args, runtime) {
    const response = await runtime.get<{ data: CustomerSegment[] }>('/customer-segments');
    const segments = response.data ?? [];
    return {
      output: segments,
      evidence: `${segments.length} saved customer segment${segments.length === 1 ? '' : 's'}`,
      cards: [
        {
          kind: 'list',
          title: 'Customer segments',
          caption: 'Membership updates from live customer data',
          rows: segments.slice(0, 6).map((segment) => ({
            label: segment.name,
            meta: segment.description || `${Object.keys(segment.filters ?? {}).length} active filters`,
          })),
          emptyLabel: 'No saved customer segments.',
        },
      ],
      shortcuts: [page('Open customer segments', '/customers', 'Customers · Segments')],
    };
  },
};

// ── People ───────────────────────────────────────────────────────────────────

const getSchedule: ToolDefinition = {
  name: 'get_schedule',
  description:
    'Read the rota for a date range plus who is clocked in right now. Defaults to today. Returns draft and published shifts with the person’s name, their local start and end times, and how long anyone on shift has been clocked in.',
  capability: 'scheduling:read',
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
  capability: 'hr.leave:read',
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
      cards: [
        {
          kind: 'list',
          title: `${sentence(status)} leave`,
          emptyLabel: `No ${status} leave requests.`,
          caption: requests.length > 6 ? `Showing 6 of ${requests.length}` : undefined,
          rows: requests.slice(0, 6).map((request) => ({
            label: request.employee?.name || names.get(request.userId) || request.userId,
            value: `${toNumber(request.totalDays)} days`,
            meta: `${request.startDate} → ${request.endDate}${request.leaveType?.name ? ` · ${request.leaveType.name}` : ''}`,
            tone:
              request.status === 'declined'
                ? ('negative' as const)
                : request.status === 'approved'
                  ? ('positive' as const)
                  : ('warning' as const),
          })),
        },
      ],
      shortcuts: [page('Open leave requests', '/staff/requests', 'Team · Requests')],
    };
  },
};

const listHelpdeskTickets: ToolDefinition = {
  name: 'list_helpdesk_tickets',
  description: 'List internal helpdesk tickets raised by staff — HR, payroll, scheduling, IT and workplace issues.',
  capability: 'helpdesk:manage',
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
      cards: [
        {
          kind: 'list',
          title: status ? `${sentence(status)} helpdesk tickets` : 'Helpdesk tickets',
          emptyLabel: status ? `No ${sentence(status).toLowerCase()} helpdesk tickets.` : 'No helpdesk tickets have been raised.',
          caption: tickets.length > 6 ? `Showing 6 of ${tickets.length}` : undefined,
          rows: tickets.slice(0, 6).map((ticket) => ({
            label: ticket.subject,
            value: ticket.status.replaceAll('_', ' '),
            meta: `${ticket.category} · ${ticket.priority}${ticket.employee?.name ? ` · ${ticket.employee.name}` : ''}`,
            tone:
              ticket.priority === 'urgent'
                ? ('negative' as const)
                : ticket.priority === 'high'
                  ? ('warning' as const)
                  : ('default' as const),
          })),
        },
      ],
      shortcuts: [page('Open helpdesk', '/staff/helpdesk', 'Team · Helpdesk')],
    };
  },
};

// ── Governance, finance and communications ──────────────────────────────────

const getCashUpStatus: ToolDefinition = {
  name: 'get_cash_up_status',
  description: 'Read cash-up records for a location, including expected cash/card totals, counted totals, status and variance.',
  capability: 'cashups:read',
  step: 'Checking cash-up records',
  parameters: schema({ locationId: nullableString('Location to inspect, or null for the active location.') }),
  async run(args, runtime) {
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
    if (!locationId) return { output: { error: 'Select a location before checking cash-up records.' } };
    const records = await runtime.get<CashUp[]>(`/cash-ups?${new URLSearchParams({ locationId })}`);
    return {
      output: records.slice(0, 30),
      evidence: `${records.length} cash-up record${records.length === 1 ? '' : 's'}`,
      cards: [
        {
          kind: 'list',
          title: 'Cash-up status',
          caption: (await runtime.locationName(locationId)) || undefined,
          rows: records.slice(0, 6).map((record) => ({
            label: record.tradingDate,
            value: record.cashVariance == null ? record.status : gbp(record.cashVariance),
            meta: `${record.status} · cash variance ${record.cashVariance == null ? 'pending' : gbp(record.cashVariance)} · card variance ${record.cardVariance == null ? 'pending' : gbp(record.cardVariance)}`,
            tone:
              record.status !== 'closed'
                ? ('warning' as const)
                : Math.abs(toNumber(record.cashVariance)) > 0.01 || Math.abs(toNumber(record.cardVariance)) > 0.01
                  ? ('warning' as const)
                  : ('positive' as const),
          })),
          emptyLabel: 'No cash-up records for this location.',
        },
      ],
      shortcuts: [page('Open cash-up', '/cash-up', 'Cash-up', locationId)],
    };
  },
};

const listPrivacyRequests: ToolDefinition = {
  name: 'list_privacy_requests',
  description: 'List GDPR/privacy requests with type, status, customer and due date.',
  capability: 'privacy:read',
  step: 'Checking privacy requests',
  parameters: schema({ status: nullableString('received, in_progress, awaiting_identity, completed, declined, or null for all.') }),
  async run(args, runtime) {
    const status = optionalText(args.status, 30);
    const query = status ? `?${new URLSearchParams({ status })}` : '';
    const requests = await runtime.get<PrivacyRequest[]>(`/privacy-requests${query}`);
    return {
      output: requests.slice(0, 40),
      evidence: `${requests.length} privacy request${requests.length === 1 ? '' : 's'}${status ? ` (${status})` : ''}`,
      cards: [
        {
          kind: 'list',
          title: status ? `${sentence(status)} privacy requests` : 'Privacy requests',
          emptyLabel: status ? `No ${sentence(status).toLowerCase()} privacy requests.` : 'No privacy requests have been received.',
          caption: requests.length > 6 ? `Showing 6 of ${requests.length}` : undefined,
          rows: requests.slice(0, 6).map((request) => ({
            label:
              request.customerSnapshot?.name ||
              (request.customer ? `${request.customer.firstName} ${request.customer.lastName}` : 'Unknown customer'),
            value: request.status.replaceAll('_', ' '),
            meta: `${request.type} · due ${request.dueAt.slice(0, 10)}`,
            tone:
              !['completed', 'declined'].includes(request.status) && Date.parse(request.dueAt) < Date.now()
                ? ('negative' as const)
                : ('default' as const),
          })),
        },
      ],
      shortcuts: [page('Open compliance', '/compliance', 'Compliance')],
    };
  },
};

/**
 * The audit trail, told the way the audit page tells it.
 *
 * This used to hand the model `response.data` — raw rows carrying
 * `orders.status_update`, a bare `orders`, UUIDs and two JSON strings. The
 * model then had strictly less to work with than a person looking at the page,
 * and had to guess at the vocabulary. It now runs the same narrative layer the
 * page does, so a tool result reads "Sam Reed (Store Manager) cancelled order
 * PO-0912 — Status: pending → cancelled".
 *
 * `notes` states the scope explicitly. Without it a model asked "did anyone
 * delete anything this month?" will answer from one page of results as though
 * it had seen every entry.
 */
const AUDIT_TOOL_LIMIT = 50;
/**
 * Outcome is not a server filter — the API has no status parameter — so it is
 * applied to what was fetched. Pulling the endpoint's maximum first makes that
 * sample as close to "everything recent" as the API allows, and `notes` says
 * exactly how many entries were actually examined.
 */
const AUDIT_SCAN_LIMIT = 200;
/**
 * A sweep pages until it runs out of matches or hits this many entries. The cap
 * is a cost bound, not a claim about completeness — whatever it did not reach is
 * stated in `notes` so the model cannot present a partial sweep as the whole log.
 */
const AUDIT_SCAN_MAX = 1_000;

const getAuditActivity: ToolDefinition = {
  name: 'get_audit_activity',
  description:
    'Read the audit trail: who did what to which record, whether it worked, and what changed. Filter by actor, action, record type, a specific record ID, or a date range.',
  capability: 'audit:read',
  step: 'Reading the audit trail',
  parameters: schema({
    userId: nullableString('Actor user ID to filter to one person, or null.'),
    action: nullableString('Exact action key such as "orders.cancel" or "hr.leave_approved", or null.'),
    resourceType: nullableString('Record type such as "orders", "customers", "stock-items" — plural, as the API stores it. Or null.'),
    resourceId: nullableString('A single record ID, to trace everything that happened to it. Matched in full. Or null.'),
    from: nullableString(`Start of the range. ${DATE} Or null.`),
    to: nullableString(`End of the range. ${DATE} Or null.`),
    outcome: nullableString(
      'Narrow by result: "failed" for anything that failed or was refused, "destructive" for deletions, cancellations, refunds and erasures. Null for everything.',
    ),
  }),
  async run(args, runtime) {
    const outcome = optionalText(args.outcome, 20)?.toLowerCase();
    const wantsFailed = outcome === 'failed';
    const wantsDestructive = outcome === 'destructive';
    const filtering = wantsFailed || wantsDestructive;

    const perPage = filtering ? AUDIT_SCAN_LIMIT : AUDIT_TOOL_LIMIT;
    const query = new URLSearchParams({ page: '1', limit: String(perPage) });
    for (const key of ['userId', 'action', 'resourceType', 'resourceId', 'from', 'to'] as const) {
      const value = optionalText(args[key], 120);
      if (value) query.set(key, value);
    }

    // Outcome is not a server filter, so answering "show me everything that
    // failed" honestly means walking the pages rather than judging the first
    // one. Only a filtered sweep pages; an unfiltered read is a recent-activity
    // question and one page answers it.
    const first = await runtime.get<AuditLogsResponse>(`/audit-logs?${query}`);
    const rows = [...first.data];
    let pagesRead = 1;

    if (filtering && first.pages > 1) {
      const lastPage = Math.min(first.pages, Math.ceil(AUDIT_SCAN_MAX / perPage));
      for (let next = 2; next <= lastPage; next += 1) {
        runtime.progress(`Reading the audit trail — page ${next} of ${lastPage}, ${rows.length} entries scanned`);
        query.set('page', String(next));
        const batch = await runtime.get<AuditLogsResponse>(`/audit-logs?${query}`);
        rows.push(...batch.data);
        pagesRead = next;
        if (batch.data.length === 0) break;
      }
    }

    const response = { ...first, data: rows };
    const scanned = rows.length;
    const completeSweep = scanned >= response.total;
    if (pagesRead > 1) runtime.progress(`Scanned ${scanned} audit entries across ${pagesRead} pages`);

    const entries = response.data.map((log) => {
      const severity = auditSeverity(log);
      const { changes, facts } = auditChangeSet(log);
      const subject = auditSubject(log);
      return {
        at: log.createdAt,
        when: formatDateTime(log.createdAt, 'Europe/London'),
        actor: auditActor(log),
        role: auditRole(log),
        did: auditPhrase(log),
        record: {
          type: resourceLabel(log.resourceType),
          name: subject,
          id: log.resourceId ?? null,
        },
        outcome: severityLabel(severity, log.statusCode) ?? 'Succeeded',
        destructive: severity === 'destructive',
        // Only a handful of handlers record prior values, so `from` is often
        // absent. Never present a missing `from` as "no change".
        changed: changes.length ? changes.map((change) => ({ field: change.label, from: change.before ?? null, to: change.after })) : null,
        details: facts.length ? facts.map((fact) => ({ label: fact.label, value: fact.value })) : null,
      };
    });

    const matches = wantsFailed
      ? entries.filter((entry) => entry.outcome !== 'Succeeded')
      : wantsDestructive
        ? entries.filter((entry) => entry.destructive)
        : entries;

    const failures = entries.filter((entry) => entry.outcome !== 'Succeeded');
    const actors = [...new Set(entries.map((entry) => entry.actor))];
    const records = new Set(response.data.filter((log) => log.resourceId).map((log) => `${log.resourceType}:${log.resourceId}`));

    const notes = [
      completeSweep
        ? `All ${response.total} matching entries were examined${pagesRead > 1 ? ` across ${pagesRead} pages` : ''}.`
        : `Only the ${scanned} most recent of ${response.total} matching entries were examined${pagesRead > 1 ? ` across ${pagesRead} pages` : ''}. Do not describe this as a complete history — narrow the filters or say what was not seen.`,
      'Entries are newest first.',
      'Where a changed field has no "from" value, the API stored only the new value — say the field was set, not that it changed from nothing.',
    ];
    if (filtering) {
      notes.push(
        `The audit API cannot filter by outcome, so the "${outcome}" filter was applied to the ${scanned} entries fetched. ${matches.length} of them matched.`,
      );
      if (!completeSweep) {
        notes.push(
          `The sweep stopped at ${AUDIT_SCAN_MAX} entries. Say the count is "at least ${matches.length}" and offer a narrower date range for a complete answer.`,
        );
      }
    }
    if (!query.has('from') && !query.has('to')) notes.push('No date range was applied, so this is simply the most recent activity.');

    // The card names what was actually asked for, and uses the real actor and
    // record names from the results rather than echoing the ID that was filtered on.
    const distinctActors = [...new Set(matches.map((entry) => entry.actor))];
    const distinctNames = [...new Set(matches.map((entry) => entry.record.name).filter(Boolean))];
    const scope: string[] = [];
    if (query.has('userId') && distinctActors.length === 1) scope.push(`by ${distinctActors[0]}`);
    if (query.has('resourceId') && distinctNames.length === 1) scope.push(`on ${distinctNames[0]}`);
    else if (query.has('resourceType') && matches.length > 0) scope.push(`on ${matches[0].record.type.toLowerCase()}`);
    const title = [
      wantsFailed ? 'Failed and refused' : wantsDestructive ? 'Deletions, cancellations and refunds' : 'Audit activity',
      ...scope,
    ].join(' ');

    const shown = matches.slice(0, 8);

    return {
      output: {
        summary: {
          matchedOnServer: response.total,
          examined: scanned,
          returned: matches.length,
          failedOrRefused: failures.length,
          distinctActors: actors.length,
          distinctRecords: records.size,
        },
        entries: matches,
        notes,
      },
      evidence: `${response.total} matching audit event${response.total === 1 ? '' : 's'}${filtering ? `, ${matches.length} matching "${outcome}" in the ${scanned} examined` : failures.length ? `, ${failures.length} failed or refused` : ''}`,
      cards: [
        {
          kind: 'list',
          title,
          caption:
            matches.length > shown.length
              ? `Showing ${shown.length} of ${matches.length}`
              : filtering
                ? completeSweep
                  ? `${matches.length} of all ${scanned} matching entries`
                  : `${matches.length} of the ${scanned} most recent entries`
                : undefined,
          rows: shown.map((entry) => ({
            label: `${entry.actor}${entry.role ? ` (${entry.role})` : ''} ${entry.did}`,
            value: entry.outcome === 'Succeeded' ? (entry.destructive ? 'Destructive' : undefined) : entry.outcome,
            meta: `${entry.record.type} · ${entry.when}`,
            tone: entry.outcome !== 'Succeeded' ? ('negative' as const) : entry.destructive ? ('warning' as const) : ('default' as const),
          })),
          emptyTone: filtering ? ('clean' as const) : ('none' as const),
          emptyLabel: wantsFailed
            ? `Nothing failed or was refused in the ${scanned} entries examined.`
            : wantsDestructive
              ? `Nothing was deleted, cancelled or refunded in the ${scanned} entries examined.`
              : 'No audit entries match those filters.',
        },
      ],
      shortcuts: [page('Open audit log', '/audit-log', 'Audit log')],
    };
  },
};

const getCommunicationsStatus: ToolDefinition = {
  name: 'get_communications_status',
  description: 'Read email connection health, templates, automations and recent delivery results.',
  capability: 'email:read',
  step: 'Checking customer communications',
  parameters: schema({}),
  async run(_args, runtime) {
    const tenant = runtime.tenantId ? `?tenantId=${encodeURIComponent(runtime.tenantId)}` : '';
    const deliveriesQuery = new URLSearchParams({ page: '1', limit: '20', ...(runtime.tenantId ? { tenantId: runtime.tenantId } : {}) });
    const [connection, templates, automations, deliveries] = await Promise.all([
      runtime.get<EmailConnection | null>(`/email/connection${tenant}`),
      runtime.get<EmailTemplate[]>(`/email/templates${tenant}`),
      runtime.get<EmailAutomation[]>(`/email/automations${tenant}`),
      runtime.get<EmailDeliveriesResponse>(`/email/deliveries?${deliveriesQuery}`),
    ]);
    const failed = deliveries.data.filter((delivery) => delivery.status === 'failed').length;
    return {
      output: { connection, templates, automations, deliveries: deliveries.data },
      evidence: `${templates.length} templates, ${automations.length} automations, ${failed} recent failures`,
      cards: [
        {
          title: 'Customer email',
          caption: connection?.fromEmail || 'No sender connected',
          metrics: [
            {
              label: 'Connection',
              value: connection?.isEnabled ? 'Enabled' : 'Needs setup',
              tone: connection?.isEnabled ? 'positive' : 'warning',
            },
            { label: 'Active templates', value: String(templates.filter((item) => item.isActive).length) },
            { label: 'Live automations', value: String(automations.filter((item) => item.isEnabled).length) },
            { label: 'Recent failures', value: String(failed), tone: failed ? 'negative' : 'positive' },
          ],
        },
      ],
      shortcuts: [page('Open communications', '/communications', 'Communications')],
    };
  },
};

const getPayrollOverview: ToolDefinition = {
  name: 'get_payroll_overview',
  description: 'Preview payroll gross pay and paid hours for a date range, plus recent payroll runs.',
  capability: 'hr.payroll:read',
  step: 'Checking payroll',
  parameters: schema({
    period: { type: 'string', enum: ['weekly', 'monthly'] },
    from: { type: 'string', description: DATE },
    to: { type: 'string', description: DATE },
  }),
  async run(args, runtime) {
    if (!isIsoDate(args.from) || !isIsoDate(args.to)) return { output: { error: 'Payroll dates must use YYYY-MM-DD.' } };
    const period = args.period === 'monthly' ? 'monthly' : 'weekly';
    const [preview, runs] = await Promise.all([
      runtime.get<PayrollPreview>(`/payroll/preview?${new URLSearchParams({ period, from: String(args.from), to: String(args.to) })}`),
      runtime.get<PayrollRun[]>('/payroll/runs'),
    ]);
    return {
      output: { preview, recentRuns: runs.slice(0, 10) },
      evidence: `${preview.totals.employees} payroll employee${preview.totals.employees === 1 ? '' : 's'} ${String(args.from)}–${String(args.to)}`,
      cards: [
        {
          title: 'Payroll preview',
          caption: rangeLabel(String(args.from), String(args.to)),
          metrics: [
            { label: 'Employees', value: String(preview.totals.employees) },
            { label: 'Gross pay', value: gbp(preview.totals.gross) },
            {
              label: 'Paid hours',
              value: String(
                round(
                  preview.lines.reduce((sum, line) => sum + line.paidHours, 0),
                  1,
                ),
              ),
            },
            { label: 'Recent runs', value: String(runs.length) },
          ],
        },
      ],
      shortcuts: [page('Open payroll', '/staff/payroll', 'Team · Payroll')],
    };
  },
};

const getMyWorkspace: ToolDefinition = {
  name: 'get_my_workspace',
  description:
    'Read the signed-in operator’s own Dashboard and My HR summary: current and upcoming shifts, leave balance, HR warnings, documents, payslips, expenses and support requests. Use for broad questions about my workday, my pay, my leave, my rota, or what needs my attention. For a simple name, address, emergency-contact or personal-details question, use get_my_profile instead.',
  step: 'Checking your Dashboard and My HR',
  parameters: schema({}),
  async run(_args, runtime) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const year = now.getFullYear();

    const employee = await runtime.get<HrEmployee>('/hr/employees/me');
    const optional = await Promise.allSettled([
      runtime.get<LeaveEntitlement[]>(`/hr/entitlements/me?year=${year}`),
      runtime.get<LeaveRequest[]>('/hr/leave-requests/my'),
      runtime.get<HelpdeskTicket[]>('/helpdesk/my'),
      runtime.get<EmployeeDocument[]>('/hr/documents/me'),
      runtime.get<Payslip[]>('/hr/payslips/my'),
      runtime.get<ExpenseClaim[]>('/hr/expense-claims/my'),
      runtime.get<Shift[]>('/shifts/my'),
      runtime.get<ScheduledShift[]>(
        `/scheduled-shifts/my?${new URLSearchParams({ from: weekStart.toISOString(), to: weekEnd.toISOString() })}`,
      ),
    ]);
    const value = <T>(index: number): T[] => (optional[index]?.status === 'fulfilled' ? (optional[index].value as T[]) : []);
    const entitlements = value<LeaveEntitlement>(0);
    const requests = value<LeaveRequest>(1);
    const tickets = value<HelpdeskTicket>(2);
    const documents = value<EmployeeDocument>(3);
    const payslips = value<Payslip>(4);
    const expenses = value<ExpenseClaim>(5);
    const shifts = value<Shift>(6);
    const rota = value<ScheduledShift>(7);
    const unavailable = [
      'leave entitlement',
      'leave requests',
      'HR requests',
      'documents',
      'payslips',
      'expenses',
      'clock records',
      'rota',
    ].filter((_, index) => optional[index]?.status === 'rejected');

    const actions = myHrActions({ employee, documents, tickets, expenses, now });
    const balance = leaveBalance(entitlements);
    const activeShift = shifts.find((shift) => !shift.clockedOut) ?? null;
    const upcoming = rota
      .filter((shift) => new Date(shift.endsAt).getTime() >= now.getTime())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const latestPayslip = [...payslips].sort((a, b) => b.payPeriodEnd.localeCompare(a.payPeriodEnd))[0] ?? null;
    const openTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
    const pendingLeave = requests.filter((request) => request.status === 'pending');

    return {
      output: {
        profile: {
          displayName: runtime.profile.name ?? null,
          email: runtime.profile.email ?? null,
          jobTitle: employee.jobTitle,
          department: employee.department ?? null,
          employmentType: employee.employmentType,
          startDate: employee.startDate,
          address: employee.address ?? null,
          emergencyContactComplete: Boolean(employee.emergencyContactName && employee.emergencyContactPhone),
          nationalInsuranceNumberHeld: Boolean(employee.hasNiNumber),
        },
        dashboard: {
          activeShift: activeShift
            ? {
                clockedIn: activeShift.clockedIn,
                location: activeShift.location?.name ?? activeShift.locationId,
                elapsedMinutes: Math.max(0, Math.round((now.getTime() - new Date(activeShift.clockedIn).getTime()) / 60_000)),
              }
            : null,
          upcomingShifts: upcoming.slice(0, 12).map((shift) => ({
            startsAt: shift.startsAt,
            endsAt: shift.endsAt,
            location: shift.location?.name ?? shift.locationId,
            role: shift.role ?? null,
          })),
        },
        myHr: {
          warnings: actions,
          leave: balance,
          pendingLeaveRequests: pendingLeave,
          openRequests: openTickets.map(({ id, subject, category, priority, status, updatedAt }) => ({
            id,
            subject,
            category,
            priority,
            status,
            updatedAt,
          })),
          documents: documents.map(({ id, title, documentType, issuedAt, expiresAt }) => ({
            id,
            title,
            documentType,
            issuedAt: issuedAt ?? null,
            expiresAt: expiresAt ?? null,
          })),
          latestPayslip: latestPayslip
            ? {
                periodStart: latestPayslip.payPeriodStart,
                periodEnd: latestPayslip.payPeriodEnd,
                grossPayGbp: toNumber(latestPayslip.grossPay),
                netPayGbp: toNumber(latestPayslip.netPay),
                finalisedAt: latestPayslip.finalisedAt,
              }
            : null,
          recentExpenses: expenses.slice(0, 10),
          unavailableSections: unavailable,
        },
      },
      evidence: `Your Dashboard and My HR · ${actions.length} notice${actions.length === 1 ? '' : 's'}`,
      cards: [
        {
          title: 'My workday',
          caption: activeShift ? 'Currently on shift' : 'Not clocked in',
          metrics: [
            { label: 'Upcoming shifts', value: String(upcoming.length) },
            { label: 'Leave remaining', value: balance.hasEntitlement ? `${balance.remaining} days` : 'Not set' },
            {
              label: 'Needs attention',
              value: String(actions.filter((action) => action.severity !== 'info').length),
              tone: actions.some((action) => action.severity !== 'info') ? 'warning' : 'positive',
            },
            { label: 'Open HR requests', value: String(openTickets.length) },
          ],
        },
        {
          kind: 'list',
          title: 'My HR notices',
          emptyTone: 'clean' as const,
          emptyLabel: 'Nothing needs you — your HR record is up to date.',
          caption: actions.length ? 'Most urgent first' : 'Everything looks up to date',
          rows: actions.slice(0, 6).map((action) => ({
            label: action.title,
            meta: action.detail,
            tone:
              action.severity === 'blocking'
                ? ('negative' as const)
                : action.severity === 'attention'
                  ? ('warning' as const)
                  : ('default' as const),
          })),
        },
      ],
      shortcuts: [
        page('Edit your details', '/my-hr?tab=overview&action=edit-details', 'My HR · Review your name and edit personal details'),
      ],
    };
  },
};

const getMyProfile: ToolDefinition = {
  name: 'get_my_profile',
  description:
    'Read only the signed-in operator’s basic employment and editable personal-detail status. Always use this for questions about my name, my address, my emergency contact, my National Insurance number, or where to edit my personal details. This intentionally excludes payslips, expenses, documents and private HR requests.',
  step: 'Checking your personal details',
  parameters: schema({}),
  async run(_args, runtime) {
    const employee = await runtime.get<HrEmployee>('/hr/employees/me');
    return {
      output: {
        displayName: runtime.profile.name ?? null,
        email: runtime.profile.email ?? null,
        jobTitle: employee.jobTitle,
        department: employee.department ?? null,
        employmentType: employee.employmentType,
        startDate: employee.startDate,
        addressHeld: Boolean(employee.address),
        emergencyContactComplete: Boolean(employee.emergencyContactName && employee.emergencyContactPhone),
        nationalInsuranceNumberHeld: Boolean(employee.hasNiNumber),
        editableInDetailsDrawer: ['address', 'emergency contact', 'bank details', 'National Insurance number'],
      },
      evidence: 'Your My HR profile',
      shortcuts: [
        page('Edit your details', '/my-hr?tab=overview&action=edit-details', 'My HR · Review your name and edit personal details'),
      ],
    };
  },
};

// ── My HR: attendance and pay ────────────────────────────────────────────────

const getMyAttendance: ToolDefinition = {
  name: 'get_my_attendance',
  description:
    'Read the signed-in operator’s own attendance for a period: hours worked against hours rostered, the shortfall or overtime, each working day, and any absence logged against them. Use for "how many hours did I work", "was I short last month", "when did I clock in", "what absence is on my record". Defaults to the current calendar month.',
  step: 'Checking your hours',
  parameters: schema({
    from: nullableString(`Start of the period. ${DATE} Null for the start of this month.`),
    to: nullableString(`End of the period. ${DATE} Null for the end of this month.`),
  }),
  async run(args, runtime) {
    const anchors = calendarAnchors();
    // The month runs to the day before the next one starts, so a 30- or 31-day
    // month needs no special case.
    const monthEnd = addDays(`${addDays(anchors.monthStart, 31).slice(0, 7)}-01`, -1);
    const from = isIsoDate(args.from) ? String(args.from) : anchors.monthStart;
    const to = isIsoDate(args.to) ? String(args.to) : monthEnd;

    const [attendance, absences] = await Promise.all([
      runtime.get<AttendanceDay[]>(`/hr/attendance/me?from=${from}&to=${to}`),
      runtime.get<AbsenceLog[]>('/hr/absence-logs/my').catch(() => [] as AbsenceLog[]),
    ]);

    const inRange = absences.filter((absence) => absence.date.slice(0, 10) >= from && absence.date.slice(0, 10) <= to);
    const days = mergeAbsenceDays(attendance, inRange);
    const totals = attendanceTotals(days);
    const weeks = groupAttendanceByWeek(days);

    return {
      output: {
        period: { from, to },
        // Shifts still to come are excluded from the totals — counting a rota
        // that has not run yet reads as a shortfall the employee cannot fix.
        hoursWorked: totals.workedHours,
        hoursRostered: totals.plannedHours,
        varianceHours: totals.varianceHours,
        varianceMeaning: totals.varianceHours < 0 ? 'short of roster' : totals.varianceHours > 0 ? 'over roster' : 'matches roster',
        weeks: weeks.map((week) => ({
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          workedHours: week.workedHours,
          rosteredHours: week.plannedHours,
        })),
        days: days
          .filter((day) => day.status !== 'no_shift' || day.absence)
          .map((day) => ({
            date: day.date,
            status: day.status,
            workedHours: round(day.workedMinutes / 60, 2),
            rosteredHours: round(day.plannedMinutes / 60, 2),
            leave: day.leaveName ?? null,
            absence: day.absence ? { halfDay: day.absence.isHalfDay, reason: day.absence.reason } : null,
          })),
      },
      evidence: `Your attendance · ${rangeLabel(from, to)}`,
      shortcuts: [page('Open your attendance', '/my-hr?tab=attendance', 'My HR · Attendance')],
    };
  },
};

const getMyPayslips: ToolDefinition = {
  name: 'get_my_payslips',
  description:
    'Read the signed-in operator’s own payslips, itemised: gross pay, each deduction named separately (tax, National Insurance, pension, other) and take-home pay. Use for "what was I paid", "how much tax did I pay", "why is my pay different this month", "show my last payslip".',
  step: 'Checking your payslips',
  parameters: schema({ limit: { type: ['number', 'null'], description: 'How many recent payslips to return. Null for 6.' } }),
  async run(args, runtime) {
    const payslips = await runtime.get<Payslip[]>('/hr/payslips/my');
    const recent = [...payslips].sort((a, b) => b.payPeriodEnd.localeCompare(a.payPeriodEnd)).slice(0, limit(args.limit, 6, 24));

    return {
      output: {
        count: payslips.length,
        payslips: recent.map((payslip) => ({
          periodStart: payslip.payPeriodStart,
          periodEnd: payslip.payPeriodEnd,
          grossPayGbp: toNumber(payslip.grossPay),
          deductions: payslipDeductions(payslip).map((line) => ({ label: line.label, amountGbp: line.amount })),
          netPayGbp: toNumber(payslip.netPay),
          // Surfaced rather than hidden: a statement that does not add up is
          // exactly what the employee should be querying with payroll.
          figuresReconcile: payslipReconciles(payslip),
          issuedAt: payslip.finalisedAt ?? null,
        })),
      },
      evidence: `Your payslips · ${payslips.length} issued`,
      shortcuts: [page('Open your payslips', '/my-hr?tab=documents', 'My HR · Documents')],
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
  listCustomerSegments,
  getSchedule,
  listLeaveRequests,
  listHelpdeskTickets,
  getCashUpStatus,
  listPrivacyRequests,
  getAuditActivity,
  getCommunicationsStatus,
  getMyProfile,
  getMyWorkspace,
  getMyAttendance,
  getMyPayslips,
  getPayrollOverview,
];

const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function toolsForCapabilities(capabilities: readonly string[]) {
  // A tool with no capability is open to everyone; otherwise the caller must
  // hold it. The API re-checks on every call the tool makes — this only decides
  // which tools the model is even offered, so it cannot be the security boundary.
  return TOOLS.filter((tool) => !tool.capability || hasCapability(capabilities, tool.capability));
}

export function toolByName(name: string) {
  return TOOL_BY_NAME.get(name);
}
