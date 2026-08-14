/**
 * The real audit vocabulary, taken from the API rather than guessed.
 *
 * Two things about how `duma-api` writes audit entries drive everything here:
 *
 *  1. `resourceType` is the **plural first path segment** — `orders`, not
 *     `order`; `stock-items`, not `stock`; `hr/leave-requests` keeps its slash.
 *     (`src/middleware/audit.ts` → `deriveResourceType`.)
 *  2. `action` is `resourceType.verb`, where the verb is either the last
 *     non-ID path segment or a method-derived word — `orders.create`,
 *     `orders.status_update`, `stock-items.update`. Around forty handlers
 *     override it with a named event such as `customers.merged`.
 *
 * The previous filter lists in this page were written from intuition and used
 * singular forms, so nearly every option selected nothing. Anything added here
 * must be checked against the API source, not invented.
 */

export type AuditDomain = 'orders' | 'stock' | 'team' | 'reference';

interface ResourceMeta {
  /** Filter-list form, plural: "Purchase orders". */
  plural: string;
  /** Bare singular for sentences: "purchase order". */
  noun: string;
  domain: AuditDomain;
  /**
   * A second key the API also writes for the same thing (handlers that set
   * `auditResourceType` by hand use snake_case). Kept for lookup, hidden from
   * the picker so one concept never appears twice in the list.
   */
  alias?: true;
}

/** Every resource type the API can emit, keyed exactly as it is stored. */
export const RESOURCES: Record<string, ResourceMeta> = {
  // — Orders and money —
  orders: { plural: 'Orders', noun: 'order', domain: 'orders' },
  order_refund: { alias: true, plural: 'Refunds', noun: 'refund', domain: 'orders' },
  refunds: { plural: 'Refunds', noun: 'refund', domain: 'orders' },
  payments: { plural: 'Payments', noun: 'payment', domain: 'orders' },
  receipts: { plural: 'Receipts', noun: 'receipt', domain: 'orders' },
  'cash-ups': { plural: 'Cash-ups', noun: 'cash-up', domain: 'orders' },
  'payment-connections': { plural: 'Payment connections', noun: 'payment connection', domain: 'orders' },

  // — Stock and purchasing —
  'stock-items': { plural: 'Stock items', noun: 'stock item', domain: 'stock' },
  'stock-units': { plural: 'Stock units', noun: 'stock unit', domain: 'stock' },
  'stock-transfers': { plural: 'Stock transfers', noun: 'stock transfer', domain: 'stock' },
  stocktakes: { plural: 'Stocktakes', noun: 'stocktake', domain: 'stock' },
  'purchase-orders': { plural: 'Purchase orders', noun: 'purchase order', domain: 'stock' },
  'restock-requests': { plural: 'Restock requests', noun: 'restock request', domain: 'stock' },
  suppliers: { plural: 'Suppliers', noun: 'supplier', domain: 'stock' },
  inventory: { plural: 'Inventory', noun: 'inventory record', domain: 'stock' },
  'location-stock': { plural: 'Location stock', noun: 'location stock record', domain: 'stock' },
  location_stock: { alias: true, plural: 'Location stock', noun: 'location stock record', domain: 'stock' },
  'loss-log': { plural: 'Stock loss', noun: 'stock loss entry', domain: 'stock' },

  // — Team and HR —
  staff: { plural: 'Staff', noun: 'staff member', domain: 'team' },
  onboarding: { plural: 'Onboarding', noun: 'starter', domain: 'team' },
  shifts: { plural: 'Shifts', noun: 'shift', domain: 'team' },
  'scheduled-shifts': { plural: 'Scheduled shifts', noun: 'scheduled shift', domain: 'team' },
  payroll: { plural: 'Payroll', noun: 'payroll run', domain: 'team' },
  helpdesk: { plural: 'Helpdesk', noun: 'ticket', domain: 'team' },
  'hr/employees': { plural: 'Employees', noun: 'employee record', domain: 'team' },
  'hr/leave-requests': { plural: 'Leave requests', noun: 'leave request', domain: 'team' },
  'hr/leave-types': { plural: 'Leave types', noun: 'leave type', domain: 'team' },
  'hr/entitlements': { plural: 'Leave entitlements', noun: 'leave entitlement', domain: 'team' },
  'hr/documents': { plural: 'HR documents', noun: 'document', domain: 'team' },
  'hr/attendance': { plural: 'Attendance', noun: 'attendance record', domain: 'team' },
  'hr/absence-logs': { plural: 'Absence', noun: 'absence record', domain: 'team' },

  // — Reference and configuration —
  customers: { plural: 'Customers', noun: 'customer', domain: 'reference' },
  'customer-segments': { plural: 'Customer segments', noun: 'segment', domain: 'reference' },
  email: { plural: 'Email', noun: 'email record', domain: 'reference' },
  marketing_suppression: { alias: true, plural: 'Email suppressions', noun: 'suppression', domain: 'reference' },
  'menu-items': { plural: 'Menu items', noun: 'menu item', domain: 'reference' },
  modifiers: { plural: 'Modifiers', noun: 'modifier', domain: 'reference' },
  'menu-item-recipes': { plural: 'Recipes', noun: 'recipe', domain: 'reference' },
  'modifier-recipes': { plural: 'Modifier recipes', noun: 'modifier recipe', domain: 'reference' },
  'menu-item-modifiers': { plural: 'Menu item modifiers', noun: 'menu item modifier', domain: 'reference' },
  locations: { plural: 'Locations', noun: 'location', domain: 'reference' },
  tenants: { plural: 'Workspaces', noun: 'workspace', domain: 'reference' },
  'trading-settings': { plural: 'Trading settings', noun: 'trading setting', domain: 'reference' },
  'privacy-requests': { plural: 'Privacy requests', noun: 'privacy request', domain: 'reference' },
  privacy_request: { alias: true, plural: 'Privacy requests', noun: 'privacy request', domain: 'reference' },
  auth: { plural: 'Sign-in', noun: 'session', domain: 'reference' },
  analytics: { plural: 'Analytics', noun: 'analytics query', domain: 'reference' },
  'demand-forecast': { plural: 'Forecasting', noun: 'forecast', domain: 'reference' },
};

