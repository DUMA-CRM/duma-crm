import 'server-only';

import type { HrEmployee } from '@/lib/api/hr.service';
import type { LocationStock } from '@/lib/api/inventory.service';
import type { Order } from '@/lib/api/orders.service';
import type { LeaveEntitlement, LeaveRequest, LeaveType } from '@/lib/api/people-ops.service';
import type { PurchaseOrder } from '@/lib/api/purchasing.service';
import type { QrOrderingConfig } from '@/lib/api/qr-ordering.service';
import { encodeNotes } from '@/lib/api/restock.service';
import { type Capability, hasCapability } from '@/lib/auth/capabilities';
import { isValidNiNumber, normaliseNiNumber } from '@/lib/utils/my-hr';
import type { Customer, CustomersResponse } from '@/types/customers';
import type { MenuItem } from '@/types/menu';

import type { FieldValue, ResolvedAction, ResolvedLine } from './action-seal.ts';
import { resolveSealedSubmission, sealAction } from './action-seal.ts';
import { formatDateTime, gbp, isIsoDate, optionalText, round, toNumber, zonedIso } from './agent-format.ts';
import { AgentRuntime } from './agent-runtime.server';
import type {
  AgentActionSubmission,
  AgentField,
  AgentFieldOption,
  AgentFieldType,
  AgentLineGroup,
  AgentPendingAction,
  AgentShortcut,
} from './agent-types';

type JsonObject = Record<string, unknown>;

const MAX_OPTIONS = 200;

export { sealAction };
export type { ResolvedAction, ResolvedLine };

// ── Field builders ───────────────────────────────────────────────────────────

interface FieldInit extends Partial<Omit<AgentField, 'key' | 'label' | 'type'>> {
  type: AgentFieldType;
}

function field(key: string, label: string, init: FieldInit): AgentField {
  return { key, label, value: null, ...init };
}

function selectField(key: string, label: string, options: AgentFieldOption[], value: unknown, init: Partial<AgentField> = {}): AgentField {
  const capped = options.slice(0, MAX_OPTIONS);
  const requested = typeof value === 'string' ? value : '';
  return {
    key,
    label,
    type: 'select',
    // Never present an id the operator cannot see in the list — a silent
    // mismatch would confirm something different from what the card shows.
    value: capped.some((option) => option.value === requested) ? requested : '',
    options: capped,
    ...init,
  };
}

function choice(values: Array<[string, string]>): AgentFieldOption[] {
  return values.map(([value, label]) => ({ value, label }));
}

// ── Resolved values ──────────────────────────────────────────────────────────

function str(values: Record<string, FieldValue>, key: string) {
  const value = values[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
}

function num(values: Record<string, FieldValue>, key: string) {
  return toNumber(values[key]);
}

// ── Action definitions ───────────────────────────────────────────────────────

export interface ActionResult {
  message: string;
  shortcuts?: AgentShortcut[];
}

export interface ActionDefinition {
  kind: string;
  /**
   * Capability required to offer this action. Omit for self-service writes an
   * employee makes about their own record — booking their own leave, editing
   * their own details — which every signed-in operator may do. Same contract
   * as `ToolDefinition.capability`; there is no capability standing for "is a
   * person", and inventing one the API does not grant would fail closed and
   * lock everybody out.
   */
  capability?: Capability;
  /** Tool the model calls to prepare this action. It never writes anything. */
  tool: { name: string; description: string; parameters: JsonObject };
  draft(args: JsonObject, runtime: AgentRuntime): Promise<AgentPendingAction | { error: string }>;
  /** What confirming would do, described without performing it (test mode). */
  execute(action: ResolvedAction, runtime: AgentRuntime): Promise<ActionResult>;
}

function schema(properties: JsonObject): JsonObject {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const nullableString = (description: string) => ({ type: ['string', 'null'], description });

// Inventory is one workspace with query-string tabs (see InventoryWorkspace);
// stock is the default tab and transfers/losses live on the item record.
const INVENTORY_TABS = {
  stock: { href: '/inventory', label: 'Open stock' },
  demand: { href: '/inventory?tab=demand', label: 'Open restock requests' },
  orders: { href: '/inventory?tab=orders', label: 'Open purchase orders' },
  suppliers: { href: '/inventory?tab=suppliers', label: 'Open suppliers' },
  stocktakes: { href: '/inventory?tab=stocktakes', label: 'Open stocktakes' },
} as const;

const inventoryShortcut = (tab: keyof typeof INVENTORY_TABS, locationId?: string): AgentShortcut => ({
  ...INVENTORY_TABS[tab],
  description: locationId ? 'Switches the active location' : 'Inventory',
  ...(locationId ? { locationId } : {}),
  kind: 'filtered',
});

// 1 ─ Purchase order ─────────────────────────────────────────────────────────

const createPurchaseOrder: ActionDefinition = {
  kind: 'create_purchase_order',
  capability: 'purchasing:write',
  tool: {
    name: 'draft_purchase_order',
    description:
      'Prepare a purchase order for operator approval. Never creates the order. Resolve the real supplier, location and stock item ids first; leave unitCost null to use the last known cost.',
    parameters: schema({
      supplierId: { type: 'string' },
      locationId: { type: 'string' },
      expectedAt: nullableString('Expected delivery date as YYYY-MM-DD, or null.'),
      notes: nullableString('Short note for the supplier, or null.'),
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            stockItemId: { type: 'string' },
            quantityOrdered: { type: 'number', exclusiveMinimum: 0 },
            unitCost: { type: ['number', 'null'] },
          },
          required: ['stockItemId', 'quantityOrdered', 'unitCost'],
          additionalProperties: false,
        },
      },
    }),
  },
  async draft(args, runtime) {
    const [suppliers, locations, stockOptions, stockItems] = await Promise.all([
      runtime.supplierOptions(),
      runtime.locationOptions(),
      runtime.stockItemOptions(),
      runtime.stockItems(),
    ]);
    if (suppliers.length === 0) return { error: 'This workspace has no active suppliers yet.' };
    const locationId = await runtime.resolveLocationId(args.locationId);
    const byId = new Map(stockItems.map((item) => [item.id, item]));

    const template: AgentField[] = [
      field('quantityOrdered', 'Quantity', { type: 'number', min: 0.01, max: 100_000, step: 1, value: 1 }),
      field('unitCost', 'Unit cost', { type: 'money', min: 0, max: 100_000, step: 0.01, value: 0 }),
    ];

    const requested = Array.isArray(args.lines) ? args.lines : [];
    const lines = requested
      .map((raw) => {
        const row = (raw ?? {}) as JsonObject;
        const item = byId.get(String(row.stockItemId ?? ''));
        if (!item) return null;
        const cost = row.unitCost == null ? toNumber(item.costPerUnit) : toNumber(row.unitCost);
        return {
          id: item.id,
          title: item.name,
          subtitle: `per ${item.unit}`,
          fields: [
            { ...template[0], value: round(Math.max(toNumber(row.quantityOrdered, 1), 0.01), 3) },
            { ...template[1], value: round(cost, 2) },
          ],
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line));

    if (lines.length === 0) return { error: 'None of those stock item ids matched an active item. Call list_stock_items first.' };

    const lineGroup: AgentLineGroup = {
      label: 'Items',
      addLabel: 'Add item',
      emptyLabel: 'No items on this order yet.',
      options: stockOptions,
      template,
      lines,
      total: { label: 'Order total', multiply: ['quantityOrdered', 'unitCost'], format: 'currency' },
      minLines: 1,
      maxLines: 40,
    };

    return {
      kind: 'create_purchase_order',
      title: 'Purchase order',
      summary: 'Draft order for supplier approval',
      confirmLabel: 'Create draft order',
      note: 'Creates a draft purchase order. It stays a draft until someone submits it to the supplier.',
      fields: [
        selectField('supplierId', 'Supplier', suppliers, args.supplierId),
        selectField('locationId', 'Deliver to', locations, locationId),
        field('expectedAt', 'Expected', { type: 'date', value: isIsoDate(args.expectedAt) ? args.expectedAt : '', optional: true }),
        field('notes', 'Notes', {
          type: 'textarea',
          value: optionalText(args.notes),
          optional: true,
          placeholder: 'Optional note for the supplier',
        }),
      ],
      lineGroup,
    };
  },
  async execute(action, runtime) {
    const locationId = str(action.fields, 'locationId');
    const expectedAt = str(action.fields, 'expectedAt');
    const created = await runtime.send<PurchaseOrder>('/purchase-orders', 'POST', {
      supplierId: str(action.fields, 'supplierId'),
      locationId,
      ...(expectedAt ? { expectedAt: `${expectedAt}T00:00:00.000Z` } : {}),
      ...(str(action.fields, 'notes') ? { notes: str(action.fields, 'notes') } : {}),
      lines: action.lines.map((line) => ({
        stockItemId: line.id,
        quantityOrdered: num(line.values, 'quantityOrdered'),
        unitCost: num(line.values, 'unitCost'),
      })),
    });
    return {
      message: `Purchase order ${created.reference || created.id} was created as a draft with ${action.lines.length} line${action.lines.length === 1 ? '' : 's'}. It is not sent to the supplier until it is submitted.`,
      shortcuts: [inventoryShortcut('orders', locationId)],
    };
  },
};

