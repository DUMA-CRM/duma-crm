import { htmlToBlocks, readSimpleBody } from './simpleBody.ts';

export type TemplateAlign = 'left' | 'center' | 'right';

/** Blocks that hold content. These are the only things a column can contain. */
export type TemplateLeafBlock =
  | { id: string; type: 'heading'; text: string; align: TemplateAlign }
  | { id: string; type: 'text'; text: string; align: TemplateAlign }
  | { id: string; type: 'button'; text: string; url: string; align: TemplateAlign }
  | { id: string; type: 'image'; url: string; alt: string; href: string; width: number; align: TemplateAlign }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; height: number }
  | { id: string; type: 'social'; links: Array<{ label: string; url: string }> };

export interface TemplateColumn {
  id: string;
  blocks: TemplateLeafBlock[];
}

/**
 * A row of columns you drop content into — "image and text", "text and text".
 * Nesting stops here: a column cannot contain another row, which keeps both the
 * editor and the exported email table simple.
 */
export interface TemplateColumnsBlock {
  id: string;
  type: 'columns';
  layout: ColumnsLayout;
  columns: TemplateColumn[];
}

export type TemplateBlock = TemplateLeafBlock | TemplateColumnsBlock;

export type ColumnsLayout = 'two-equal' | 'two-wide-left' | 'two-wide-right' | 'three-equal';

/** Percentage widths per layout — used for both the canvas and the email table. */
export const COLUMN_LAYOUTS: Array<{ value: ColumnsLayout; label: string; widths: number[] }> = [
  { value: 'two-equal', label: '2 columns', widths: [50, 50] },
  { value: 'two-wide-left', label: 'Wide + narrow', widths: [66, 34] },
  { value: 'two-wide-right', label: 'Narrow + wide', widths: [34, 66] },
  { value: 'three-equal', label: '3 columns', widths: [33.34, 33.33, 33.33] },
];

export const layoutWidths = (layout: ColumnsLayout) =>
  COLUMN_LAYOUTS.find((option) => option.value === layout)?.widths ?? [50, 50];

export const isColumnsBlock = (block: TemplateBlock): block is TemplateColumnsBlock => block.type === 'columns';

const id = (prefix = 'block') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const LEAF_TYPES: TemplateLeafBlock['type'][] = ['heading', 'text', 'button', 'image', 'divider', 'spacer', 'social'];

export function newLeafBlock(type: TemplateLeafBlock['type']): TemplateLeafBlock {
  if (type === 'heading') return { id: id(), type, text: 'Write your title', align: 'center' };
  if (type === 'text') return { id: id(), type, text: 'Write your message here.', align: 'left' };
  if (type === 'button') return { id: id(), type, text: 'Learn more', url: 'https://', align: 'center' };
  if (type === 'image') return { id: id(), type, url: '', alt: '', href: '', width: 100, align: 'center' };
  if (type === 'divider') return { id: id(), type };
  if (type === 'spacer') return { id: id(), type, height: 24 };
  return { id: id(), type, links: [{ label: 'Instagram', url: 'https://' }] };
}

export function newColumnsBlock(layout: ColumnsLayout = 'two-equal'): TemplateColumnsBlock {
  return {
    id: id('row'),
    type: 'columns',
    layout,
    columns: layoutWidths(layout).map(() => ({ id: id('col'), blocks: [] })),
  };
}

export function newTemplateBlock(type: TemplateBlock['type']): TemplateBlock {
  return type === 'columns' ? newColumnsBlock() : newLeafBlock(type);
}

/** Deep copy with fresh ids, so a duplicated row does not share cell identities. */
export function cloneBlock(block: TemplateBlock): TemplateBlock {
  if (isColumnsBlock(block)) {
    return {
      ...block,
      id: id('row'),
      columns: block.columns.map((column) => ({
        id: id('col'),
        blocks: column.blocks.map((leaf) => ({ ...leaf, id: id() })),
      })),
    };
  }
  return { ...block, id: id() };
}

