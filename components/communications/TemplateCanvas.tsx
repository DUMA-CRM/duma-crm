'use client';

import { useEffect, useRef, useState } from 'react';

import { RowMenu } from '@/components/cms/rows';
import {
  ArrowDown,
  ArrowUp,
  Code,
  Copy,
  FileText,
  Globe,
  GripVertical,
  ImagePlus,
  Link2,
  ListView,
  Minus,
  Plus,
  Trash2,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils/cn';

import { EmailImage } from './EmailImage';
import {
  COLUMN_LAYOUTS,
  type ColumnsLayout,
  type DropContainer,
  type TemplateBlock,
  type TemplateColumnsBlock,
  type TemplateDesign,
  type TemplateLeafBlock,
  cloneBlock,
  findTemplateBlock,
  insertTemplateBlock,
  isColumnsBlock,
  layoutWidths,
  moveTemplateBlock,
  newColumnsBlock,
  newLeafBlock,
  nudgeTemplateBlock,
  removeTemplateBlock,
  updateTemplateBlock,
} from './templateDesign';

/** What is being dragged — an existing block (moved by its grip) — or what a "+" adds. */
export type DragPayload = { kind: 'new'; type: TemplateBlock['type']; layout?: ColumnsLayout } | { kind: 'move'; blockId: string };

/** Builds the block a "+" asked for. */
export const blockFromPayload = (payload: Extract<DragPayload, { kind: 'new' }>): TemplateBlock =>
  payload.type === 'columns' ? newColumnsBlock(payload.layout ?? 'two-equal') : newLeafBlock(payload.type);

const BLOCK_CHOICES: Array<{ type: TemplateLeafBlock['type']; label: string; icon: IconComponent }> = [
  { type: 'heading', label: 'Heading', icon: FileText },
  { type: 'text', label: 'Text', icon: ListView },
  { type: 'button', label: 'Button', icon: Link2 },
  { type: 'image', label: 'Image', icon: ImagePlus },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'spacer', label: 'Spacer', icon: ArrowDown },
  { type: 'social', label: 'Social', icon: Globe },
  { type: 'html', label: 'HTML', icon: Code },
];

type NewBlock = Extract<DragPayload, { kind: 'new' }>;

/**
 * What a "+" offers: the content blocks, then — on the page itself, never inside
 * a column — a row of columns by its shape. Clicks inside never reach the block
 * the "+" sits on, so choosing selects the new block, not the old one.
 */
function AddBlockMenu({
  columns,
  onPick,
  children,
}: {
  /** Offer column rows too (only on the page, not inside a column). */
  columns: boolean;
  onPick: (payload: NewBlock) => void;
  /** The trigger button. */
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const pick = (payload: NewBlock) => {
    setOpen(false);
    onPick(payload);
  };
  return (
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent align="center" className="w-64 p-2">
          {/* Compact choices: a small icon and the name — a full action row leaves no room for the word in half a popover. */}
          <div className="grid grid-cols-2 gap-0.5">
            {BLOCK_CHOICES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => pick({ kind: 'new', type })}
                className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Icon size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">{label}</span>
              </button>
            ))}
          </div>
          {columns && (
            <>
              <p className="mt-2 px-2 pb-1.5 text-label uppercase text-muted-foreground">Columns</p>
              <div className="grid grid-cols-2 gap-1.5 px-1 pb-1">
                {COLUMN_LAYOUTS.map(({ value, label, widths }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pick({ kind: 'new', type: 'columns', layout: value })}
                    title={label}
                    aria-label={`Add a ${label} row`}
                    className="flex h-9 items-stretch gap-1 rounded-md border border-border bg-background p-1.5 transition-colors hover:border-primary/40 hover:bg-primary/6 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {widths.map((width, index) => (
                      <span key={index} style={{ width: `${width}%` }} className="rounded-sm bg-band" aria-hidden="true" />
                    ))}
                  </button>
                ))}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
}

const HIGHLIGHT_NAME = 'template-variable';
const HIGHLIGHT_STYLE_ID = 'template-variable-highlight-style';
const VARIABLE_TOKEN = /\{\{[^{}]+\}\}/g;

function ensureVariableHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  // Kept at runtime because the current Next.js CSS optimiser rejects the
  // standards-based custom-highlight pseudo-element during production builds.
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) { background-color: color-mix(in oklab, var(--reference) 14%, transparent); color: var(--reference); }`;
  document.head.append(style);
}

/**
 * Tints every {{merge.field}} in the canvas with the app accent, so placeholders
 * read as placeholders rather than literal copy. Uses the CSS Custom Highlight
 * API — no wrapper elements, so the editable text stays plain and the caret is
 * unaffected. Browsers without the API simply render the token unstyled.
 */
function useVariableHighlight(root: React.RefObject<HTMLElement | null>, design: TemplateDesign) {
  useEffect(() => {
    const node = root.current;
    if (!node || typeof CSS === 'undefined' || !CSS.highlights) return;
    ensureVariableHighlightStyle();

    const ranges: Range[] = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      for (const match of (text.nodeValue ?? '').matchAll(VARIABLE_TOKEN)) {
        if (match.index === undefined) continue;
        const range = document.createRange();
        range.setStart(text, match.index);
        range.setEnd(text, match.index + match[0].length);
        ranges.push(range);
      }
    }

    if (!ranges.length) {
      CSS.highlights.delete(HIGHLIGHT_NAME);
      return;
    }
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
    return () => {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    };
    // Re-scanned on every design change, which covers typing, drops and reorders.
  }, [root, design]);
}

export interface CanvasDnd {
  /** Live payload — a ref so drag handlers read it without re-rendering. */
  payload: React.RefObject<DragPayload | null>;
  /** True between dragstart and dragend, so drop slots can show themselves. */
  dragging: boolean;
  start: (payload: DragPayload) => void;
  end: () => void;
}

/**
 * The email itself, as a direct-manipulation surface: text is edited in place,
 * a "+" under any block adds the next one, blocks are dragged by their grip,
 * and column rows take content per cell.
 */
export function TemplateCanvas({
  design,
  selectedId,
  onSelect,
  onChange,
  dnd,
  onRequestImage,
}: {
  design: TemplateDesign;
  selectedId: string;
  onSelect: (id: string) => void;
  onChange: (design: TemplateDesign) => void;
  dnd: CanvasDnd;
  /** Finds an image for an image block: the media library, or a file from this device. */
  onRequestImage: (blockId: string) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useVariableHighlight(sheetRef, design);

  // A row can only live on the page, never inside another column.
  const accepts = (container: DropContainer) => {
    const payload = dnd.payload.current;
    if (!payload) return false;
    if (container.kind === 'root') return true;
    if (payload.kind === 'new') return payload.type !== 'columns';
    const block = findTemplateBlock(design, payload.blockId);
    return Boolean(block) && !isColumnsBlock(block!);
  };

  const drop = (container: DropContainer, index: number) => {
    const payload = dnd.payload.current;
    if (!payload || !accepts(container)) return;
    if (payload.kind === 'new') {
      const block = blockFromPayload(payload);
      onChange(insertTemplateBlock(design, block, container, index));
      onSelect(block.id);
    } else {
      onChange(moveTemplateBlock(design, payload.blockId, container, index));
      onSelect(payload.blockId);
    }
    dnd.end();
  };

  /** A new block at this spot, selected so its settings open. */
  const add = (container: DropContainer, index: number, payload: NewBlock) => {
    const block = blockFromPayload(payload);
    onChange(insertTemplateBlock(design, block, container, index));
    onSelect(block.id);
  };

  const actions = {
    add,
    select: onSelect,
    update: (block: TemplateBlock) => onChange(updateTemplateBlock(design, block)),
    remove: (blockId: string) => {
      onChange(removeTemplateBlock(design, blockId));
      if (blockId === selectedId) onSelect('');
    },
    duplicate: (block: TemplateBlock) => {
      const copy = cloneBlock(block);
      const container: DropContainer = rootIndexOf(design, block.id) >= 0 ? { kind: 'root' } : columnOf(design, block.id)!;
      const index = indexIn(design, container, block.id) + 1;
      onChange(insertTemplateBlock(design, copy, container, index));
      onSelect(copy.id);
    },
    nudge: (blockId: string, direction: -1 | 1) => onChange(nudgeTemplateBlock(design, blockId, direction)),
    requestImage: onRequestImage,
  };

  return (
    <div className="space-y-3">
    <div className="rounded-lg border border-border p-3 sm:p-5" style={{ backgroundColor: design.styles.backgroundColor }}>
      <div
        ref={sheetRef}
        className="mx-auto max-w-155 rounded-md p-6 md:p-8"
        style={{
          backgroundColor: design.styles.contentColor,
          color: design.styles.textColor,
          fontFamily: design.styles.fontFamily,
        }}
      >
        {design.blocks.length === 0 && !dnd.dragging ? (
          <AddBlockMenu columns onPick={(payload) => add({ kind: 'root' }, 0, payload)}>
            <button type="button" className="w-full rounded-sm border border-dashed border-current/25 p-12 text-sm opacity-60 transition-opacity hover:opacity-100">
              Add your first block
            </button>
          </AddBlockMenu>
        ) : (
          <>
            <DropGap container={{ kind: 'root' }} index={0} dnd={dnd} accepts={accepts} onDrop={drop} first />
            {design.blocks.map((block, index) => (
              <div key={block.id}>
                <BlockShell
                  block={block}
                  design={design}
                  selectedId={selectedId}
                  accent={design.styles.accentColor}
                  dnd={dnd}
                  accepts={accepts}
                  onDropAt={drop}
                  actions={actions}
                  container={{ kind: 'root' }}
                  index={index}
                />
                <DropGap container={{ kind: 'root' }} index={index + 1} dnd={dnd} accepts={accepts} onDrop={drop} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
      {/* The end of the email, the one place to add that is always on screen. */}
      {design.blocks.length > 0 && (
        <AddBlockMenu columns onPick={(payload) => add({ kind: 'root' }, design.blocks.length, payload)}>
          <Button type="button" variant="outline" className="w-full gap-1.5 border-dashed">
            <Plus aria-hidden="true" /> Add block
          </Button>
        </AddBlockMenu>
      )}
    </div>
  );
}

/* ── Position helpers ──────────────────────────────────────────────────────── */

const rootIndexOf = (design: TemplateDesign, blockId: string) => design.blocks.findIndex((block) => block.id === blockId);

function columnOf(design: TemplateDesign, blockId: string): DropContainer | undefined {
  for (const block of design.blocks) {
    if (!isColumnsBlock(block)) continue;
    for (const column of block.columns)
      if (column.blocks.some((leaf) => leaf.id === blockId)) return { kind: 'column', columnId: column.id };
  }
  return undefined;
}

function indexIn(design: TemplateDesign, container: DropContainer, blockId: string) {
  if (container.kind === 'root') return rootIndexOf(design, blockId);
  for (const block of design.blocks) {
    if (!isColumnsBlock(block)) continue;
    const column = block.columns.find((item) => item.id === container.columnId);
    if (column) return column.blocks.findIndex((leaf) => leaf.id === blockId);
  }
  return 0;
}

interface BlockActions {
  add: (container: DropContainer, index: number, payload: NewBlock) => void;
  select: (id: string) => void;
  update: (block: TemplateBlock) => void;
  remove: (blockId: string) => void;
  duplicate: (block: TemplateBlock) => void;
  nudge: (blockId: string, direction: -1 | 1) => void;
  requestImage: (blockId: string) => void;
}

type DropHandler = (container: DropContainer, index: number) => void;
type AcceptsHandler = (container: DropContainer) => boolean;

/* ── Drop slot ─────────────────────────────────────────────────────────────── */

/**
 * The gap between two blocks. Invisible at rest; during a drag it becomes a real
 * target, and lights up when the pointer is over it. Deliberately childless so
 * dragenter/dragleave never fire for a descendant.
 */
function DropGap({
  container,
  index,
  dnd,
  accepts,
  onDrop,
  first = false,
  vertical = false,
}: {
  container: DropContainer;
  index: number;
  dnd: CanvasDnd;
  accepts: AcceptsHandler;
  onDrop: DropHandler;
  /** The slot above the first block needs no collapsed height. */
  first?: boolean;
  /** Slots inside a column are tighter. */
  vertical?: boolean;
}) {
  const [over, setOver] = useState(false);
  const allowed = dnd.dragging && accepts(container);

  return (
    <div
      onDragOver={(event) => {
        if (!allowed) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = dnd.payload.current?.kind === 'move' ? 'move' : 'copy';
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!allowed) return;
        event.preventDefault();
        setOver(false);
        onDrop(container, index);
      }}
      aria-hidden="true"
      className={cn('relative transition-all', allowed ? (vertical ? 'my-0.5 h-4' : 'my-1 h-6') : first ? 'h-0' : 'h-1', over && 'h-10')}
    >
      {allowed && (
        <span
          className={cn(
            'pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full transition-all',
            over ? 'h-1 bg-primary' : 'h-0.5 bg-current opacity-15',
          )}
        />
      )}
    </div>
  );
}

/* ── Block frame ───────────────────────────────────────────────────────────── */

function BlockShell({
  block,
  design,
  selectedId,
  accent,
  dnd,
  accepts,
  onDropAt,
  actions,
  container,
  index,
  compact = false,
}: {
  block: TemplateBlock;
  design: TemplateDesign;
  selectedId: string;
  accent: string;
  dnd: CanvasDnd;
  accepts: AcceptsHandler;
  onDropAt: DropHandler;
  actions: BlockActions;
  /** Where the block sits, so its "+" adds the next one just below it. */
  container: DropContainer;
  index: number;
  /** Blocks inside a column get a tighter frame. */
  compact?: boolean;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const selected = block.id === selectedId;

  return (
    <div
      ref={shellRef}
      onClick={(event) => {
        event.stopPropagation();
        actions.select(block.id);
      }}
      className={cn(
        'group/block relative rounded-sm border transition-colors',
        compact ? 'px-1' : 'px-2',
        selected ? 'border-primary/60' : 'border-transparent hover:border-current/15',
      )}
    >
      <BlockToolbar
        block={block}
        selected={selected}
        shellRef={shellRef}
        dnd={dnd}
        onDuplicate={() => actions.duplicate(block)}
        onRemove={() => actions.remove(block.id)}
        onNudge={(direction) => actions.nudge(block.id, direction)}
      />

      {/* "+" on the lower edge: the next block, just below this one. */}
      <AddBlockMenu columns={container.kind === 'root'} onPick={(payload) => actions.add(container, index + 1, payload)}>
        <button
          type="button"
          aria-label={`Add a block below this ${isColumnsBlock(block) ? 'row' : block.type}`}
          className={cn(
            'absolute -bottom-3 left-1/2 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:opacity-100',
            selected ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100',
          )}
        >
          <Plus size={13} aria-hidden="true" />
        </button>
      </AddBlockMenu>

      {isColumnsBlock(block) ? (
        <ColumnsView
          block={block}
          design={design}
          selectedId={selectedId}
          accent={accent}
          dnd={dnd}
          accepts={accepts}
          onDropAt={onDropAt}
          actions={actions}
        />
      ) : (
        <LeafView block={block} accent={accent} compact={compact} actions={actions} />
      )}
    </div>
  );
}

/** Hover controls: drag by the grip; move, copy and delete behind ⋯. */
function BlockToolbar({
  block,
  selected,
  shellRef,
  dnd,
  onDuplicate,
  onRemove,
  onNudge,
}: {
  block: TemplateBlock;
  selected: boolean;
  shellRef: React.RefObject<HTMLDivElement | null>;
  dnd: CanvasDnd;
  onDuplicate: () => void;
  onRemove: () => void;
  onNudge: (direction: -1 | 1) => void;
}) {
  const label = isColumnsBlock(block) ? 'row' : block.type;
  return (
    <div
      className={cn(
        'absolute -top-4 right-1 z-10 flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5 text-foreground shadow-sm transition-opacity',
        selected ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100 focus-within:opacity-100',
      )}
      // Clicking the toolbar (or its menu) must not also re-enter the block's own handlers.
      onClick={(event) => event.stopPropagation()}
    >
      {/* Only the grip is draggable, so selecting and editing text stay usable. */}
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          dnd.start({ kind: 'move', blockId: block.id });
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', block.id);
          if (shellRef.current) event.dataTransfer.setDragImage(shellRef.current, 20, 20);
        }}
        onDragEnd={dnd.end}
        aria-label={`Drag to move this ${label}`}
        title="Drag to move"
        className="flex size-7 cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-band hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
      <span className="[&_button]:size-7">
        <RowMenu
          label={`This ${label}’s actions`}
          items={[
            { icon: ArrowUp, label: 'Move up', onClick: () => onNudge(-1) },
            { icon: ArrowDown, label: 'Move down', onClick: () => onNudge(1) },
            { icon: Copy, label: 'Duplicate', onClick: onDuplicate },
            { icon: Trash2, label: 'Delete', danger: true, onClick: onRemove },
          ]}
        />
      </span>
    </div>
  );
}

/* ── Column row ────────────────────────────────────────────────────────────── */

function ColumnsView({
  block,
  design,
  selectedId,
  accent,
  dnd,
  accepts,
  onDropAt,
  actions,
}: {
  block: TemplateColumnsBlock;
  design: TemplateDesign;
  selectedId: string;
  accent: string;
  dnd: CanvasDnd;
  accepts: AcceptsHandler;
  onDropAt: DropHandler;
  actions: BlockActions;
}) {
  const widths = layoutWidths(block.layout);
  return (
    <div className="flex items-stretch gap-3 py-2">
      {block.columns.map((column, columnIndex) => {
        const container: DropContainer = { kind: 'column', columnId: column.id };
        const empty = column.blocks.length === 0;
        return (
          <div key={column.id} style={{ width: `${widths[columnIndex] ?? 100 / block.columns.length}%` }} className="min-w-0">
            {empty ? (
              <EmptyCell container={container} dnd={dnd} accepts={accepts} onDrop={onDropAt} onAdd={(payload) => actions.add(container, 0, payload)} />
            ) : (
              <>
                <DropGap container={container} index={0} dnd={dnd} accepts={accepts} onDrop={onDropAt} first vertical />
                {column.blocks.map((leaf, leafIndex) => (
                  <div key={leaf.id}>
                    <BlockShell
                      block={leaf}
                      design={design}
                      selectedId={selectedId}
                      accent={accent}
                      dnd={dnd}
                      accepts={accepts}
                      onDropAt={onDropAt}
                      actions={actions}
                      container={container}
                      index={leafIndex}
                      compact
                    />
                    <DropGap container={container} index={leafIndex + 1} dnd={dnd} accepts={accepts} onDrop={onDropAt} vertical />
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** An empty cell: a "+" for its first block, and one big target while a block is dragged. */
function EmptyCell({
  container,
  dnd,
  accepts,
  onDrop,
  onAdd,
}: {
  container: DropContainer;
  dnd: CanvasDnd;
  accepts: AcceptsHandler;
  onDrop: DropHandler;
  onAdd: (payload: NewBlock) => void;
}) {
  const [over, setOver] = useState(false);
  const allowed = dnd.dragging && accepts(container);
  return (
    <div
      onDragOver={(event) => {
        if (!allowed) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = dnd.payload.current?.kind === 'move' ? 'move' : 'copy';
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!allowed) return;
        event.preventDefault();
        setOver(false);
        onDrop(container, 0);
      }}
      className={cn(
        'flex min-h-24 flex-col items-center justify-center gap-1 rounded-sm border border-dashed p-3 text-center text-label transition-colors',
        over ? 'border-primary bg-primary/6' : 'border-current/20',
      )}
    >
      {dnd.dragging ? (
        // Inert, so dragging over the label never reads as leaving the cell.
        <span className="pointer-events-none opacity-60">Drop here</span>
      ) : (
        <AddBlockMenu columns={false} onPick={onAdd}>
          <button
            type="button"
            className="flex items-center gap-1 rounded-sm px-2 py-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Plus size={13} aria-hidden="true" /> Add
          </button>
        </AddBlockMenu>
      )}
    </div>
  );
}

/* ── Content ───────────────────────────────────────────────────────────────── */

function LeafView({
  block,
  accent,
  compact,
  actions,
}: {
  block: TemplateLeafBlock;
  accent: string;
  compact: boolean;
  actions: BlockActions;
}) {
  if (block.type === 'heading')
    return (
      <InlineText
        value={block.text}
        onChange={(text) => actions.update({ ...block, text })}
        onFocus={() => actions.select(block.id)}
        singleLine
        placeholder="Write your title"
        ariaLabel="Heading text"
        className={cn('font-bold', compact ? 'py-1.5 text-xl' : 'py-3 text-3xl')}
        style={{ textAlign: block.align }}
      />
    );

  if (block.type === 'text')
    return (
      <InlineText
        value={block.text}
        onChange={(text) => actions.update({ ...block, text })}
        onFocus={() => actions.select(block.id)}
        placeholder="Write your message here."
        ariaLabel="Paragraph text"
        className={cn('leading-7', compact ? 'py-1 text-sm' : 'py-2 text-sm')}
        style={{ textAlign: block.align }}
      />
    );

  if (block.type === 'button')
    return (
      <div className={compact ? 'py-2' : 'py-4'} style={{ textAlign: block.align }}>
        <span className="inline-block rounded-sm px-6 py-3 text-sm font-bold text-white" style={{ backgroundColor: accent }}>
          <InlineText
            value={block.text}
            onChange={(text) => actions.update({ ...block, text })}
            onFocus={() => actions.select(block.id)}
            singleLine
            placeholder="Button label"
            ariaLabel="Button label"
            className="min-w-8"
          />
        </span>
      </div>
    );

  if (block.type === 'image')
    return (
      <div className={compact ? 'py-2' : 'py-3'} style={{ textAlign: block.align }}>
        {block.url ? (
          <EmailImage url={block.url} alt={block.alt} className="inline-block h-auto max-w-full rounded-sm" style={{ width: `${block.width}%` }} />
        ) : (
          <button
            type="button"
            onClick={() => actions.requestImage(block.id)}
            className="flex min-h-24 w-full items-center justify-center gap-2 rounded-sm border border-dashed border-current/25 text-sm opacity-60 transition-opacity hover:opacity-100"
          >
            <ImagePlus size={16} />
            Choose an image
          </button>
        )}
      </div>
    );

  if (block.type === 'divider') return <hr className={cn('border-current/15', compact ? 'my-3' : 'my-5')} />;

  if (block.type === 'html') return <HtmlPreview html={block.html} />;

  if (block.type === 'spacer')
    return (
      <div className="flex items-center justify-center opacity-40" style={{ height: block.height }}>
        <span className="text-micro">{block.height}px</span>
      </div>
    );

  return (
    <div className={cn('flex flex-wrap justify-center gap-4 text-sm underline', compact ? 'py-2' : 'py-4')}>
      {block.links.map((link, index) => (
        <span key={`${link.label}-${index}`}>{link.label}</span>
      ))}
    </div>
  );
}

/**
 * Pasted HTML drawn as it will send, sized to its content. The frame runs no
 * scripts; same-origin is only there so its height can be read. Clicks pass
 * through to the block, so a link inside cannot navigate the editor.
 */
function HtmlPreview({ html }: { html: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);

  const measure = () => {
    const body = frameRef.current?.contentDocument?.body;
    if (!body) return;
    setHeight(Math.max(40, body.scrollHeight));
    const observer = new ResizeObserver(() => setHeight(Math.max(40, body.scrollHeight)));
    observer.observe(body);
    return observer;
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    const onLoad = () => {
      observer?.disconnect();
      observer = measure();
    };
    frame.addEventListener('load', onLoad);
    return () => {
      frame.removeEventListener('load', onLoad);
      observer?.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={frameRef}
      title="Custom HTML"
      sandbox="allow-same-origin"
      srcDoc={html}
      className="pointer-events-none block w-full border-0"
      style={{ height }}
    />
  );
}

/**
 * Text edited where it is shown. The element has no React children — the value
 * is written to the DOM through a ref — so re-renders never rewrite the text and
 * the caret stays put while typing.
 */
function InlineText({
  value,
  onChange,
  onFocus,
  singleLine = false,
  placeholder,
  ariaLabel,
  className,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  /** Enter commits instead of inserting a line break. */
  singleLine?: boolean;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Only push the value in when it changed elsewhere (variable insert, undo of a
  // duplicate) and we are not the focused element.
  useEffect(() => {
    const node = ref.current;
    if (!node || document.activeElement === node) return;
    if (node.innerText !== value) node.innerText = value;
  }, [value]);

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline={!singleLine}
      aria-label={ariaLabel}
      tabIndex={0}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={onFocus}
      onInput={(event) => onChange(event.currentTarget.innerText)}
      onBlur={(event) => onChange(event.currentTarget.innerText)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && singleLine) {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') event.currentTarget.blur();
      }}
      className={cn(
        'block w-full whitespace-pre-wrap outline-none',
        'focus:rounded focus:ring-2 focus:ring-primary/40',
        'empty:before:pointer-events-none empty:before:opacity-40 empty:before:content-[attr(data-placeholder)]',
        className,
      )}
      style={style}
    />
  );
}