// 2 ─ Restock request ────────────────────────────────────────────────────────

const createRestockRequest: ActionDefinition = {
  kind: 'create_restock_request',
  capability: 'restock:write',
  tool: {
    name: 'draft_restock_request',
    description: 'Prepare an internal restock request for approval — the way a site asks for stock without raising a supplier order.',
    parameters: schema({
      stockItemId: { type: 'string' },
      locationId: { type: 'string' },
      requestedQty: { type: 'number', exclusiveMinimum: 0 },
      priority: { type: 'string', enum: ['standard', 'urgent'] },
      notes: nullableString('Why it is needed, or null.'),
    }),
  },
  async draft(args, runtime) {
    const [stockOptions, locations] = await Promise.all([runtime.stockItemOptions(), runtime.locationOptions()]);
    const locationId = await runtime.resolveLocationId(args.locationId);
    return {
      kind: 'create_restock_request',
      title: 'Restock request',
      summary: 'Ask for stock to be moved or reordered',
      confirmLabel: 'Send request',
      note: 'Raises a pending restock request for a manager to approve.',
      fields: [
        selectField('stockItemId', 'Item', stockOptions, args.stockItemId),
        selectField('locationId', 'Location', locations, locationId),
        field('requestedQty', 'Quantity', {
          type: 'number',
          min: 0.01,
          max: 100_000,
          step: 1,
          value: round(Math.max(toNumber(args.requestedQty, 1), 0.01), 3),
        }),
        field('priority', 'Priority', {
          type: 'select',
          options: choice([
            ['standard', 'Standard'],
            ['urgent', 'Urgent'],
          ]),
          value: args.priority === 'urgent' ? 'urgent' : 'standard',
        }),
        field('notes', 'Notes', { type: 'textarea', value: optionalText(args.notes), optional: true, placeholder: 'Optional context' }),
      ],
    };
  },
  async execute(action, runtime) {
    const priority = str(action.fields, 'priority') === 'urgent' ? 'urgent' : 'standard';
    await runtime.send('/restock-requests', 'POST', {
      stockItemId: str(action.fields, 'stockItemId'),
      locationId: str(action.fields, 'locationId'),
      requestedQty: num(action.fields, 'requestedQty'),
      notes: encodeNotes(priority, str(action.fields, 'notes')),
    });
    const item = await optionLabel(runtime.stockItemOptions(), str(action.fields, 'stockItemId'));
    return {
      message: `Restock request raised for ${num(action.fields, 'requestedQty')} × ${item}. It sits as pending until a manager approves it.`,
      shortcuts: [inventoryShortcut('demand', str(action.fields, 'locationId'))],
    };
  },
};

// 3 ─ Stock transfer ─────────────────────────────────────────────────────────

const createStockTransfer: ActionDefinition = {
  kind: 'create_stock_transfer',
  capability: 'stock.transfers:write',
  tool: {
    name: 'draft_stock_transfer',
    description: 'Prepare a stock transfer between two locations for approval. Use when one site has spare stock another site needs.',
    parameters: schema({
      fromLocationId: { type: 'string' },
      toLocationId: { type: 'string' },
      notes: nullableString('Reason for the transfer, or null.'),
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: { stockItemId: { type: 'string' }, quantity: { type: 'number', exclusiveMinimum: 0 } },
          required: ['stockItemId', 'quantity'],
          additionalProperties: false,
        },
      },
    }),
  },
  async draft(args, runtime) {
    const [locations, stockOptions, stockItems] = await Promise.all([
      runtime.locationOptions(),
      runtime.stockItemOptions(),
      runtime.stockItems(),
    ]);
    if (locations.length < 2) return { error: 'A transfer needs two accessible locations; this workspace has one.' };
    const byId = new Map(stockItems.map((item) => [item.id, item]));
    const template: AgentField[] = [field('quantity', 'Quantity', { type: 'number', min: 0.01, max: 100_000, step: 1, value: 1 })];
    const lines = (Array.isArray(args.lines) ? args.lines : [])
      .map((raw) => {
        const row = (raw ?? {}) as JsonObject;
        const item = byId.get(String(row.stockItemId ?? ''));
        if (!item) return null;
        return {
          id: item.id,
          title: item.name,
          subtitle: item.unit,
          fields: [{ ...template[0], value: round(Math.max(toNumber(row.quantity, 1), 0.01), 3) }],
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line));
    if (lines.length === 0) return { error: 'None of those stock item ids matched an active item.' };

    return {
      kind: 'create_stock_transfer',
      title: 'Stock transfer',
      summary: 'Move stock between locations',
      confirmLabel: 'Create transfer',
      note: 'Creates a pending transfer. Stock moves once the receiving site completes it.',
      fields: [
        selectField('fromLocationId', 'From', locations, args.fromLocationId ?? runtime.locationId),
        selectField('toLocationId', 'To', locations, args.toLocationId),
        field('notes', 'Notes', { type: 'textarea', value: optionalText(args.notes), optional: true }),
      ],
      lineGroup: {
        label: 'Items',
        addLabel: 'Add item',
        emptyLabel: 'No items to move yet.',
        options: stockOptions,
        template,
        lines,
        minLines: 1,
        maxLines: 30,
      },
    };
  },
  async execute(action, runtime) {
    const fromLocationId = str(action.fields, 'fromLocationId');
    const toLocationId = str(action.fields, 'toLocationId');
    if (fromLocationId === toLocationId) throw new Error('A transfer needs two different locations. Change one of them and confirm again.');
    await runtime.send('/stock-transfers', 'POST', {
      fromLocationId,
      toLocationId,
      ...(str(action.fields, 'notes') ? { notes: str(action.fields, 'notes') } : {}),
      lines: action.lines.map((line) => ({ stockItemId: line.id, quantity: num(line.values, 'quantity') })),
    });
    const to = await runtime.locationName(toLocationId);
    return {
      message: `Transfer created for ${action.lines.length} item${action.lines.length === 1 ? '' : 's'} to ${to}. It stays pending until the receiving site completes it.`,
      shortcuts: [inventoryShortcut('stock', toLocationId)],
    };
  },
};

// 4 ─ Loss / waste ───────────────────────────────────────────────────────────

