import type { EmailAutomation, EmailTrigger, EmailWorkflowDefinition, EmailWorkflowEdge, EmailWorkflowNode } from '@/lib/api/email.service';

const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function defaultWorkflow(input?: {
  trigger?: Exclude<EmailTrigger, 'manual'>;
  templateId?: string;
  locationId?: string | null;
  offsetDays?: number;
  timezone?: string;
}): EmailWorkflowDefinition {
  const trigger: EmailWorkflowNode = {
    id: id('trigger'),
    type: 'trigger',
    name: 'Workflow trigger',
    config: {
      event: input?.trigger ?? 'order_created',
      locationId: input?.locationId ?? null,
      offsetDays: input?.offsetDays ?? 0,
      timezone: input?.timezone ?? 'Europe/London',
    },
  };
  const email: EmailWorkflowNode = {
    id: id('email'),
    type: 'send_email',
    name: 'Send email',
    config: { templateId: input?.templateId ?? '' },
  };
  const end: EmailWorkflowNode = { id: id('end'), type: 'end', name: 'End', config: {} };
  return {
    schemaVersion: 1,
    nodes: [trigger, email, end],
    edges: [
      { id: id('edge'), source: trigger.id, target: email.id, branch: 'next' },
      { id: id('edge'), source: email.id, target: end.id, branch: 'next' },
    ],
  };
}

export function workflowForAutomation(automation?: EmailAutomation): EmailWorkflowDefinition {
  return (
    automation?.definition ??
    defaultWorkflow({
      trigger: automation?.trigger,
      templateId: automation?.templateId,
      locationId: automation?.locationId,
      offsetDays: automation?.offsetDays,
      timezone: automation?.timezone,
    })
  );
}

export function workflowErrors(definition: EmailWorkflowDefinition) {
  const errors: string[] = [];
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
  const trigger = definition.nodes.filter((node) => node.type === 'trigger');
  if (trigger.length !== 1) errors.push('Use exactly one trigger.');
  if (!definition.nodes.some((node) => node.type === 'send_email')) errors.push('Add at least one email step.');
  if (!definition.nodes.some((node) => node.type === 'end')) errors.push('Add an end step.');
  // A segment trigger with no segment publishes happily and then never fires.
  // The API refuses it too; catching it here is what lets the editor say so.
  const first = trigger[0];
  if (first?.type === 'trigger' && first.config.event === 'segment_entered' && !first.config.segmentId) {
    errors.push('Choose the segment this automation watches.');
  }
  for (const node of definition.nodes) {
    if (node.type === 'send_email' && !node.config.templateId) errors.push(`Choose a template for “${node.name}”.`);
    const outgoing = definition.edges.filter((edge) => edge.source === node.id);
    if (node.type === 'condition') {
      if (!outgoing.some((edge) => edge.branch === 'yes') || !outgoing.some((edge) => edge.branch === 'no'))
        errors.push(`Connect both branches from “${node.name}”.`);
    } else if (node.type !== 'end' && outgoing.length !== 1) errors.push(`Connect “${node.name}” to one next step.`);
    if (node.type === 'end' && outgoing.length) errors.push('End nodes cannot continue.');
  }
  for (const edge of definition.edges)
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) errors.push('A connection points to a missing step.');
  if (trigger[0]) {
    const visited = new Set<string>();
    const active = new Set<string>();
    const visit = (nodeId: string) => {
      if (active.has(nodeId)) {
        errors.push('Workflow connections cannot contain a loop.');
        return;
      }
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      active.add(nodeId);
      definition.edges.filter((edge) => edge.source === nodeId).forEach((edge) => visit(edge.target));
      active.delete(nodeId);
    };
    visit(trigger[0].id);
    if (definition.nodes.some((node) => !visited.has(node.id))) errors.push('Every step must connect back to the trigger.');
  }
  return [...new Set(errors)];
}