interface ActionMeta {
  /** Past tense, no subject: "cancelled". */
  verb: string;
  /**
   * The resource this action belongs to, where the action's own prefix isn't
   * a resource key — `hr.leave_approved` is written against `hr/leave-requests`.
   * Lets the action picker narrow to whatever resource is selected.
   */
  resource?: string;
  /** Overrides the resource's noun. `null` means the verb already names its object. */
  noun?: string | null;
  /** Overrides the derived "Orders cancelled" filter label. */
  filter?: string;
}

/**
 * Named events the API sets explicitly, plus the derived `resource.verb` forms
 * worth wording properly. Every key below appears in `duma-api/src/routes`.
 */
export const ACTIONS: Record<string, ActionMeta> = {
  // — Orders —
  'orders.create': { verb: 'took', filter: 'Orders taken' },
  'orders.update': { verb: 'updated' },
  'orders.delete': { verb: 'deleted' },
  'orders.cancel': { verb: 'cancelled' },
  'orders.status_update': { verb: 'moved' },
  'orders.refund': { verb: 'refunded' },
  'orders.bulk_cancel': { verb: 'cancelled', noun: 'orders in bulk', filter: 'Orders cancelled in bulk' },
  'orders.bulk_status_update': { verb: 'moved', noun: 'orders in bulk', filter: 'Orders moved in bulk' },
  'cashup.closed': { resource: 'cash-ups', verb: 'closed', noun: 'cash-up', filter: 'Cash-ups closed' },
  'payments.connection_created': {
    resource: 'payment-connections',
    verb: 'connected',
    noun: 'payment provider',
    filter: 'Payment providers connected',
  },

  // — Stock —
  'stock-items.create': { verb: 'added' },
  'stock-items.update': { verb: 'updated' },
  'stock-items.delete': { verb: 'deleted' },
  'stock-transfers.create': { verb: 'transferred', noun: 'stock', filter: 'Stock transferred' },
  'stocktakes.create': { verb: 'started' },
  'stocktakes.finalise': { verb: 'finalised' },
  'stock.loss': { resource: 'loss-log', verb: 'recorded', noun: 'stock loss', filter: 'Stock loss recorded' },
  'purchase-orders.create': { verb: 'raised' },
  'purchase-orders.receive': { verb: 'received' },
  'suppliers.create': { verb: 'added' },
  'suppliers.update': { verb: 'updated' },
  'suppliers.delete': { verb: 'removed' },
  'restock-requests.create': { verb: 'requested', noun: 'restock', filter: 'Restock requested' },

  // — Team and HR —
  'staff.onboard': { verb: 'onboarded', noun: 'starter', filter: 'Starters onboarded' },
  'staff.create': { verb: 'added' },
  'staff.update': { verb: 'updated' },
  'staff.delete': { verb: 'removed' },
  'shifts.manual-create': { verb: 'added', noun: 'shift by hand', filter: 'Shifts added by hand' },
  'scheduled-shifts.suggest': { verb: 'suggested', noun: 'shift cover', filter: 'Shift cover suggested' },
  'payroll.finalise': { verb: 'finalised', noun: 'payroll run', filter: 'Payroll runs finalised' },
  'hr.leave_approved': { resource: 'hr/leave-requests', verb: 'approved', noun: 'leave request', filter: 'Leave approved' },
  'hr.leave_declined': { resource: 'hr/leave-requests', verb: 'declined', noun: 'leave request', filter: 'Leave declined' },
  'hr.leave_entitlement_created': {
    resource: 'hr/entitlements',
    verb: 'created',
    noun: 'leave entitlement',
    filter: 'Leave entitlements created',
  },
  'hr.leave_entitlement_updated': {
    resource: 'hr/entitlements',
    verb: 'updated',
    noun: 'leave entitlement',
    filter: 'Leave entitlements updated',
  },
  'hr.work_pattern_updated': { resource: 'hr/employees', verb: 'updated', noun: 'work pattern', filter: 'Work patterns updated' },
  'hr.bank_details.update': { resource: 'hr/employees', verb: 'updated', noun: 'bank details', filter: 'Bank details updated' },
  'hr.employee_offboarded': { resource: 'hr/employees', verb: 'offboarded', noun: 'employee', filter: 'Employees offboarded' },
  'hr.document_created': { resource: 'hr/documents', verb: 'uploaded', noun: 'HR document', filter: 'HR documents uploaded' },
  'hr.document_deleted': { resource: 'hr/documents', verb: 'deleted', noun: 'HR document', filter: 'HR documents deleted' },
  'helpdesk.ticket_created': { verb: 'raised', noun: 'helpdesk ticket', filter: 'Helpdesk tickets raised' },
  'helpdesk.ticket_updated': { verb: 'updated', noun: 'helpdesk ticket', filter: 'Helpdesk tickets updated' },
  'helpdesk.reply_added': { verb: 'replied to', noun: 'helpdesk ticket', filter: 'Helpdesk replies sent' },
  'helpdesk.private_note_added': { verb: 'added a private note to', noun: 'helpdesk ticket', filter: 'Helpdesk private notes added' },

  // — Customers and marketing —
  'customers.create': { verb: 'added' },
  'customers.update': { verb: 'updated' },
  'customers.delete': { verb: 'deleted' },
  'customers.merged': { verb: 'merged' },
  'customers.unmerged': { verb: 'unmerged' },
  'customers.erased': { verb: 'erased' },
  'customers.safety_updated': { verb: 'updated safety notes for', noun: 'customer', filter: 'Customer safety notes updated' },
  'customers.points_added': { verb: 'added loyalty points to', noun: 'customer', filter: 'Loyalty points added' },
  'customers.points_deducted': { verb: 'deducted loyalty points from', noun: 'customer', filter: 'Loyalty points deducted' },
  'customers.marketing_subscribed': { verb: 'subscribed', noun: 'customer to marketing', filter: 'Marketing opt-ins' },
  'customers.marketing_unsubscribed': { verb: 'unsubscribed', noun: 'customer from marketing', filter: 'Marketing opt-outs' },
  'email.suppression_added': { verb: 'suppressed', noun: 'email address', filter: 'Email addresses suppressed' },
  'email.suppression_lifted': { verb: 'unsuppressed', noun: 'email address', filter: 'Email suppressions lifted' },

  // — Compliance and configuration —
  'privacy.request_received': {
    resource: 'privacy-requests',
    verb: 'logged',
    noun: 'privacy request',
    filter: 'Privacy requests received',
  },
  'privacy.request_completed': {
    resource: 'privacy-requests',
    verb: 'completed',
    noun: 'privacy request',
    filter: 'Privacy requests completed',
  },
  'privacy.erasure_completed': { resource: 'privacy-requests', verb: 'erased a customer for', noun: null, filter: 'Erasures completed' },
  'privacy.data_exported': { resource: 'privacy-requests', verb: 'exported customer data', noun: null, filter: 'Customer data exported' },
  'trading.settings_updated': {
    resource: 'trading-settings',
    verb: 'updated trading settings',
    noun: null,
    filter: 'Trading settings updated',
  },
  'tenants.create': { verb: 'created' },
  'tenants.update': { verb: 'updated' },
  'tenants.delete': { verb: 'deleted' },
  'locations.create': { verb: 'opened' },
  'locations.update': { verb: 'updated' },
  'locations.delete': { verb: 'closed' },
  'menu-items.create': { verb: 'added' },
  'menu-items.update': { verb: 'updated' },
  'menu-items.delete': { verb: 'removed' },
};