/** Changing the layout keeps the content: extra cells fold into the last one kept. */
export function relayoutColumns(block: TemplateColumnsBlock, layout: ColumnsLayout): TemplateColumnsBlock {
  const count = layoutWidths(layout).length;
  const columns = Array.from({ length: count }, (_, index) => block.columns[index] ?? { id: id('col'), blocks: [] });
  const dropped = block.columns.slice(count).flatMap((column) => column.blocks);
  if (dropped.length) {
    const last = columns.length - 1;
    columns[last] = { ...columns[last], blocks: [...columns[last].blocks, ...dropped] };
  }
  return { ...block, layout, columns };
}

export interface TemplateDesign {
  schemaVersion: 2;
  styles: {
    backgroundColor: string;
    contentColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: 'Arial' | 'Georgia' | 'Verdana';
  };
  blocks: TemplateBlock[];
}

export function defaultTemplateDesign(): TemplateDesign {
  return {
    schemaVersion: 2,
    styles: {
      backgroundColor: '#f4f1eb',
      contentColor: '#ffffff',
      textColor: '#25221d',
      accentColor: '#25221d',
      fontFamily: 'Arial',
    },
    blocks: [newLeafBlock('heading'), newLeafBlock('text'), newLeafBlock('button')],
  };
}

export function isTemplateDesign(value: unknown): value is TemplateDesign {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TemplateDesign>;
  const version = candidate.schemaVersion as number | undefined;
  return (version === 1 || version === 2) && Array.isArray(candidate.blocks) && Boolean(candidate.styles);
}

/**
 * Reads any stored design into the current shape. Version 1 stored a column row
 * as two plain strings, so those become real cells holding a text block each.
 */
export function normalizeTemplateDesign(value: TemplateDesign | (Omit<TemplateDesign, 'schemaVersion'> & { schemaVersion: 1 })) {
  const blocks = (value.blocks as unknown[]).map((raw) => {
    const block = raw as TemplateBlock & { left?: string; right?: string };
    if (block.type !== 'columns') return block as TemplateLeafBlock;
    if (Array.isArray((block as TemplateColumnsBlock).columns)) {
      const columns = (block as TemplateColumnsBlock).columns;
      return { ...block, layout: block.layout ?? 'two-equal', columns } as TemplateColumnsBlock;
    }
    const cell = (text?: string): TemplateColumn => ({
      id: id('col'),
      blocks: text ? [{ id: id(), type: 'text', text, align: 'left' }] : [],
    });
    return { id: block.id, type: 'columns', layout: 'two-equal', columns: [cell(block.left), cell(block.right)] };
  });
  return { ...value, schemaVersion: 2, blocks } as TemplateDesign;
}

export function legacyHtmlToDesign(html: string): TemplateDesign {
  const design = defaultTemplateDesign();
  const simple = readSimpleBody(html) ?? htmlToBlocks(html);
  design.blocks = simple.map((block) => {
    if (block.type === 'heading') return { id: id(), type: 'heading', text: block.text, align: 'left' };
    if (block.type === 'text') return { id: id(), type: 'text', text: block.text, align: 'left' };
    if (block.type === 'button') return { id: id(), type: 'button', text: block.text, url: block.url, align: 'left' };
    return { id: id(), type: 'divider' };
  });
  return design;
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function safeUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? escapeHtml(trimmed) : '#';
}

function textHtml(text: string) {
  return escapeHtml(text).replaceAll('\n', '<br />');
}

type Styles = TemplateDesign['styles'];

