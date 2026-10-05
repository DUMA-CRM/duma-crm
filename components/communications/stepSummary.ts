import type { EmailWorkflowNode } from '@/lib/modules/communications/client';

import { TRIGGER_OPTIONS } from './shared.ts';

const OPERATOR_WORDS: Record<string, string> = {
  equals: 'is',
  not_equals: 'isn’t',
  greater_than: 'is more than',
  greater_than_or_equal: 'is at least',
  less_than: 'is less than',
  less_than_or_equal: 'is at most',
  contains: 'contains',
};

const FIELD_WORDS: Record<string, string> = {
  'customer.marketingOptIn': 'the customer’s marketing opt-in',
  'customer.tier': 'the customer’s loyalty tier',
  'customer.pointsBalance': 'the customer’s points balance',
  'order.status': 'the order status',
  'order.totalAmount': 'the order total',
  'order.paymentMethod': 'the payment method',
  'staff.employmentType': 'the employee’s employment type',
  'staff.locationId': 'the employee’s location',
  'staff.role': 'the employee’s role',
};

/**
 * One sentence saying what a step does, for the top of the step panel — the
 * settings below are the how, this is the what.
 */
export function describeStep(
  node: EmailWorkflowNode,
  { templateName, locationName, staff }: { templateName: (id: string) => string; locationName?: string | null; staff: boolean },
): string {
  const who = staff ? 'the employee' : 'the customer';
  switch (node.type) {
    case 'trigger': {
      const event = TRIGGER_OPTIONS.find((option) => option.value === node.config.event)?.label ?? 'Something happens';
      const days = Math.abs(node.config.offsetDays ?? 0);
      if (node.config.event === 'customer_birthday')
        return days === 0
          ? 'Starts on each opted-in customer’s birthday.'
          : `Starts ${days} day${days === 1 ? '' : 's'} before each opted-in customer’s birthday.`;
      if (node.config.event === 'customer_inactive')
        return `Starts when an opted-in customer hasn’t visited for ${Math.max(1, days)} days.`;
      const where = node.config.event.startsWith('order_') ? (locationName ? ` at ${locationName}` : ' at any location') : '';
      return `Starts when ${event.charAt(0).toLowerCase()}${event.slice(1)}${where}.`;
    }
    case 'send_email':
      return node.config.templateId ? `Emails “${templateName(node.config.templateId)}” to ${who}.` : `Emails ${who} — choose a template.`;
    case 'delay':
      return `Waits ${node.config.amount} ${node.config.amount === 1 ? node.config.unit.replace(/s$/, '') : node.config.unit} before the next step.`;
    case 'condition': {
      const field = FIELD_WORDS[node.config.field] ?? node.config.field;
      return `If ${field} ${OPERATOR_WORDS[node.config.operator] ?? node.config.operator} “${String(node.config.value)}”, it follows Yes; otherwise No.`;
    }
    default:
      return 'This branch finishes here.';
  }
}
