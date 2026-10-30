import { createHmac, timingSafeEqual } from 'node:crypto';

import { type Token, type Tokens, marked } from 'marked';

/**
 * Pure helpers for the blog: heading anchors shared by the table of contents
 * and the renderer, reading time, and the CMS webhook signature check. No
 * network, no React — so the blog's rules are unit-tested.
 */

/** `Margins & VAT: a guide` → `margins-vat-a-guide`. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Gives each heading a unique anchor in document order — a second "Pricing"
 * becomes `pricing-2`. The renderer and the table of contents each make one
 * and walk the same headings in the same order, so their ids agree.
 */
export function headingIds(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = slugify(text) || 'section';
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
}

/** A heading's words without its Markdown — `**Bold** idea` → `Bold idea`. */
export function inlineText(tokens: readonly Token[] | undefined, fallback = ''): string {
  if (!tokens?.length) return fallback;
  return tokens
    .map((token) => {
      if ('tokens' in token && Array.isArray(token.tokens) && token.tokens.length) return inlineText(token.tokens);
      return 'text' in token ? String(token.text) : '';
    })
    .join('');
}

export type TocHeading = { depth: 2 | 3; text: string; id: string };

/** The ## and ### headings of a post, with the anchors the rendered page gives them. */
export function extractHeadings(markdown: string): TocHeading[] {
  const id = headingIds();
  const headings: TocHeading[] = [];
  const walk = (tokens: readonly Token[]) => {
    for (const token of tokens) {
      if (token.type === 'heading') {
        const heading = token as Tokens.Heading;
        const text = inlineText(heading.tokens, heading.text);
        const anchor = id(text);
        if (heading.depth === 2 || heading.depth === 3) headings.push({ depth: heading.depth, text, id: anchor });
      }
    }
  };
  walk(marked.lexer(markdown));
  return headings;
}

/** Words in a post's body, ignoring Markdown syntax, links' addresses and code fences' markers. */
export function wordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*/g, ' '))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Minutes to read at 225 words a minute — never less than one. */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / 225));
}

/**
 * Checks a DUMA CMS webhook: `X-Duma-Signature: v1=<hex HMAC-SHA256 of
 * "${timestamp}.${body}">`, rejecting anything more than five minutes from
 * now — the scheme duma-api lib/cms-webhook-signing.ts signs with.
 */
export function verifyCmsWebhook(
  secret: string,
  timestamp: string | null,
  body: string,
  signature: string | null,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > 300) return false;
  const expected = Buffer.from(`v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex')}`);
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