/** One content block as email HTML. `compact` trims padding inside a column. */
function renderLeaf(block: TemplateLeafBlock, styles: Styles, compact = false): string {
  const pad = (value: number) => (compact ? Math.max(4, Math.round(value / 2)) : value);
  if (block.type === 'heading') {
    return `<h1 style="margin:0;padding:${pad(12)}px 0;font-size:${compact ? 22 : 30}px;line-height:1.25;text-align:${block.align};color:${styles.textColor}">${textHtml(block.text)}</h1>`;
  }
  if (block.type === 'text') {
    return `<p style="margin:0;padding:${pad(10)}px 0;font-size:15px;line-height:1.65;text-align:${block.align};color:${styles.textColor}">${textHtml(block.text)}</p>`;
  }
  if (block.type === 'button') {
    return `<div style="padding:${pad(16)}px 0;text-align:${block.align}"><a href="${safeUrl(block.url)}" style="display:inline-block;border-radius:10px;background:${styles.accentColor};color:#ffffff;text-decoration:none;padding:12px 22px;font-size:15px;font-weight:700">${escapeHtml(block.text)}</a></div>`;
  }
  if (block.type === 'image') {
    if (!block.url) return '';
    const image = `<img src="${safeUrl(block.url)}" alt="${escapeHtml(block.alt)}" style="display:block;max-width:100%;width:${Math.max(10, Math.min(100, block.width))}%;height:auto;border:0" />`;
    const linked = block.href ? `<a href="${safeUrl(block.href)}">${image}</a>` : image;
    return `<div style="padding:${pad(10)}px 0;text-align:${block.align}"><div style="display:inline-block;width:100%">${linked}</div></div>`;
  }
  if (block.type === 'divider') return `<hr style="border:0;border-top:1px solid #ded8cf;margin:${pad(18)}px 0" />`;
  if (block.type === 'spacer') {
    const height = Math.max(8, Math.min(120, block.height));
    return `<div style="height:${height}px;line-height:${height}px">&nbsp;</div>`;
  }
  const links = block.links
    .filter((link) => link.label && link.url)
    .map(
      (link) =>
        `<a href="${safeUrl(link.url)}" style="color:${styles.accentColor};margin:0 8px;text-decoration:underline">${escapeHtml(link.label)}</a>`,
    )
    .join('');
  return `<div style="padding:${pad(14)}px 0;text-align:center;font-size:13px">${links}</div>`;
}

