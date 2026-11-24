'use client';

import { useState } from 'react';

import { ActionRow, RowMenu } from '@/components/shared/rows';
import { Copy, GripVertical, Plus, Trash2, TriangleAlert } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import type { EmailWorkflowDefinition, EmailWorkflowNode } from '@/lib/modules/communications/client';
import { cn } from '@/lib/utils/cn';

import { isMovableNode } from './workflowModel';
import { NODE_META, type TriggerNames, nodeDetail } from './workflowNodes';

/**
 * The workflow, drawn as the tree it actually is: one vertical flow of step
 * cards from the trigger down, a "+" on every connection, a condition splitting
 * into its Yes and No columns. A step's settings open in the editor's sidebar.
 *
 * Layout is derived, never stored: a step's position comes entirely from the
 * edges, so the tree cannot drift out of agreement with the graph and a flow can
 * never be visually valid but logically broken. What it gains instead of free
 * positioning are the moves a tree can actually honour — pick a step up and drop
 * it between any two others, insert on any connection, duplicate, delete. That
 * missing verb is what used to make the editor feel static; the dot grid it sits
 * on now describes something true.
 *
 * Conditions are deliberately not draggable. A condition owns two branches, so
 * moving one means moving a subtree — a different operation from reordering, and
 * one that quietly orphans steps when it goes wrong. Refusing it is honest;
 * pretending otherwise is how a flow ends up unreachable from its trigger.
 */

export type InsertType = 'send_email' | 'send_telegram' | 'create_task' | 'delay' | 'condition';

/** Where a drop would land: after this node, down this branch. */
interface DropTarget {
  afterNodeId: string;
  branch: string;
}

interface Props {
  definition: EmailWorkflowDefinition;
  selectedId: string;
  onSelect: (id: string) => void;
  onInsert: (afterNodeId: string, branch: string, type: InsertType) => void;
  onMove: (nodeId: string, afterNodeId: string, branch: string) => void;
  onDuplicate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  /** Resolves a template id to its name for the step's second line. */
  templateName?: (id: string) => string;
  /** Names for a trigger's location and segment, so its step reads "Order placed · at North Street". */
  triggerNames?: TriggerNames;
  /** A new workflow whose event isn't chosen yet: its trigger step says so instead of the placeholder event. */
  triggerPending?: boolean;
  /** What's wrong with each step, by id — outlined on its card, the reason on hover. */
  issues?: ReadonlyMap<string, string[]>;
  /** View only: steps can be selected to read, but not added, moved, copied or removed. */
  readOnly?: boolean;
}

/** The two branch columns under a condition; BranchConnector mirrors this gap. */
const BRANCH_GRID = 'grid w-full grid-cols-2 gap-8';

