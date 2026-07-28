// Shared constants and label helpers for the Communications feature.
import type { EmailAutomation, EmailDelivery } from '@/lib/api/email.service';

export const labelClass = 'text-xs font-bold uppercase tracking-widest text-muted-foreground';

export const textareaClass =
  'w-full rounded-lg border border-transparent bg-surface-offset px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';

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