const recordStockLoss: ActionDefinition = {
  kind: 'record_stock_loss',
  capability: 'loss:write',
  tool: {
    name: 'draft_stock_loss',
    description:
      'Prepare a stock write-off (waste, spoilage, breakage, theft) for approval. Quantity is a positive number in the item unit.',
    parameters: schema({
      stockItemId: { type: 'string' },
      locationId: { type: 'string' },
      quantity: { type: 'number', exclusiveMinimum: 0 },
      reason: { type: 'string', enum: ['expiry', 'damage', 'theft', 'other'] },
      notes: nullableString('What happened, or null.'),
    }),
  },
  async draft(args, runtime) {
    const [stockOptions, locations] = await Promise.all([runtime.stockItemOptions(), runtime.locationOptions()]);
    const locationId = await runtime.resolveLocationId(args.locationId);
    const reason = ['expiry', 'damage', 'theft', 'other'].includes(String(args.reason)) ? String(args.reason) : 'other';
    return {
      kind: 'record_stock_loss',
      title: 'Stock write-off',
      summary: 'Record stock that will not be sold',
      confirmLabel: 'Log write-off',
      tone: 'critical',
      note: 'Reduces the counted stock at this location and adds a line to the loss log.',
      fields: [
        selectField('stockItemId', 'Item', stockOptions, args.stockItemId),
        selectField('locationId', 'Location', locations, locationId),
        field('quantity', 'Quantity', {
          type: 'number',
          min: 0.01,
          max: 100_000,
          step: 1,
          value: round(Math.max(toNumber(args.quantity, 1), 0.01), 3),
        }),
        field('reason', 'Reason', {
          type: 'select',
          options: choice([
            ['expiry', 'Expired'],
            ['damage', 'Damaged'],
            ['theft', 'Theft'],
            ['other', 'Other'],
          ]),
          value: reason,
        }),
        field('notes', 'Notes', { type: 'textarea', value: optionalText(args.notes), optional: true }),
      ],
    };
  },
  async execute(action, runtime) {
    await runtime.send('/loss-log', 'POST', {
      stockItemId: str(action.fields, 'stockItemId'),
      locationId: str(action.fields, 'locationId'),
      quantity: num(action.fields, 'quantity'),
      reason: str(action.fields, 'reason') || 'other',
      ...(str(action.fields, 'notes') ? { notes: str(action.fields, 'notes') } : {}),
    });
    const item = await optionLabel(runtime.stockItemOptions(), str(action.fields, 'stockItemId'));
    return {
      message: `Logged ${num(action.fields, 'quantity')} × ${item} as a write-off. The location count has been reduced.`,
      shortcuts: [inventoryShortcut('stock', str(action.fields, 'locationId'))],
    };
  },
};

// 5 ─ Order status ───────────────────────────────────────────────────────────

const ORDER_STATUSES: Array<[string, string]> = [
  ['pending', 'Pending'],
  ['preparing', 'Preparing'],
  ['ready', 'Ready'],
  ['done', 'Done'],
  ['cancelled', 'Cancelled'],
];

const updateOrderStatus: ActionDefinition = {
  kind: 'update_order_status',
  capability: 'orders:status',
  tool: {
    name: 'draft_order_status_change',
    description: 'Prepare a change to one order’s status for approval. Cancelling an order also needs a void reason.',
    parameters: schema({
      orderId: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'done', 'cancelled'] },
      voidReason: {
        type: ['string', 'null'],
        description: 'Only for cancellations: customer_request, duplicate, payment_failed, item_unavailable, staff_error or other.',
      },
      notes: nullableString('Short explanation, or null.'),
    }),
  },
  async draft(args, runtime) {
    const orders = await recentOrders(runtime);
    const options = orders.map((order) => ({
      value: order.id,
      label: `#${order.id.slice(0, 8)} · ${gbp(order.totalAmount)}`,
      hint: `${order.status} · ${formatDateTime(order.createdAt)}`,
    }));
    if (options.length === 0) return { error: 'There are no recent orders to change.' };
    return {
      kind: 'update_order_status',
      title: 'Order status',
      summary: 'Move an order to a different state',
      confirmLabel: 'Update order',
      tone: String(args.status) === 'cancelled' ? 'critical' : 'default',
      note: 'Changes the live order state that the till and kitchen screen read.',
      fields: [
        selectField('orderId', 'Order', options, args.orderId),
        field('status', 'New status', {
          type: 'select',
          options: choice(ORDER_STATUSES),
          value: ORDER_STATUSES.some(([value]) => value === args.status) ? String(args.status) : 'done',
        }),
        field('voidReason', 'Void reason', {
          type: 'select',
          options: choice([
            ['customer_request', 'Customer request'],
            ['duplicate', 'Duplicate'],
            ['payment_failed', 'Payment failed'],
            ['item_unavailable', 'Item unavailable'],
            ['staff_error', 'Staff error'],
            ['other', 'Other'],
          ]),
          value: typeof args.voidReason === 'string' ? args.voidReason : 'customer_request',
          optional: true,
          showWhen: { field: 'status', equals: 'cancelled' },
        }),
        field('notes', 'Notes', {
          type: 'text',
          value: optionalText(args.notes, 200),
          optional: true,
          showWhen: { field: 'status', equals: 'cancelled' },
        }),
      ],
    };
  },
  async execute(action, runtime) {
    const orderId = str(action.fields, 'orderId');
    const status = str(action.fields, 'status');
    const cancelling = status === 'cancelled';
    await runtime.send(`/orders/${orderId}/status`, 'PATCH', {
      status,
      ...(cancelling
        ? {
            voidReason: str(action.fields, 'voidReason') || 'other',
            ...(str(action.fields, 'notes') ? { voidNotes: str(action.fields, 'notes') } : {}),
          }
        : {}),
    });
    return {
      message: `Order #${orderId.slice(0, 8)} is now **${status}**.`,
      shortcuts: [{ label: 'Open orders', href: '/orders', description: 'Orders', kind: 'page' }],
    };
  },
};

// 6 ─ Loyalty points ─────────────────────────────────────────────────────────

const adjustCustomerPoints: ActionDefinition = {
  kind: 'adjust_customer_points',
  capability: 'customers:points',
  tool: {
    name: 'draft_points_adjustment',
    description:
      'Prepare a loyalty points adjustment for approval. Use a negative delta to deduct points. Find the customer with search_customers first.',
    parameters: schema({
      customerId: { type: 'string' },
      delta: { type: 'number', description: 'Points to add; negative to remove.' },
      reason: nullableString('Why the balance is changing, or null.'),
    }),
  },
  async draft(args, runtime) {
    const customers = await runtime.get<CustomersResponse>('/customers?limit=100');
    const options = (customers.data ?? []).map((customer) => ({
      value: customer.id,
      label: `${customer.firstName} ${customer.lastName}`.trim() || customer.phone,
      hint: `${customer.pointsBalance} pts · ${customer.phone}`,
    }));
    if (options.length === 0) return { error: 'There are no customers in this workspace yet.' };
    return {
      kind: 'adjust_customer_points',
      title: 'Loyalty adjustment',
      summary: 'Change a customer’s points balance',
      confirmLabel: 'Apply adjustment',
      note: 'Writes a points movement against the customer record.',
      fields: [
        selectField('customerId', 'Customer', options, args.customerId),
        field('delta', 'Points', {
          type: 'number',
          min: -100_000,
          max: 100_000,
          step: 5,
          value: round(toNumber(args.delta), 0),
          unit: 'pts',
          hint: 'Negative removes points',
        }),
        field('reason', 'Reason', {
          type: 'text',
          value: optionalText(args.reason, 200),
          optional: true,
          placeholder: 'Goodwill, correction…',
        }),
      ],
    };
  },
  async execute(action, runtime) {
    const delta = Math.round(num(action.fields, 'delta'));
    if (delta === 0) throw new Error('A points adjustment of zero would change nothing. Set a value and confirm again.');
    const customerId = str(action.fields, 'customerId');
    const customer = await runtime.send<Customer>(`/customers/${customerId}/points`, 'PATCH', {
      delta,
      ...(str(action.fields, 'reason') ? { reason: str(action.fields, 'reason') } : {}),
    });
    return {
      message: `${delta >= 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} points. ${customer.firstName} ${customer.lastName} now has **${customer.pointsBalance} points**.`,
      shortcuts: [{ label: 'Open customer', href: `/customers/${customerId}`, description: 'Customer record', kind: 'page' }],
    };
  },
};

