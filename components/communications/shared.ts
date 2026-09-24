// Shared constants and label helpers for the Communications feature.
import type { EmailAutomation, EmailDelivery } from '@/lib/modules/communications/client';

export const labelClass = 'text-xs font-bold uppercase tracking-widest text-muted-foreground';

export const textareaClass =
  'w-full rounded-lg border border-input bg-field px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';

export const panelClass = 'rounded-2xl border border-border bg-card p-5';

type Trigger = EmailAutomation['trigger'];

/** Short label for lists and badges. */
export const TRIGGER_LABELS: Record<Trigger, string> = {
  order_created: 'Order created',
  order_ready: 'Order ready',
  order_completed: 'Order completed',
  order_cancelled: 'Order cancelled',
  customer_created: 'New customer',
  customer_birthday: 'Customer birthday',
  customer_inactive: 'Customer inactive',
  segment_entered: 'Enters a segment',
};

/** Sentence used in the trigger dropdown — reads as "send when…". */
export const TRIGGER_OPTIONS: { value: Trigger; label: string }[] = [
  { value: 'order_created', label: 'An order is placed' },
  { value: 'order_ready', label: 'An order is ready for collection' },
  { value: 'order_completed', label: 'An order is completed' },
  { value: 'order_cancelled', label: 'An order is cancelled' },
  { value: 'customer_created', label: 'A new customer is added' },
  { value: 'customer_birthday', label: "It is a customer's birthday" },
  { value: 'customer_inactive', label: 'A customer has not visited for a while' },
  { value: 'segment_entered', label: 'A customer enters a segment' },
];

/** Plain-language explanation shown under the trigger dropdown. */
export const TRIGGER_HELP: Record<Trigger, string> = {
  order_created: 'Sent once per order, as soon as the order is created in the POS.',
  order_ready: 'Sent once per order, the moment its status changes to ready.',
  order_completed: 'Sent once per order, when the order is marked completed.',
  order_cancelled: 'Sent once per order, if the order is cancelled.',
  customer_created: 'Sent once, when a customer profile is first created.',
  customer_birthday: 'Sent once a year to opted-in customers, on the day you choose.',
  customer_inactive: 'Sent once per inactive spell to opted-in customers. A new visit resets the clock.',
  segment_entered:
    'Checked hourly. Only customers who start matching after you publish are sent to — everybody already in the segment is left alone.',
};

/** Which triggers need customers to have opted in to marketing email. */
export const OPT_IN_TRIGGERS: Trigger[] = ['customer_birthday', 'customer_inactive'];

export const deliveryBadge: Record<EmailDelivery['status'], 'muted' | 'primary' | 'success' | 'destructive' | 'warning'> = {
  queued: 'muted',
  sending: 'primary',
  sent: 'success',
  failed: 'destructive',
  cancelled: 'warning',
};

/** "Order created · Order confirmation" style summary for automation rows. */
export function describeTiming(trigger: Trigger, offsetDays: number): string {
  if (trigger === 'customer_birthday') {
    const days = Math.abs(offsetDays);
    return days === 0 ? 'on the day' : `${days} ${days === 1 ? 'day' : 'days'} before`;
  }
  if (trigger === 'customer_inactive') return `after ${Math.max(1, offsetDays)} days without a visit`;
  return 'immediately';
}

/** One sentence describing exactly what an automation will do. */
export function describeAutomation({
  trigger,
  offsetDays,
  templateName,
  locationName,
}: {
  trigger: Trigger;
  offsetDays: number;
  templateName?: string;
  locationName?: string | null;
}): string {
  const template = templateName ? `“${templateName}”` : 'the chosen template';
  const where = locationName ? `at ${locationName}` : 'at any location';
  if (trigger === 'customer_birthday') {
    const days = Math.abs(offsetDays);
    const when = days === 0 ? 'on their birthday' : `${days} ${days === 1 ? 'day' : 'days'} before their birthday`;
    return `Emails ${template} to each opted-in customer ${when}.`;
  }
  if (trigger === 'customer_inactive') {
    return `Emails ${template} to an opted-in customer once they have not visited for ${Math.max(1, offsetDays)} days.`;
  }
  const event = TRIGGER_OPTIONS.find((option) => option.value === trigger)?.label.toLowerCase() ?? 'the event happens';
  return `Emails ${template} to the customer as soon as ${event} ${where}.`;
}

// ── Template categories ─────────────────────────────────────────────────────

/**
 * A fixed list, not free text.
 *
 * Category used to be any string up to 50 characters, typed into a combobox that
 * suggested whatever had been typed before. That guarantees drift — "Orders",
 * "orders" and "Order updates" become three groups on the templates tab — and it
 * offers no way to rename or remove one, because a category is not a record: it
 * exists only while some template still says that word. A typo was permanent.
 *
 * Five buckets, mapped to the triggers that exist. A café will own perhaps a
 * dozen templates in its life; an unbounded taxonomy for a dozen things is
 * complexity nobody is buying.
 */
export const TEMPLATE_CATEGORIES = [
  { value: 'orders', label: 'Orders', hint: 'Receipts, ready for collection, cancellations' },
  { value: 'loyalty', label: 'Loyalty', hint: 'Points awarded, tier changes' },
  { value: 'marketing', label: 'Marketing', hint: 'Campaigns, offers, win-backs' },
  { value: 'lifecycle', label: 'Lifecycle', hint: 'Welcome notes, birthdays' },
  { value: 'general', label: 'General', hint: 'Anything that does not fit the rest' },
] as const;

export const DEFAULT_TEMPLATE_CATEGORY = 'general';

/**
 * Display name for a stored category.
 *
 * Falls back to the raw value so a template saved under an older, free-text
 * category still reads sensibly and stays editable, rather than disappearing
 * from a list it no longer matches.
 */
export const templateCategoryLabel = (value: string) => TEMPLATE_CATEGORIES.find((category) => category.value === value)?.label ?? value;
