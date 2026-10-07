import type { CmsFieldDefinition } from '@/lib/api/cms.service';

// ---------------------------------------------------------------------------
// Bringing content in: CSV rows and WordPress posts become entry data for one
// content type. Everything here is pure — the browser parses the file (CSV
// text, or the WordPress XML through DOMParser) and these rules decide what
// each value becomes — so the decisions are tested.
// ---------------------------------------------------------------------------

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^﻿/, '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Fields an import can fill: plain values, not groups, references or media. */
export const importableFields = (fields: readonly CmsFieldDefinition[]) =>
  fields.filter((field) => !['group', 'reference', 'media', 'json', 'location'].includes(field.type));

/**
 * Column → field key, by matching the header to a field's key or label (case
 * and punctuation ignored). Unmatched columns map to '' — skipped unless chosen.
 */
export function autoMap(headers: readonly string[], fields: readonly CmsFieldDefinition[]): string[] {
  const candidates = importableFields(fields);
  const used = new Set<string>();
  return headers.map((header) => {
    const want = normalise(header);
    const match = candidates.find((field) => !used.has(field.key) && (normalise(field.key) === want || normalise(field.label) === want));
    if (!match) return '';
    used.add(match.key);
    return match.key;
  });
}

/** One cell to the value its field stores; null for blanks and anything unreadable. */
export function coerce(value: string, field: CmsFieldDefinition): unknown {
  const text = value.trim();
  if (!text) return null;
  switch (field.type) {
    case 'number': {
      const number = Number(text.replace(/,/g, ''));
      return Number.isFinite(number) ? number : null;
    }
    case 'boolean':
      return /^(true|yes|y|1|on)$/i.test(text) ? true : /^(false|no|n|0|off)$/i.test(text) ? false : null;
    case 'date': {
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    }
    case 'dateTime': {
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    case 'select':
      if (field.multiple)
        return text
          .split(/[;|]/)
          .map((part) => part.trim())
          .filter(Boolean);
      return text;
    default:
      return text;
  }
}

/** Rows to entry data with the chosen mapping. Empty rows are dropped. */
export function rowsToEntries(rows: readonly string[][], mapping: readonly string[], fields: readonly CmsFieldDefinition[]) {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return rows
    .map((row) => {
      const data: Record<string, unknown> = {};
      mapping.forEach((key, column) => {
        const field = key ? byKey.get(key) : undefined;
        if (!field) return;
        const value = coerce(row[column] ?? '', field);
        if (value !== null) data[key] = value;
      });
      return data;
    })
    .filter((data) => Object.keys(data).length > 0);
}

// ─── WordPress ───────────────────────────────────────────────────────────────

/** The parts of a DOM node the converter reads — the browser's nodes, or plain objects in tests. */
export interface HtmlNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<HtmlNode>;
  getAttribute?: (name: string) => string | null;
}

const TEXT = 3;
const ELEMENT = 1;

/**
 * WordPress post HTML to Markdown: headings, paragraphs, emphasis, links,
 * images, lists, quotes, code and breaks. Anything else keeps its text. Block
 * comments (`<!-- wp:paragraph -->`) and scripts never appear.
 */
export function htmlToMarkdown(root: HtmlNode): string {
  const inline = (node: HtmlNode): string => {
    if (node.nodeType === TEXT) return (node.textContent ?? '').replace(/\s+/g, ' ');
    if (node.nodeType !== ELEMENT) return '';
    const tag = node.nodeName.toLowerCase();
    const inner = () => Array.from(node.childNodes).map(inline).join('');
    switch (tag) {
      case 'strong':
      case 'b':
        return `**${inner().trim()}**`;
      case 'em':
      case 'i':
        return `_${inner().trim()}_`;
      case 'code':
        return `\`${node.textContent ?? ''}\``;
      case 'br':
        return '  \n';
      case 'a': {
        const href = node.getAttribute?.('href') ?? '';
        const text = inner().trim();
        return href ? `[${text || href}](${href})` : text;
      }
      case 'img': {
        const src = node.getAttribute?.('src') ?? '';
        return src ? `![${(node.getAttribute?.('alt') ?? '').replace(/[[\]]/g, '')}](${src})` : '';
      }
      case 'script':
      case 'style':
        return '';
      default:
        return inner();
    }
  };

  const block = (node: HtmlNode, depth = 0): string[] => {
    if (node.nodeType === TEXT) {
      const text = (node.textContent ?? '').trim();
      return text ? [text] : [];
    }
    if (node.nodeType !== ELEMENT) return [];
    const tag = node.nodeName.toLowerCase();
    const children = Array.from(node.childNodes);
    const heading = /^h([1-6])$/.exec(tag);
    if (heading) return [`${'#'.repeat(Number(heading[1]))} ${children.map(inline).join('').trim()}`];
    if (tag === 'p') {
      const text = children.map(inline).join('').trim();
      return text ? [text] : [];
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = children.filter((child) => child.nodeType === ELEMENT && child.nodeName.toLowerCase() === 'li');
      return [
        items
          .map((item, index) => {
            const nested = Array.from(item.childNodes).filter((child) => ['ul', 'ol'].includes(child.nodeName.toLowerCase()));
            const own = Array.from(item.childNodes)
              .filter((child) => !nested.includes(child))
              .map(inline)
              .join('')
              .trim();
            const marker = tag === 'ol' ? `${index + 1}.` : '-';
            const sub = nested.flatMap((list) => block(list, depth + 1)).join('\n');
            return `${'  '.repeat(depth)}${marker} ${own}${sub ? `\n${sub}` : ''}`;
          })
          .join('\n'),
      ];
    }
    if (tag === 'blockquote')
      return [
        children
          .flatMap((child) => block(child))
          .join('\n\n')
          .split('\n')
          .map((line) => `> ${line}`.trimEnd())
          .join('\n'),
      ];
    if (tag === 'pre') return [`\`\`\`\n${(node.textContent ?? '').replace(/\n$/, '')}\n\`\`\``];
    if (tag === 'hr') return ['---'];
    if (tag === 'img' || tag === 'a' || tag === 'strong' || tag === 'em') return [inline(node)];
    if (tag === 'script' || tag === 'style') return [];
    // figure, div, section…: their blocks, in order.
    return children.flatMap((child) => block(child, depth));
  };

  return block(root)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

export interface WordPressPost {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  date: string;
  status: string;
  categories: string[];
}

/**
 * A WordPress post as the column-shaped row the mapping step understands, so a
 * WordPress import and a CSV import share one mapping screen. Content is
 * already Markdown by now.
 */
export const WORDPRESS_COLUMNS = ['Title', 'Slug', 'Content', 'Excerpt', 'Date', 'Status', 'Categories'] as const;
export const wordPressRow = (post: WordPressPost): string[] => [
  post.title,
  post.slug,
  post.content,
  post.excerpt,
  post.date,
  post.status,
  post.categories.join('; '),
];

/** Pages, attachments, menu items and drafts-in-the-bin are not posts to import. */
export const isImportablePost = (type: string, status: string) =>
  (type === 'post' || type === 'page') && status !== 'trash' && status !== 'auto-draft';
