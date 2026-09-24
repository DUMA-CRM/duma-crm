'use client';

import { CheckCircle2, Clock, GitCompareArrows, type IconComponent, Send, Zap } from '@/components/icons';

import type { EmailWorkflowNode } from '@/lib/modules/communications/client';
import { cn } from '@/lib/utils/cn';

import { TRIGGER_LABELS } from './shared';

/**
 * One visual language for workflow steps, shared by the automations list and the
 * editor canvas — a step has the same icon and colour wherever you meet it.
 */
type NodeType = EmailWorkflowNode['type'];

export const NODE_META: Record<NodeType, { label: string; icon: IconComponent; chip: string; ink: string }> = {
  trigger: { label: 'Trigger', icon: Zap, chip: 'bg-band text-primary', ink: 'text-primary' },
  send_email: { label: 'Send email', icon: Send, chip: 'bg-info/6 text-info', ink: 'text-info' },
  delay: { label: 'Wait', icon: Clock, chip: 'bg-warning/6 text-warning', ink: 'text-warning' },
  condition: { label: 'Condition', icon: GitCompareArrows, chip: 'bg-chart-5/10 text-chart-5', ink: 'text-chart-5' },
  end: { label: 'End', icon: CheckCircle2, chip: 'bg-band text-muted-foreground', ink: 'text-faint' },
};

/**
 * The dotted backdrop a workflow sits on.
 *
 * This was removed for a while on the argument that graph paper promises a
 * free canvas the model cannot honour — there are no coordinates, position is
 * derived from the edges. That was true when the only thing you could do to a
 * step was click it. Now that steps can be picked up and dropped between any
 * two others, the grid is describing something real: a surface you rearrange
 * things on. The problem was never the grid, it was the grid without the verb.
 */
export const DOT_GRID_STYLE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--border) 70%, transparent) 1px, transparent 1px)',
  backgroundSize: '16px 16px',
};

/** Second line of a step card: what this particular step is set to do. */
export function nodeDetail(node: EmailWorkflowNode, templateName?: (id: string) => string): string {
  switch (node.type) {
    case 'trigger':
      return TRIGGER_LABELS[node.config.event];
    case 'send_email':
      return templateName?.(node.config.templateId) ?? 'Email template';
    case 'delay':
      return `${node.config.amount} ${node.config.unit}`;
    case 'condition':
      return (
        node.config.field
          .split('.')
          .at(-1)
          ?.replaceAll(/([A-Z])/g, ' $1')
          .toLowerCase() ?? 'Condition'
      );
    default:
      return 'Finish';
  }
}

/**
 * Compact left-to-right read of a workflow for list rows: every step as a chip
 * on the dotted canvas, so a card previews the shape of the flow without
 * opening the editor. Long flows are truncated with a "+n" chip.
 */
export function FlowStrip({
  nodes,
  templateName,
  max = 6,
  className,
}: {
  nodes: EmailWorkflowNode[];
  templateName?: (id: string) => string;
  /** Steps drawn before the overflow chip takes over. */
  max?: number;
  className?: string;
}) {
  const shown = nodes.slice(0, max);
  const hidden = nodes.length - shown.length;

  return (
    <ol
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto rounded-sm border border-rule px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      style={DOT_GRID_STYLE}
    >
      {shown.map((node, index) => {
        const { icon: Icon, ink } = NODE_META[node.type];
        return (
          <li key={node.id} className="flex shrink-0 items-center gap-1.5">
            {index > 0 && <span className="h-px w-3 shrink-0 bg-border" aria-hidden="true" />}
            <span
              className="inline-flex items-center gap-1.5 rounded-sm border border-rule bg-card px-2 py-1 shadow-sm"
              title={nodeDetail(node, templateName)}
            >
              <Icon size={12} className={cn('shrink-0', ink)} aria-hidden="true" />
              <span className="max-w-32 truncate text-label font-semibold text-foreground">{nodeDetail(node, templateName)}</span>
            </span>
          </li>
        );
      })}
      {hidden > 0 && (
        <li className="flex shrink-0 items-center gap-1.5">
          <span className="h-px w-3 shrink-0 bg-border" aria-hidden="true" />
          <span className="rounded-sm border border-dashed border-rule bg-card/80 px-2 py-1 text-label font-semibold text-muted-foreground">
            +{hidden} more
          </span>
        </li>
      )}
    </ol>
  );
}
