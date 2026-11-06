/**
 * Markdown for agents: a public page asked for with `Accept: text/markdown`
 * comes back as Markdown, while browsers keep getting HTML. `proxy.ts` decides
 * with prefersMarkdown() and servesMarkdown(); app/md/route.ts fetches the
 * page's own HTML and converts its <main> with htmlToMarkdown(). Converting the
 * rendered page, not a hand-kept copy, means the Markdown can never say
 * something the page does not.
 *
 * Pure and dependency-free so the edge proxy and the unit tests share one copy.
 */

import { MARKETING_PATHS } from './public-paths.ts';

/** Set on app/md's own fetch of the page, so the proxy serves it HTML rather than rewriting it back to /md. */
export const MARKDOWN_RENDER_HEADER = 'x-duma-markdown-render';

/** Pages with a Markdown version: the marketing site and the legal pages — never the app or the guest pages. */
const MARKDOWN_PATHS = [...MARKETING_PATHS, '/privacy', '/terms', '/dpa', '/gdpr', '/legal', '/data-deletion'];

export function servesMarkdown(pathname: string): boolean {
  // A dot means a file — sitemap.xml, llms.txt, feed.xml, /.well-known/* — which already has its own format.
  if (pathname.split('/').some((segment) => segment.includes('.')) || pathname.endsWith('/opengraph-image')) return false;
  return pathname === '/' || MARKDOWN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Each media range's q-value, defaulting to 1 (RFC 9110 §12.5.1). */
function qualities(accept: string): Map<string, number> {
  const ranges = new Map<string, number>();
  for (const part of accept.split(',')) {
    const [type, ...params] = part.trim().toLowerCase().split(';');
    if (!type) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    ranges.set(type.trim(), q ? Number(q.slice(2)) || 0 : 1);
  }
  return ranges;
}

/**
 * Markdown only when it is named outright and wanted at least as much as HTML.
 * `*\/*` never counts: a browser sends it, and so does every client that
 * would rather have the page.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const q = qualities(accept);
  const markdown = q.get('text/markdown') ?? 0;
  return markdown > 0 && markdown >= (q.get('text/html') ?? 0);
}

/** A rough token count for `x-markdown-tokens` — about four characters a token, as Cloudflare estimates. */
export function estimateTokens(markdown: string): number {
  return Math.ceil(markdown.length / 4);
}

// --- HTML → Markdown ------------------------------------------------------
//
// Not a general HTML parser: it reads what React renders, which is well-formed
// and escapes `<`, `>` and quotes inside attributes, so a tag always ends at
// the first `>`.

type Node = { tag: string; attrs: string; children: (Node | string)[] };

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Controls, media and navigation — nothing an agent can read or use. */
const SKIP = new Set(['button', 'form', 'input', 'select', 'textarea', 'dialog', 'iframe', 'video', 'audio', 'canvas', 'nav', 'head']);
const BLOCK = new Set(['div', 'section', 'article', 'header', 'footer', 'aside', 'main', 'figure', 'figcaption', 'address', 'dl', 'details', 'fieldset', 'hgroup']);

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', pound: '£', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

function decode(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') return String.fromCodePoint(code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function attr(attrs: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}(?:="([^"]*)")?(?=\\s|/?$)`, 'i').exec(attrs);
  return match ? decode(match[1] ?? '') : undefined;
}

function parse(html: string): Node {
  const root: Node = { tag: '#root', attrs: '', children: [] };
  const stack = [root];
  const source = html.replace(/<(script|style|template|noscript|svg)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const [, close, name, attrs = '', text] of source.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g)) {
    const top = stack[stack.length - 1]!;
    if (text !== undefined) {
      top.children.push(decode(text));
    } else if (close) {
      const tag = name!.toLowerCase();
      const at = stack.findLastIndex((node) => node.tag === tag);
      if (at > 0) stack.length = at;
    } else {
      const node: Node = { tag: name!.toLowerCase(), attrs: attrs.replace(/\/$/, ''), children: [] };
      top.children.push(node);
      if (!VOID.has(node.tag) && !attrs.endsWith('/')) stack.push(node);
    }
  }
  return root;
}

function find(node: Node, tag: string): Node | undefined {
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (child.tag === tag) return child;
    const found = find(child, tag);
    if (found) return found;
  }
}

function textOf(node: Node | string): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('');
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

function hidden(node: Node): boolean {
  return SKIP.has(node.tag) || attr(node.attrs, 'hidden') !== undefined || attr(node.attrs, 'aria-hidden') === 'true';
}

