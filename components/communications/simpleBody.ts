/**
 * "Simple mode" template bodies.
 *
 * Templates are stored as a single `htmlBody` string, so simple mode keeps its
 * block list in a base64 marker comment at the top of that HTML. When the marker
 * is present the editor can round-trip the blocks; when it isn't (hand-written
 * HTML) the editor stays on the HTML tab and offers a best-effort import.
 */

export type SimpleBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'button'; text: string; url: string }
  | { type: 'divider' };

export const BLOCK_LABELS: Record<SimpleBlock['type'], string> = {
  heading: 'Heading',
  text: 'Paragraph',
  button: 'Button',
  divider: 'Divider',
};

const MARKER_PREFIX = '<!--duma-simple:';
const MARKER_SUFFIX = '-->';

export function newBlock(type: SimpleBlock['type']): SimpleBlock {
  if (type === 'heading') return { type, text: 'Hello {{customer.firstName}},' };
  if (type === 'text') return { type, text: 'Write your message here.' };
  if (type === 'button') return { type, text: 'View our menu', url: 'https://' };
  return { type: 'divider' };
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function encodeMarker(blocks: SimpleBlock[]): string {
  const json = JSON.stringify(blocks);
  // Base64 keeps "--" and other comment-breaking sequences out of the marker.
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeMarker(encoded: string): SimpleBlock[] | null {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(parsed)) return null;
    const blocks = parsed.filter((block): block is SimpleBlock => {
      if (typeof block !== 'object' || block === null) return false;
      const type = (block as { type?: unknown }).type;
      return type === 'heading' || type === 'text' || type === 'button' || type === 'divider';
    });
    return blocks.length ? blocks : null;
  } catch {
    return null;
  }
}

/** Paragraph text: blank lines start a new paragraph, single newlines become <br>. */
function paragraphs(text: string, style: string): string {
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p style="${style}">${escapeHtml(chunk).replaceAll('\n', '<br />')}</p>`)
    .join('');
}

/** Renders blocks to inline-styled, email-client-safe HTML (with the round-trip marker). */
export function renderSimpleBody(blocks: SimpleBlock[]): string {
  const body = blocks
    .map((block) => {
      if (block.type === 'heading') {
        return `<h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#25221d">${escapeHtml(block.text)}</h2>`;
      }
      if (block.type === 'text') {
        return paragraphs(block.text, 'margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f3a33');
      }
      if (block.type === 'button') {
        const url = escapeHtml(block.url.trim() || '#');
        return `<p style="margin:22px 0"><a href="${url}" style="display:inline-block;background:#25221d;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:15px;font-weight:600">${escapeHtml(
          block.text,
        )}</a></p>`;
      }
      return '<hr style="border:none;border-top:1px solid #e6e1d8;margin:22px 0" />';
    })
    .join('');

  return `${MARKER_PREFIX}${encodeMarker(blocks)}${MARKER_SUFFIX}<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#25221d">${body}</div>`;
}

/** Blocks stored in the HTML, or null when the body was hand-written. */
export function readSimpleBody(html: string): SimpleBlock[] | null {
  if (!html.startsWith(MARKER_PREFIX)) return null;
  const end = html.indexOf(MARKER_SUFFIX);
  if (end === -1) return null;
  return decodeMarker(html.slice(MARKER_PREFIX.length, end));
}

export function isSimpleBody(html: string): boolean {
  return readSimpleBody(html) !== null;
}

/**
 * Best-effort conversion of arbitrary HTML into blocks, for users who want to
 * move a hand-written template into simple mode. Formatting is lost by design —
 * the caller warns first.
 */
export function htmlToBlocks(html: string): SimpleBlock[] {
  const existing = readSimpleBody(html);
  if (existing) return existing;

  const withoutHead = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<hr[^>]*>/gi, '\n@@divider@@\n');

  // Keep link text and remember the first button-ish link so it survives.
  const firstLink = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(withoutHead);

  const headingMatches = [...withoutHead.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)];
  const headingText = headingMatches.length ? stripTags(headingMatches[0][1]) : '';

  const text = stripTags(
    withoutHead
      .replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi, '\n')
      .replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n\n'),
  );

  const blocks: SimpleBlock[] = [];
  if (headingText) blocks.push({ type: 'heading', text: headingText });
  for (const chunk of text.split(/\n{2,}/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (trimmed === '@@divider@@') {
      blocks.push({ type: 'divider' });
      continue;
    }
    blocks.push({ type: 'text', text: trimmed });
  }
  if (firstLink) {
    const label = stripTags(firstLink[2]).trim();
    if (label) blocks.push({ type: 'button', text: label, url: firstLink[1] });
  }
  return blocks.length ? blocks : [newBlock('heading'), newBlock('text')];
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ''))
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

/** Plain-text fallback generated from blocks, so users never have to write one. */
export function blocksToPlainText(blocks: SimpleBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === 'divider') return '---';
      if (block.type === 'button') return `${block.text}: ${block.url}`;
      return block.text;
    })
    .filter(Boolean)
    .join('\n\n');
}