export function insertWorkflowNode(
  definition: EmailWorkflowDefinition,
  edgeId: string,
  type: 'send_email' | 'delay' | 'condition',
  templateId = '',
) {
  const edge = definition.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return definition;
  let node: EmailWorkflowNode;
  if (type === 'send_email') node = { id: id('email'), type, name: 'Send email', config: { templateId } };
  else if (type === 'delay') node = { id: id('delay'), type, name: 'Wait', config: { amount: 1, unit: 'days' } };
  else
    node = {
      id: id('condition'),
      type,
      name: 'Check a condition',
      config: { field: 'customer.marketingOptIn', operator: 'equals', value: true },
    };

  const first: EmailWorkflowEdge = { id: id('edge'), source: edge.source, target: node.id, branch: edge.branch ?? 'next' };
  const next: EmailWorkflowEdge = { id: id('edge'), source: node.id, target: edge.target, branch: type === 'condition' ? 'yes' : 'next' };
  const nodes = [...definition.nodes, node];
  const edges = [...definition.edges.filter((candidate) => candidate.id !== edgeId), first, next];
  if (type === 'condition') {
    const noEnd: EmailWorkflowNode = { id: id('end'), type: 'end', name: 'End', config: {} };
    nodes.push(noEnd);
    edges.push({ id: id('edge'), source: node.id, target: noEnd.id, branch: 'no' });
  }
  return { ...definition, nodes, edges };
}

export function updateWorkflowNode(definition: EmailWorkflowDefinition, node: EmailWorkflowNode) {
  return { ...definition, nodes: definition.nodes.map((candidate) => (candidate.id === node.id ? node : candidate)) };
}

export function removeWorkflowNode(definition: EmailWorkflowDefinition, nodeId: string) {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.type === 'trigger' || node.type === 'end') return definition;

  const incoming = definition.edges.filter((edge) => edge.target === nodeId);
  const outgoing = definition.edges.filter((edge) => edge.source === nodeId);
  const continuation =
    node.type === 'condition'
      ? outgoing.find((edge) => edge.branch === 'yes')?.target
      : outgoing.find((edge) => edge.branch !== 'no')?.target;
  if (!continuation) return definition;

  const withoutNode = definition.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
  const reconnected = incoming.map<EmailWorkflowEdge>((edge) => ({
    id: id('edge'),
    source: edge.source,
    target: continuation,
    branch: edge.branch ?? 'next',
  }));
  const candidate = {
    ...definition,
    nodes: definition.nodes.filter((item) => item.id !== nodeId),
    edges: [...withoutNode, ...reconnected],
  };

  // Removing a condition also removes a branch. Prune only nodes that can no
  // longer be reached from the trigger, while preserving any shared steps.
  const trigger = candidate.nodes.find((item) => item.type === 'trigger');
  if (!trigger) return candidate;
  const reachable = new Set<string>();
  const visit = (currentId: string) => {
    if (reachable.has(currentId)) return;
    reachable.add(currentId);
    candidate.edges.filter((edge) => edge.source === currentId).forEach((edge) => visit(edge.target));
  };
  visit(trigger.id);
  return {
    ...candidate,
    nodes: candidate.nodes.filter((item) => reachable.has(item.id)),
    edges: candidate.edges.filter((edge) => reachable.has(edge.source) && reachable.has(edge.target)),
  };
}

/** Steps that can be picked up and dropped somewhere else. */
export const isMovableNode = (node: EmailWorkflowNode) => node.type === 'send_email' || node.type === 'delay';

/** Every node reachable from `nodeId`, itself included. */
function subtreeIds(definition: EmailWorkflowDefinition, nodeId: string) {
  const seen = new Set<string>();
  const visit = (current: string) => {
    if (seen.has(current)) return;
    seen.add(current);
    for (const edge of definition.edges.filter((candidate) => candidate.source === current)) visit(edge.target);
  };
  visit(nodeId);
  return seen;
}

/**
 * Detach a step, splicing the flow closed around it, and hand the step back.
 *
 * Unlike `removeWorkflowNode` this never prunes: the caller is about to put the
 * step back somewhere else, and pruning would delete the very node being moved.
 * Only linear steps qualify — a condition owns two branches, and dragging one
 * means dragging a subtree, which is a different (and much easier to get wrong)
 * operation than reordering.
 */
