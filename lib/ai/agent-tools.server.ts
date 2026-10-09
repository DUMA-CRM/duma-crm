import 'server-only';

import { auditChangeSet, auditSubject } from '@/lib/audit/change';
import { auditActor, auditPhrase, auditRole, auditSeverity, resourceLabel, severityLabel } from '@/lib/audit/narrative';
import { type Capability, hasCapability } from '@/lib/auth/capabilities';
import type {
  CategorySales,
  CustomerRetention,
  ExceptionsAnalytics,
  HourlyVolume,
  LabourAnalytics,
  OrderAnalytics,
  PaymentMethodSales,
  RevenueByLocation,
  StaffHoursAnalytics,
  TaxAnalytics,
  TopItemAnalytics,
} from '@/lib/modules/analytics/client';
import type { AuditLogsResponse } from '@/lib/modules/audit/client';
import type { EmailAutomation, EmailConnection, EmailDeliveriesResponse, EmailTemplate } from '@/lib/modules/communications/client';
import type { PrivacyRequest } from '@/lib/modules/compliance/client';
import type { CustomerLoyaltyProgram } from '@/lib/modules/customers/client';
import type { InventoryForecast, LowStockAlert, RecipeGap } from '@/lib/modules/inventory/client';
import type { LossLogResponse } from '@/lib/modules/inventory/client';
import type { RestockRequestsResponse } from '@/lib/modules/inventory/client';
import { decodeNotes } from '@/lib/modules/inventory/client';
import type { StocktakesResponse } from '@/lib/modules/inventory/client';
import type { StockTransfersResponse } from '@/lib/modules/inventory/client';
import { MODULE_IDS, type ModuleId, isModuleSurfaceEnabled } from '@/lib/modules/manifest';
import type { Order, OrderDetail } from '@/lib/modules/ordering/client';
import type { CurrentTenantModules, Location } from '@/lib/modules/organization/client';
import type { CashUp, CashUpExpectation } from '@/lib/modules/payments/client';
import type { PayrollPreview, PayrollRun, Payslip } from '@/lib/modules/payroll/client';
import type {
  AbsenceLog,
  AttendanceDay,
  EmployeeDocument,
  HelpdeskTicket,
  LeaveEntitlement,
  LeaveRequest,
} from '@/lib/modules/people/client';
import type { PurchaseOrdersResponse } from '@/lib/modules/purchasing/client';
import type { QrOrderingConfig } from '@/lib/modules/qr-ordering/client';
import type { ScheduledShift, VarianceRow } from '@/lib/modules/workforce/client';
import type { Shift } from '@/lib/modules/workforce/client';
import { attendanceTotals, groupAttendanceByWeek, leaveBalance, mergeAbsenceDays, myHrActions } from '@/lib/utils/my-hr';
import type { Customer, CustomerSegment, CustomersResponse } from '@/types/customers';

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
import { explainQrOrderingAvailability } from './qr-ordering.ts';
import { searchSupportArticles } from './support-search';

type JsonObject = Record<string, unknown>;

export interface ToolResult {
  output: unknown;
  /** Internal provenance retained for diagnostics; it is not rendered in chat. */
  evidence?: string;
  shortcuts?: AgentShortcut[];
  cards?: AgentCard[];
}

interface ToolDefinitionBase {
  name: string;
  description: string;
  parameters: JsonObject;
  /** Short present-tense line shown while the tool runs. */
  step: string;
  run(args: JsonObject, runtime: AgentRuntime): Promise<ToolResult>;
}

export type ToolDefinition = ToolDefinitionBase & ({ capability: Capability; module?: never } | { capability?: never; module: ModuleId });

function schema(properties: JsonObject): JsonObject {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const nullableString = (description: string) => ({ type: ['string', 'null'], description });
const DATE = 'Inclusive YYYY-MM-DD calendar date.';

/** "partially_received" → "Partially received", for card titles and empty states. */
const sentence = (value: string) => value.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());

const orderSourceLabel = (source: Order['source']) => (source === 'pos' ? 'POS' : source === 'qr_code' ? 'QR code' : 'Mobile');

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
  module: 'support',
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
      note: 'No opening hours have been set for this location. They are edited in Settings → Workspace, on the location.',
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
  module: 'organization',
  name: 'list_locations',
  description:
    'List the locations the operator can access, with their address, phone, timezone, trading hours — today’s opening and closing time, whether the site is open right now, and the full weekly pattern — the order workflow (kitchen: paid tickets stay on the kitchen screen until made; counter: a sale completes when paid) and the daily net takings target. Use this for any question about when a site opens or closes, how orders flow, or what the daily target is.',
  // The API gates GET /locations on `locations:read`, which every built-in role
  // holds and the frontend deliberately does not name, so the module gates it.
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
        orderWorkflow: location.orderFulfilmentMode === 'counter' ? 'counter service' : 'kitchen',
        dailyTakingsTargetGbp: location.dailyRevenueTarget == null ? null : toNumber(location.dailyRevenueTarget),
        ...tradingHours(location),
      })),
      evidence: `${locations.length} accessible location${locations.length === 1 ? '' : 's'}, ${open} open now`,
      shortcuts: [
        ...locations.slice(0, 5).map(({ id, name }) => page(`Open ${name}`, '/dashboard', 'Switches the active location', id)),
        page('Edit trading hours', '/settings/workspaces', 'Settings · Workspace'),
      ],
    };
  },
};

/** What each module is called on screen, for answers about what is switched on. */
const MODULE_NAMES: Record<ModuleId, string> = {
  core: 'Core',
  identity: 'Accounts & sign-in',
  organization: 'Workspace & locations',
  customers: 'Customers & loyalty',
  catalog: 'Menu',
  ordering: 'Orders',
  pos: 'Till',
  kds: 'Kitchen display',
  'qr-ordering': 'QR ordering',
  payments: 'Payments & cash-up',
  inventory: 'Inventory',
  purchasing: 'Purchasing & suppliers',
  workforce: 'Rota & time',
  people: 'Staff & HR',
  payroll: 'Payroll',
  communications: 'Customer email',
  compliance: 'Compliance',
  audit: 'Audit log',
  analytics: 'Dashboard & reports',
  agent: 'Ask DUMA',
  support: 'Support & helpdesk',
  cms: 'Content (CMS)',
  promotions: 'Promotions',
};

const getWorkspaceModules: ToolDefinition = {
  module: 'organization',
  name: 'get_workspace_modules',
  description:
    'Read which product modules are switched on for this workspace (till, kitchen screen, QR ordering, inventory, purchasing, rota, HR, payroll, customer email, compliance and so on). Use when someone asks why a page, menu entry or feature is missing, or what the workspace has turned on. A disabled module hides its pages and the API refuses its data; turning one on or off is done in Settings → Modules by someone who can change workspace settings.',
  // Authenticated, ungated: GET /modules/current is how every page decides what to show.
  step: 'Checking workspace modules',
  parameters: schema({}),
  async run(_args, runtime) {
    const tenant = runtime.tenantId ? `?${new URLSearchParams({ tenantId: runtime.tenantId })}` : '';
    const state = await runtime.get<CurrentTenantModules>(`/modules/current${tenant}`);
    const known = state.modules.filter((row) => (MODULE_IDS as readonly string[]).includes(row.moduleId));
    const enabled = known.filter((row) => row.status === 'enabled');
    const disabled = known.filter((row) => row.status !== 'enabled');
    return {
      output: {
        enabled: enabled.map((row) => ({ id: row.moduleId, name: MODULE_NAMES[row.moduleId] })),
        disabled: disabled.map((row) => ({ id: row.moduleId, name: MODULE_NAMES[row.moduleId] })),
        note: 'A feature can also be hidden because this operator lacks the capability for it, even when its module is on.',
      },
      evidence: `${enabled.length} module${enabled.length === 1 ? '' : 's'} enabled, ${disabled.length} disabled`,
      cards: [
        {
          kind: 'list',
          title: 'Switched off',
          caption: `${enabled.length} of ${known.length} modules on`,
          emptyTone: 'clean' as const,
          emptyLabel: 'Every module is switched on.',
          rows: disabled.slice(0, 8).map((row) => ({ label: MODULE_NAMES[row.moduleId], value: 'Off', tone: 'warning' as const })),
        },
      ],
      shortcuts: hasCapability(runtime.profile, 'settings:write')
        ? [page('Open modules', '/settings/modules', 'Settings · Modules')]
        : undefined,
    };
  },
};

