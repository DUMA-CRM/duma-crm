import { FRONTEND_CAPABILITIES, type Capability } from '../auth/capabilities.ts';

export const MODULE_IDS = [
  'core', 'identity', 'organization', 'customers', 'catalog', 'ordering', 'payments', 'inventory',
  'purchasing', 'workforce', 'people', 'communications', 'compliance', 'analytics', 'agent', 'support',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

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
  identity: ['/forgot-password', '/reset-password', '/sign-in', '/sign-up', '/settings/security'],
  organization: ['/settings', '/settings/trading', '/settings/workspaces'],
  customers: ['/customers', '/customers/[id]', '/customers/duplicates'],
  catalog: ['/menu', '/menu/categories', '/menu/items', '/menu/items/[id]', '/menu/items/new', '/menu/modifiers', '/menu/modifiers/[id]', '/menu/modifiers/new'],
  ordering: ['/kds', '/orders', '/pos', '/order/[token]', '/settings/qr-ordering'],
  payments: ['/cash-up'],
  inventory: ['/inventory', '/inventory/items/[id]', '/inventory/restock-requests', '/inventory/stocktakes', '/inventory/units/[id]'],
  purchasing: ['/inventory/purchasing'],
  workforce: ['/scheduling', '/staff/rota', '/staff/shifts'],
  people: ['/my-hr', '/staff', '/staff/[userId]', '/staff/payroll', '/staff/requests', '/staff/team'],
  communications: ['/communications', '/settings/connectors'],
  compliance: ['/audit-log', '/compliance'],
  analytics: ['/dashboard', '/reports', '/reports/[metric]', '/reports/compare', '/reports/library', '/reports/refunds', '/reports/staff/[userId]', '/reports/top-items'],
  agent: [],
  support: ['/staff/helpdesk', '/support', '/support/[slug]'],
};

const dependencies: Record<ModuleId, readonly ModuleId[]> = {
  core: [],
  identity: ['core'],
  organization: ['identity'],
  customers: ['organization'],
  catalog: ['organization'],
  ordering: ['catalog', 'customers'],
  payments: ['ordering'],
  inventory: ['catalog', 'organization'],
  purchasing: ['inventory'],
  workforce: ['identity', 'organization'],
  people: ['identity', 'workforce'],
  communications: ['customers'],
  compliance: ['customers', 'identity'],
  analytics: ['ordering'],
  agent: ['core'],
  support: ['identity'],
};

const capabilityOwners: Record<ModuleId, readonly RegExp[]> = {
  core: [],
  identity: [/^staff:/],
  organization: [/^(?:locations|tenants|settings):/],
  customers: [/^customers(?::|\.)/, /^segments:/],
  catalog: [/^(?:menu|recipes):/],
  ordering: [/^orders:/, /^qr-ordering:/],
  payments: [/^payments(?::|\.)/, /^cashups:/],
  inventory: [/^stock(?::|\.)/, /^inventory:/, /^stocktakes:/, /^loss:/, /^restock:/, /^forecast:/],
  purchasing: [/^suppliers:/, /^purchasing:/],
  workforce: [/^shifts:/, /^scheduling:/],
  people: [/^hr\./],
  communications: [/^email(?::|\.)/],
  compliance: [/^privacy:/, /^audit:/],
  analytics: [/^analytics:/],
  agent: [],
  support: [/^helpdesk:/],
};

const navigation: Record<ModuleId, readonly string[]> = {
  core: [], identity: [], organization: ['/settings'], customers: ['/customers'], catalog: ['/menu'],
  ordering: ['/pos', '/kds', '/orders'], payments: [], inventory: ['/inventory'], purchasing: [],
  workforce: ['/scheduling'], people: ['/my-hr', '/staff'], communications: ['/communications'],
  compliance: ['/compliance', '/audit-log'], analytics: ['/dashboard', '/reports'], agent: [], support: ['/support'],
};

const capabilitiesFor = (id: ModuleId): Capability[] => FRONTEND_CAPABILITIES.filter((entry) =>
  capabilityOwners[id].some((pattern) => pattern.test(entry)),
);

export const CRM_MODULE_MANIFESTS: readonly ModuleManifest[] = MODULE_IDS.map((id) => ({
  id,
  version: 1,
  dependencies: dependencies[id],
  capabilities: capabilitiesFor(id),
  navigation: navigation[id],
  routes: pages[id],
  widgets: [],
  setupChecks: [],
  publishedEvents: [],
  consumedEvents: [],
  tables: [],
  backgroundWorkers: [],
}));

export function moduleForPage(path: string): ModuleId | undefined {
  return CRM_MODULE_MANIFESTS.find((manifest) => manifest.routes.includes(path))?.id;
}