/** A column row as a fixed-layout table — the only structure every mail client agrees on. */
function renderColumns(block: TemplateColumnsBlock, styles: Styles): string {
  const widths = layoutWidths(block.layout);
  const cells = block.columns
    .map((column, index) => {
      const width = widths[index] ?? 100 / block.columns.length;
      const first = index === 0;
      const last = index === block.columns.length - 1;
      const padding = `10px ${last ? 0 : 12}px 10px ${first ? 0 : 12}px`;
      const body = column.blocks.map((leaf) => renderLeaf(leaf, styles, true)).join('');
      return `<td width="${width.toFixed(2)}%" valign="top" style="width:${width.toFixed(2)}%;padding:${padding};font-size:14px;line-height:1.6;color:${styles.textColor}">${body}</td>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;width:100%"><tr>${cells}</tr></table>`;
}

export function renderTemplateDesign(design: TemplateDesign): string {
  const { styles } = design;
  const blocks = design.blocks
    .map((block) => (isColumnsBlock(block) ? renderColumns(block, styles) : renderLeaf(block, styles)))
    .join('');
  return `<div style="margin:0;padding:28px 12px;background:${styles.backgroundColor};font-family:${styles.fontFamily},Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px;background:${styles.contentColor};border-radius:16px">${blocks}</div></div>`;
}

function leafToPlainText(block: TemplateLeafBlock): string[] {
  if (block.type === 'divider') return ['---'];
  if (block.type === 'spacer' || block.type === 'image') return [];
  if (block.type === 'button') return [`${block.text}: ${block.url}`];
  if (block.type === 'social') return block.links.map((link) => `${link.label}: ${link.url}`);
  return [block.text];
}

export function templateDesignToPlainText(design: TemplateDesign) {
  return design.blocks
    .flatMap((block) => (isColumnsBlock(block) ? block.columns.flatMap((column) => column.blocks.flatMap(leafToPlainText)) : leafToPlainText(block)))
    .filter(Boolean)
    .join('\n\n');
}

/* ── Structural edits ──────────────────────────────────────────────────────────
   The canvas moves blocks between the page and column cells, so every edit goes
   through these helpers rather than being spelled out at each call site. */

/** Where a block sits, or is heading: the page itself, or a column by id. */
export type DropContainer = { kind: 'root' } | { kind: 'column'; columnId: string };

const withColumns = (design: TemplateDesign, map: (column: TemplateColumn) => TemplateColumn): TemplateDesign => ({
  ...design,
  blocks: design.blocks.map((block) => (isColumnsBlock(block) ? { ...block, columns: block.columns.map(map) } : block)),
});

export function updateTemplateBlock(design: TemplateDesign, next: TemplateBlock): TemplateDesign {
  const atRoot = { ...design, blocks: design.blocks.map((block) => (block.id === next.id ? next : block)) };
  if (isColumnsBlock(next)) return atRoot;
  return withColumns(atRoot, (column) => ({
    ...column,
    blocks: column.blocks.map((leaf) => (leaf.id === next.id ? next : leaf)),
  }));
}

export function removeTemplateBlock(design: TemplateDesign, blockId: string): TemplateDesign {
  const atRoot = { ...design, blocks: design.blocks.filter((block) => block.id !== blockId) };
  return withColumns(atRoot, (column) => ({ ...column, blocks: column.blocks.filter((leaf) => leaf.id !== blockId) }));
}

export function findTemplateBlock(design: TemplateDesign, blockId: string): TemplateBlock | undefined {
  const atRoot = design.blocks.find((block) => block.id === blockId);
  if (atRoot) return atRoot;
  for (const block of design.blocks) {
    if (!isColumnsBlock(block)) continue;
    for (const column of block.columns) {
      const leaf = column.blocks.find((item) => item.id === blockId);
      if (leaf) return leaf;
    }
  }
  return undefined;
}

/** Inserts a block at an exact slot. A row can only ever live on the page. */
export function insertTemplateBlock(
  design: TemplateDesign,
  block: TemplateBlock,
  container: DropContainer,
  index: number,
): TemplateDesign {
  if (container.kind === 'root') {
    const blocks = [...design.blocks];
    blocks.splice(Math.max(0, Math.min(index, blocks.length)), 0, block);
    return { ...design, blocks };
  }
  if (isColumnsBlock(block)) return design;
  return withColumns(design, (column) => {
    if (column.id !== container.columnId) return column;
    const blocks = [...column.blocks];
    blocks.splice(Math.max(0, Math.min(index, blocks.length)), 0, block);
    return { ...column, blocks };
  });
}

/**
 * Drag-and-drop reorder. Removing the block first shifts the slots after it, so
 * the target index is corrected when the move stays inside the same container.
 */
export function moveTemplateBlock(
  design: TemplateDesign,
  blockId: string,
  container: DropContainer,
  index: number,
): TemplateDesign {
  const block = findTemplateBlock(design, blockId);
  if (!block) return design;
  if (isColumnsBlock(block) && container.kind === 'column') return design;

  const source = locateTemplateBlock(design, blockId);
  let target = index;
  if (source && sameContainer(source.container, container) && source.index < index) target -= 1;

  return insertTemplateBlock(removeTemplateBlock(design, blockId), block, container, target);
}

const sameContainer = (a: DropContainer, b: DropContainer) =>
  a.kind === b.kind && (a.kind !== 'column' || b.kind !== 'column' || a.columnId === b.columnId);

/** Container and index of a block, for move maths and up/down nudges. */
export function locateTemplateBlock(
  design: TemplateDesign,
  blockId: string,
): { container: DropContainer; index: number; total: number } | undefined {
  const rootIndex = design.blocks.findIndex((block) => block.id === blockId);
  if (rootIndex >= 0) return { container: { kind: 'root' }, index: rootIndex, total: design.blocks.length };
  for (const block of design.blocks) {
    if (!isColumnsBlock(block)) continue;
    for (const column of block.columns) {
      const index = column.blocks.findIndex((leaf) => leaf.id === blockId);
      if (index >= 0) return { container: { kind: 'column', columnId: column.id }, index, total: column.blocks.length };
    }
  }
  return undefined;
}

/** Keyboard-friendly nudge, used by the up/down buttons on a selected block. */
export function nudgeTemplateBlock(design: TemplateDesign, blockId: string, direction: -1 | 1): TemplateDesign {
  const found = locateTemplateBlock(design, blockId);
  if (!found) return design;
  const target = found.index + direction;
  if (target < 0 || target >= found.total) return design;
  // moveTemplateBlock corrects for the removal, so a downward nudge needs +1.
  return moveTemplateBlock(design, blockId, found.container, direction === 1 ? target + 1 : target);
}