const getQrOrderingStatus: ToolDefinition = {
  name: 'get_qr_ordering_status',
  description:
    'Read the complete QR ordering setup for one location and explain whether customers can order right now. Use for QR setup, enabled/disabled/paused state, payment options, collection scheduling, published content, visible items, or questions such as “why can’t I order now?”.',
  capability: 'qr-ordering:read',
  step: 'Checking QR ordering',
  parameters: schema({ locationId: nullableString('Location id, or null for the active location.') }),
  async run(args, runtime) {
    const locationId = await runtime.resolveLocationId(args.locationId);
    if (!locationId) return { output: { error: 'Choose a location before checking QR ordering.' } };
    const location = (await runtime.locations()).find((row) => row.id === locationId);
    if (!location) return { output: { error: 'That location is not available to this operator.' } };
    const [config, menuItems] = await Promise.all([
      runtime.get<QrOrderingConfig | null>(`/qr-ordering/locations/${locationId}`),
      runtime.menuItems(),
    ]);
    let stripeConnected: boolean | null = null;
    if (config?.publicToken && config.isEnabled && config.publishedContent) {
      const publicMenu = await runtime
        .get<{ ordering?: { cardEnabled?: boolean } }>(`/qr-ordering/public/${config.publicToken}`)
        .catch(() => null);
      if (publicMenu && config.cardEnabled) stripeConnected = Boolean(publicMenu.ordering?.cardEnabled);
    }
    const availability = explainQrOrderingAvailability(config, location, stripeConnected);
    const publishedVisibility = new Map(config?.itemVisibility.map((item) => [item.menuItemId, item.publishedVisible]) ?? []);
    const visibleItems = menuItems.filter((item) => item.isAvailable && publishedVisibility.get(item.id) !== false).length;

    return {
      output: {
        location: { id: location.id, name: location.name, timezone: location.timezone, isActive: location.isActive },
        availability,
        settings: config
          ? {
              enabled: config.isEnabled,
              paused: config.isPaused,
              published: Boolean(config.publishedContent),
              publishedAt: config.publishedAt,
              cardEnabled: config.cardEnabled,
              stripeConnected,
              cashEnabled: config.cashEnabled,
              minimumOrderGbp: toNumber(config.minimumOrderAmount),
              minimumNoticeMinutes: config.minimumNoticeMinutes,
              slotIntervalMinutes: config.slotIntervalMinutes,
              maxOrdersPerSlot: config.maxOrdersPerSlot,
              bookingHorizonDays: config.bookingHorizonDays,
              welcomeMessage: config.draftContent.welcomeMessage,
              collectionInstructions: config.draftContent.collectionInstructions,
              visiblePublishedItems: visibleItems,
            }
          : null,
      },
      evidence: `QR ordering at ${location.name}: ${availability.explanation}`,
      cards: [
        {
          title: 'QR ordering',
          caption: location.name,
          metrics: [
            {
              label: 'Orders now',
              value: availability.canOrder ? 'Open' : 'Unavailable',
              tone: availability.canOrder ? 'positive' : 'warning',
            },
            { label: 'Local time', value: availability.localTime, hint: location.timezone },
            { label: 'Published items', value: String(visibleItems) },
          ],
        },
      ],
      shortcuts: [page('Open QR ordering settings', '/settings/qr-ordering', 'Settings · QR ordering', locationId)],
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
  description:
    'Find active stock items with their units, barcodes, last known costs and default reorder quantities. The query matches the item name or an exact barcode.',
  // The API accepts `stock:read` or `inventory:read`; every role holding the
  // first also holds the second, and till staff hold only the second.
  capability: 'inventory:read',
  step: 'Checking stock items',
  parameters: schema({
    query: { type: 'string', description: 'Case-insensitive item name, or a scanned barcode; use an empty string to list all.' },
  }),
  async run(args, runtime) {
    const query = optionalText(args.query, 60).toLocaleLowerCase('en-GB');
    const items = (await runtime.stockItems())
      .filter(
        (item) => !query || item.name.toLocaleLowerCase('en-GB').includes(query) || item.barcode?.toLocaleLowerCase('en-GB') === query,
      )
      .slice(0, 100);
    return {
      output: items.map(({ id, name, barcode, unit, category, costPerUnit, defaultReorderQuantity }) => ({
        id,
        name,
        barcode: barcode ?? null,
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
  module: 'catalog',
  name: 'list_menu_items',
  description: 'List menu items with their brand-wide price, category and availability.',
  // The API gates GET /menu-items on `menu:read`, which every built-in role
  // holds and the frontend deliberately does not name, so the module gates it.
  step: 'Reading the menu',
  parameters: schema({ query: { type: 'string', description: 'Case-insensitive name search; empty string lists all.' } }),
  async run(args, runtime) {
    const query = optionalText(args.query, 60).toLocaleLowerCase('en-GB');
    const items = (await runtime.menuItems())
      .filter((item) => !query || item.name.toLocaleLowerCase('en-GB').includes(query))
      .slice(0, 120);
    const unavailable = items.filter((item) => !item.isAvailable).length;
    return {
      output: items.map(({ id, name, categoryId, price, isAvailable }) => ({
        id,
        name,
        categoryId,
        priceGbp: toNumber(price),
        isAvailable,
      })),
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
                meta: `${item.categoryId} · ${item.isAvailable ? 'Available' : 'Hidden'}`,
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
      shortcuts: [page('Open team', '/staff/team', 'Staff · Team')],
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
    'Compare orders, revenue, refunds, average order value and item sales across two date ranges. Use the calendar anchors in the brief rather than guessing dates. Set chartMetric to the single measure being compared, even when the operator does not explicitly say chart; use none for a broad summary with no single comparison focus.',
  capability: 'analytics:read',
  step: 'Reading live sales data',
  parameters: schema({
    currentFrom: { type: 'string', description: DATE },
    currentTo: { type: 'string', description: DATE },
    previousFrom: { type: 'string', description: DATE },
    previousTo: { type: 'string', description: DATE },
    locationId: nullableString('Restrict to one location, or null for everything accessible.'),
    itemQuery: nullableString('Optional item name such as latte. Null returns the item ranking.'),
    chartMetric: {
      type: 'string',
      enum: ['none', 'net_revenue', 'refunds', 'orders', 'average_order_value'],
      description: 'Single measure to render as a current-vs-previous comparison chart, or none for a broad multi-measure summary.',
    },
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
    const days = (from: string, to: string) =>
      Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    const currentDays = days(currentFrom as string, currentTo as string);
    const previousDays = days(previousFrom as string, previousTo as string);
    const comparisonBasis =
      currentDays === previousDays
        ? `Like-for-like: ${currentDays} calendar day${currentDays === 1 ? '' : 's'} in each period`
        : `Caution: ${currentDays} days compared with ${previousDays} days`;
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
    const chartMetric = ['net_revenue', 'refunds', 'orders', 'average_order_value'].includes(String(args.chartMetric))
      ? String(args.chartMetric)
      : undefined;
    const chart = chartMetric
      ? {
          kind: 'chart' as const,
          type: 'column' as const,
          title:
            chartMetric === 'orders'
              ? 'Orders comparison'
              : chartMetric === 'average_order_value'
                ? 'Average order comparison'
                : chartMetric === 'refunds'
                  ? 'Refunds comparison'
                  : 'Net revenue comparison',
          caption: `${basis} vs ${rangeLabel(currentFrom as string, currentTo as string)} · ${comparisonBasis}`,
          format: chartMetric === 'orders' ? ('number' as const) : ('currency' as const),
          series: [
            {
              key: 'value',
              label:
                chartMetric === 'orders'
                  ? 'Orders'
                  : chartMetric === 'average_order_value'
                    ? 'Average order'
                    : chartMetric === 'refunds'
                      ? 'Refunds'
                      : 'Net revenue',
            },
          ],
          points: [
            {
              label: basis,
              values: {
                value:
                  chartMetric === 'orders'
                    ? previousSummary.orders
                    : chartMetric === 'average_order_value'
                      ? previousSummary.averageOrderValueGbp
                      : chartMetric === 'refunds'
                        ? previousSummary.refundsGbp
                        : previousSummary.netRevenueGbp,
              },
            },
            {
              label: rangeLabel(currentFrom as string, currentTo as string),
              values: {
                value:
                  chartMetric === 'orders'
                    ? currentSummary.orders
                    : chartMetric === 'average_order_value'
                      ? currentSummary.averageOrderValueGbp
                      : chartMetric === 'refunds'
                        ? currentSummary.refundsGbp
                        : currentSummary.netRevenueGbp,
              },
            },
          ],
        }
      : undefined;

    return {
      output: {
        currentPeriod: { from: currentFrom, to: currentTo, ...currentSummary },
        previousPeriod: { from: previousFrom, to: previousTo, ...previousSummary },
        changesPercent: changes,
        currentItems: currentRows.slice(0, 40),
        previousItems: previousRows.slice(0, 40),
        comparisonBasis,
        lowestSellingRecordedItems: [...currentRows]
          .filter((row) => row.quantity > 0)
          .sort((a, b) => a.quantity - b.quantity)
          .slice(0, 8),
        caveat: 'Lowest-selling only covers items returned by the sales endpoint; products with zero sales may be absent.',
      },
      evidence: `Sales ${String(currentFrom)}–${String(currentTo)} vs ${String(previousFrom)}–${String(previousTo)}`,
      cards: chart
        ? [chart]
        : [
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
        page(
          'Open the sales summary',
          '/reports/sales-summary',
          locationId ? 'Switches the active location' : 'Reports · Sales summary',
          locationId,
        ),
      ],
    };
  },
};

const getBusinessAnalytics: ToolDefinition = {
  name: 'get_business_analytics',
  description:
    'Read one analytics view over a date range — the same figures as the matching report in Reports: hourly_volume (Sales by hour), revenue_by_location (Sales by location), customer_retention (new vs returning), staff_hours (worked hours per person), labour (Labour vs sales: paid hours, estimated cost, and labour as a share of net sales), payment_methods (sales by how customers paid), vat (VAT collected, by rate), discounts_voids (discounts given and voided orders, with reasons), or category_sales (sales by menu category). Set includeChart true when the operator asks for a chart, graph, or visual comparison.',
  capability: 'analytics:read',
  step: 'Reading analytics',
  parameters: schema({
    metric: {
      type: 'string',
      enum: [
        'hourly_volume',
        'revenue_by_location',
        'customer_retention',
        'staff_hours',
        'labour',
        'payment_methods',
        'vat',
        'discounts_voids',
        'category_sales',
      ],
    },
    from: { type: 'string', description: DATE },
    to: { type: 'string', description: DATE },
    locationId: nullableString('Restrict to one location, or null.'),
    includeChart: { type: 'boolean', description: 'Whether to render the result as a chart as well as returning the exact data.' },
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
          ? args.includeChart
            ? [
                {
                  kind: 'chart' as const,
                  type: 'line' as const,
                  title: 'Orders by hour',
                  caption: rangeLabel(query.get('from') ?? '', query.get('to') ?? ''),
                  format: 'number' as const,
                  series: [{ key: 'orders', label: 'Orders' }],
                  points: rows
                    .slice()
                    .sort((a, b) => a.hour - b.hour)
                    .map((row) => ({ label: `${String(row.hour).padStart(2, '0')}:00`, values: { orders: row.orderCount } })),
                },
              ]
            : [
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
        shortcuts: [page('Open sales by hour', '/reports/sales-by-hour', 'Reports · Sales by hour')],
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
        cards: args.includeChart
          ? [
              {
                kind: 'chart',
                type: 'bar',
                title: 'Revenue by location',
                caption: rangeLabel(query.get('from') ?? '', query.get('to') ?? ''),
                format: 'currency',
                series: [{ key: 'revenue', label: 'Net revenue' }],
                points: rows
                  .slice()
                  .sort((a, b) => toNumber(b.totalRevenue) - toNumber(a.totalRevenue))
                  .slice(0, 10)
                  .map((row) => ({ label: row.locationName || 'Unnamed location', values: { revenue: toNumber(row.totalRevenue) } })),
              },
            ]
          : undefined,
        shortcuts: [page('Open sales by location', '/reports/sales-by-location', 'Reports · Sales by location')],
      };
    }

    if (metric === 'customer_retention') {
      const retention = await runtime.get<CustomerRetention>(`/analytics/customer-retention?${query}`);
      return {
        output: retention,
        evidence: `Customer retention ${query.get('from')}–${query.get('to')}`,
        cards: args.includeChart
          ? [
              {
                kind: 'chart' as const,
                type: 'bar' as const,
                title: 'New and returning customers',
                caption: rangeLabel(query.get('from') ?? '', query.get('to') ?? ''),
                format: 'number' as const,
                series: [{ key: 'customers', label: 'Customers' }],
                points: [
                  { label: 'New', values: { customers: retention.newCustomers } },
                  { label: 'Returning', values: { customers: retention.returningCustomers } },
                ],
              },
            ]
          : [
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
        shortcuts: [page('Open customer retention', '/reports/customer-retention', 'Reports · Customer retention')],
      };
    }

    const range = rangeLabel(query.get('from') ?? '', query.get('to') ?? '');

    if (metric === 'labour') {
      const [labour, sales] = await Promise.all([
        runtime.get<LabourAnalytics>(`/analytics/labour?${query}`),
        runtime.get<OrderAnalytics>(`/analytics/orders?${query}`),
      ]);
      const netSales = toNumber(sales.summary.totalRevenue);
      const labourPercent = netSales > 0 ? round((labour.estimatedCost / netSales) * 100, 1) : null;
      return {
        output: {
          ...labour,
          netSalesGbp: netSales,
          labourPercentOfNetSales: labourPercent,
          notes: [
            'estimatedCost covers paid hours only: time clocked outside a rota slot (uncostedHours) is not costed.',
            labour.costComplete
              ? 'Every person in the window has usable pay data.'
              : `${labour.staffMissingPayData} person(s) have no usable pay record, so the cost is understated — say so.`,
            'labourPercentOfNetSales matches the Labour vs sales report: net sales as taken, VAT included where charged. The Profit panel on the Reports home measures against sales without VAT, so its labour % reads higher.',
          ],
        },
        evidence: `Labour ${query.get('from')}–${query.get('to')}`,
        cards: [
          {
            title: 'Labour vs sales',
            caption: range,
            metrics: [
              { label: 'Paid hours', value: String(round(labour.paidHours, 1)) },
              {
                label: 'Est. cost',
                value: gbp(labour.estimatedCost),
                ...(labour.costComplete ? {} : { hint: 'Incomplete pay data', tone: 'warning' as const }),
              },
              { label: 'Labour %', value: labourPercent == null ? 'No sales' : `${labourPercent}%` },
              { label: 'Headcount', value: String(labour.headcount) },
            ],
          },
        ],
        shortcuts: [page('Open labour vs sales', '/reports/labour-vs-sales', 'Reports · Labour vs sales')],
      };
    }

    if (metric === 'payment_methods') {
      const rows = await runtime.get<PaymentMethodSales[]>(`/analytics/payments?${query}`);
      return {
        output: rows.map((row) => ({
          method: row.method,
          orders: row.orders,
          grossGbp: round(row.gross, 2),
          refundedGbp: round(row.refunded, 2),
          netGbp: round(row.revenue, 2),
        })),
        evidence: `Payment methods ${query.get('from')}–${query.get('to')}`,
        cards: args.includeChart
          ? [
              {
                kind: 'chart' as const,
                type: 'bar' as const,
                title: 'Sales by payment method',
                caption: range,
                format: 'currency' as const,
                series: [{ key: 'net', label: 'Net sales' }],
                points: rows.map((row) => ({ label: sentence(row.method), values: { net: round(row.revenue, 2) } })),
              },
            ]
          : [
              {
                kind: 'list' as const,
                title: 'Sales by payment method',
                caption: range,
                emptyLabel: 'No sales in this range.',
                rows: rows.slice(0, 6).map((row) => ({
                  label: sentence(row.method),
                  value: gbp(row.revenue),
                  meta: `${row.orders} order${row.orders === 1 ? '' : 's'}${row.refunded ? ` · ${gbp(row.refunded)} refunded` : ''}`,
                })),
              },
            ],
        shortcuts: [page('Open payment methods', '/reports/payment-methods', 'Reports · Payment methods')],
      };
    }

    if (metric === 'vat') {
      const tax = await runtime.get<TaxAnalytics>(`/analytics/tax?${query}`);
      return {
        output: {
          vatRegistered: tax.vatRegistered,
          pricesIncludeVat: tax.pricesIncludeTax,
          recordedGrossGbp: round(tax.recorded.gross, 2),
          recordedVatGbp: round(tax.recorded.vat, 2),
          byRate: tax.byRate.map((bucket) => ({
            ratePercent: bucket.rate,
            grossGbp: round(bucket.gross, 2),
            vatGbp: round(bucket.vat, 2),
            netGbp: round(bucket.net, 2),
          })),
          notes: [
            'recordedVatGbp is exact: the VAT stored on each order when it was taken.',
            'The by-rate split uses each item’s current VAT rate, because order lines do not store their rate — treat it as an estimate.',
            ...(tax.vatRegistered ? [] : ['The workspace is not VAT registered, so no VAT is due on these sales.']),
          ],
        },
        evidence: `VAT ${query.get('from')}–${query.get('to')}`,
        cards: [
          {
            title: 'VAT',
            caption: range,
            metrics: [
              { label: 'Gross sales', value: gbp(tax.recorded.gross) },
              { label: 'VAT recorded', value: gbp(tax.recorded.vat) },
              { label: 'Registered', value: tax.vatRegistered ? 'Yes' : 'No' },
            ],
          },
        ],
        shortcuts: [page('Open VAT', '/reports/vat', 'Reports · VAT')],
      };
    }

    if (metric === 'discounts_voids') {
      const exceptions = await runtime.get<ExceptionsAnalytics>(`/analytics/exceptions?${query}`);
      const discountTotal = round(
        exceptions.discounts.reduce((sum, row) => sum + row.amount, 0),
        2,
      );
      const voidTotal = round(
        exceptions.voids.reduce((sum, row) => sum + row.amount, 0),
        2,
      );
      return {
        output: {
          discounts: exceptions.discounts.map((row) => ({ ...row, amountGbp: round(row.amount, 2) })),
          voids: exceptions.voids.map((row) => ({ ...row, amountGbp: round(row.amount, 2) })),
          discountTotalGbp: discountTotal,
          voidTotalGbp: voidTotal,
          note: 'Refunds are separate — use get_sales_report for refunds.',
        },
        evidence: `Discounts and voids ${query.get('from')}–${query.get('to')}`,
        cards: [
          {
            title: 'Discounts & voids',
            caption: range,
            metrics: [
              { label: 'Discounts', value: gbp(discountTotal) },
              {
                label: 'Voided',
                value: gbp(voidTotal),
                hint: `${exceptions.voids.reduce((sum, row) => sum + row.orders, 0)} orders`,
                ...(voidTotal > 0 ? { tone: 'warning' as const } : {}),
              },
            ],
          },
        ],
        shortcuts: [page('Open discounts & voids', '/reports/discounts-voids', 'Reports · Discounts & voids')],
      };
    }

    if (metric === 'category_sales') {
      const rows = await runtime.get<CategorySales[]>(`/analytics/category-sales?${query}`);
      const ranked = rows.slice().sort((a, b) => b.revenue - a.revenue);
      return {
        output: ranked.map((row) => ({
          categoryId: row.categoryId,
          name: row.name,
          quantity: row.quantity,
          revenueGbp: round(row.revenue, 2),
          orders: row.orders,
        })),
        evidence: `Category sales ${query.get('from')}–${query.get('to')}`,
        cards: args.includeChart
          ? [
              {
                kind: 'chart' as const,
                type: 'bar' as const,
                title: 'Sales by category',
                caption: range,
                format: 'currency' as const,
                series: [{ key: 'revenue', label: 'Revenue' }],
                points: ranked.slice(0, 10).map((row) => ({ label: row.name, values: { revenue: round(row.revenue, 2) } })),
              },
            ]
          : undefined,
        shortcuts: [page('Open item & category sales', '/reports/item-sales', 'Reports · Item & category sales')],
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
      cards: args.includeChart
        ? [
            {
              kind: 'chart',
              type: 'bar',
              title: 'Hours worked by person',
              caption: rangeLabel(query.get('from') ?? '', query.get('to') ?? ''),
              format: 'number',
              series: [{ key: 'hours', label: 'Hours' }],
              points: rows
                .slice()
                .sort((a, b) => b.totalHours - a.totalHours)
                .slice(0, 10)
                .map((row) => ({
                  label: row.userName || names.get(row.userId) || row.userId,
                  values: { hours: round(row.totalHours, 1) },
                })),
            },
          ]
        : undefined,
      shortcuts: [page('Open staff hours', '/reports/staff-hours', 'Reports · Staff hours')],
    };
  },
};

const getOperationsCommandCentre: ToolDefinition = {
  name: 'get_operations_command_centre',
  description:
    'Read DUMA’s persistent operations command centre: prioritised open findings, durable workflows waiting for approval, tracked recommendations, document intake and recent quality evaluations. Use this for an operations briefing, cross-functional priorities, workflow status, or what needs attention first.',
  capability: 'analytics:read',
  step: 'Reviewing operational signals',
  parameters: schema({}),
  async run(_args, runtime) {
    // Refreshing only updates the caller's private finding queue; it does not
    // take an operational action, so the briefing can safely be current.
    await runtime
      .send('/agent/operations/refresh', 'POST', runtime.locationId ? { locationId: runtime.locationId } : {})
      .catch(() => undefined);
    const data = await runtime.get<{
      findings: Array<{
        severity: 'critical' | 'attention' | 'opportunity';
        area: string;
        title: string;
        summary: string;
        evidence: string[];
      }>;
      workflows: Array<{ title: string; status: string; currentStep: number }>;
      outcomes: Array<{ recommendation: string; status: string }>;
      documents: Array<{ name: string; status: string }>;
      evaluations: Array<{ status: string; total: number; passed: number; failed: number }>;
      generatedAt: string;
    }>('/agent/operations/overview');
    const rank = { critical: 0, attention: 1, opportunity: 2 } as const;
    const findings = data.findings.slice().sort((a, b) => rank[a.severity] - rank[b.severity]);
    const waiting = data.workflows.filter((workflow) => workflow.status === 'waiting_approval');
    const latestEvaluation = data.evaluations[0];
    return {
      output: {
        generatedAt: data.generatedAt,
        priorities: findings.slice(0, 10),
        workflowsWaitingForApproval: waiting,
        trackedOutcomes: data.outcomes.slice(0, 10),
        documentsInReview: data.documents.filter((document) => document.status !== 'completed'),
        latestQualityEvaluation: latestEvaluation ?? null,
      },
      evidence: `${findings.length} open operational finding${findings.length === 1 ? '' : 's'} · ${waiting.length} approval gate${waiting.length === 1 ? '' : 's'}`,
      cards: [
        {
          title: 'Operations command centre',
          caption: 'Live persistent state',
          metrics: [
            {
              label: 'Urgent',
              value: String(findings.filter((item) => item.severity === 'critical').length),
              tone: findings.some((item) => item.severity === 'critical') ? ('negative' as const) : ('positive' as const),
            },
            { label: 'Open findings', value: String(findings.length) },
            {
              label: 'Awaiting approval',
              value: String(waiting.length),
              tone: waiting.length ? ('warning' as const) : ('positive' as const),
            },
            { label: 'Outcomes tracked', value: String(data.outcomes.length) },
          ],
        },
        {
          kind: 'list' as const,
          title: 'Needs attention',
          caption: 'Most urgent first',
          emptyTone: 'clean' as const,
          emptyLabel: 'No open operational findings.',
          rows: findings.slice(0, 6).map((finding) => ({
            label: finding.title,
            value: sentence(finding.severity),
            meta: finding.summary,
            tone:
              finding.severity === 'critical'
                ? ('negative' as const)
                : finding.severity === 'attention'
                  ? ('warning' as const)
                  : ('positive' as const),
          })),
        },
      ],
    };
  },
};

// ── Orders ───────────────────────────────────────────────────────────────────

const listOrders: ToolDefinition = {
  name: 'list_orders',
  description:
    'List recent orders with their status, source, total and time. Can isolate QR code, mobile or POS orders. Use before proposing a status change or investigating a specific sale.',
  capability: 'orders:read',
  step: 'Reading orders',
  parameters: schema({
    status: nullableString('pending, preparing, ready, done, cancelled, expired, or null for all.'),
    source: nullableString('qr_code, mobile, pos, or null for all sources.'),
    from: nullableString(DATE),
    to: nullableString(DATE),
    locationId: nullableString('Restrict to one location, or null for the active one.'),
    limit: { type: ['number', 'null'], description: 'How many orders to return, up to 50.' },
  }),
  async run(args, runtime) {
    const query = new URLSearchParams({ limit: String(limit(args.limit, 20, 50)) });
    const status = optionalText(args.status, 20);
    if (['pending', 'preparing', 'ready', 'done', 'cancelled', 'expired'].includes(status)) query.set('status', status);
    const source = optionalText(args.source, 20);
    if (['qr_code', 'mobile', 'pos'].includes(source)) query.set('source', source);
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
          sourceLabel: orderSourceLabel(order.source),
          totalGbp: toNumber(order.totalAmount),
          createdAt: order.createdAt,
          itemCount: order.items?.length ?? null,
        })),
      },
      evidence: `${orders.length} ${source ? `${orderSourceLabel(source as Order['source'])} ` : ''}order${orders.length === 1 ? '' : 's'}${status ? ` with status ${status}` : ''}`,
      cards: [
        {
          kind: 'list',
          title: status ? `${sentence(status)} orders` : 'Recent orders',
          emptyLabel: status ? `No ${status} orders in this range.` : 'No orders in this range.',
          caption: orders.length > 6 ? `Showing 6 of ${orders.length}` : undefined,
          rows: orders.slice(0, 6).map((order) => ({
            label: `Order #${order.id.slice(0, 8)}`,
            value: gbp(order.totalAmount),
            meta: `${orderSourceLabel(order.source)} · ${order.status} · ${formatDateTime(order.createdAt, 'Europe/London')}`,
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
        sourceLabel: orderSourceLabel(order.source),
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
  // GET /location-stock/alerts is gated on `stock.locations:read`. Till staff
  // hold `inventory:read` (to record waste) but not this, so gating on the
  // broader one offered them a tool that always 403'd.
  capability: 'stock.locations:read',
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
          daysOfCover: row.daysOfStockRemaining == null ? null : round(row.daysOfStockRemaining, 1),
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
                          hint:
                            critical[0].daysOfStockRemaining == null
                              ? 'Consumption history is not available'
                              : `${round(critical[0].daysOfStockRemaining, 1)} days`,
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
  // The two halves are gated separately on the API: `stock.transfers:read` and
  // `stocktakes:read`. The tool needs the first; the second is read only when held.
  capability: 'stock.transfers:read',
  step: 'Checking stock operations',
  parameters: schema({ locationId: nullableString('Restrict to one location, or null for the active one.') }),
  async run(args, runtime) {
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
    const query = new URLSearchParams({ limit: '20', ...(locationId ? { locationId } : {}) });
    const canReadStocktakes = hasCapability(runtime.profile, 'stocktakes:read');
    const [transfers, stocktakes] = await Promise.all([
      runtime.get<StockTransfersResponse>(`/stock-transfers?${new URLSearchParams({ ...Object.fromEntries(query), status: 'pending' })}`),
      canReadStocktakes
        ? runtime.get<StocktakesResponse>(`/stocktakes?${new URLSearchParams({ ...Object.fromEntries(query), status: 'in_progress' })}`)
        : null,
    ]);
    const pendingTransfers = transfers.data ?? [];
    const openStocktakes = stocktakes?.data ?? [];
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
        ...(canReadStocktakes ? {} : { stocktakesNote: 'This operator cannot read stocktakes, so none are listed.' }),
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
      shortcuts: [page('Open waste & loss', '/reports/waste', 'Reports · Waste & loss')],
    };
  },
};

const listRecipeGaps: ToolDefinition = {
  name: 'list_recipe_gaps',
  description:
    'List menu items that have no recipe. Without a recipe a sale cannot deduct stock and the item has no food cost, so its margin is unknown in Menu engineering and Prime cost. Use for "which items are missing recipes" or when a margin or stock figure looks wrong.',
  capability: 'recipes:read',
  step: 'Checking menu recipes',
  parameters: schema({}),
  async run(_args, runtime) {
    const tenant = runtime.tenantId ? `?${new URLSearchParams({ tenantId: runtime.tenantId })}` : '';
    const gaps = await runtime.get<RecipeGap[]>(`/menu-item-recipes/gaps${tenant}`);
    return {
      output: { total: gaps.length, items: gaps.slice(0, 60).map(({ id, name, category }) => ({ id, name, category })) },
      evidence: `${gaps.length} menu item${gaps.length === 1 ? '' : 's'} without a recipe`,
      cards: [
        {
          kind: 'list',
          title: 'Missing recipes',
          caption: gaps.length > 6 ? `Showing 6 of ${gaps.length}` : undefined,
          emptyTone: 'clean' as const,
          emptyLabel: 'Every menu item has a recipe.',
          rows: gaps.slice(0, 6).map((gap) => ({ label: gap.name, meta: gap.category, tone: 'warning' as const })),
        },
      ],
      shortcuts: [page('Open the menu', '/menu/items', 'Menu · Items')],
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

/**
 * One customer as the record page shows them: tier, points, visits and spend,
 * the guest-safety facts staff must see (allergies, dietary needs, alerts), and
 * the loyalty wallet — stamp-card balances and the reward vouchers ready to
 * redeem. Reading the wallet also lets the API issue any birthday reward that is
 * due, exactly as opening the record does.
 */
const getCustomer: ToolDefinition = {
  name: 'get_customer',
  description:
    'Read one customer’s record: loyalty tier, points balance, visits, spend, last visit, marketing consent, allergies, dietary needs and staff alerts, plus their loyalty wallet — stamp or punch-card balance per programme, rewards (vouchers) ready to redeem and when they expire. Resolve the id with search_customers first.',
  capability: 'customers:read',
  step: 'Opening the customer record',
  parameters: schema({ customerId: { type: 'string', description: 'Customer id from search_customers.' } }),
  async run(args, runtime) {
    const customerId = optionalText(args.customerId, 60);
    if (!customerId) return { output: { error: 'A customer id is required — find it with search_customers.' } };
    const [customer, wallet] = await Promise.all([
      runtime.get<Customer>(`/customers/${encodeURIComponent(customerId)}`),
      runtime
        .get<{ programmes: CustomerLoyaltyProgram[] }>(`/loyalty-programs/customers/${encodeURIComponent(customerId)}`)
        .catch(() => null),
    ]);
    const name = `${customer.firstName} ${customer.lastName}`.trim();
    const programmes = (wallet?.programmes ?? []).map((programme) => ({
      name: programme.name,
      balance: programme.balance,
      unit: programme.balance === 1 ? programme.unitSingular : programme.unitPlural,
      stampsPerReward: programme.rewardRule.cost,
      rewardsReady: programme.rewards.length,
      nextRewardExpiresAt: programme.nextRewardExpiresAt,
      lifetimeEarned: programme.lifetimeEarned,
      lifetimeRedeemed: programme.lifetimeRedeemed,
    }));
    return {
      output: {
        id: customer.id,
        name,
        phone: customer.phone,
        email: customer.email ?? null,
        tier: customer.tier,
        pointsBalance: customer.pointsBalance,
        totalVisits: customer.totalVisits,
        totalSpentGbp: toNumber(customer.totalSpent),
        lastVisitAt: customer.lastVisitAt ?? null,
        customerSince: customer.createdAt,
        marketingOptIn: customer.marketingOptIn,
        allergies: customer.allergies ?? [],
        dietary: customer.dietary ?? [],
        alerts: customer.alerts ?? [],
        loyaltyProgrammes: programmes,
        ...(wallet ? {} : { loyaltyNote: 'The loyalty wallet could not be read, so stamp balances and vouchers are unknown — not zero.' }),
      },
      evidence: `Customer record · ${name || customer.id.slice(0, 8)}`,
      cards: [
        {
          title: name || 'Customer',
          caption: sentence(customer.tier),
          metrics: [
            { label: 'Points', value: String(customer.pointsBalance) },
            { label: 'Visits', value: String(customer.totalVisits) },
            { label: 'Spent', value: gbp(customer.totalSpent) },
            ...(programmes.length
              ? [
                  {
                    label: 'Rewards ready',
                    value: String(programmes.reduce((sum, programme) => sum + programme.rewardsReady, 0)),
                  },
                ]
              : []),
          ],
        },
      ],
      shortcuts: [page('Open customer', `/customers/${customer.id}`, 'Customer record')],
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
      shortcuts: [page('Open the rota', '/staff/rota', 'Staff · Rota & shifts', locationId ?? undefined)],
    };
  },
};

const getRotaVariance: ToolDefinition = {
  name: 'get_rota_variance',
  description:
    'Compare the published rota with what was actually worked over a date range: for each rostered shift, whether the person worked it, is still on shift, or did not show, how many minutes late or early they clocked in, and minutes worked against minutes planned. Use for lateness, no-shows, "did everyone turn up", or planned versus worked hours. Clock-ins with no rota slot are not included — get_schedule shows who is clocked in now.',
  capability: 'scheduling:read',
  step: 'Comparing the rota with worked time',
  parameters: schema({
    from: nullableString(`${DATE} Defaults to the start of this week.`),
    to: nullableString(`${DATE} Defaults to today.`),
    locationId: nullableString('Restrict to one location, or null for the active one.'),
  }),
  async run(args, runtime) {
    const locationId = typeof args.locationId === 'string' && args.locationId ? args.locationId : runtime.locationId;
    const timeZone = await runtime.timezone(locationId);
    const anchors = calendarAnchors();
    const from = isIsoDate(args.from) ? args.from : anchors.weekStart;
    const to = isIsoDate(args.to) ? args.to : zonedNow(timeZone).date;
    const query = new URLSearchParams({ from: zonedIso(from, '00:00', timeZone), to: zonedIso(addDays(to, 1), '00:00', timeZone) });
    if (locationId) query.set('locationId', locationId);

    const rows = await runtime.get<VarianceRow[]>(`/scheduled-shifts/variance?${query}`);
    const late = rows.filter((row) => (row.startDeltaMinutes ?? 0) > 5);
    const noShows = rows.filter((row) => row.status === 'no_show' && Date.parse(row.endsAt) < Date.now());
    const plannedMinutes = rows.reduce((sum, row) => sum + row.plannedMinutes, 0);
    const workedMinutes = rows.reduce((sum, row) => sum + row.workedMinutes, 0);
    const label = (row: VarianceRow) => row.staff?.name || row.staff?.email || 'Unassigned shift';

    return {
      output: {
        range: { from, to, timeZone },
        totals: {
          shifts: rows.length,
          plannedHours: round(plannedMinutes / 60, 1),
          workedHours: round(workedMinutes / 60, 1),
          lateStarts: late.length,
          noShows: noShows.length,
        },
        shifts: rows.slice(0, 80).map((row) => ({
          staff: label(row),
          local: `${formatDateTime(row.startsAt, timeZone)} → ${formatDateTime(row.endsAt, timeZone)}`,
          status: Date.parse(row.startsAt) > Date.now() && row.status === 'no_show' ? 'not started yet' : row.status.replaceAll('_', ' '),
          clockInMinutesLate: row.startDeltaMinutes,
          plannedHours: round(row.plannedMinutes / 60, 2),
          workedHours: round(row.workedMinutes / 60, 2),
        })),
        notes: [
          'Only published shifts are compared. clockInMinutesLate is positive when late, negative when early.',
          'A shift that has not started yet has no clock-in; it is not a no-show.',
          'Worked time can be corrected on Staff → Rota & shifts by someone who can edit the rota.',
        ],
      },
      evidence: `Rota vs worked ${from}${to === from ? '' : `–${to}`}: ${noShows.length} no-show${noShows.length === 1 ? '' : 's'}, ${late.length} late`,
      cards: [
        {
          title: 'Rota vs worked',
          caption: rangeLabel(from, to),
          metrics: [
            { label: 'Planned', value: `${round(plannedMinutes / 60, 1)} h` },
            { label: 'Worked', value: `${round(workedMinutes / 60, 1)} h` },
            { label: 'Late starts', value: String(late.length), tone: late.length ? ('warning' as const) : ('positive' as const) },
            { label: 'No-shows', value: String(noShows.length), tone: noShows.length ? ('negative' as const) : ('positive' as const) },
          ],
        },
      ],
      shortcuts: [page('Open the rota', '/staff/rota', 'Staff · Rota & shifts', locationId ?? undefined)],
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
      shortcuts: [page('Open leave requests', '/staff/requests', 'Staff · Leave')],
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
      shortcuts: [page('Open helpdesk', '/staff/helpdesk', 'Staff · Helpdesk')],
    };
  },
};

// ── Governance, finance and communications ──────────────────────────────────

/**
 * Cash-up is done in the till now (2026-10-04): the till header opens a drawer
 * to open the day with a float and close it with a blind count. The history is
 * the End of day report. An open day's stored expected figures stay at £0 until
 * it closes, so the running expectation is read from `/expected` instead —
 * quoting the stored row would tell a manager the drawer should be empty.
 */
const getCashUpStatus: ToolDefinition = {
  name: 'get_cash_up_status',
  description:
    'Read the trading-day cash-ups for a location: whether today is open or closed, the opening float, what the drawer and card terminal should hold so far, and for closed days the counted totals and the cash and card variance. Use for "is the day open", "did the till balance", "what was the variance", or the End of day report.',
  capability: 'cashups:read',
  step: 'Checking cash-ups',
  parameters: schema({ locationId: nullableString('Location to inspect, or null for the active location.') }),
  async run(args, runtime) {
    const locationId = await runtime.resolveLocationId(args.locationId);
    if (!locationId) return { output: { error: 'Select a location before checking cash-ups.' } };
    const records = await runtime.get<CashUp[]>(`/cash-ups?${new URLSearchParams({ locationId })}`);
    const timeZone = await runtime.timezone(locationId);
    const today = zonedNow(timeZone).date;
    const open = records.find((record) => record.status === 'open') ?? null;
    const expectation = open ? await runtime.get<CashUpExpectation>(`/cash-ups/${open.id}/expected`).catch(() => null) : null;
    const todayRecord = records.find((record) => record.tradingDate === today) ?? null;
    const variance = (value?: string | null) => (value == null ? null : toNumber(value));
    const closed = records.filter((record) => record.status !== 'open').slice(0, 14);
    const canRunCashUp = hasCapability(runtime.profile, 'cashups:write') && hasCapability(runtime.profile, 'orders:create');

    return {
      output: {
        today: {
          date: today,
          state: todayRecord ? (todayRecord.status === 'open' ? 'open' : 'closed') : 'not opened',
        },
        openDay: open
          ? {
              tradingDate: open.tradingDate,
              leftOpenFromEarlierDay: open.tradingDate < today,
              openedAt: open.openedAt ?? null,
              openingFloatGbp: toNumber(open.openingFloat),
              expectedSoFar: expectation
                ? {
                    cashInDrawerGbp: toNumber(expectation.expectedCash),
                    cardGbp: toNumber(expectation.expectedCard),
                    byPaymentProvider: expectation.tenderSummary,
                    asOf: expectation.asOf,
                  }
                : null,
            }
          : null,
        closedDays: closed.map((record) => ({
          tradingDate: record.tradingDate,
          status: record.status,
          openingFloatGbp: toNumber(record.openingFloat),
          expectedCashGbp: toNumber(record.expectedCash),
          countedCashGbp: variance(record.countedCash),
          cashVarianceGbp: variance(record.cashVariance),
          expectedCardGbp: toNumber(record.expectedCard),
          terminalCardTotalGbp: variance(record.terminalCardTotal),
          cardVarianceGbp: variance(record.cardVariance),
          notes: record.notes ?? null,
          closedAt: record.closedAt ?? null,
        })),
        notes: [
          'A negative variance means less was counted than expected.',
          'The day is opened and closed from the till (the cash-up button in the till header); history is in Reports → End of day.',
          ...(open && open.tradingDate < today ? [`The day for ${open.tradingDate} was never closed — flag it.`] : []),
        ],
      },
      evidence: `${records.length} cash-up record${records.length === 1 ? '' : 's'}${open ? ', one day open' : ''}`,
      cards: [
        {
          kind: 'list',
          title: 'Cash-ups',
          caption: (await runtime.locationName(locationId)) || undefined,
          rows: records.slice(0, 6).map((record) => ({
            label: record.tradingDate,
            value: record.status === 'open' ? 'Open' : record.cashVariance == null ? sentence(record.status) : gbp(record.cashVariance),
            meta:
              record.status === 'open'
                ? `Opened with a ${gbp(record.openingFloat)} float`
                : `cash variance ${record.cashVariance == null ? 'not counted' : gbp(record.cashVariance)} · card variance ${record.cardVariance == null ? 'not entered' : gbp(record.cardVariance)}`,
            tone:
              record.status === 'open'
                ? ('warning' as const)
                : Math.abs(toNumber(record.cashVariance)) > 0.01 || Math.abs(toNumber(record.cardVariance)) > 0.01
                  ? ('warning' as const)
                  : ('positive' as const),
          })),
          emptyLabel: 'No cash-ups for this location yet.',
        },
      ],
      shortcuts: [
        canRunCashUp
          ? page('Open the till cash-up', '/pos?cashup=open', 'Till · Cash-up', locationId)
          : page('Open the End of day report', '/reports/end-of-day', 'Reports · End of day', locationId),
      ],
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
  description:
    'Read customer email: the sending connection (when this operator may see it), templates, automations (which are live) and recent delivery results, including failures.',
  capability: 'email:read',
  step: 'Checking customer communications',
  parameters: schema({}),
  async run(_args, runtime) {
    const tenant = runtime.tenantId ? `?tenantId=${encodeURIComponent(runtime.tenantId)}` : '';
    const deliveriesQuery = new URLSearchParams({ page: '1', limit: '20', ...(runtime.tenantId ? { tenantId: runtime.tenantId } : {}) });
    // GET /email/connection is gated on `email.connections:read`, which store
    // and marketing managers do not hold. Fetching it unconditionally failed
    // the whole tool for the very roles that run email.
    const canSeeConnection = hasCapability(runtime.profile, 'email.connections:read');
    const [connection, templates, automations, deliveries] = await Promise.all([
      canSeeConnection ? runtime.get<EmailConnection | null>(`/email/connection${tenant}`) : Promise.resolve(undefined),
      runtime.get<EmailTemplate[]>(`/email/templates${tenant}`),
      runtime.get<EmailAutomation[]>(`/email/automations${tenant}`),
      runtime.get<EmailDeliveriesResponse>(`/email/deliveries?${deliveriesQuery}`),
    ]);
    const failed = deliveries.data.filter((delivery) => delivery.status === 'failed').length;
    return {
      output: {
        connection: canSeeConnection
          ? connection
          : 'Not visible to this role (needs email.connections:read). Do not describe email as not set up.',
        templates,
        automations,
        deliveries: deliveries.data,
      },
      evidence: `${templates.length} templates, ${automations.length} automations, ${failed} recent failures`,
      cards: [
        {
          title: 'Customer email',
          caption: canSeeConnection ? connection?.fromEmail || 'No sender connected' : undefined,
          metrics: [
            {
              label: 'Connection',
              value: !canSeeConnection ? 'Not visible' : connection?.isEnabled ? 'Enabled' : 'Needs setup',
              tone: !canSeeConnection ? 'default' : connection?.isEnabled ? 'positive' : 'warning',
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
  description:
    'Preview payroll gross pay and paid hours for a date range, plus recent pay runs and their state: draft, finalised (hours and gross frozen), issued (payslips published to employees, irreversible) or superseded. Flags runs that are finalised but not issued and lines still missing their deductions.',
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
    const recentRuns = runs.slice(0, 10).map((run) => ({
      id: run.id,
      period: run.period,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      status: run.status,
      employees: run.lines.length,
      grossGbp: round(
        run.lines.reduce((sum, line) => sum + toNumber(line.grossPay), 0),
        2,
      ),
      // `netPay: null` means the deductions have not been entered — never zero.
      linesMissingDeductions: run.lines.filter((line) => line.netPay == null).length,
      finalisedAt: run.finalisedAt,
      issuedAt: run.issuedAt,
      deductionsSource: run.deductionsSource,
    }));
    return {
      output: {
        preview,
        recentRuns,
        notes: [
          'DUMA does not compute tax or NI: deductions are entered from whatever runs payroll, and a run cannot be issued until every line has them.',
          'Issuing publishes the payslips to employees in My HR → Documents.',
        ],
      },
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
            {
              label: 'Awaiting issue',
              value: String(recentRuns.filter((run) => run.status === 'finalised').length),
              tone: recentRuns.some((run) => run.status === 'finalised') ? ('warning' as const) : ('positive' as const),
            },
          ],
        },
      ],
      shortcuts: [page('Open payroll', '/staff/payroll', 'Staff · Payroll')],
    };
  },
};

const getMyWorkspace: ToolDefinition = {
  module: 'people',
  name: 'get_my_workspace',
  description:
    'Read the signed-in operator’s own My rota and My HR summary: whether they are clocked in now, their next shifts over the coming five weeks, leave balance, HR warnings, documents and support requests. Use for broad questions about my workday, my next shift, my leave, my rota, or what needs my attention. For a simple name, address, emergency-contact or personal-details question, use get_my_profile instead; for pay, use get_my_payslips. DUMA does not hold expense claims — say so rather than guessing.',
  step: 'Checking your rota and My HR',
  parameters: schema({}),
  async run(_args, runtime) {
    const now = new Date();
    const rotaFrom = new Date(now);
    rotaFrom.setHours(0, 0, 0, 0);
    // The same horizon My rota uses for "Next shift": a question about the next
    // shift must not come back empty because it falls in a later week.
    const rotaTo = new Date(rotaFrom);
    rotaTo.setDate(rotaTo.getDate() + 35);
    const year = now.getFullYear();

    const [employee, optional] = await Promise.all([
      runtime.myEmployee(),
      Promise.allSettled([
        runtime.get<LeaveEntitlement[]>(`/hr/entitlements/me?year=${year}`),
        runtime.get<LeaveRequest[]>('/hr/leave-requests/my'),
        runtime.get<HelpdeskTicket[]>('/helpdesk/my'),
        runtime.get<EmployeeDocument[]>('/hr/documents/me'),
        runtime.get<Shift[]>('/shifts/my'),
        runtime.get<ScheduledShift[]>(
          `/scheduled-shifts/my?${new URLSearchParams({ from: rotaFrom.toISOString(), to: rotaTo.toISOString() })}`,
        ),
      ]),
    ]);
    const value = <T>(index: number): T[] => (optional[index]?.status === 'fulfilled' ? (optional[index].value as T[]) : []);
    const entitlements = value<LeaveEntitlement>(0);
    const requests = value<LeaveRequest>(1);
    const tickets = value<HelpdeskTicket>(2);
    const documents = value<EmployeeDocument>(3);
    const shifts = value<Shift>(4);
    const rota = value<ScheduledShift>(5);
    const unavailable = ['leave entitlement', 'leave requests', 'HR requests', 'documents', 'clock records', 'rota'].filter(
      (_, index) => optional[index]?.status === 'rejected',
    );

    const actions = employee ? myHrActions({ employee, documents, tickets, now }) : [];
    const balance = leaveBalance(entitlements);
    const activeShift = shifts.find((shift) => !shift.clockedOut) ?? null;
    const upcoming = rota
      .filter((shift) => new Date(shift.endsAt).getTime() >= now.getTime())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const zoneOf = new Map((await runtime.locations().catch(() => [] as Location[])).map((location) => [location.id, location.timezone]));
    const openTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
    const pendingLeave = requests.filter((request) => request.status === 'pending');

    return {
      output: {
        profile: {
          displayName: runtime.profile.name ?? null,
          email: runtime.profile.email ?? null,
          role: runtime.profile.role,
          scope: runtime.profile.scope,
          employeeRecordAvailable: Boolean(employee),
          jobTitle: employee?.jobTitle ?? null,
          department: employee?.department ?? null,
          employmentType: employee?.employmentType ?? null,
          startDate: employee?.startDate ?? null,
          address: employee?.address ?? null,
          emergencyContactComplete: employee ? Boolean(employee.emergencyContactName && employee.emergencyContactPhone) : null,
          nationalInsuranceNumberHeld: employee ? Boolean(employee.hasNiNumber) : null,
        },
        dashboard: {
          activeShift: activeShift
            ? {
                clockedIn: activeShift.clockedIn,
                location: activeShift.location?.name ?? activeShift.locationId,
                elapsedMinutes: Math.max(0, Math.round((now.getTime() - new Date(activeShift.clockedIn).getTime()) / 60_000)),
              }
            : null,
          upcomingShifts: upcoming.slice(0, 12).map((shift) => {
            const timeZone = zoneOf.get(shift.locationId) || 'Europe/London';
            return {
              startsAt: shift.startsAt,
              endsAt: shift.endsAt,
              local: `${formatDateTime(shift.startsAt, timeZone)} → ${formatDateTime(shift.endsAt, timeZone)}`,
              location: shift.location?.name ?? shift.locationId,
              role: shift.role ?? null,
            };
          }),
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
          unavailableSections: unavailable,
        },
      },
      evidence: `Your rota and My HR · ${actions.length} notice${actions.length === 1 ? '' : 's'}`,
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
          emptyLabel: employee
            ? 'Nothing needs you — your HR record is up to date.'
            : 'Your DUMA account is active. Employment details have not been added.',
          caption: actions.length ? 'Most urgent first' : employee ? 'Everything looks up to date' : 'Account details only',
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
      shortcuts: employee
        ? [page('Edit your details', '/my-hr?tab=overview&action=edit-details', 'My HR · Review your personal details')]
        : [page('Open your profile', '/settings', 'Settings · Your signed-in account and workspace')],
    };
  },
};

const getMyProfile: ToolDefinition = {
  module: 'identity',
  name: 'get_my_profile',
  description:
    'Read the signed-in operator’s trusted DUMA account identity plus optional employment and editable personal-detail status. Always use this for questions about who I am, my name, email, role, access scope, assigned locations, address, emergency contact, National Insurance number, or where to edit my details. The account identity remains valid when no optional HR employee record exists. This intentionally excludes documents and private HR requests.',
  step: 'Checking your personal details',
  parameters: schema({}),
  async run(_args, runtime) {
    const employee = await runtime.myEmployee();
    return {
      output: {
        displayName: runtime.profile.name ?? null,
        email: runtime.profile.email ?? null,
        role: runtime.profile.role,
        scope: runtime.profile.scope,
        tenantId: runtime.profile.tenantId,
        assignedLocationIds: runtime.profile.locationIds ?? [],
        employeeRecordAvailable: Boolean(employee),
        jobTitle: employee?.jobTitle ?? null,
        department: employee?.department ?? null,
        employmentType: employee?.employmentType ?? null,
        startDate: employee?.startDate ?? null,
        addressHeld: employee ? Boolean(employee.address) : null,
        emergencyContactComplete: employee ? Boolean(employee.emergencyContactName && employee.emergencyContactPhone) : null,
        nationalInsuranceNumberHeld: employee ? Boolean(employee.hasNiNumber) : null,
        editableInDetailsDrawer: employee ? ['address', 'emergency contact', 'bank details', 'National Insurance number'] : [],
      },
      evidence: employee ? 'Your DUMA account and My HR profile' : 'Your DUMA account',
      shortcuts: employee
        ? [page('Edit your details', '/my-hr?tab=overview&action=edit-details', 'My HR · Review your personal details')]
        : [page('Open your profile', '/settings', 'Settings · Your signed-in account and workspace')],
    };
  },
};

// ── My HR: attendance and pay ────────────────────────────────────────────────

const getMyAttendance: ToolDefinition = {
  module: 'people',
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

/**
 * The operator's own issued payslips. A payslip is a line of a pay run that has
 * been issued, so a draft or finalised run never appears here — "no payslip yet"
 * usually means the run has not been issued, not that nobody was paid.
 * Session-subject on the API: an employee is always entitled to their own.
 */
const getMyPayslips: ToolDefinition = {
  module: 'payroll',
  name: 'get_my_payslips',
  description:
    'Read the signed-in operator’s own issued payslips, newest first: pay period, gross pay, net pay, each named deduction (tax, social security, pension, other) and the hours paid. Use for "what was I paid", "my last payslip", "how much tax did I pay". Payslips appear only once a pay run is issued.',
  step: 'Checking your payslips',
  parameters: schema({ limit: { type: ['number', 'null'], description: 'How many payslips to return, up to 12. Null for 6.' } }),
  async run(args, runtime) {
    const payslips = await runtime.get<Payslip[]>('/hr/payslips/my');
    const shown = payslips.slice(0, limit(args.limit, 6, 12));
    const latest = payslips[0];
    // Each payslip carries its workspace's currency; an employee may hold payslips from more than one.
    const money = (value: unknown, currency: string) => {
      try {
        return toNumber(value).toLocaleString('en-GB', { style: 'currency', currency });
      } catch {
        return gbp(value);
      }
    };
    return {
      output: {
        total: payslips.length,
        payslips: shown.map((payslip) => ({
          period: rangeLabel(payslip.payPeriodStart, payslip.payPeriodEnd),
          payPeriodStart: payslip.payPeriodStart,
          payPeriodEnd: payslip.payPeriodEnd,
          currency: payslip.currency,
          gross: toNumber(payslip.grossPay),
          net: toNumber(payslip.netPay),
          deductions: (payslip.deductions ?? [])
            .filter((line) => line.paidBy === 'employee')
            .map((line) => ({ label: line.label, kind: line.kind, amount: toNumber(line.amount) })),
          employerContributions: payslip.employerContributions == null ? null : toNumber(payslip.employerContributions),
          issuedAt: payslip.finalisedAt ?? null,
        })),
        ...(payslips.length === 0
          ? { note: 'No payslip has been issued to this person yet. Payslips appear once their employer issues a pay run.' }
          : {}),
      },
      evidence: `${payslips.length} payslip${payslips.length === 1 ? '' : 's'}`,
      cards: latest
        ? [
            {
              title: 'Latest payslip',
              caption: rangeLabel(latest.payPeriodStart, latest.payPeriodEnd),
              metrics: [
                { label: 'Gross', value: money(latest.grossPay, latest.currency) },
                { label: 'Net', value: money(latest.netPay, latest.currency) },
                ...(latest.employeeDeductions != null
                  ? [{ label: 'Deductions', value: money(latest.employeeDeductions, latest.currency) }]
                  : []),
              ],
            },
          ]
        : [],
      shortcuts: [page('Open your payslips', '/my-hr?tab=documents', 'My HR · Documents')],
    };
  },
};

export const TOOLS: ToolDefinition[] = [
  searchSupport,
  listLocations,
  getWorkspaceModules,
  getQrOrderingStatus,
  listSuppliers,
  listStockItems,
  listMenuItems,
  listStaff,
  getSalesReport,
  getBusinessAnalytics,
  getOperationsCommandCentre,
  listOrders,
  getOrderDetail,
  getInventoryStatus,
  listPurchaseOrders,
  listRestockRequests,
  getStockOperations,
  getLossLog,
  listRecipeGaps,
  searchCustomers,
  getCustomer,
  listCustomerSegments,
  getSchedule,
  getRotaVariance,
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

export function toolsForCapabilities(capabilities: readonly string[], enabledModuleIds: readonly ModuleId[] = MODULE_IDS) {
  // A tool with no capability is open to everyone; otherwise the caller must
  // hold it. The API re-checks on every call the tool makes — this only decides
  // which tools the model is even offered, so it cannot be the security boundary.
  return TOOLS.filter((tool) => {
    if (tool.capability && !hasCapability(capabilities, tool.capability)) return false;
    return isModuleSurfaceEnabled(tool, enabledModuleIds);
  });
}

export function toolByName(name: string) {
  return TOOL_BY_NAME.get(name);
}
