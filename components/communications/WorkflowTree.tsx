'use client';

import { useState } from 'react';

import { Copy, Menu, Plus, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { EmailWorkflowDefinition, EmailWorkflowNode } from '@/lib/api/email.service';
import { cn } from '@/lib/utils/cn';

import { NODE_META, nodeDetail } from './workflowNodes';
import { isMovableNode } from './workflowModel';

/**
 * The workflow, drawn as the tree it actually is.
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

export type InsertType = 'send_email' | 'delay' | 'condition';

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

    return (
      <div className="flex min-w-60 flex-col items-center">
        <StepCard
          node={node}
          templateName={templateName}
          selected={node.id === selectedId}
          dragging={dragging === node.id}
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
                        branch === 'yes' ? 'bg-momentum/8 text-momentum' : 'bg-band text-muted-foreground',
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
          connector(edges[0].branch ?? 'next', definition.nodes.find((candidate) => candidate.id === edges[0]!.target))
        ) : null}
      </div>
    );
  };

  return <div className="flex min-w-max justify-center">{render(trigger, new Set())}</div>;
}

// ── The connection between two steps ──────────────────────────────────────

/**
 * A connection is three things at once: the line, the insert button, and — while
 * something is being dragged — the drop zone. It grows and lights up during a
 * drag so the places a step can land are obvious rather than discovered.
 */
function Connection({
  target,
  isDragging,
  isOver,
  onOver,
  onLeave,
  onDrop,
  onInsert,
}: {
  target: DropTarget;
  isDragging: boolean;
  isOver: boolean;
  onOver: (target: DropTarget) => void;
  onLeave: () => void;
  onDrop: (target: DropTarget) => void;
  onInsert: (type: InsertType) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn('relative flex flex-col items-center transition-[height] duration-150', isDragging ? 'h-16' : 'h-15')}
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
            'flex h-full w-56 items-center justify-center rounded-sm border-2 border-dashed transition-colors',
            isOver ? 'border-primary bg-primary/8 text-primary' : 'border-rule text-muted-foreground',
          )}
        >
          <span className="text-xs font-semibold">{isOver ? 'Drop here' : 'Drop'}</span>
        </div>
      ) : (
        <>
          <span className="h-5 w-px bg-rule" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Insert a step on this connection"
            className="flex size-6 items-center justify-center rounded-full border border-rule bg-card text-primary shadow-sm transition-colors hover:border-primary hover:bg-band focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
          <span className="h-4 w-px bg-rule" aria-hidden="true" />
          {open && (
            <div className="absolute left-8 top-3 z-20 flex w-44 flex-col rounded-sm border border-rule bg-surface p-1 shadow-lg">
              {(
                [
                  ['send_email', 'Send email'],
                  ['delay', 'Wait'],
                  ['condition', 'Condition'],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onInsert(type);
                    setOpen(false);
                  }}
                  className="rounded-sm px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-band"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
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
      <span className="h-4 w-px bg-rule" />
      <div className={BRANCH_GRID}>
        {(['left', 'right'] as const).map((side) => (
          <div key={side} className="relative h-4">
            <span className={cn('absolute top-0 h-px bg-rule', side === 'left' ? 'left-1/2 -right-4' : '-left-4 right-1/2')} />
            <span className="absolute left-1/2 top-0 h-full w-px bg-rule" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The step itself ───────────────────────────────────────────────────────

function StepCard({
  node,
  templateName,
  selected,
  dragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onDuplicate,
  onRemove,
}: {
  node: EmailWorkflowNode;
  templateName?: (id: string) => string;
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  // Icon and colour come from the shared step language, so a step looks the same
  // here as it does on its automation card in the list.
  const { icon: Icon, chip } = NODE_META[node.type];
  const movable = isMovableNode(node);
  const removable = node.type !== 'trigger' && node.type !== 'end';

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
        'group/step relative flex w-64 items-center gap-2 rounded-sm border bg-card p-3 text-left shadow-sm',
        'transition-[border-color,box-shadow,opacity] duration-150',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-rule hover:border-primary/40',
        dragging && 'opacity-40',
      )}
    >
      {movable ? (
        <span
          className="-ml-1 shrink-0 cursor-grab text-muted-foreground/60 transition-colors group-hover/step:text-muted-foreground active:cursor-grabbing"
          aria-hidden="true"
        >
          <Menu size={14} />
        </span>
      ) : (
        <span className="-ml-1 w-3.5 shrink-0" aria-hidden="true" />
      )}

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-sm', chip)}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{node.name}</span>
          <span className="block truncate text-label text-muted-foreground">{nodeDetail(node, templateName)}</span>
        </span>
      </button>

      {/* Row actions appear on hover or keyboard focus — always-visible icons on
          every card turn a readable flow into a control panel. */}
      {(movable || removable) && (
        <span className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/step:opacity-100">
          {movable && (
            <Button variant="ghost" size="icon-xs" onClick={onDuplicate} aria-label={`Duplicate ${node.name}`} title="Duplicate">
              <Copy />
            </Button>
          )}
          {removable && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              aria-label={`Remove ${node.name}`}
              title="Remove"
              className="text-muted-foreground hover:text-exception"
            >
              <Trash2 />
            </Button>
          )}
        </span>
      )}
    </div>
  );
}