// 7 ─ Menu item ──────────────────────────────────────────────────────────────

const updateMenuItem: ActionDefinition = {
  kind: 'update_menu_item',
  capability: 'menu:write',
  tool: {
    name: 'draft_menu_item_update',
    description: 'Prepare a menu item price or availability change for approval. Price is brand-wide — there is no per-location pricing.',
    parameters: schema({
      menuItemId: { type: 'string' },
      price: { type: ['number', 'null'], description: 'New price in GBP, or null to keep the current one.' },
      isAvailable: { type: ['boolean', 'null'], description: 'New availability, or null to keep it.' },
    }),
  },
  async draft(args, runtime) {
    const items = await runtime.menuItems();
    const options = items.map((item) => ({
      value: item.id,
      label: item.name,
      hint: `${gbp(item.price)} · ${item.isAvailable ? 'available' : 'hidden'}`,
      prefill: { price: toNumber(item.price) },
    }));
    if (options.length === 0) return { error: 'This workspace has no menu items yet.' };
    const selected = items.find((item) => item.id === args.menuItemId);
    const available = typeof args.isAvailable === 'boolean' ? args.isAvailable : (selected?.isAvailable ?? true);
    return {
      kind: 'update_menu_item',
      title: 'Menu change',
      summary: 'Update a menu item’s price or availability',
      confirmLabel: 'Save change',
      note: 'Applies immediately to the till, the kitchen screen and any live menu.',
      fields: [
        selectField('menuItemId', 'Item', options, args.menuItemId),
        field('price', 'Price', {
          type: 'money',
          min: 0,
          max: 1_000,
          step: 0.05,
          value: round(args.price == null ? toNumber(selected?.price) : toNumber(args.price), 2),
        }),
        field('isAvailable', 'Availability', {
          type: 'select',
          options: choice([
            ['true', 'Available'],
            ['false', 'Hidden'],
          ]),
          value: available ? 'true' : 'false',
        }),
      ],
    };
  },
  async execute(action, runtime) {
    const menuItemId = str(action.fields, 'menuItemId');
    const updated = await runtime.send<MenuItem>(`/menu-items/${menuItemId}`, 'PATCH', {
      price: num(action.fields, 'price').toFixed(2),
      isAvailable: str(action.fields, 'isAvailable') !== 'false',
    });
    return {
      message: `${updated.name} is now ${gbp(updated.price)} and ${updated.isAvailable ? 'available' : 'hidden'}.`,
      shortcuts: [{ label: 'Open menu', href: '/menu', description: 'Menu', kind: 'page' }],
    };
  },
};

// 8 ─ Scheduled shift ────────────────────────────────────────────────────────

function timeOptions(): AgentFieldOption[] {
  const options: AgentFieldOption[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    options.push({ value, label: value });
  }
  return options;
}

const scheduleShift: ActionDefinition = {
  kind: 'schedule_shift',
  capability: 'scheduling:write',
  tool: {
    name: 'draft_scheduled_shift',
    description:
      'Prepare a rota shift for approval. Times are local to the location; an end time at or before the start rolls into the next day.',
    parameters: schema({
      locationId: { type: 'string' },
      userId: nullableString('Staff user id, or null to leave the shift open.'),
      date: { type: 'string', description: 'YYYY-MM-DD' },
      startTime: { type: 'string', description: 'HH:MM, 24 hour' },
      endTime: { type: 'string', description: 'HH:MM, 24 hour' },
      role: nullableString('Role label such as barista, or null.'),
      notes: nullableString('Optional note, or null.'),
    }),
  },
  async draft(args, runtime) {
    const [locations, staff] = await Promise.all([runtime.locationOptions(), runtime.staffOptions()]);
    const locationId = await runtime.resolveLocationId(args.locationId);
    const times = timeOptions();
    const validTime = (value: unknown, fallback: string) => (/^\d{2}:\d{2}$/.test(String(value)) ? String(value) : fallback);
    return {
      kind: 'schedule_shift',
      title: 'Rota shift',
      summary: 'Add a shift to the schedule',
      confirmLabel: 'Add to rota',
      note: 'Adds a draft shift. Staff only see it once the rota is published.',
      fields: [
        selectField('locationId', 'Location', locations, locationId),
        selectField('userId', 'Staff', [{ value: '', label: 'Open shift (unassigned)' }, ...staff], args.userId, { optional: true }),
        field('date', 'Date', { type: 'date', value: isIsoDate(args.date) ? args.date : '' }),
        field('startTime', 'Starts', { type: 'select', options: times, value: validTime(args.startTime, '08:00') }),
        field('endTime', 'Ends', { type: 'select', options: times, value: validTime(args.endTime, '16:00') }),
        field('role', 'Role', { type: 'text', value: optionalText(args.role, 60), optional: true, placeholder: 'Barista, supervisor…' }),
        field('notes', 'Notes', { type: 'text', value: optionalText(args.notes, 200), optional: true }),
      ],
    };
  },
  async execute(action, runtime) {
    const locationId = str(action.fields, 'locationId');
    const date = str(action.fields, 'date');
    if (!isIsoDate(date)) throw new Error('Choose a real date for the shift and confirm again.');
    const timeZone = await runtime.timezone(locationId);
    const startsAt = zonedIso(date, str(action.fields, 'startTime'), timeZone);
    let endsAt = zonedIso(date, str(action.fields, 'endTime'), timeZone);
    if (!startsAt || !endsAt) throw new Error('Those shift times could not be read. Adjust them and confirm again.');
    // An end at or before the start is an overnight shift, the same rule the rota editor uses.
    if (Date.parse(endsAt) <= Date.parse(startsAt)) endsAt = new Date(Date.parse(endsAt) + 24 * 60 * 60 * 1_000).toISOString();

    await runtime.send('/scheduled-shifts', 'POST', {
      locationId,
      userId: str(action.fields, 'userId') || null,
      startsAt,
      endsAt,
      status: 'draft',
      ...(str(action.fields, 'role') ? { role: str(action.fields, 'role') } : {}),
      ...(str(action.fields, 'notes') ? { notes: str(action.fields, 'notes') } : {}),
    });
    const staffLabel = await optionLabel(runtime.staffOptions(), str(action.fields, 'userId'));
    return {
      message: `Draft shift added for ${staffLabel || 'an open slot'} on ${date}, ${str(action.fields, 'startTime')}–${str(action.fields, 'endTime')}. Publish the rota to make it visible to staff.`,
      shortcuts: [
        { label: 'Open the rota', href: '/staff/rota', description: 'Switches the active location', locationId, kind: 'filtered' },
      ],
    };
  },
};

// 9 ─ Leave decision ─────────────────────────────────────────────────────────

