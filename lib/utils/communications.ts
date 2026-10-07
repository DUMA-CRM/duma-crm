import { relativeTime } from './relative-time.ts';

// Pure logic behind the Communications overview and history — no React, so it
// can be tested. Structural types only: the caller passes API records as-is.

type DeliveryStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';

interface DeliveryLike {
  status: DeliveryStatus;
  createdAt: string;
}

interface WorkflowLike {
  nodes: { type: string; config: Record<string, unknown> }[];
}

interface AutomationLike {
  id: string;
  name: string;
  isEnabled: boolean;
  publishedVersion: number;
  failedRunCount?: number;
  definition?: WorkflowLike;
  publishedDefinition?: WorkflowLike | null;
}

interface TemplateLike {
  id: string;
  isActive: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Sent / failed / total across the given deliveries, last 7 days. */
export function summariseWeek(deliveries: readonly DeliveryLike[], now: number) {
  const cutoff = now - 7 * DAY_MS;
  const recent = deliveries.filter((delivery) => Date.parse(delivery.createdAt) >= cutoff);
  return {
    total: recent.length,
    sent: recent.filter((delivery) => delivery.status === 'sent').length,
    failed: recent.filter((delivery) => delivery.status === 'failed').length,
  };
}

export type DeliveryBucket = 'all' | 'sent' | 'waiting' | 'failed' | 'cancelled';

/** "Waiting" covers queued and mid-send — nobody can act on either. */
export const deliveryBucket = (status: DeliveryStatus): Exclude<DeliveryBucket, 'all'> =>
  status === 'queued' || status === 'sending' ? 'waiting' : status;

export function countByBucket(deliveries: readonly DeliveryLike[]): Record<DeliveryBucket, number> {
  const counts: Record<DeliveryBucket, number> = { all: deliveries.length, sent: 0, waiting: 0, failed: 0, cancelled: 0 };
  for (const delivery of deliveries) counts[deliveryBucket(delivery.status)] += 1;
  return counts;
}

/** Send steps pointing at a template that is gone or archived — those steps won't send. */
export function missingTemplateCount(definition: WorkflowLike | undefined, templates: readonly TemplateLike[]): number {
  return (definition?.nodes ?? [])
    .filter((node) => node.type === 'send_email')
    .filter((node) => !templates.some((template) => template.id === node.config.templateId && template.isActive)).length;
}

/** The draft differs from what is live — edits saved but not published. */
export function hasUnpublishedChanges(automation: AutomationLike): boolean {
  if (automation.publishedVersion === 0 || !automation.publishedDefinition || !automation.definition) return false;
  return JSON.stringify(automation.definition) !== JSON.stringify(automation.publishedDefinition);
}

export type ConnectionState = 'ready' | 'unverified' | 'missing' | 'unknown';

/**
 * `unknown` when the viewer can't read the connection (the API gates it on
 * `email.connections:read`) or it failed to load — never reported as "not set up".
 */
export function connectionState(
  connection: { isEnabled: boolean; lastTestSucceeded?: boolean | null } | null | undefined,
  readable: boolean,
): ConnectionState {
  if (!readable || connection === undefined) return 'unknown';
  if (connection === null) return 'missing';
  return connection.isEnabled && connection.lastTestSucceeded ? 'ready' : 'unverified';
}

export type AttentionIssue =
  | { kind: 'connection'; state: 'missing' | 'unverified' }
  | { kind: 'failed_deliveries'; count: number }
  | { kind: 'missing_template'; automationId: string; name: string; count: number }
  | { kind: 'failed_runs'; automationId: string; name: string; count: number }
  | { kind: 'unpublished'; automationId: string; name: string }
  | { kind: 'draft'; automationId: string; name: string };

/**
 * What needs someone, most urgent first: mail can't leave, emails failed, a
 * live automation is broken or failing, then work that isn't live yet.
 */
export function attentionIssues({
  connection,
  deliveries,
  automations,
  templates,
  now,
}: {
  connection: ConnectionState;
  deliveries: readonly DeliveryLike[];
  automations: readonly AutomationLike[];
  templates: readonly TemplateLike[];
  now: number;
}): AttentionIssue[] {
  const issues: AttentionIssue[] = [];
  if (connection === 'missing' || connection === 'unverified') issues.push({ kind: 'connection', state: connection });

  const failed = summariseWeek(deliveries, now).failed;
  if (failed > 0) issues.push({ kind: 'failed_deliveries', count: failed });

  const byName = [...automations].sort((a, b) => a.name.localeCompare(b.name));
  for (const automation of byName) {
    if (!automation.isEnabled) continue;
    const missing = missingTemplateCount(automation.definition, templates);
    if (missing > 0) issues.push({ kind: 'missing_template', automationId: automation.id, name: automation.name, count: missing });
  }
  for (const automation of byName) {
    if (automation.isEnabled && (automation.failedRunCount ?? 0) > 0)
      issues.push({ kind: 'failed_runs', automationId: automation.id, name: automation.name, count: automation.failedRunCount ?? 0 });
  }
  for (const automation of byName) {
    if (hasUnpublishedChanges(automation)) issues.push({ kind: 'unpublished', automationId: automation.id, name: automation.name });
  }
  for (const automation of byName) {
    if (automation.publishedVersion === 0) issues.push({ kind: 'draft', automationId: automation.id, name: automation.name });
  }
  return issues;
}

/** "just now", "12 min ago", "3 h ago", "2 d ago" — for short activity lists. */
export const timeAgo = (iso: string, now: number): string => relativeTime(iso, now);

// ── Automations list ──────────────────────────────────────────────────────────

export type AutomationGroup = 'orders' | 'customers' | 'staff';

export const AUTOMATION_GROUPS: { value: AutomationGroup; label: string }[] = [
  { value: 'orders', label: 'Orders' },
  { value: 'customers', label: 'Customers' },
  { value: 'staff', label: 'Staff' },
];

/** Which list heading an automation sits under — by what starts it. */
export const automationGroup = (trigger: string): AutomationGroup =>
  trigger.startsWith('order_') ? 'orders' : trigger.startsWith('staff_') ? 'staff' : 'customers';

/** Grouped Orders → Customers → Staff, sending first, then by name; empty groups dropped. */
export function groupAutomations<T extends { name: string; trigger: string; isEnabled: boolean }>(
  automations: readonly T[],
): { group: AutomationGroup; label: string; items: T[]; sending: number }[] {
  return AUTOMATION_GROUPS.map(({ value, label }) => {
    const items = automations
      .filter((automation) => automationGroup(automation.trigger) === value)
      .sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled) || a.name.localeCompare(b.name));
    return { group: value, label, items, sending: items.filter((automation) => automation.isEnabled).length };
  }).filter((group) => group.items.length > 0);
}