export function WorkflowTree({
  definition,
  selectedId,
  onSelect,
  onInsert,
  onMove,
  onDuplicate,
  onRemove,
  templateName,
  triggerNames,
  triggerPending = false,
  issues,
  readOnly = false,
}: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);

  const trigger = definition.nodes.find((node) => node.type === 'trigger');
  if (!trigger) return <p className="text-sm text-exception">Add a trigger to continue.</p>;

  const drop = (target: DropTarget) => {
    if (dragging) onMove(dragging, target.afterNodeId, target.branch);
    setDragging(null);
    setOver(null);
  };

  const render = (node: EmailWorkflowNode, visited: Set<string>): React.ReactNode => {
    if (visited.has(node.id)) return null;
    const nextVisited = new Set(visited).add(node.id);
    const edges = definition.edges.filter((edge) => edge.source === node.id);

    const connector = (branch: string, target?: EmailWorkflowNode) => (
      <>
        <Connection
          readOnly={readOnly}
          target={{ afterNodeId: node.id, branch }}
          isDragging={Boolean(dragging)}
          isOver={over?.afterNodeId === node.id && over.branch === branch}
          onOver={setOver}
          onLeave={() => setOver(null)}
          onDrop={drop}
          onInsert={(type) => onInsert(node.id, branch, type)}
        />
        {target && render(target, nextVisited)}
      </>
    );

    // An end is where a branch stops, not a step to configure: a quiet marker, still selectable.
    if (node.type === 'end')
      return (
        <div className="flex flex-col items-center">
          <EndMarker selected={node.id === selectedId} onSelect={() => onSelect(node.id)} />
        </div>
      );

    return (
      <div className="flex min-w-64 flex-col items-center">
        <StepCard
          node={node}
          templateName={templateName}
          triggerNames={triggerNames}
          triggerPending={triggerPending}
          issues={issues?.get(node.id)}
          selected={node.id === selectedId}
          dragging={dragging === node.id}
          readOnly={readOnly}
          onSelect={() => onSelect(node.id)}
          onDragStart={() => setDragging(node.id)}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          onDuplicate={() => onDuplicate(node.id)}
          onRemove={() => onRemove(node.id)}
        />

        {node.type === 'condition' ? (
          <>
            <BranchConnector />
            <div className={BRANCH_GRID}>
              {(['yes', 'no'] as const).map((branch) => {
                const edge = edges.find((candidate) => candidate.branch === branch);
                const target = edge && definition.nodes.find((candidate) => candidate.id === edge.target);
                return (
                  <div key={branch} className="flex flex-col items-center">
                    <span
                      className={cn(
                        'rounded-sm px-2 py-0.5 text-micro font-semibold uppercase tracking-micro',
                        branch === 'yes' ? 'bg-momentum/10 text-momentum' : 'bg-band text-muted-foreground',
                      )}
                    >
                      {branch}
                    </span>
                    {edge && connector(branch, target)}
                  </div>
                );
              })}
            </div>
          </>
        ) : edges[0] ? (
          connector(
            edges[0].branch ?? 'next',
            definition.nodes.find((candidate) => candidate.id === edges[0]!.target),
          )
        ) : null}
      </div>
    );
  };

  return <div className="flex min-w-max justify-center">{render(trigger, new Set())}</div>;
}

// ── The connection between two steps ──────────────────────────────────────

const INSERT_OPTIONS: ReadonlyArray<readonly [InsertType, string]> = [
  ['send_email', 'Send email'],
  ['send_telegram', 'Send Telegram message'],
  ['create_task', 'Create helpdesk task'],
  ['delay', 'Wait'],
  ['condition', 'Condition'],
];

/**
 * A connection is three things at once: the line, the "+" that inserts a step
 * on it, and — while a step is being dragged — the place it can land.
 */