/** The dozen worth offering before any real data has loaded. */
export const COMMON_ACTIONS = [
  'orders.create',
  'orders.cancel',
  'orders.refund',
  'orders.status_update',
  'stock-items.update',
  'stock.loss',
  'stocktakes.finalise',
  'purchase-orders.receive',
  'staff.onboard',
  'staff.update',
  'hr.leave_approved',
  'hr.leave_declined',
  'payroll.finalise',
  'customers.merged',
  'customers.erased',
  'privacy.data_exported',
  'tenants.delete',
  'locations.delete',
] as const;

export const COMMON_RESOURCES = [
  'orders',
  'customers',
  'staff',
  'stock-items',
  'purchase-orders',
  'stocktakes',
  'hr/leave-requests',
  'hr/employees',
  'payroll',
  'helpdesk',
  'locations',
  'tenants',
] as const;

// ── Derivation for anything not listed ────────────────────────────────────────

const VERBS: Record<string, string> = {
  add: 'added',
  adjust: 'adjusted',
  approve: 'approved',
  cancel: 'cancelled',
  clock: 'clocked',
  'clock-in': 'clocked in',
  'clock-out': 'clocked out',
  close: 'closed',
  complete: 'completed',
  create: 'created',
  decline: 'declined',
  delete: 'deleted',
  erase: 'erased',
  export: 'exported',
  finalise: 'finalised',
  import: 'imported',
  merge: 'merged',
  publish: 'published',
  receive: 'received',
  refund: 'refunded',
  reject: 'rejected',
  remove: 'removed',
  restore: 'restored',
  send: 'sent',
  submit: 'submitted',
  suggest: 'suggested',
  transfer: 'transferred',
  update: 'updated',
  void: 'voided',
};

