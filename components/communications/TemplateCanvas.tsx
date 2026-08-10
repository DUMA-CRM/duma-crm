'use client';

import { useEffect, useRef, useState } from 'react';

import { ArrowDown, ArrowUp, Copy, ImagePlus, LayoutGrid, Menu, Trash2 } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

import {
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

/** What is being dragged: a brand new block from the palette, or an existing one. */
export type DragPayload = { kind: 'new'; type: TemplateBlock['type']; layout?: ColumnsLayout } | { kind: 'move'; blockId: string };

/** Builds the block a palette drag or click asked for. */
export const blockFromPayload = (payload: Extract<DragPayload, { kind: 'new' }>): TemplateBlock =>
  payload.type === 'columns' ? newColumnsBlock(payload.layout ?? 'two-equal') : newLeafBlock(payload.type);

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
 * blocks are dragged into position, and column rows accept content per cell.
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
  /** Opens the file picker for an image block. */
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

  const actions = {
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
    <div className="rounded-sm p-4 shadow-inner" style={{ backgroundColor: design.styles.backgroundColor }}>
      <div
        ref={sheetRef}
        className="mx-auto max-w-155 rounded-sm p-6 shadow-sm md:p-8"
        style={{
          backgroundColor: design.styles.contentColor,
          color: design.styles.textColor,
          fontFamily: design.styles.fontFamily,
        }}
      >
        {design.blocks.length === 0 && !dnd.dragging ? (
          <button
            type="button"
            onClick={() => {
              const block = newLeafBlock('text');
              onChange(insertTemplateBlock(design, block, { kind: 'root' }, 0));
              onSelect(block.id);
            }}
            className="w-full rounded-sm border border-dashed border-current/25 p-12 text-sm opacity-60"
          >
            Add your first content block — or drag one in from the left
          </button>
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
                />
                <DropGap container={{ kind: 'root' }} index={index + 1} dnd={dnd} accepts={accepts} onDrop={drop} />
              </div>
            ))}
          </>
        )}
      </div>
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
        'group/block relative rounded-sm border-2 transition-colors',
        compact ? 'px-1' : 'px-2',
        selected ? 'border-primary' : 'border-transparent hover:border-current/20',
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

/** Hover controls: drag by the grip, or nudge, copy and delete. */
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
        'absolute -top-3 right-1 z-10 flex items-center gap-0.5 rounded-sm border border-rule bg-card p-0.5 shadow-md transition-opacity',
        selected ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100 focus-within:opacity-100',
      )}
      // Clicking the toolbar must not also re-enter the block's own handlers.
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
        className="flex size-6 cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <Menu size={13} />
      </button>
      <ToolbarButton label="Move up" onClick={() => onNudge(-1)}>
        <ArrowUp size={13} />
      </ToolbarButton>
      <ToolbarButton label="Move down" onClick={() => onNudge(1)}>
        <ArrowDown size={13} />
      </ToolbarButton>
      <ToolbarButton label={`Duplicate this ${label}`} onClick={onDuplicate}>
        <Copy size={13} />
      </ToolbarButton>
      <ToolbarButton label={`Delete this ${label}`} onClick={onRemove} destructive>
        <Trash2 size={13} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-6 items-center justify-center rounded-sm transition-colors',
        destructive
          ? 'text-muted-foreground hover:bg-band hover:text-destructive'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
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
              <EmptyCell container={container} dnd={dnd} accepts={accepts} onDrop={onDropAt} />
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

/** An empty cell is one big target — the whole point of choosing a layout first. */
function EmptyCell({
  container,
  dnd,
  accepts,
  onDrop,
}: {
  container: DropContainer;
  dnd: CanvasDnd;
  accepts: AcceptsHandler;
  onDrop: DropHandler;
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
        'flex min-h-24 flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed p-3 text-center text-label transition-colors',
        over ? 'border-primary bg-band' : 'border-current/20 opacity-50',
      )}
    >
      {/* Inert, so dragging over the label never reads as leaving the cell. */}
      <span className="pointer-events-none flex flex-col items-center gap-1">
        <LayoutGrid size={14} aria-hidden="true" />
        Drop content here
      </span>
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
          // Email-builder images use arbitrary tenant-uploaded public URLs;
          // next/image cannot know or safely proxy those hosts at build time.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.url} alt={block.alt} className="inline-block h-auto max-w-full rounded-sm" style={{ width: `${block.width}%` }} />
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