function Connection({
  readOnly,
  target,
  isDragging,
  isOver,
  onOver,
  onLeave,
  onDrop,
  onInsert,
}: {
  readOnly: boolean;
  target: DropTarget;
  isDragging: boolean;
  isOver: boolean;
  onOver: (target: DropTarget) => void;
  onLeave: () => void;
  onDrop: (target: DropTarget) => void;
  onInsert: (type: InsertType) => void;
}) {
  const [open, setOpen] = useState(false);

  // Nothing to insert or drop onto — just the line between two steps.
  if (readOnly) return <span className="h-8 w-px bg-border" aria-hidden="true" />;

  return (
    <div
      className="relative flex h-14 flex-col items-center"
      onDragOver={(event) => {
        if (!isDragging) return;
        event.preventDefault();
        onOver(target);
      }}
      onDragLeave={onLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(target);
      }}
    >
      {isDragging ? (
        <div
          className={cn(
            'my-1.5 flex w-56 flex-1 items-center justify-center rounded-md border border-dashed text-xs font-semibold transition-colors',
            isOver ? 'border-primary bg-primary/6 text-primary' : 'border-border text-muted-foreground',
          )}
        >
          {isOver ? 'Drop here' : 'Move here'}
        </div>
      ) : (
        <>
          <span className="w-px flex-1 bg-border" aria-hidden="true" />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Add a step here"
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border bg-card shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  open
                    ? 'border-primary/50 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary',
                )}
              >
                <Plus size={13} aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-60 p-2">
              <div className="flex flex-col gap-0.5">
                {INSERT_OPTIONS.map(([type, label]) => (
                  <ActionRow
                    key={type}
                    icon={NODE_META[type].icon}
                    label={label}
                    onClick={() => {
                      setOpen(false);
                      onInsert(type);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <span className="w-px flex-1 bg-border" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

/**
 * Joins a condition card to its yes/no columns: a stem down from the card, a rail
 * across to each branch, and a drop into it. The rail repeats BRANCH_GRID so each
 * half ends at its own column's centre, and each half reaches `-4` (half the
 * grid's `gap-8`) past its cell — otherwise the gap leaves the rail split in two
 * directly under the stem.
 */
function BranchConnector() {
  return (
    <div className="flex w-full flex-col items-center" aria-hidden="true">
      <span className="h-4 w-px bg-border" />
      <div className={BRANCH_GRID}>
        {(['left', 'right'] as const).map((side) => (
          <div key={side} className="relative h-4">
            <span className={cn('absolute top-0 h-px bg-border', side === 'left' ? 'left-1/2 -right-4' : '-left-4 right-1/2')} />
            <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Where a branch stops. */
function EndMarker({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-full border px-3 py-1 text-label font-semibold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-ring',
        selected ? 'border-primary/50 bg-primary/6 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      End
    </button>
  );
}

// ── The step itself ───────────────────────────────────────────────────────

function StepCard({
  node,
  templateName,
  triggerNames,
  triggerPending,
  issues,
  selected,
  dragging,
  readOnly,
  onSelect,
  onDragStart,
  onDragEnd,
  onDuplicate,
  onRemove,
}: {
  node: EmailWorkflowNode;
  templateName?: (id: string) => string;
  triggerNames?: TriggerNames;
  triggerPending?: boolean;
  issues?: string[];
  selected: boolean;
  dragging: boolean;
  readOnly: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  // Icon and colour come from the shared step language, so a step looks the same
  // here as it does on its automation card in the list.
  const { icon: Icon, chip } = NODE_META[node.type];
  const movable = !readOnly && isMovableNode(node);
  const removable = !readOnly && node.type !== 'trigger' && node.type !== 'end';

  return (
    <div
      draggable={movable}
      onDragStart={(event) => {
        if (!movable) return;
        // Firefox refuses to start a drag without data on the transfer.
        event.dataTransfer.setData('text/plain', node.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group/step relative flex w-64 items-center gap-1 rounded-lg border bg-card py-2.5 pr-1.5 pl-3 shadow-sm',
        'transition-[border-color,box-shadow,opacity] duration-150',
        selected
          ? cn('ring-2', issues?.length ? 'border-exception/50 ring-exception/10' : 'border-primary/50 ring-primary/10')
          : issues?.length
            ? 'border-exception/40'
            : 'border-border hover:border-primary/30',
        movable && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      {/* The whole card drags; the grip only says so, on hover. */}
      {movable && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-6 hidden -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover/step:opacity-100 pointer-fine:block"
        >
          <GripVertical size={14} />
        </span>
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', chip)}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{node.name}</span>
            {issues?.length ? (
              <Tooltip side="top" wrap label={issues.join(' ')}>
                <span className="shrink-0 text-exception" aria-label={`Needs attention: ${issues.join(' ')}`}>
                  <TriangleAlert size={13} />
                </span>
              </Tooltip>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {node.type === 'trigger' && triggerPending ? 'Choose an event' : nodeDetail(node, templateName, triggerNames)}
          </span>
        </span>
      </button>

      {(movable || removable) && (
        <RowMenu
          label={`${node.name} actions`}
          items={[
            ...(movable ? [{ icon: Copy, label: 'Duplicate', onClick: onDuplicate }] : []),
            ...(removable ? [{ icon: Trash2, label: 'Remove', danger: true, onClick: onRemove }] : []),
          ]}
        />
      )}
    </div>
  );
}
