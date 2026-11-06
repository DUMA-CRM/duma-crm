import {
  Banknote,
  BarChart3,
  Calculator,
  CreditCard,
  Database,
  GoogleDrive,
  type IconComponent,
  Mail,
  Printer,
  Send,
  Tags,
} from '@/components/icons';

import type { Capability } from '@/lib/auth/capabilities';
import type { WorkspaceModuleId } from '@/lib/modules/organization/client';
import type { ConnectorState } from '@/lib/utils/connector-state';

export type ConnectorId =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'telegram'
  | 'email'
  | 'card-payments'
  | 'media-storage'
  | 'google-drive'
  | 'analytics'
  | 'payroll'
  | 'accounting'
  | 'till-hardware'
  | 'label-printer';

/**
 * What the business sees on the card. `attention` covers anything that used to
 * work and no longer does (rejected credentials, a failed check) — the only
 * state that needs someone to act today.
 */
export type { ConnectorState } from '@/lib/utils/connector-state';

/** Something to have to hand before connecting — a plain line, or one with a short hint after it. */
export type ConnectorRequirement = string | { label: string; hint?: string };

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
  requirements: ConnectorRequirement[];
  /** false → nothing to connect to yet; the card renders as Coming soon. */
  available: boolean;
  /** Shown only to someone holding this — the capability the API checks for it. */
  capability?: Capability;
  /** Required to fetch connection details; write access does not imply read access. */
  readCapability?: Capability;
  /** Shown only while this module is enabled for the workspace. */
  moduleId?: WorkspaceModuleId;
}

export const CONNECTORS: ConnectorDefinition[] = [
  ...(['youtube', 'facebook', 'instagram', 'tiktok'] as const).map(
    (id): ConnectorDefinition => ({
      id,
      name: { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' }[id],
      icon: Send,
      description: 'Schedule and publish social content from your marketing calendar.',
      tags: ['Marketing', 'Scheduled posts'],
      tagline: 'Connect the accounts your workspace publishes to.',
      requirements: [{ label: 'An account that can publish', hint: 'You sign in on the provider’s page' }],
      available: true,
      readCapability: 'marketing.connections:read',
      moduleId: 'marketing',
    }),
  ),
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    description: 'Send new-order alerts and other automation notifications to your staff chat.',
    tags: ['Staff notifications', 'Automations', 'Groups'],
    tagline: 'Keep your team informed in Telegram.',
    requirements: [
      { label: 'A Telegram account', hint: 'On your phone or computer' },
      { label: 'A staff group chat', hint: 'Where alerts will appear' },
    ],
    available: true,
    capability: 'settings:write',
    moduleId: 'automation',
  },
  {
    id: 'analytics',
    name: 'Web analytics',
    icon: BarChart3,
    description: 'Bring website traffic and product usage data from your analytics provider into DUMA.',
    tags: ['Umami Cloud', 'Self-hosted Umami', 'PostHog', 'Traffic metrics'],
    tagline: 'Connect your website analytics so DUMA can fetch its metrics.',
    requirements: [
      { label: 'An Umami or PostHog account', hint: 'With your website already tracked' },
      { label: 'Permission to create an API key', hint: 'Or a view-only user, on older Umami' },
    ],
    available: true,
    capability: 'settings:write',
    moduleId: 'analytics',
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    description: 'Send order confirmations, birthday offers and win-backs from your own mailbox.',
    tags: ['SMTP sending', 'Templates', 'Automations', 'Delivery log', 'Suppressions'],
    tagline: 'Customer email through your own mail provider, so replies come back to you.',
    requirements: [
      { label: 'Your mailbox login', hint: 'Usually the full email address' },
      { label: 'An app password', hint: 'Gmail and Microsoft 365 require one' },
      { label: 'Your SMTP server', hint: 'Filled in for Gmail and Microsoft 365' },
    ],
    available: true,
    capability: 'email.connections:write',
    readCapability: 'email.connections:read',
    moduleId: 'communications',
  },
  {
    id: 'card-payments',
    name: 'Card payments',
    icon: CreditCard,
    description: 'Take card payments at the till through a connected reader or a manual terminal.',
    tags: ['Stripe Terminal', 'SumUp', 'Square', 'Manual terminal'],
    tagline: 'Connect the card reader on your counter so the till can take card payments.',
    requirements: [
      { label: 'Your card reader', hint: 'Switched on, with its ID to hand' },
      { label: 'A key from your provider', hint: 'Not needed for a standalone card machine' },
    ],
    available: true,
    capability: 'payments.connections:write',
    readCapability: 'payments.connections:read',
    moduleId: 'payments',
  },
  {
    id: 'media-storage',
    name: 'Media storage',
    icon: Database,
    description: 'Keep website images, video and documents in your own bucket instead of the free 50 MB.',
    tags: ['Cloudflare R2', 'AWS S3', 'S3-compatible', 'Vercel Blob'],
    tagline: 'Content’s media stored in a bucket you own, served from your own CDN.',
    requirements: [
      { label: 'A bucket or Blob store', hint: 'Cloudflare R2, AWS S3 or Vercel Blob' },
      { label: 'A read-write key', hint: 'For that bucket or store' },
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
    id: 'till-hardware',
    name: 'Till hardware',
    icon: Printer,
    description: 'Connect this till’s printer and open its cash drawer after cash payments.',
    tags: ['iPad', 'Epson network', 'QZ Tray', 'Cash drawer'],
    tagline: 'Hardware configured separately for each till.',
    requirements: [
      { label: 'A receipt printer', hint: 'Epson on your network, or QZ Tray on a computer' },
      { label: 'A cash drawer', hint: 'Plugged into the printer' },
    ],
    available: true,
    capability: 'settings:write',
    moduleId: 'pos',
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
  configured: { label: 'Configured on this device', variant: 'muted' },
  connected: { label: 'Connected', variant: 'success' },
  attention: { label: 'Needs attention', variant: 'destructive' },
  paused: { label: 'Paused', variant: 'warning' },
  disconnected: { label: 'Not connected', variant: 'muted' },
  unavailable: { label: 'Coming soon', variant: 'muted' },
};

/** Which filter chip a card belongs under. `unavailable` never counts as set up. */
export type ConnectorFilter = 'all' | 'connected' | 'configured' | 'attention' | 'disconnected';
