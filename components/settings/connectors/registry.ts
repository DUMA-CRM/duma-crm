import { Banknote, Calculator, CreditCard, Database, GoogleDrive, type IconComponent, Mail, Printer, Tags } from '@/components/icons';
import type { Capability } from '@/lib/auth/capabilities';
import type { WorkspaceModuleId } from '@/lib/modules/organization/client';

export type ConnectorId =
  | 'email'
  | 'card-payments'
  | 'media-storage'
  | 'google-drive'
  | 'payroll'
  | 'accounting'
  | 'receipt-printer'
  | 'label-printer';

/**
 * What the business sees on the card. `attention` covers anything that used to
 * work and no longer does (rejected credentials, a failed check) — the only
 * state that needs someone to act today.
 */
export type ConnectorState = 'connected' | 'attention' | 'paused' | 'disconnected' | 'unavailable';

export interface ConnectorDefinition {
  id: ConnectorId;
  name: string;
  icon: IconComponent;
  /** Card body — what this connector does, in one sentence. */
  description: string;
  /** Capability chips under the description. */
  tags: string[];
  /** Rail heading on the connect wizard. */
  tagline: string;
  /** "Before you start" list on the connect wizard. */
  requirements: string[];
  /** false → nothing to connect to yet; the card renders as Coming soon. */
  available: boolean;
  /** Shown only to someone holding this — the capability the API checks for it. */
  capability?: Capability;
  /** Shown only while this module is enabled for the workspace. */
  moduleId?: WorkspaceModuleId;
}

export const CONNECTORS: ConnectorDefinition[] = [
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    description: 'Send order confirmations, birthday offers and win-backs from your own mailbox.',
    tags: ['SMTP sending', 'Templates', 'Automations', 'Delivery log', 'Suppressions'],
    tagline: 'Customer email through your own mail provider, so replies come back to you.',
    requirements: [
      'Your provider’s outgoing server name and port',
      'The mailbox username — usually the full email address',
      'An app password (Gmail and Microsoft 365 both require one)',
    ],
    available: true,
    capability: 'email.connections:write',
  },
  {
    id: 'card-payments',
    name: 'Card payments',
    icon: CreditCard,
    description: 'Take card payments at the till through a connected reader or a manual terminal.',
    tags: ['Stripe Terminal', 'SumUp', 'Square', 'Manual terminal'],
    tagline: 'Connect the card reader on your counter so the till can take card payments.',
    requirements: [
      'Stripe, SumUp or Square: your reader’s ID and a key from your account',
      'A standalone card machine: nothing — just a name',
      'About two minutes',
    ],
    available: true,
    capability: 'payments.connections:write',
  },
  {
    id: 'media-storage',
    name: 'Media storage',
    icon: Database,
    description: 'Keep website images, video and documents in your own bucket instead of the free 50 MB.',
    tags: ['Cloudflare R2', 'AWS S3', 'S3-compatible', 'Vercel Blob'],
    tagline: 'Content’s media stored in a bucket you own, served from your own CDN.',
    requirements: [
      'A bucket on Cloudflare R2, AWS S3, another S3 service, or a Vercel Blob store',
      'A key that can read and write that bucket (or the Blob read-write token)',
      'Optional: the bucket’s public URL, so your website loads files from your CDN',
    ],
    available: true,
    capability: 'cms.keys:write',
    moduleId: 'cms',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: GoogleDrive,
    description: 'Keep the notes you choose as Google Docs in your own Drive, updated as you edit them.',
    tags: ['Notes', 'Google Docs', 'Your own account'],
    tagline: 'Your notes, kept as Google Docs in your Drive.',
    requirements: [],
    available: true,
    capability: 'notes:write',
    // Each person connects their own Google account; nobody else sees it.
    moduleId: 'notes',
  },
  {
    id: 'payroll',
    name: 'Payroll export',
    icon: Banknote,
    description: 'Send finalised payroll runs straight to your provider instead of exporting a file.',
    tags: ['Xero', 'QuickBooks', 'BrightPay'],
    tagline: 'Finalised payroll runs pushed to your payroll provider.',
    requirements: [],
    available: false,
  },
  {
    id: 'accounting',
    name: 'Accounting',
    icon: Calculator,
    description: 'Post daily sales, cost of goods and payroll journals to your accounting software.',
    tags: ['Sales', 'Cost of goods', 'Payroll journals'],
    tagline: 'Daily journals posted to your books automatically.',
    requirements: [],
    available: false,
  },
  {
    id: 'receipt-printer',
    name: 'Receipt printer',
    icon: Printer,
    description: 'Print order receipts to networked or Bluetooth thermal printers from the POS.',
    tags: ['Network', 'Bluetooth', 'Thermal'],
    tagline: 'Receipts printed at the counter as orders are paid for.',
    requirements: [],
    available: false,
  },
  {
    id: 'label-printer',
    name: 'Label printer',
    icon: Tags,
    description: 'Print prep and allergen labels for food items as they are made.',
    tags: ['Prep labels', 'Allergen labels'],
    tagline: 'Prep and allergen labels printed from the kitchen.',
    requirements: [],
    available: false,
  },
];

export const CONNECTORS_BY_ID = Object.fromEntries(CONNECTORS.map((connector) => [connector.id, connector])) as Record<
  ConnectorId,
  ConnectorDefinition
>;

export const STATE_BADGE: Record<ConnectorState, { label: string; variant: 'success' | 'destructive' | 'warning' | 'muted' }> = {
  connected: { label: 'Connected', variant: 'success' },
  attention: { label: 'Needs attention', variant: 'destructive' },
  paused: { label: 'Paused', variant: 'warning' },
  disconnected: { label: 'Not connected', variant: 'muted' },
  unavailable: { label: 'Coming soon', variant: 'muted' },
};

/** Which filter chip a card belongs under. `unavailable` never counts as set up. */
export type ConnectorFilter = 'all' | 'connected' | 'attention' | 'disconnected';
