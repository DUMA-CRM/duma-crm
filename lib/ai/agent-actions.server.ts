import 'server-only';

import type { LocationStock } from '@/lib/api/inventory.service';
import type { Order } from '@/lib/api/orders.service';
import type { LeaveRequest } from '@/lib/api/people-ops.service';
import type { PurchaseOrder } from '@/lib/api/purchasing.service';
import { encodeNotes } from '@/lib/api/restock.service';
import { type Capability, hasCapability } from '@/lib/auth/capabilities';
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
  capability: Capability;
  /** Tool the model calls to prepare this action. It never writes anything. */
  tool: { name: string; description: string; parameters: JsonObject };
  draft(args: JsonObject, runtime: AgentRuntime): Promise<AgentPendingAction | { error: string }>;
  /** What confirming would do, described without performing it (test mode). */
  rehearse(action: ResolvedAction, runtime: AgentRuntime): Promise<ActionResult>;
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
  async rehearse(action, runtime) {
    const supplier = await optionLabel(runtime.supplierOptions(), str(action.fields, 'supplierId'));
    const total = action.lines.reduce((sum, line) => sum + num(line.values, 'quantityOrdered') * num(line.values, 'unitCost'), 0);
    return {
      message: `Test run complete — nothing was written. The order for ${supplier || 'the selected supplier'} passed validation with ${action.lines.length} line${action.lines.length === 1 ? '' : 's'} totalling ${gbp(total)}. Set AI_AGENT_TEST_MODE=false to send approved actions to the DUMA API.`,
      shortcuts: [inventoryShortcut('orders', str(action.fields, 'locationId'))],
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
  async rehearse(action, runtime) {
    const item = await optionLabel(runtime.stockItemOptions(), str(action.fields, 'stockItemId'));
    return {
      message: `Test run complete — nothing was written. The request for ${num(action.fields, 'requestedQty')} × ${item || 'the selected item'} passed validation.`,
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
  async rehearse(action) {
    return {
      message: `Test run complete — nothing was written. The transfer of ${action.lines.length} item${action.lines.length === 1 ? '' : 's'} passed validation.`,
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
  async rehearse(action, runtime) {
    const item = await optionLabel(runtime.stockItemOptions(), str(action.fields, 'stockItemId'));
    return {
      message: `Test run complete — nothing was written. Writing off ${num(action.fields, 'quantity')} × ${item} passed validation.`,
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
  async rehearse(action) {
    return {
      message: `Test run complete — nothing was written. Moving order #${str(action.fields, 'orderId').slice(0, 8)} to ${str(action.fields, 'status')} passed validation.`,
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
  async rehearse(action) {
    const delta = num(action.fields, 'delta');
    return { message: `Test run complete — nothing was written. A ${delta >= 0 ? '+' : ''}${delta} point adjustment passed validation.` };
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
  async rehearse(action, runtime) {
    const items = await runtime.menuItems();
    const item = items.find((row) => row.id === str(action.fields, 'menuItemId'));
    return {
      message: `Test run complete — nothing was written. Setting ${item?.name ?? 'the item'} to ${gbp(num(action.fields, 'price'))} passed validation.`,
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
  async rehearse(action) {
    return {
      message: `Test run complete — nothing was written. A shift on ${str(action.fields, 'date')} from ${str(action.fields, 'startTime')} to ${str(action.fields, 'endTime')} passed validation.`,
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
  async rehearse(action) {
    return { message: `Test run complete — nothing was written. Recording “${str(action.fields, 'decision')}” passed validation.` };
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
  async rehearse(action) {
    return {
      message: `Test run complete — nothing was written. A low-stock threshold of ${num(action.fields, 'lowThreshold')} passed validation.`,
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

export const ACTIONS: ActionDefinition[] = [
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
];

const ACTION_BY_TOOL = new Map(ACTIONS.map((action) => [action.tool.name, action]));
const ACTION_BY_KIND = new Map(ACTIONS.map((action) => [action.kind, action]));

export function actionsForCapabilities(capabilities: readonly string[]) {
  return ACTIONS.filter((action) => hasCapability(capabilities, action.capability));
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