const reviewLeaveRequest: ActionDefinition = {
  kind: 'review_leave_request',
  capability: 'hr.leave:review',
  tool: {
    name: 'draft_leave_decision',
    description: 'Prepare an approve or decline decision on a pending leave request. Read list_leave_requests first to get the id.',
    parameters: schema({
      requestId: { type: 'string' },
      decision: { type: 'string', enum: ['approved', 'declined'] },
      reviewNotes: nullableString('Note for the employee, or null.'),
    }),
  },
  async draft(args, runtime) {
    const requests = await runtime.get<LeaveRequest[]>('/hr/leave-requests?status=pending');
    const options = requests.map((request) => ({
      value: request.id,
      label: `${request.employee?.name ?? 'Employee'} · ${request.leaveType?.name ?? 'Leave'}`,
      hint: `${request.startDate} → ${request.endDate} · ${request.totalDays} days`,
    }));
    if (options.length === 0) return { error: 'There are no pending leave requests to review.' };
    return {
      kind: 'review_leave_request',
      title: 'Leave decision',
      summary: 'Approve or decline a leave request',
      confirmLabel: 'Record decision',
      note: 'Notifies the employee and updates their entitlement.',
      fields: [
        selectField('requestId', 'Request', options, args.requestId),
        field('decision', 'Decision', {
          type: 'select',
          options: choice([
            ['approved', 'Approve'],
            ['declined', 'Decline'],
          ]),
          value: args.decision === 'declined' ? 'declined' : 'approved',
        }),
        field('reviewNotes', 'Note', { type: 'text', value: optionalText(args.reviewNotes, 300), optional: true }),
      ],
    };
  },
  async execute(action, runtime) {
    const decision = str(action.fields, 'decision') === 'declined' ? 'declined' : 'approved';
    await runtime.send(`/hr/leave-requests/${str(action.fields, 'requestId')}/review`, 'PATCH', {
      status: decision,
      ...(str(action.fields, 'reviewNotes') ? { reviewNotes: str(action.fields, 'reviewNotes') } : {}),
    });
    return {
      message: `Leave request ${decision}. The employee can see the decision on their HR page.`,
      shortcuts: [{ label: 'Open leave requests', href: '/staff/requests', description: 'Team · Requests', kind: 'page' }],
    };
  },
};

// 10 ─ Stock thresholds ──────────────────────────────────────────────────────

const updateStockThresholds: ActionDefinition = {
  kind: 'update_stock_thresholds',
  capability: 'stock.locations:write',
  tool: {
    name: 'draft_stock_threshold_update',
    description:
      'Prepare a change to a location’s low-stock threshold or reorder quantity. Use get_inventory_status to find the locationStockId.',
    parameters: schema({
      locationStockId: { type: 'string' },
      lowThreshold: { type: 'number', minimum: 0 },
      reorderQuantity: { type: ['number', 'null'] },
    }),
  },
  async draft(args, runtime) {
    const locationId = await runtime.resolveLocationId(null);
    if (!locationId) return { error: 'Pick a location first — thresholds are set per location.' };
    const rows = await runtime.get<LocationStock[]>(`/location-stock/location/${locationId}`);
    const options = rows.map((row) => ({
      value: row.id,
      label: row.stockItem?.name ?? row.stockItemId,
      hint: `${toNumber(row.quantity)} ${row.stockItem?.unit ?? ''} in stock · alerts under ${toNumber(row.lowThreshold)}`,
      prefill: { lowThreshold: toNumber(row.lowThreshold), reorderQuantity: toNumber(row.reorderQuantity) },
    }));
    if (options.length === 0) return { error: 'This location has no tracked stock rows yet.' };
    const current = rows.find((row) => row.id === args.locationStockId);
    return {
      kind: 'update_stock_thresholds',
      title: 'Stock thresholds',
      summary: 'Change when this item triggers a low-stock alert',
      confirmLabel: 'Save thresholds',
      note: 'Only changes alerting — no stock moves.',
      fields: [
        selectField('locationStockId', 'Item', options, args.locationStockId),
        field('lowThreshold', 'Alert under', {
          type: 'number',
          min: 0,
          max: 100_000,
          step: 1,
          value: round(args.lowThreshold == null ? toNumber(current?.lowThreshold) : toNumber(args.lowThreshold), 3),
        }),
        field('reorderQuantity', 'Reorder quantity', {
          type: 'number',
          min: 0,
          max: 100_000,
          step: 1,
          value: round(args.reorderQuantity == null ? toNumber(current?.reorderQuantity) : toNumber(args.reorderQuantity), 3),
          optional: true,
        }),
      ],
    };
  },
  async execute(action, runtime) {
    const reorder = num(action.fields, 'reorderQuantity');
    await runtime.send(`/location-stock/${str(action.fields, 'locationStockId')}`, 'PATCH', {
      lowThreshold: String(num(action.fields, 'lowThreshold')),
      reorderQuantity: reorder > 0 ? String(reorder) : null,
    });
    return {
      message: `Thresholds saved. The item now raises a low-stock alert under ${num(action.fields, 'lowThreshold')}.`,
      shortcuts: [inventoryShortcut('stock', runtime.locationId ?? undefined)],
    };
  },
};

// ── Self-service: what an employee may do about their own record ─────────────
//
// These carry no capability. They write only to the signed-in operator's own
// record through the `/me` and `/my` endpoints, which the API scopes to the
// caller — so the authorisation is the session, not a grant. Every one of them
// mirrors something the My HR page offers, so chat and page stay in step.

const requestLeave: ActionDefinition = {
  kind: 'request_leave',
  tool: {
    name: 'draft_leave_request',
    description:
      'Prepare a time-off request for the signed-in operator themselves. Use for "book me off", "request holiday", "I need Friday off". To approve or decline somebody else’s request, use draft_leave_decision instead.',
    parameters: schema({
      leaveTypeId: nullableString('Leave type id, or null to pick the only one or let the operator choose.'),
      startDate: nullableString(`First day off. Inclusive YYYY-MM-DD calendar date.Null to let the operator fill it in.`),
      endDate: nullableString(`Last day off, inclusive. Inclusive YYYY-MM-DD calendar date.Null to use the first day.`),
      partialDay: { type: ['string', 'null'], enum: ['none', 'start', 'end', null], description: 'Half day on the first or last day.' },
      notes: nullableString('Note for the approving manager, or null.'),
    }),
  },
  async draft(args, runtime) {
    const types = await runtime.get<LeaveType[]>('/hr/leave-types');
    if (types.length === 0) return { error: 'No leave types are configured, so there is nothing to book against. HR sets these up.' };

    const entitlements = await runtime.get<LeaveEntitlement[]>(`/hr/entitlements/me?year=${new Date().getFullYear()}`).catch(() => []);
    const remaining = new Map(
      entitlements.map((item) => [item.leaveType.id, round(toNumber(item.totalDays) - toNumber(item.usedDays), 2)] as const),
    );
    const options = types.map((type) => {
      const left = remaining.get(type.id);
      return {
        value: type.id,
        label: type.isPaid ? type.name : `${type.name} (unpaid)`,
        hint: left === undefined ? 'No allowance recorded' : `${left} days left`,
      };
    });

    const start = isIsoDate(args.startDate) ? String(args.startDate) : '';
    const requested = typeof args.leaveTypeId === 'string' ? args.leaveTypeId : '';
    return {
      kind: 'request_leave',
      title: 'Time off request',
      summary: 'Book time away for approval',
      confirmLabel: 'Submit request',
      note: 'Goes to your manager to approve. Nothing is booked until they do.',
      fields: [
        // One configured type is not a choice, so it arrives already made.
        selectField('leaveTypeId', 'Type of leave', options, requested || (types.length === 1 ? types[0].id : '')),
        field('startDate', 'First day', { type: 'date', value: start }),
        field('endDate', 'Last day', { type: 'date', value: isIsoDate(args.endDate) ? String(args.endDate) : start }),
        field('partialDay', 'Day length', {
          type: 'select',
          options: choice([
            ['none', 'Full days'],
            ['start', 'Half day on the first day'],
            ['end', 'Half day on the last day'],
          ]),
          value: args.partialDay === 'start' || args.partialDay === 'end' ? String(args.partialDay) : 'none',
        }),
        field('notes', 'Note for your manager', { type: 'text', value: optionalText(args.notes, 300), optional: true }),
      ],
    };
  },
  async execute(action, runtime) {
    const startDate = str(action.fields, 'startDate');
    const endDate = str(action.fields, 'endDate') || startDate;
    if (!startDate) return { message: 'No start date was given, so nothing was submitted.' };
    if (endDate < startDate) return { message: 'The last day is before the first day, so nothing was submitted.' };

    await runtime.send('/hr/leave-requests', 'POST', {
      leaveTypeId: str(action.fields, 'leaveTypeId'),
      startDate,
      endDate,
      partialDay: str(action.fields, 'partialDay') || 'none',
      ...(str(action.fields, 'notes') ? { notes: str(action.fields, 'notes') } : {}),
    });
    return {
      message: `Time off requested for ${startDate} to ${endDate}. Your manager reviews it, and the outcome appears under Time off.`,
      shortcuts: [{ label: 'Open your time off', href: '/my-hr?tab=time-off', description: 'My HR · Time off', kind: 'page' }],
    };
  },
};