/** `<strong>Free </strong>plan` → `**Free** plan`: the markers hug the words, the spaces stay outside. */
function emphasise(text: string, mark: string): string {
  const [, before, words, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  return words ? `${before}${mark}${words}${mark}${after}` : text;
}

function render(node: Node | string, base: URL): string {
  if (typeof node === 'string') return node.replace(/\s+/g, ' ');
  if (hidden(node)) return '';
  // Siblings laid out apart by CSS (flex gaps, badges, rows) have no space between them in the
  // markup; one goes in wherever two elements meet. Text beside an element is joined as written.
  const inner = () => node.children.map((child, i) => (i > 0 && typeof child !== 'string' && typeof node.children[i - 1] !== 'string' ? ' ' : '') + render(child, base)).join('');
  const block = (text: string) => `\n\n${text.trim()}\n\n`;

  switch (node.tag) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const text = oneLine(inner());
      return text ? block(`${'#'.repeat(Number(node.tag[1]))} ${text}`) : '';
    }
    case 'p': return block(inner());
    case 'br': return '\n';
    case 'hr': return block('---');
    case 'strong': case 'b': return emphasise(inner(), '**');
    case 'em': case 'i': return emphasise(inner(), '*');
    case 'code': return `\`${textOf(node)}\``;
    case 'pre': {
      const code = find(node, 'code');
      const lang = /language-([\w-]+)/.exec(attr(code?.attrs ?? '', 'class') ?? '')?.[1] ?? '';
      return block(`\`\`\`${lang}\n${textOf(node).replace(/\n+$/, '')}\n\`\`\``);
    }
    case 'a': {
      const text = inner();
      const href = attr(node.attrs, 'href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return text;
      const url = new URL(href, base).href;
      // A card — a link wrapped round a heading and its copy — keeps its blocks and links its title.
      if (text.includes('\n')) return block(`${text.trim()}\n\n[${oneLine(textOf(find(node, 'h2') ?? find(node, 'h3') ?? find(node, 'h4') ?? node))}](${url})`);
      return text.trim() ? `[${oneLine(text)}](${url})` : '';
    }
    case 'img': {
      const alt = attr(node.attrs, 'alt');
      const src = attr(node.attrs, 'src');
      return alt && src ? `![${oneLine(alt)}](${new URL(src, base).href})` : '';
    }
    case 'ul': case 'ol': {
      const items = node.children.filter((child): child is Node => typeof child !== 'string' && child.tag === 'li' && !hidden(child));
      const lines = items.map((item, i) => {
        const marker = node.tag === 'ol' ? `${i + 1}. ` : '- ';
        const body = item.children.map((child) => render(child, base)).join('').trim().replace(/\n{2,}/g, '\n');
        return marker + body.split('\n').map((line, n) => (n === 0 ? line.trim() : `${' '.repeat(marker.length)}${line}`)).join('\n');
      });
      return lines.length ? block(lines.join('\n')) : '';
    }
    case 'blockquote': return block(inner().trim().split('\n').map((line) => `> ${line}`.trimEnd()).join('\n'));
    case 'table': {
      const rows: string[][] = [];
      const collect = (n: Node) => {
        for (const child of n.children) {
          if (typeof child === 'string') continue;
          if (child.tag === 'tr') rows.push(child.children.filter((c): c is Node => typeof c !== 'string' && (c.tag === 'td' || c.tag === 'th')).map((cell) => oneLine(render(cell, base)).replaceAll('|', '\\|')));
          else collect(child);
        }
      };
      collect(node);
      if (!rows.length) return '';
      const width = Math.max(...rows.map((row) => row.length));
      const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? '').join(' | ')} |`;
      return block([line(rows[0]!), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n'));
    }
    case 'dt': case 'summary': { const text = oneLine(inner()); return text ? block(`**${text}**`) : ''; }
    case 'dd': case 'li': return block(inner());
    default: return BLOCK.has(node.tag) ? block(inner()) : inner();
  }
}

/** Tidies everything outside code fences: no stray indentation, doubled spaces or runs of blank lines. */
function tidy(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n (?=\S)/g, '\n')
            .replace(/(\S) {2,}(?=\S)/g, '$1 ')
            .replace(/ +([.,;:!?)])/g, '$1'),
    )
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The Markdown version of a rendered page: its title and description, then
 * its <main> — the header, footer and their navigation are the same on every
 * page and tell an agent nothing (/llms.txt is the site map).
 */
export function htmlToMarkdown(html: string, pageUrl: string): string {
  const doc = parse(html);
  const base = new URL(pageUrl);
  const head = find(doc, 'head');
  const title = head && find(head, 'title');
  const description = head?.children.find((node): node is Node => typeof node !== 'string' && node.tag === 'meta' && attr(node.attrs, 'name') === 'description');
  const frontMatter = [
    '---',
    title && `title: ${JSON.stringify(oneLine(textOf(title)))}`,
    description && `description: ${JSON.stringify(oneLine(attr(description.attrs, 'content') ?? ''))}`,
    `url: ${base.href}`,
    '---',
  ].filter(Boolean);
  // `head` is skipped by render(), so a page without <main> still yields only its body.
  return `${frontMatter.join('\n')}\n\n${tidy(render(find(doc, 'main') ?? doc, base))}\n`;
}
