import type { EmailWorkflowNode } from '@/lib/modules/communications/client';

import { conditionSentence } from '../../lib/utils/workflow-conditions.ts';

import { TRIGGER_OPTIONS } from './shared.ts';

/**
 * One sentence saying what a step does, for the top of the step panel — the
 * settings below are the how, this is the what.
 */
export function describeStep(
  node: EmailWorkflowNode,
  {
    templateName,
    locationName,
    staff,
    booking = false,
  }: { templateName: (id: string) => string; locationName?: string | null; staff: boolean; booking?: boolean },
): string {
  const who = staff ? 'the employee' : booking ? 'the guest' : 'the customer';
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
      if (node.config.event === 'reservation_reminder') {
        const hours = node.config.offsetHours ?? 24;
        return `Starts ${hours} hour${hours === 1 ? '' : 's'} before each booking${locationName ? ` at ${locationName}` : ''}.`;
      }
      const scoped = node.config.event.startsWith('order_') || node.config.event.startsWith('reservation_');
      const where = scoped ? (locationName ? ` at ${locationName}` : ' at any location') : '';
      return `Starts when ${event.charAt(0).toLowerCase()}${event.slice(1)}${where}.`;
    }
    case 'create_task':
      return 'Creates an internal helpdesk task for your team. Requires helpdesk management permission.';
    case 'send_email':
      return node.config.templateId ? `Emails “${templateName(node.config.templateId)}” to ${who}.` : `Emails ${who} — choose a template.`;
    case 'delay':
      return `Waits ${node.config.amount} ${node.config.amount === 1 ? node.config.unit.replace(/s$/, '') : node.config.unit} before the next step.`;
    case 'condition': {
      return `If ${conditionSentence(node.config)}, it follows Yes; otherwise No.`;
    }
    default:
      return 'This branch finishes here.';
  }
}
