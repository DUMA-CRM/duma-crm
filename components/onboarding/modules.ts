import {
  Bell,
  BookOpen,
  Boxes,
  ClipboardCheck,
  CreditCard,
  LifeBuoy,
  LineChart,
  QrCode,
  Receipt,
  Monitor,
  ShieldCheck,
  Sparkles,
  Tags,
  Truck,
  UserRound,
  Users,
  Wallet,
} from '@/components/icons';

import type { WorkspaceModuleId } from '@/lib/modules/organization/client';

type Icon = typeof Tags;

/** Always switched on — shown as one line rather than as cards. */
export const FOUNDATION_MODULES = new Set<WorkspaceModuleId>(['core', 'identity', 'organization']);

/** How a proposal reads: the till first, then the back of house, then the team, then the rest. */
export const MODULE_ORDER: readonly WorkspaceModuleId[] = [
  'ordering',
  'pos',
  'qr-ordering',
  'catalog',
  'payments',
  'inventory',
  'purchasing',
  'workforce',
  'people',
  'payroll',
  'customers',
  'communications',
  'analytics',
  'agent',
  'support',
  'compliance',
  'audit',
  'core',
  'identity',
  'organization',
];

export const byModuleOrder = (a: WorkspaceModuleId, b: WorkspaceModuleId) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b);

export const MODULE_COPY: Record<WorkspaceModuleId, { name: string; detail: string; icon: Icon }> = {
  core: { name: 'Core platform', detail: 'Secure workspace foundations.', icon: ShieldCheck },
  identity: { name: 'Identity & access', detail: 'Sign-in, roles and permissions.', icon: ShieldCheck },
  organization: { name: 'Organisation', detail: 'Locations, trading hours and settings.', icon: ShieldCheck },
  catalog: { name: 'Products & menu', detail: 'Everything you sell, with prices and options.', icon: Tags },
  ordering: { name: 'Orders', detail: 'Manage orders and fulfilment across every sales channel.', icon: Receipt },
  pos: { name: 'POS terminal', detail: 'Take orders and payments at a counter or till.', icon: Monitor },
  'qr-ordering': { name: 'QR ordering', detail: 'Let guests scan, order and pay from their phone.', icon: QrCode },
  payments: { name: 'Payments', detail: 'Card, cash and invoice, reconciled daily.', icon: CreditCard },
  inventory: { name: 'Stock', detail: 'Know what’s on hand before you run out.', icon: Boxes },
  purchasing: { name: 'Purchasing', detail: 'Order from suppliers and receive deliveries.', icon: Truck },
  workforce: { name: 'Rotas & time', detail: 'Shifts, clock-ins and leave.', icon: Users },
  people: { name: 'People', detail: 'Employee records, documents and HR details.', icon: UserRound },
  payroll: { name: 'Payroll', detail: 'Prepare pay runs and issue payslips.', icon: Wallet },
  customers: { name: 'Customers & loyalty', detail: 'Recognise regulars and reward them.', icon: BookOpen },
  communications: { name: 'Messages', detail: 'Email customers and your team.', icon: Bell },
  compliance: { name: 'Compliance', detail: 'Manage privacy and personal-data requests.', icon: ClipboardCheck },
  audit: { name: 'Audit Log', detail: 'Review important activity and changes across the workspace.', icon: ShieldCheck },
  analytics: { name: 'Analytics', detail: 'Sales, margin and labour trends.', icon: LineChart },
  agent: { name: 'Ask DUMA', detail: 'An assistant that knows your operation.', icon: Sparkles },
  support: { name: 'Help centre', detail: 'Guides and a helpdesk for your staff.', icon: LifeBuoy },
};

const readable = (id: string) =>
  String(id)
    .replaceAll(/[._:-]+/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());

/**
 * Copy for a module id that came from the API. The API owns the module list, so
 * a module this UI has no copy for yet gets a readable name and a generic icon
 * rather than crashing whatever is rendering it.
 */
export function moduleCopy(id: string): { name: string; detail: string; icon: Icon } {
  return MODULE_COPY[id as WorkspaceModuleId] ?? { name: readable(id), detail: '', icon: Boxes };
}