const cancelLeaveRequest: ActionDefinition = {
  kind: 'cancel_leave_request',
  tool: {
    name: 'draft_leave_cancellation',
    description:
      'Prepare the cancellation of one of the signed-in operator’s own pending time-off requests. Use for "cancel my holiday", "I no longer need Friday off".',
    parameters: schema({ requestId: nullableString('Id of the request to cancel, or null to choose from the pending list.') }),
  },
  async draft(args, runtime) {
    const requests = await runtime.get<LeaveRequest[]>('/hr/leave-requests/my');
    const pending = requests.filter((request) => request.status === 'pending');
    if (pending.length === 0)
      return { error: 'You have no pending time-off requests to cancel. Approved leave has to be cancelled by HR.' };

    return {
      kind: 'cancel_leave_request',
      title: 'Cancel time off',
      summary: 'Withdraw a request you have not had a decision on yet',
      confirmLabel: 'Cancel request',
      note: 'Only pending requests can be withdrawn here.',
      fields: [
        selectField(
          'requestId',
          'Request',
          pending.map((request) => ({
            value: request.id,
            label: request.leaveType?.name ?? 'Leave',
            hint: `${request.startDate} → ${request.endDate} · ${request.totalDays} days`,
          })),
          args.requestId,
        ),
      ],
    };
  },
  async execute(action, runtime) {
    await runtime.send(`/hr/leave-requests/${str(action.fields, 'requestId')}/cancel`, 'PATCH');
    return {
      message: 'Time-off request withdrawn. Any days it held are back in your allowance.',
      shortcuts: [{ label: 'Open your time off', href: '/my-hr?tab=time-off', description: 'My HR · Time off', kind: 'page' }],
    };
  },
};




const raiseHrRequest: ActionDefinition = {
  kind: 'raise_hr_request',
  tool: {
    name: 'draft_hr_request',
    description:
      'Prepare a request from the signed-in operator to HR — a question, a document request, an attendance correction, or a request for a copy of their own data. Use for "ask HR about…", "I need a copy of my contract", "my hours are wrong on the 3rd", "request my data".',
    parameters: schema({
      subject: nullableString('One-line summary of the request.'),
      category: {
        type: ['string', 'null'],
        enum: ['hr', 'payroll', 'scheduling', 'leave', 'workplace', 'it', 'other', null],
        description: 'Which team should pick it up.',
      },
      priority: { type: ['string', 'null'], enum: ['low', 'normal', 'high', 'urgent', null] },
      message: nullableString('The detail HR needs to act on it.'),
    }),
  },
  async draft(args) {
    const category = typeof args.category === 'string' ? args.category : 'hr';
    return {
      kind: 'raise_hr_request',
      title: 'Request to HR',
      summary: 'Send a question or request to your HR team',
      confirmLabel: 'Send to HR',
      note: 'HR replies in Requests, and you are notified.',
      fields: [
        field('subject', 'Subject', { type: 'text', value: optionalText(args.subject, 150) }),
        field('category', 'About', {
          type: 'select',
          options: choice([
            ['hr', 'HR — contract, records, policy'],
            ['payroll', 'Payroll — pay, payslips, tax'],
            ['scheduling', 'Scheduling — rota, hours, attendance'],
            ['leave', 'Leave — holiday and absence'],
            ['workplace', 'Workplace — equipment, safety, site'],
            ['it', 'IT — accounts and devices'],
            ['other', 'Something else'],
          ]),
          value: ['hr', 'payroll', 'scheduling', 'leave', 'workplace', 'it', 'other'].includes(category) ? category : 'hr',
        }),
        field('priority', 'Urgency', {
          type: 'select',
          options: choice([
            ['low', 'Low'],
            ['normal', 'Normal'],
            ['high', 'High'],
            ['urgent', 'Urgent'],
          ]),
          value: ['low', 'high', 'urgent'].includes(String(args.priority)) ? String(args.priority) : 'normal',
        }),
        field('message', 'Details', { type: 'textarea', value: optionalText(args.message, 4000) }),
      ],
    };
  },
  async execute(action, runtime) {
    const subject = str(action.fields, 'subject');
    const message = str(action.fields, 'message');
    if (subject.length < 3) return { message: 'The request needs a subject, so nothing was sent.' };
    if (!message) return { message: 'The request needs some detail for HR to act on, so nothing was sent.' };

    await runtime.send('/helpdesk', 'POST', {
      subject,
      category: str(action.fields, 'category') || 'hr',
      priority: str(action.fields, 'priority') || 'normal',
      message,
    });
    return {
      message: 'Sent to HR. Their reply appears under Requests.',
      shortcuts: [{ label: 'Open your requests', href: '/my-hr?tab=requests', description: 'My HR · Requests', kind: 'page' }],
    };
  },
};

const updateMyDetails: ActionDefinition = {
  kind: 'update_my_details',
  tool: {
    name: 'draft_my_details_update',
    description:
      'Prepare a change to the signed-in operator’s own personal record: home address, emergency contact, bank details or National Insurance number. Use for "I moved house", "change my emergency contact", "update my bank details", "add my NI number". Never use this for anybody else’s record.',
    parameters: schema({
      address: nullableString('Full home address, or null to leave unchanged.'),
      emergencyContactName: nullableString('Emergency contact name, or null.'),
      emergencyContactRelation: nullableString('Their relationship to the operator, or null.'),
      emergencyContactPhone: nullableString('Emergency contact phone, or null.'),
      nationalInsuranceNumber: nullableString('National Insurance number, or null.'),
    }),
  },
  async draft(args, runtime) {
    const employee = await runtime.get<HrEmployee>('/hr/employees/me');
    const text = (value: unknown, current: string | null | undefined) =>
      typeof value === 'string' && value.trim() ? value.trim() : (current ?? '');

    return {
      kind: 'update_my_details',
      title: 'Your details',
      summary: 'Update the record HR holds about you',
      confirmLabel: 'Save details',
      // Bank details are deliberately absent: they are never returned to the
      // employee, so a form could not show what it was about to replace, and a
      // half-remembered account number is how wages go missing.
      note: 'Bank details are not editable here — open My HR to change those.',
      fields: [
        field('address', 'Home address', { type: 'text', value: text(args.address, employee.address), optional: true }),
        field('emergencyContactName', 'Emergency contact', {
          type: 'text',
          value: text(args.emergencyContactName, employee.emergencyContactName),
          optional: true,
        }),
        field('emergencyContactRelation', 'Their relationship to you', {
          type: 'text',
          value: text(args.emergencyContactRelation, employee.emergencyContactRelation),
          optional: true,
        }),
        field('emergencyContactPhone', 'Emergency phone', {
          type: 'text',
          value: text(args.emergencyContactPhone, employee.emergencyContactPhone),
          optional: true,
        }),
        field('nationalInsuranceNumber', 'National Insurance number', {
          type: 'text',
          value: typeof args.nationalInsuranceNumber === 'string' ? normaliseNiNumber(args.nationalInsuranceNumber) : '',
          optional: true,
          hint: employee.hasNiNumber ? 'One is already held — only enter one to correct it.' : 'Two letters, six digits, then A–D.',
        }),
      ],
    };
  },
  async execute(action, runtime) {
    const ni = normaliseNiNumber(str(action.fields, 'nationalInsuranceNumber'));
    if (ni && !isValidNiNumber(ni)) {
      return {
        message: `“${ni}” is not a valid National Insurance number, so nothing was saved. It is two letters, six digits, then A–D.`,
      };
    }

    const updated = await runtime.send<HrEmployee>('/hr/employees/me', 'PATCH', {
      address: str(action.fields, 'address'),
      emergencyContactName: str(action.fields, 'emergencyContactName'),
      emergencyContactRelation: str(action.fields, 'emergencyContactRelation'),
      emergencyContactPhone: str(action.fields, 'emergencyContactPhone'),
      // Both spellings — the documented one and the one every working call site
      // in this app uses. See UpdateMyEmployeePayload.
      ...(ni ? { nationalInsuranceNumber: ni, niNumber: ni } : {}),
    });

    // The endpoint answers 200 for fields it ignored, so the saved record is
    // checked rather than trusted.
    if (ni && updated?.hasNiNumber === false) {
      return {
        message: 'Your other details were saved, but the server did not accept the National Insurance number. Raise it with HR.',
        shortcuts: [{ label: 'Open My HR', href: '/my-hr', description: 'My HR · Overview', kind: 'page' }],
      };
    }
    return {
      message: 'Your details are updated.',
      shortcuts: [{ label: 'Open My HR', href: '/my-hr', description: 'My HR · Overview', kind: 'page' }],
    };
  },
};

