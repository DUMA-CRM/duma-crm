import { marked } from 'marked';

import { CALLOUT_KINDS, videoEmbed } from './markdown-edit.ts';

// ---------------------------------------------------------------------------
// Whether a CMS rich-text value can be edited live (in the Notes-style editor)
// without changing what a website shows. The live editor writes its own
// Markdown back — `*x*` for `_x_`, its own list markers — so the text may be
// tidied; what must not change is the rendered result, and the two things a
// site reads from the raw text: `> [!KIND]` callouts and a bare video link on
// its own line. Anything else → the entry opens in the Markdown editor.
// ---------------------------------------------------------------------------

/** Rendered HTML with differences no reader sees taken out: whitespace between tags, loose vs tight list items. */
function renderedShape(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true }) as string;
  return html
    .replace(/>\s+</g, '><')
    .replace(/<li>\s*<p>/g, '<li>')
    .replace(/<\/p>\s*<\/li>/g, '</li>')
    .replace(/\s+/g, ' ')
    .trim();
}

const CALLOUT = new RegExp(`^\\s*>\\s*\\[!(${CALLOUT_KINDS.join('|')})\\]\\s*$`, 'i');

/** What a site reads from the raw text, in order: callout markers and bare video links. */
function literalMarkers(markdown: string): string[] {
  return markdown.split('\n').flatMap((line) => {
    const callout = CALLOUT.exec(line);
    if (callout) return [`callout:${callout[1]!.toUpperCase()}`];
    const trimmed = line.trim();
    return trimmed && videoEmbed(trimmed) && /^\S+$/.test(trimmed) ? [`video:${trimmed}`] : [];
  });
}

/** True when `roundTripped` shows readers and websites exactly what `original` did. */
export function survivesRoundTrip(original: string, roundTripped: string): boolean {
  if (renderedShape(original) !== renderedShape(roundTripped)) return false;
  const before = literalMarkers(original);
  const after = literalMarkers(roundTripped);
  return before.length === after.length && before.every((marker, index) => marker === after[index]);
}