// ── Templates list ────────────────────────────────────────────────────────────

/** How many automations have a send step using each template id. */
export function templateUsage(automations: readonly { definition?: WorkflowLike }[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const automation of automations) {
    const ids = new Set(
      (automation.definition?.nodes ?? []).filter((node) => node.type === 'send_email').map((node) => String(node.config.templateId)),
    );
    for (const id of ids) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

/**
 * Live templates under their category, in the order the categories are listed
 * (`order`), anything unknown after them; alphabetical within each. Deleted
 * templates are only flagged inactive, so they are left out here.
 */
export function groupTemplates<T extends { id: string; name: string; category: string; isActive: boolean }>(
  templates: readonly T[],
  order: readonly string[],
  usage: ReadonlyMap<string, number>,
): { category: string; items: T[]; inUse: number }[] {
  const rank = (category: string) => (order.includes(category) ? order.indexOf(category) : order.length);
  const buckets = new Map<string, T[]>();
  for (const template of templates) {
    if (!template.isActive) continue;
    buckets.set(template.category, [...(buckets.get(template.category) ?? []), template]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      inUse: items.filter((item) => (usage.get(item.id) ?? 0) > 0).length,
    }));
}

// ── History ───────────────────────────────────────────────────────────────────

interface HistoryDelivery extends DeliveryLike {
  toEmail: string;
  toName?: string | null;
  subject: string;
  sentAt?: string | null;
  template?: { id: string; name: string } | null;
}

export type HistoryWindow = 'all' | 'today' | '7d' | '30d';

/** The moment a delivery happened, for sorting and day headings: sent, else queued. */
export const deliveryTime = (delivery: { sentAt?: string | null; createdAt: string }) => delivery.sentAt ?? delivery.createdAt;

/** Cut-off for the time filter (local midnight for "today"), or null when it is off. */
export function windowStart(window: HistoryWindow, now: number): number | null {
  if (window === 'all') return null;
  if (window === 'today') {
    const today = new Date(now);
    return new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  }
  return now - (window === '7d' ? 7 : 30) * DAY_MS;
}

/** Status bucket, template, time window and a search over recipient and subject. */
export function filterDeliveries<T extends HistoryDelivery>(
  deliveries: readonly T[],
  {
    search,
    status,
    template,
    window,
    now,
  }: { search: string; status: DeliveryBucket; template: string; window: HistoryWindow; now: number },
): T[] {
  const query = search.trim().toLowerCase();
  const since = windowStart(window, now);
  return deliveries.filter(
    (delivery) =>
      (status === 'all' || deliveryBucket(delivery.status) === status) &&
      (template === 'all' || delivery.template?.id === template) &&
      (since === null || Date.parse(deliveryTime(delivery)) >= since) &&
      (!query || `${delivery.toName ?? ''} ${delivery.toEmail} ${delivery.subject}`.toLowerCase().includes(query)),
  );
}

/** Newest first under a local-day key ("2026-09-28"), as the audit log groups its rows. */
export function deliveriesByDay<T extends { sentAt?: string | null; createdAt: string }>(
  deliveries: readonly T[],
  dayKey: (date: Date) => string,
): { day: string; items: T[] }[] {
  const sorted = [...deliveries].sort((a, b) => Date.parse(deliveryTime(b)) - Date.parse(deliveryTime(a)));
  const days: { day: string; items: T[] }[] = [];
  for (const delivery of sorted) {
    const day = dayKey(new Date(deliveryTime(delivery)));
    const last = days.at(-1);
    if (last?.day === day) last.items.push(delivery);
    else days.push({ day, items: [delivery] });
  }
  return days;
}

// ── Suppressions ──────────────────────────────────────────────────────────────

/** Mirrors `duma-api/src/routes/email.ts` (POST /suppressions) — its `reason` enum. */
export const SUPPRESSION_REASONS: { value: string; label: string; detail: string }[] = [
  { value: 'customer_request', label: 'Asked to stop', detail: 'The customer asked not to be emailed.' },
  { value: 'complaint', label: 'Complaint', detail: 'They complained about an email.' },
  { value: 'invalid_address', label: 'Address doesn’t work', detail: 'Mail to it bounces or it isn’t theirs.' },
  { value: 'privacy_erasure', label: 'Erased', detail: 'Removed by a privacy erasure request.' },
  { value: 'other', label: 'Other', detail: 'Any other reason.' },
];

/** And its `source` enum — how the entry was made. */
export const SUPPRESSION_SOURCES: Record<string, string> = {
  email_unsubscribe: 'Unsubscribe link',
  customer_request: 'Customer request',
  staff: 'Added by staff',
  bounce: 'Bounced',
  privacy_request: 'Privacy request',
};

/** Unknown values still read as words rather than snake_case. */
const humanise = (value: string) => {
  const text = value.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
export const suppressionReasonLabel = (value: string) =>
  SUPPRESSION_REASONS.find((reason) => reason.value === value)?.label ?? humanise(value);
export const suppressionSourceLabel = (value: string) => SUPPRESSION_SOURCES[value] ?? humanise(value);

interface SuppressionLike {
  maskedValue: string;
  reason: string;
  source: string;
  createdAt: string;
  customer?: { firstName: string; lastName: string } | null;
}

/**
 * Grouped by reason in the order above (unknown reasons last), newest first
 * within each; the search covers the name, the masked address, and the reason
 * and source as they read on screen.
 */
export function groupSuppressions<T extends SuppressionLike>(
  list: readonly T[],
  search: string,
): { reason: string; label: string; items: T[] }[] {
  const query = search.trim().toLowerCase();
  const matches = list.filter((item) => {
    if (!query) return true;
    const name = item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : '';
    return `${name} ${item.maskedValue} ${suppressionReasonLabel(item.reason)} ${suppressionSourceLabel(item.source)}`
      .toLowerCase()
      .includes(query);
  });
  const order = SUPPRESSION_REASONS.map((reason) => reason.value);
  const rank = (reason: string) => (order.includes(reason) ? order.indexOf(reason) : order.length);
  const buckets = new Map<string, T[]>();
  for (const item of matches) buckets.set(item.reason, [...(buckets.get(item.reason) ?? []), item]);
  return [...buckets.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([reason, items]) => ({
      reason,
      label: suppressionReasonLabel(reason),
      items: [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    }));
}