function titleCase(value: string) {
  const words = value.replace(/[._\-/]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function resourceMeta(resourceType: string): ResourceMeta {
  const known = RESOURCES[resourceType];
  if (known) return known;
  // Unknown types still get a readable noun rather than a raw column value.
  const words = resourceType.replace(/[._\-/]+/g, ' ').trim() || 'record';
  const singular = words.endsWith('ies') ? `${words.slice(0, -3)}y` : words.endsWith('s') ? words.slice(0, -1) : words;
  return { plural: titleCase(words), noun: singular, domain: 'reference' };
}

/** The tail of `resourceType.verb`, worded where possible. */
function derivedVerb(action: string): string {
  const tail = action.includes('.') ? action.slice(action.indexOf('.') + 1) : action;
  const segments = tail.split(/[._\- ]/).filter(Boolean);
  if (segments.length === 0) return 'acted on';
  const last = segments[segments.length - 1];
  if (VERBS[last]) {
    const modifier = segments.slice(0, -1).join(' ');
    return modifier ? `${VERBS[last]} the ${modifier} of` : VERBS[last];
  }
  if (VERBS[segments[0]]) return `${VERBS[segments[0]]} the ${segments.slice(1).join(' ')} of`.replace(/ of$/, '');
  return segments.join(' ');
}

export function actionMeta(action: string, resourceType: string): Required<Pick<ActionMeta, 'verb'>> & ActionMeta {
  const known = ACTIONS[action];
  if (known) return known;
  return { verb: derivedVerb(action), noun: resourceMeta(resourceType).noun };
}

const article = (noun: string) => (/^[aeiou]/i.test(noun) ? 'an' : 'a');

/**
 * The predicate of a row. With a resolved subject it names the record
 * ("cancelled order PO-0912"); without one it stays indefinite
 * ("cancelled an order"), which is honest rather than showing a bare UUID.
 */
export function actionPhrase(action: string, resourceType: string, subject?: string | null): string {
  const meta = actionMeta(action, resourceType);
  const noun = meta.noun === undefined ? resourceMeta(resourceType).noun : meta.noun;
  if (noun === null) return subject ? `${meta.verb} ${subject}` : meta.verb;
  if (subject) return `${meta.verb} ${noun} ${subject}`;
  return `${meta.verb} ${article(noun)} ${noun}`;
}

/** Just the verb, for summarising several entries at once: "created, moved". */
export function actionVerb(action: string, resourceType: string): string {
  return actionMeta(action, resourceType).verb;
}

/** Plural filter-list label: "Orders cancelled". */
export function actionFilterLabel(action: string, resourceType?: string): string {
  const known = ACTIONS[action];
  if (known?.filter) return known.filter;
  const type = resourceType ?? (action.includes('.') ? action.slice(0, action.indexOf('.')) : action);
  const meta = actionMeta(action, type);
  return `${resourceMeta(type).plural} ${meta.verb}`;
}

// ── Pickers ───────────────────────────────────────────────────────────────────

/** Every resource worth offering, alphabetical, aliases folded away. */
export function resourcePickerOptions(): { value: string; label: string }[] {
  return Object.entries(RESOURCES)
    .filter(([, meta]) => !meta.alias)
    .map(([value, meta]) => ({ value, label: meta.plural }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Which resource an action was written against — the action's own prefix when
 * that is a resource key, otherwise the explicit mapping. Returns null for an
 * unmapped action, which the picker treats as "always show".
 */
export function actionResource(action: string): string | null {
  const known = ACTIONS[action];
  if (known?.resource) return known.resource;
  const prefix = action.split('.')[0];
  return RESOURCES[prefix] && !RESOURCES[prefix].alias ? prefix : null;
}
