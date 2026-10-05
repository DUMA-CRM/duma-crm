/**
 * Turns a module's blast radius — route paths, widget keys, worker ids,
 * capability strings — into what an operator recognises: page names, dashboard
 * panels, automations and the staff actions that go away.
 *
 * Pure so the wording is testable; the dialog only renders the groups.
 */

export type ImpactGroupKey = 'pages' | 'panels' | 'automations' | 'integrations' | 'access';

export interface ImpactGroup {
  key: ImpactGroupKey;
  title: string;
  items: string[];
}

export interface ModuleImpactInput {
  routes: readonly string[];
  navigation: readonly string[];
  widgets: readonly string[];
  backgroundWorkers: readonly string[];
  integrations: readonly string[];
  capabilities: readonly string[];
}

// Where the last path segment doesn't say what the page is.
const PAGE_NAMES: Record<string, string> = {
  '/pos': 'POS',
  '/kds': 'Kitchen screen',
  '/my-hr': 'My HR',
  '/cash-up': 'End of day',
  '/audit-log': 'Audit log',
  '/settings': 'Settings',
  '/settings/qr-ordering': 'QR ordering settings',
  '/settings/connectors': 'Connectors',
  '/staff/helpdesk': 'Staff helpdesk',
  '/reports/[report]': 'Reports',
  '/reports/staff/[userId]': 'Staff performance report',
};

const VERBS: Record<string, string> = { read: 'View', write: 'Edit', create: 'Create', delete: 'Delete' };

const words = (value: string) => value.replace(/[._:-]+/g, ' ').trim();
const sentence = (value: string) => {
  const text = words(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const unique = (values: string[]) => [...new Set(values)];

/** "/inventory/stocktakes" → "Stocktakes". Detail and create pages fold into their parent, so they're dropped. */
export function pageName(path: string): string | null {
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  const segments = path.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('[')) || segments.at(-1) === 'new') return null;
  const last = segments.at(-1);
  return last ? sentence(last) : null;
}

/** "stock.locations:write" → "Edit stock locations". */
export function capabilityName(capability: string): string {
  const [resource = '', action = ''] = capability.split(':');
  const verb = VERBS[action] ?? sentence(action);
  return `${verb} ${words(resource).toLowerCase()}`.trim();
}

/** "inventory.expiry-sweep" → "Expiry sweep": the module prefix is implied by the dialog. */
export function automationName(id: string): string {
  const tail = id.includes('.') ? id.slice(id.indexOf('.') + 1) : id;
  return sentence(tail);
}

export function describeModuleImpact(input: ModuleImpactInput, widgetLabels: Readonly<Record<string, string>> = {}): ImpactGroup[] {
  const groups: ImpactGroup[] = [
    {
      key: 'pages',
      title: 'Pages',
      items: unique([...input.navigation, ...input.routes].map(pageName).filter((name): name is string => name !== null)),
    },
    { key: 'panels', title: 'Dashboard panels', items: unique(input.widgets.map((key) => widgetLabels[key] ?? automationName(key))) },
    { key: 'automations', title: 'Automations', items: unique(input.backgroundWorkers.map(automationName)) },
    { key: 'integrations', title: 'Integrations', items: unique(input.integrations.map(automationName)) },
    { key: 'access', title: 'Staff access', items: unique(input.capabilities.map(capabilityName)) },
  ];
  // An empty group is noise, not information.
  return groups.filter((group) => group.items.length > 0);
}

/** ["A", "B", "C"] → "A, B and C" — how a list is said out loud. */
export function listSentence(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
