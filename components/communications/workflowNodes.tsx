'use client';

import { CheckCircle2, Clock, GitCompareArrows, type IconComponent, Send, Zap } from '@/components/icons';

import type { EmailWorkflowNode } from '@/lib/modules/communications/client';
import { triggerOptionsInWords } from '@/lib/utils/communications';
import { conditionSentence } from '@/lib/utils/workflow-conditions';

import { TRIGGER_LABELS } from './shared';

/**
 * One visual language for workflow steps, shared by the automations list and the
 * editor canvas — a step has the same icon and colour wherever you meet it.
 */
type NodeType = EmailWorkflowNode['type'];

export const NODE_META: Record<NodeType, { label: string; icon: IconComponent; chip: string; ink: string }> = {
  trigger: { label: 'Trigger', icon: Zap, chip: 'bg-band text-primary', ink: 'text-primary' },
  create_task: { label: 'Create task', icon: CheckCircle2, chip: 'bg-momentum/6 text-momentum', ink: 'text-momentum' },
  send_telegram: { label: 'Send Telegram message', icon: Send, chip: 'bg-info/6 text-info', ink: 'text-info' },
  send_email: { label: 'Send email', icon: Send, chip: 'bg-info/6 text-info', ink: 'text-info' },
  delay: { label: 'Wait', icon: Clock, chip: 'bg-warning/6 text-warning', ink: 'text-warning' },
  condition: { label: 'Condition', icon: GitCompareArrows, chip: 'bg-chart-5/10 text-chart-5', ink: 'text-chart-5' },
  end: { label: 'End', icon: CheckCircle2, chip: 'bg-band text-muted-foreground', ink: 'text-faint' },
};

/** Looks up the names a trigger's options point at. */
export interface TriggerNames {
  location?: (id: string) => string | undefined;
  segment?: (id: string) => string | undefined;
}

/** Second line of a step card: what this particular step is set to do. */
export function nodeDetail(node: EmailWorkflowNode, templateName?: (id: string) => string, triggerNames?: TriggerNames): string {
  switch (node.type) {
    case 'trigger':
      // The event, then what narrows or times it — read here, set in the panel.
      return [
        TRIGGER_LABELS[node.config.event],
        ...triggerOptionsInWords(node.config, {
          location: node.config.locationId ? triggerNames?.location?.(node.config.locationId) : null,
          segment: node.config.segmentId ? triggerNames?.segment?.(node.config.segmentId) : null,
        }),
      ].join(' · ');
    case 'create_task':
      return node.config.subject || 'Helpdesk task';
    case 'send_telegram':
      return node.config.message || 'Message your staff chat';
    case 'send_email':
      return templateName?.(node.config.templateId) ?? 'Email template';
    case 'delay':
      return `${node.config.amount} ${node.config.unit}`;
    case 'condition': {
      // The check as a sentence, as the panel words it — "Loyalty tier is Gold".
      const sentence = conditionSentence(node.config, { locationName: (id) => triggerNames?.location?.(id) });
      return sentence.charAt(0).toUpperCase() + sentence.slice(1);
    }
    default:
      return 'Finish';
  }
}