const toggleOptions = choice([
  ['on', 'On'],
  ['off', 'Off'],
]);

function toggleValue(requested: unknown, current: boolean) {
  return typeof requested === 'boolean' ? (requested ? 'on' : 'off') : current ? 'on' : 'off';
}

const updateQrOrderingSettings: ActionDefinition = {
  kind: 'update_qr_ordering_settings',
  capability: 'qr-ordering:write',
  tool: {
    name: 'draft_qr_ordering_settings',
    description:
      'Prepare QR ordering settings for approval: enable, disable, pause or resume; card and cash acceptance; minimum order; collection timing and capacity; welcome copy, collection instructions and cover image. Read get_qr_ordering_status first. Null means keep the current value.',
    parameters: schema({
      locationId: nullableString('Location id, or null for the active location.'),
      isEnabled: { type: ['boolean', 'null'] },
      isPaused: { type: ['boolean', 'null'] },
      cardEnabled: { type: ['boolean', 'null'] },
      cashEnabled: { type: ['boolean', 'null'] },
      minimumOrderAmount: { type: ['number', 'null'] },
      minimumNoticeMinutes: { type: ['number', 'null'] },
      slotIntervalMinutes: { type: ['number', 'null'] },
      maxOrdersPerSlot: { type: ['number', 'null'] },
      bookingHorizonDays: { type: ['number', 'null'] },
      welcomeMessage: nullableString('New welcome message, or null to keep it.'),
      collectionInstructions: nullableString('New collection instructions, or null to keep them.'),
      coverImageUrl: nullableString('New HTTPS cover image URL, an empty string to remove it, or null to keep it.'),
    }),
  },
  async draft(args, runtime) {
    const locationId = await runtime.resolveLocationId(args.locationId);
    if (!locationId) return { error: 'Choose a location before changing QR ordering.' };
    const [locations, current] = await Promise.all([
      runtime.locationOptions(),
      runtime.get<QrOrderingConfig | null>(`/qr-ordering/locations/${locationId}`),
    ]);
    const content = current?.draftContent ?? {
      schemaVersion: 1 as const,
      welcomeMessage: '',
      collectionInstructions: '',
      coverImageUrl: null,
      featuredItemIds: [],
      categoryOrder: [],
    };
    const requestedText = (value: unknown, fallback: string) => (typeof value === 'string' ? value.trim() : fallback);
    const requestedNumber = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

    return {
      kind: 'update_qr_ordering_settings',
      title: 'QR ordering settings',
      summary: `Review the customer ordering channel for ${await runtime.locationName(locationId)}`,
      confirmLabel: 'Save QR settings',
      note: 'Operational switches take effect when saved. Page content remains a draft until you publish it.',
      fields: [
        selectField('locationId', 'Location', locations, locationId, { readOnly: true }),
        field('isEnabled', 'QR ordering', {
          type: 'select',
          options: toggleOptions,
          value: toggleValue(args.isEnabled, current?.isEnabled ?? false),
        }),
        field('isPaused', 'Pause new orders', {
          type: 'select',
          options: toggleOptions,
          value: toggleValue(args.isPaused, current?.isPaused ?? false),
        }),
        field('cardEnabled', 'Stripe card', {
          type: 'select',
          options: toggleOptions,
          value: toggleValue(args.cardEnabled, current?.cardEnabled ?? true),
        }),
        field('cashEnabled', 'Cash at counter', {
          type: 'select',
          options: toggleOptions,
          value: toggleValue(args.cashEnabled, current?.cashEnabled ?? false),
        }),
        field('minimumOrderAmount', 'Minimum order', {
          type: 'money',
          min: 0,
          max: 10_000,
          step: 0.01,
          value: round(requestedNumber(args.minimumOrderAmount, toNumber(current?.minimumOrderAmount)), 2),
        }),
        field('minimumNoticeMinutes', 'Minimum notice', {
          type: 'number',
          min: 0,
          max: 1_440,
          step: 1,
          unit: 'min',
          value: Math.round(requestedNumber(args.minimumNoticeMinutes, current?.minimumNoticeMinutes ?? 20)),
        }),
        field('slotIntervalMinutes', 'Slot interval', {
          type: 'number',
          min: 5,
          max: 120,
          step: 5,
          unit: 'min',
          value: Math.round(requestedNumber(args.slotIntervalMinutes, current?.slotIntervalMinutes ?? 15)),
        }),
        field('maxOrdersPerSlot', 'Orders per slot', {
          type: 'number',
          min: 1,
          max: 100,
          step: 1,
          value: Math.round(requestedNumber(args.maxOrdersPerSlot, current?.maxOrdersPerSlot ?? 5)),
        }),
        field('bookingHorizonDays', 'Booking horizon', {
          type: 'number',
          min: 1,
          max: 30,
          step: 1,
          unit: 'days',
          value: Math.round(requestedNumber(args.bookingHorizonDays, current?.bookingHorizonDays ?? 7)),
        }),
        field('welcomeMessage', 'Welcome message', {
          type: 'text',
          value: requestedText(args.welcomeMessage, content.welcomeMessage),
          optional: true,
        }),
        field('collectionInstructions', 'Collection instructions', {
          type: 'textarea',
          value: requestedText(args.collectionInstructions, content.collectionInstructions),
          optional: true,
        }),
        field('coverImageUrl', 'Cover image URL', {
          type: 'text',
          value: requestedText(args.coverImageUrl, content.coverImageUrl ?? ''),
          optional: true,
        }),
      ],
    };
  },
  async execute(action, runtime) {
    const locationId = str(action.fields, 'locationId');
    const current = await runtime.get<QrOrderingConfig | null>(`/qr-ordering/locations/${locationId}`);
    const cardEnabled = str(action.fields, 'cardEnabled') === 'on';
    const cashEnabled = str(action.fields, 'cashEnabled') === 'on';
    if (!cardEnabled && !cashEnabled) return { message: 'At least one payment method must remain enabled, so nothing was changed.' };
    const currentContent = current?.draftContent ?? {
      schemaVersion: 1 as const,
      welcomeMessage: '',
      collectionInstructions: '',
      coverImageUrl: null,
      featuredItemIds: [],
      categoryOrder: [],
    };
    const saved = await runtime.send<QrOrderingConfig>(`/qr-ordering/locations/${locationId}`, 'PUT', {
      isEnabled: str(action.fields, 'isEnabled') === 'on',
      isPaused: str(action.fields, 'isPaused') === 'on',
      cardEnabled,
      cashEnabled,
      minimumOrderAmount: num(action.fields, 'minimumOrderAmount'),
      minimumNoticeMinutes: Math.round(num(action.fields, 'minimumNoticeMinutes')),
      slotIntervalMinutes: Math.round(num(action.fields, 'slotIntervalMinutes')),
      maxOrdersPerSlot: Math.round(num(action.fields, 'maxOrdersPerSlot')),
      bookingHorizonDays: Math.round(num(action.fields, 'bookingHorizonDays')),
      content: {
        ...currentContent,
        welcomeMessage: str(action.fields, 'welcomeMessage').slice(0, 160),
        collectionInstructions: str(action.fields, 'collectionInstructions').slice(0, 500),
        coverImageUrl: str(action.fields, 'coverImageUrl') || null,
      },
    });
    const state = !saved.isEnabled ? 'disabled' : saved.isPaused ? 'paused' : 'enabled';
    return {
      message: `QR ordering is now ${state}. Operational settings are live; publish the QR menu if you also changed its customer-facing content.`,
      shortcuts: [
        { label: 'Open QR ordering settings', href: '/settings/qr-ordering', description: 'Settings · QR ordering', kind: 'page' },
      ],
    };
  },
};

