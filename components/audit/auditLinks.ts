import type { AuditLog } from '@/lib/api/audit.service';

/**
 * Where an entry's record lives in the CRM.
 *
 * Only routes that exist are listed, and only ones that can actually be reached
 * with the ID the audit row carries — a link that lands on a list page and
 * leaves the reader to hunt is worse than no link, because it looks like it
 * worked. Anything absent here simply gets no link.
 */
const RECORD_ROUTES: Record<string, (id: string) => string> = {
  orders: (id) => `/orders?order=${encodeURIComponent(id)}`,
  customers: (id) => `/customers/${encodeURIComponent(id)}`,
  staff: (id) => `/staff/${encodeURIComponent(id)}`,
  'hr/employees': (id) => `/staff/${encodeURIComponent(id)}`,
  'stock-items': (id) => `/inventory/items/${encodeURIComponent(id)}`,
  'stock-units': (id) => `/inventory/units/${encodeURIComponent(id)}`,
};

/** Sections that hold the record but can't deep-link to it by ID. */
const SECTION_ROUTES: Record<string, string> = {
  'purchase-orders': '/inventory/purchasing',
  suppliers: '/inventory/purchasing',
  stocktakes: '/inventory/stocktakes',
  'restock-requests': '/inventory/restock-requests',
  'stock-transfers': '/inventory',
  'loss-log': '/inventory',
  inventory: '/inventory',
  'location-stock': '/inventory',
  'hr/leave-requests': '/staff/requests',
  'hr/entitlements': '/staff/requests',
  'hr/documents': '/staff/team',
  'hr/attendance': '/staff/rota',
  'hr/absence-logs': '/staff/requests',
  helpdesk: '/staff/helpdesk',
  payroll: '/staff/payroll',
  shifts: '/staff/shifts',
  'scheduled-shifts': '/staff/rota',
  'menu-items': '/menu',
  modifiers: '/menu',
  'menu-item-recipes': '/menu',
  'modifier-recipes': '/menu',
  locations: '/settings/workspaces',
  tenants: '/settings/workspaces',
  'trading-settings': '/settings/trading',
  'payment-connections': '/settings/connectors',
  email: '/settings/connectors',
  'cash-ups': '/reports',
  refunds: '/reports/refunds',
  order_refund: '/reports/refunds',
};

export interface AuditRecordLink {
  href: string;
  /** True when the link opens the record itself rather than the list it sits in. */
  exact: boolean;
}

export function auditRecordLink(log: AuditLog): AuditRecordLink | null {
  const exactRoute = RECORD_ROUTES[log.resourceType];
  if (exactRoute && log.resourceId) return { href: exactRoute(log.resourceId), exact: true };
  const section = SECTION_ROUTES[log.resourceType];
  return section ? { href: section, exact: false } : null;
}