function detachNode(definition: EmailWorkflowDefinition, nodeId: string) {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || !isMovableNode(node)) return null;

  const continuation = definition.edges.find((edge) => edge.source === nodeId)?.target;
  if (!continuation) return null;

  const incoming = definition.edges.filter((edge) => edge.target === nodeId);
  const edges = definition.edges
    .filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    .concat(
      incoming.map<EmailWorkflowEdge>((edge) => ({
        id: id('edge'),
        source: edge.source,
        target: continuation,
        branch: edge.branch ?? 'next',
      })),
    );

  return {
    node,
    definition: { ...definition, nodes: definition.nodes.filter((candidate) => candidate.id !== nodeId), edges },
  };
}

/** Put an existing step on the connection leaving `afterNodeId` down `branch`. */
function attachAfter(definition: EmailWorkflowDefinition, node: EmailWorkflowNode, afterNodeId: string, branch: string) {
  const edge = definition.edges.find(
    (candidate) => candidate.source === afterNodeId && (candidate.branch ?? 'next') === branch,
  );
  if (!edge) return definition;
  return {
    ...definition,
    nodes: [...definition.nodes, node],
    edges: [
      ...definition.edges.filter((candidate) => candidate.id !== edge.id),
      { id: id('edge'), source: edge.source, target: node.id, branch: edge.branch ?? 'next' },
      { id: id('edge'), source: node.id, target: edge.target, branch: 'next' as const },
    ],
  };
}

/**
 * Move a step to sit directly after another one.
 *
 * The destination is named as "after this node, down this branch" rather than by
 * edge id, because detaching rewires the edges around the gap and any id the
 * caller was holding would already be stale by the time we used it.
 */
export function moveWorkflowNode(
  definition: EmailWorkflowDefinition,
  nodeId: string,
  afterNodeId: string,
  branch = 'next',
): EmailWorkflowDefinition {
  if (nodeId === afterNodeId) return definition;
  // Dropping a step inside its own downstream would cut the flow loose from the
  // trigger, so the drop is refused rather than repaired.
  if (subtreeIds(definition, nodeId).has(afterNodeId)) return definition;

  const detached = detachNode(definition, nodeId);
  if (!detached) return definition;
  return attachAfter(detached.definition, detached.node, afterNodeId, branch);
}

/** Copy a step in directly below itself. Linear steps only, same as moving. */
export function duplicateWorkflowNode(definition: EmailWorkflowDefinition, nodeId: string): EmailWorkflowDefinition {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || !isMovableNode(node)) return definition;
  const copy = { ...node, id: id(node.type), name: `${node.name} copy` } as EmailWorkflowNode;
  return attachAfter(definition, copy, nodeId, 'next');
}

export function orderedWorkflowNodes(definition: EmailWorkflowDefinition) {
  const ordered: EmailWorkflowNode[] = [];
  const visited = new Set<string>();
  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    const node = definition.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    visited.add(nodeId);
    ordered.push(node);
    const outgoing = definition.edges.filter((edge) => edge.source === nodeId);
    const edges = node.type === 'condition' ? [...outgoing].sort((a) => (a.branch === 'yes' ? -1 : 1)) : outgoing;
    edges.forEach((edge) => visit(edge.target));
  };
  const trigger = definition.nodes.find((node) => node.type === 'trigger');
  if (trigger) visit(trigger.id);
  return ordered;
}

export function workflowSummary(definition: EmailWorkflowDefinition, templateName: (id: string) => string) {
  const counts = {
    email: definition.nodes.filter((node) => node.type === 'send_email').length,
    delay: definition.nodes.filter((node) => node.type === 'delay').length,
    condition: definition.nodes.filter((node) => node.type === 'condition').length,
  };
  const firstEmail = orderedWorkflowNodes(definition).find((node) => node.type === 'send_email');
  return `${counts.email} email${counts.email === 1 ? '' : 's'}${counts.delay ? ` · ${counts.delay} wait${counts.delay === 1 ? '' : 's'}` : ''}${counts.condition ? ` · ${counts.condition} condition${counts.condition === 1 ? '' : 's'}` : ''}${firstEmail?.type === 'send_email' ? ` · starts with “${templateName(firstEmail.config.templateId)}”` : ''}`;
}