const publishQrOrdering: ActionDefinition = {
  kind: 'publish_qr_ordering',
  capability: 'qr-ordering:write',
  tool: {
    name: 'draft_publish_qr_menu',
    description: 'Prepare publishing the saved QR menu draft for approval. Publishing updates customer-facing content and menu visibility.',
    parameters: schema({ locationId: nullableString('Location id, or null for the active location.') }),
  },
  async draft(args, runtime) {
    const locationId = await runtime.resolveLocationId(args.locationId);
    if (!locationId) return { error: 'Choose a location before publishing the QR menu.' };
    const config = await runtime.get<QrOrderingConfig | null>(`/qr-ordering/locations/${locationId}`);
    if (!config) return { error: 'Set up and save QR ordering before publishing it.' };
    return {
      kind: 'publish_qr_ordering',
      title: 'Publish QR menu',
      summary: `Make the saved draft live for ${await runtime.locationName(locationId)}`,
      confirmLabel: 'Publish QR menu',
      note: 'Customers will see the current draft content and item visibility immediately after publishing.',
      fields: [selectField('locationId', 'Location', await runtime.locationOptions(), locationId, { readOnly: true })],
    };
  },
  async execute(action, runtime) {
    const locationId = str(action.fields, 'locationId');
    await runtime.send(`/qr-ordering/locations/${locationId}/publish`, 'POST');
    return {
      message: 'The QR menu is published. Customers now see the saved content and menu visibility.',
      shortcuts: [
        { label: 'Open QR ordering settings', href: '/settings/qr-ordering', description: 'Settings · QR ordering', kind: 'page' },
      ],
    };
  },
};

const updateQrItemVisibility: ActionDefinition = {
  kind: 'update_qr_item_visibility',
  capability: 'qr-ordering:write',
  tool: {
    name: 'draft_qr_item_visibility',
    description:
      'Prepare showing or hiding specific menu items on the QR channel. Resolve exact menu item ids with list_menu_items first. This changes the draft; publish afterwards to make it customer-visible.',
    parameters: schema({
      locationId: nullableString('Location id, or null for the active location.'),
      changes: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: { menuItemId: { type: 'string' }, visible: { type: 'boolean' } },
          required: ['menuItemId', 'visible'],
          additionalProperties: false,
        },
      },
    }),
  },
  async draft(args, runtime) {
    const locationId = await runtime.resolveLocationId(args.locationId);
    if (!locationId) return { error: 'Choose a location before changing the QR menu.' };
    const items = await runtime.menuItems();
    const byId = new Map(items.map((item) => [item.id, item]));
    const requested = Array.isArray(args.changes) ? args.changes : [];
    const lines = requested
      .map((raw) => {
        const change = (raw ?? {}) as JsonObject;
        const item = byId.get(String(change.menuItemId ?? ''));
        if (!item || typeof change.visible !== 'boolean') return null;
        return {
          id: item.id,
          title: item.name,
          subtitle: `£${toNumber(item.price).toFixed(2)}`,
          fields: [
            field('visibility', 'QR menu', {
              type: 'select',
              options: choice([
                ['show', 'Show'],
                ['hide', 'Hide'],
              ]),
              value: change.visible ? 'show' : 'hide',
            }),
          ],
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line));
    if (!lines.length) return { error: 'None of those menu item ids matched. Call list_menu_items first.' };
    return {
      kind: 'update_qr_item_visibility',
      title: 'QR menu visibility',
      summary: `Review ${lines.length} item change${lines.length === 1 ? '' : 's'} for ${await runtime.locationName(locationId)}`,
      confirmLabel: 'Save visibility',
      note: 'This saves the draft only. Publish the QR menu when you are ready for customers to see it.',
      fields: [selectField('locationId', 'Location', await runtime.locationOptions(), locationId, { readOnly: true })],
      lineGroup: {
        label: 'Menu items',
        addLabel: 'Add item',
        emptyLabel: 'No item changes yet.',
        options: items.map((item) => ({
          value: item.id,
          label: item.name,
          hint: `£${toNumber(item.price).toFixed(2)}`,
          prefill: { visibility: 'show' },
        })),
        template: [
          field('visibility', 'QR menu', {
            type: 'select',
            options: choice([
              ['show', 'Show'],
              ['hide', 'Hide'],
            ]),
            value: 'show',
          }),
        ],
        lines,
        minLines: 1,
        maxLines: 100,
      },
    };
  },
  async execute(action, runtime) {
    const locationId = str(action.fields, 'locationId');
    await runtime.send(`/qr-ordering/locations/${locationId}`, 'PUT', {
      itemVisibility: action.lines.map((line) => ({ menuItemId: line.id, visible: str(line.values, 'visibility') === 'show' })),
    });
    return {
      message: `Saved ${action.lines.length} QR menu visibility change${action.lines.length === 1 ? '' : 's'} to the draft. Publish the QR menu to make the change visible to customers.`,
      shortcuts: [
        { label: 'Open QR ordering settings', href: '/settings/qr-ordering', description: 'Settings · QR ordering', kind: 'page' },
      ],
    };
  },
};

export const ACTIONS: ActionDefinition[] = [
  requestLeave,
  cancelLeaveRequest,
  raiseHrRequest,
  updateMyDetails,
  createPurchaseOrder,
  createRestockRequest,
  createStockTransfer,
  recordStockLoss,
  updateOrderStatus,
  adjustCustomerPoints,
  updateMenuItem,
  scheduleShift,
  reviewLeaveRequest,
  updateStockThresholds,
  updateQrOrderingSettings,
  publishQrOrdering,
  updateQrItemVisibility,
];

const ACTION_BY_TOOL = new Map(ACTIONS.map((action) => [action.tool.name, action]));
const ACTION_BY_KIND = new Map(ACTIONS.map((action) => [action.kind, action]));

export function actionsForCapabilities(capabilities: readonly string[]) {
  return ACTIONS.filter((action) => !action.capability || hasCapability(capabilities, action.capability));
}

export function actionForTool(name: string) {
  return ACTION_BY_TOOL.get(name);
}

async function optionLabel(options: Promise<AgentFieldOption[]>, value: string) {
  if (!value) return '';
  return (await options).find((option) => option.value === value)?.label ?? '';
}

async function recentOrders(runtime: AgentRuntime) {
  const query = new URLSearchParams({ limit: '25' });
  if (runtime.locationId) query.set('locationId', runtime.locationId);
  const response = await runtime.get<{ data?: Order[] }>(`/orders?${query}`);
  return response.data ?? [];
}

/**
 * Verify an approval and replay the operator's edits against the sealed draft
 * (see `action-seal.ts`), then hand back the definition that will run it.
 */
export function resolveSubmission(submission: AgentActionSubmission): { action: ResolvedAction; definition: ActionDefinition } {
  const action = resolveSealedSubmission(submission);
  const definition = ACTION_BY_KIND.get(action.kind);
  if (!definition) throw new Error('That action is no longer supported. Ask DUMA to prepare it again.');
  return { action, definition };
}
