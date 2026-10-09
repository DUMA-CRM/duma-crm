import { widgetsForModule } from '../dashboard/widget-registry.ts';

export const MODULE_IDS = [
  'core',
  'identity',
  'organization',
  'customers',
  'catalog',
  'ordering',
  'pos',
  'qr-ordering',
  'kds',
  'payments',
  'inventory',
  'purchasing',
  'workforce',
  'people',
  'payroll',
  'communications',
  'compliance',
  'audit',
  'analytics',
  'agent',
  'support',
  'cms',
  'promotions',
  'referrals',
  'notes',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

/** CRM surfaces and Ask DUMA derive their vocabulary from module contributions. */
export const CRM_MODULE_CAPABILITIES = {
  core: [],
  identity: ['staff:read', 'staff:access', 'staff:onboard'],
  organization: [
    'locations:write',
    'locations:targets',
    'locations:activate',
    'tenants:read',
    'tenants:write',
    'settings:read',
    'settings:write',
  ],
  customers: [
    'customers:read',
    'customers:write',
    'customers:points',
    'customers:merge',
    'customers:erase',
    'customers.consent:read',
    'customers.consent:write',
    'segments:read',
    'segments:write',
    'segments:send',
  ],
  catalog: ['menu:write'],
  ordering: ['orders:create', 'orders:read', 'orders:status', 'orders:refund', 'orders:bulk'],
  pos: [],
  // The kitchen screen works orders with ordering's capabilities (orders:status).
  kds: [],
  'qr-ordering': ['qr-ordering:read', 'qr-ordering:write'],
  payments: ['payments.connections:write', 'cashups:read', 'cashups:write'],
  inventory: [
    'recipes:read',
    'recipes:write',
    'stock:read',
    'stock:write',
    'stock.transfers:read',
    'stock.locations:read',
    'stock.transfers:write',
    'stock.locations:write',
    'inventory:read',
    'inventory:write',
    'inventory:waste',
    'stocktakes:read',
    'stocktakes:write',
    'loss:read',
    'loss:write',
    'restock:read',
    'restock:write',
    'restock:delete',
    'forecast:read',
  ],
  purchasing: ['suppliers:read', 'suppliers:write', 'suppliers:delete', 'purchasing:read', 'purchasing:write'],
  workforce: ['scheduling:read', 'scheduling:write', 'shifts:read', 'shifts:write'],
  people: [
    'hr.people:read',
    'hr.people:write',
    'hr.people:delete',
    'hr.sensitive:read',
    'hr.sensitive:write',
    'hr.leave:read',
    'hr.leave:review',
    'hr.attendance:read',
    'hr.documents:read',
  ],
  payroll: ['hr.payroll:read', 'hr.payroll:write'],
  communications: [
    'email:read',
    'email:write',
    'email:send',
    'email:publish',
    'email:suppressions',
    'email.connections:read',
    'email.connections:write',
  ],
  compliance: ['privacy:read', 'privacy:write', 'privacy:export'],
  audit: ['audit:read'],
  analytics: ['analytics:read'],
  agent: [],
  support: ['helpdesk:manage'],
  cms: ['cms:read', 'cms:write', 'cms:publish', 'cms.schema:write', 'cms.keys:write'],
  // Managing promo codes; applying one at the till is orders:create.
  promotions: ['promotions:read', 'promotions:write'],
  // The refer-a-friend programme and who referred whom.
  referrals: ['referrals:read', 'referrals:write'],
  // Everyone's own notes and the shared knowledge base; sharing is an administrator's.
  notes: ['notes:read', 'notes:write', 'notes:manage'],
} as const satisfies Record<ModuleId, readonly string[]>;

type CrmCapabilityRegistry = typeof CRM_MODULE_CAPABILITIES;
export type Capability = CrmCapabilityRegistry[keyof CrmCapabilityRegistry][number];
export const FRONTEND_CAPABILITIES: readonly Capability[] = Object.values(CRM_MODULE_CAPABILITIES).flat();

export function moduleForCapability(capability: Capability): ModuleId {
  const owner = MODULE_IDS.find((moduleId) => (CRM_MODULE_CAPABILITIES[moduleId] as readonly string[]).includes(capability));
  if (!owner) throw new Error(`Capability has no CRM module owner: ${capability}`);
  return owner;
}

export function isModuleSurfaceEnabled(
  access: { capability?: Capability; module?: ModuleId },
  enabledModuleIds: readonly ModuleId[] = MODULE_IDS,
): boolean {
  const moduleId = access.capability ? moduleForCapability(access.capability) : access.module;
  if (!moduleId) throw new Error('A module surface must declare a capability or module');
  return enabledModuleIds.includes(moduleId);
}

export interface ModuleManifest {
  readonly id: ModuleId;
  readonly version: 1;
  readonly dependencies: readonly ModuleId[];
  readonly capabilities: readonly Capability[];
  readonly navigation: readonly string[];
  readonly routes: readonly string[];
  readonly widgets: readonly string[];
  readonly setupChecks: readonly string[];
  readonly publishedEvents: readonly string[];
  readonly consumedEvents: readonly string[];
  readonly tables: readonly string[];
  readonly backgroundWorkers: readonly string[];
}

const pages: Record<ModuleId, readonly string[]> = {
  core: ['/'],
  identity: ['/forgot-password', '/reset-password', '/sign-in', '/sign-up', '/settings/roles', '/settings/security'],
  // The dashboard belongs to every workspace; each widget on it follows its own module.
  organization: [
    '/dashboard',
    '/settings',
    '/settings/configuration/dashboard',
    '/settings/modules',
    '/settings/trading',
    '/settings/workspaces',
    '/settings/developers',
  ],
  customers: ['/customers', '/customers/[id]', '/customers/duplicates', '/customers/loyalty'],
  catalog: [
    '/menu',
    '/menu/categories',
    '/menu/items',
    '/menu/items/[id]',
    '/menu/items/new',
    '/menu/modifiers',
    '/menu/modifiers/[id]',
    '/menu/modifiers/new',
  ],
  ordering: ['/orders', '/settings/configuration', '/settings/configuration/orders'],
  kds: ['/kds', '/settings/configuration/kitchen'],
  pos: ['/pos', '/settings/configuration/pos'],
  'qr-ordering': ['/order/[token]', '/settings/qr-ordering'],
  payments: ['/cash-up'],
  inventory: ['/inventory', '/inventory/items/[id]', '/inventory/restock-requests', '/inventory/stocktakes', '/inventory/units/[id]'],
  purchasing: ['/inventory/purchasing'],
  workforce: ['/scheduling', '/staff/rota', '/staff/shifts'],
  people: ['/my-hr', '/staff', '/staff/[userId]', '/staff/requests', '/staff/team'],
  payroll: ['/staff/payroll'],
  communications: ['/communications', '/settings/connectors'],
  compliance: ['/compliance'],
  audit: ['/audit-log'],
  analytics: [
    '/reports',
    '/reports/[report]',
    '/reports/staff/[userId]',
  ],
  agent: [],
  support: ['/staff/helpdesk', '/support', '/support/[slug]'],
  cms: ['/content'],
  promotions: ['/promotions'],
  referrals: ['/promotions/referrals'],
  notes: ['/notes'],
};

const dependencies: Record<ModuleId, readonly ModuleId[]> = {
  core: [],
  identity: ['organization'],
  organization: ['core'],
  customers: ['organization'],
  catalog: ['organization'],
  ordering: ['catalog', 'customers', 'inventory', 'organization'],
  pos: ['ordering', 'payments'],
  kds: ['ordering'],
  'qr-ordering': ['ordering'],
  payments: ['identity', 'ordering'],
  inventory: ['catalog', 'organization'],
  purchasing: ['inventory'],
  workforce: ['identity', 'organization'],
  people: ['identity'],
  payroll: ['people'],
  communications: ['customers', 'identity'],
  compliance: ['customers', 'identity'],
  audit: ['identity'],
  analytics: ['ordering'],
  agent: ['core', 'analytics', 'inventory', 'workforce'],
  support: ['identity', 'organization'],
  cms: ['organization'],
  promotions: ['catalog', 'customers', 'ordering', 'organization'],
  referrals: ['customers', 'ordering', 'organization', 'promotions'],
  notes: ['identity', 'organization'],
};

const navigation: Record<ModuleId, readonly string[]> = {
  core: [],
  identity: [],
  organization: ['/settings'],
  customers: ['/customers'],
  catalog: ['/menu'],
  ordering: ['/orders'],
  pos: ['/pos'],
  kds: ['/kds'],
  'qr-ordering': [],
  payments: [],
  inventory: ['/inventory'],
  purchasing: [],
  workforce: ['/scheduling'],
  people: ['/my-hr', '/staff'],
  payroll: [],
  communications: ['/communications'],
  compliance: ['/compliance'],
  audit: ['/audit-log'],
  analytics: ['/dashboard', '/reports'],
  agent: [],
  support: ['/support'],
  cms: ['/content'],
  promotions: ['/promotions'],
  // A tab of Promotions, not a sidebar entry of its own.
  referrals: [],
  notes: ['/notes'],
};

export const CRM_MODULE_MANIFESTS: readonly ModuleManifest[] = MODULE_IDS.map((id) => ({
  id,
  version: 1,
  dependencies: dependencies[id],
  capabilities: CRM_MODULE_CAPABILITIES[id],
  navigation: navigation[id],
  routes: pages[id],
  widgets: widgetsForModule(id),
  setupChecks: [],
  publishedEvents: [],
  consumedEvents: [],
  tables: [],
  backgroundWorkers: [],
}));

export function moduleForPage(path: string): ModuleId | undefined {
  return CRM_MODULE_MANIFESTS.find((manifest) => manifest.routes.includes(path))?.id;
}
