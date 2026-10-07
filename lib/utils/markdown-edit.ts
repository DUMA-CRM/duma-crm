// ---------------------------------------------------------------------------
// Text edits behind the Markdown editor's toolbar, shortcuts and image
// insertion. Each command returns a `TextEdit` — replace [from, to) with
// `insert`, then select [selectFrom, selectTo] — rather than a new string, so
// the editor can apply it through the browser's own text insertion and keep
// the undo stack. Pure, so every rule here is tested.
// ---------------------------------------------------------------------------

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
  selectFrom: number;
  selectTo: number;
}

/** Apply an edit to a string — what the editor falls back to, and what tests check. */
export function applyEdit(text: string, edit: TextEdit): string {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}

/**
 * Wrap the selection in `marker` (bold `**`, italic `_`, code `` ` ``). With
 * nothing selected the placeholder is inserted and selected, ready to type
 * over. Already wrapped — inside or just outside the selection — unwraps.
 */
export function toggleWrap(text: string, start: number, end: number, marker: string, placeholder: string): TextEdit {
  const selected = text.slice(start, end);
  const m = marker.length;
  if (selected.length >= 2 * m && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(m, -m);
    return { from: start, to: end, insert: inner, selectFrom: start, selectTo: start + inner.length };
  }
  if (text.slice(start - m, start) === marker && text.slice(end, end + m) === marker) {
    return { from: start - m, to: end + m, insert: selected, selectFrom: start - m, selectTo: end - m };
  }
  const inner = selected || placeholder;
  return { from: start, to: end, insert: `${marker}${inner}${marker}`, selectFrom: start + m, selectTo: start + m + inner.length };
}

/** `[text](url)` — the selection becomes the text and `url` is selected to type over. */
export function insertLink(text: string, start: number, end: number): TextEdit {
  const label = text.slice(start, end) || 'link text';
  const insert = `[${label}](url)`;
  const urlAt = start + label.length + 3;
  return { from: start, to: end, insert, selectFrom: urlAt, selectTo: urlAt + 3 };
}

type LinePrefix = 'heading' | 'quote' | 'bullet' | 'number' | 'task';

const PREFIX_PATTERN: Record<LinePrefix, RegExp> = {
  heading: /^#{1,6} /,
  quote: /^> ?/,
  bullet: /^[-*+] (?!\[[ xX]\] )/,
  number: /^\d+\. /,
  task: /^[-*+] \[[ xX]\] /,
};

/**
 * Prefix every line the selection touches (`### `, `> `, `- `, `1. `,
 * `- [ ] `). If every line already carries it, remove it instead — the
 * toolbar button is a toggle, as on GitHub. Another list marker is swapped
 * rather than stacked.
 */
export function toggleLinePrefix(text: string, start: number, end: number, kind: LinePrefix): TextEdit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end > start && text[end - 1] === '\n' ? end - 1 : end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const all = lines.every((line) => PREFIX_PATTERN[kind].test(line));
  const listKinds: LinePrefix[] = ['bullet', 'number', 'task'];

  const next = lines.map((line, index) => {
    if (all) return line.replace(PREFIX_PATTERN[kind], '');
    let bare = line;
    if (listKinds.includes(kind)) for (const other of listKinds) bare = bare.replace(PREFIX_PATTERN[other], '');
    const prefix =
      kind === 'heading' ? '### ' : kind === 'quote' ? '> ' : kind === 'bullet' ? '- ' : kind === 'number' ? `${index + 1}. ` : '- [ ] ';
    return `${prefix}${bare}`;
  });
  const insert = next.join('\n');
  // A single empty line keeps the caret after the new prefix, ready to type.
  const collapsed = start === end && lines.length === 1;
  const caret = lineStart + insert.length;
  return { from: lineStart, to: lineEnd, insert, selectFrom: collapsed ? caret : lineStart, selectTo: caret };
}

/**
 * Insert a block (an image, a table) at the caret on lines of its own — with a
 * blank line before and after unless the text already has one — and put the
 * caret after it. Replaces any selection.
 */
export function insertBlock(text: string, start: number, end: number, block: string): TextEdit {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.length === 0 ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const insert = `${lead}${block}${trail}`;
  const caret = start + lead.length + block.length + (trail ? Math.min(trail.length, 2) : 0);
  return { from: start, to: end, insert, selectFrom: caret, selectTo: caret };
}

/** Alt text cannot close the bracket; a URL with spaces or parentheses is wrapped in `<>`. */
export function imageMarkdown(alt: string, url: string): string {
  const safeAlt = alt
    .replace(/[[\]\\]/g, '\\$&')
    .replace(/\s+/g, ' ')
    .trim();
  const safeUrl = /[\s()<>]/.test(url) ? `<${url.replace(/[<>]/g, encodeURIComponent)}>` : url;
  return `![${safeAlt}](${safeUrl})`;
}

/** The temporary line a paste or drop leaves while its upload runs. Unique per upload. */
export const uploadPlaceholder = (fileName: string, token: string) => `![Uploading ${fileName.replace(/[[\]]/g, '')}… ${token}]()`;

/**
 * Enter inside a list continues it: `- `, `1. ` (numbered on), `- [ ] ` and
 * `> `. Enter on an item with nothing after its marker ends the list instead,
 * clearing the marker. Returns null when Enter should behave normally.
 */
export function continueList(text: string, caret: number): TextEdit | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const line = text.slice(lineStart, caret);
  const match = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. |> ?)(.*)$/.exec(line);
  if (!match) return null;
  const [, indent = '', marker = '', number, rest = ''] = match;
  if (!rest.trim() && text.slice(caret).split('\n')[0]!.trim() === '') {
    return { from: lineStart, to: caret, insert: '', selectFrom: lineStart, selectTo: lineStart };
  }
  const nextMarker = number !== undefined ? `${Number(number) + 1}. ` : marker.replace(/\[[xX]\]/, '[ ]');
  const insert = `\n${indent}${nextMarker}`;
  return { from: caret, to: caret, insert, selectFrom: caret + insert.length, selectTo: caret + insert.length };
}

// ─── Links, callouts, embeds ────────────────────────────────────────────────

/** `[label](url)` over the selection; the selection (or `fallback`) is the label. Caret after the link. */
export function insertNamedLink(text: string, start: number, end: number, url: string, fallback: string): TextEdit {
  const label = (text.slice(start, end) || fallback).replace(/[[\]]/g, '\\$&');
  const insert = `[${label}](${/[\s()]/.test(url) ? `<${url}>` : url})`;
  return { from: start, to: end, insert, selectFrom: start + insert.length, selectTo: start + insert.length };
}

/** GitHub's alert kinds — the syntax GitHub, many static-site tools and our preview all render. */
export const CALLOUT_KINDS = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

/** Turn the selected lines (or a placeholder) into `> [!KIND]` and quote each line. */
export function insertCallout(text: string, start: number, end: number, kind: CalloutKind): TextEdit {
  const body = text.slice(start, end) || 'Something readers should know.';
  const block = [`> [!${kind}]`, ...body.split('\n').map((line) => `> ${line}`.trimEnd())].join('\n');
  const edit = insertBlock(text, start, end, block);
  if (text.slice(start, end)) return edit;
  // Select the placeholder so typing replaces it.
  const at = edit.from + edit.insert.indexOf(body);
  return { ...edit, selectFrom: at, selectTo: at + body.length };
}

/** `[!NOTE]` at the start of a quote → its kind; anything else is an ordinary quote. */
export function calloutKind(firstLine: string): CalloutKind | null {
  const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(firstLine.trim());
  return match ? (match[1]!.toUpperCase() as CalloutKind) : null;
}

/** A video a paragraph consists of — YouTube or Vimeo — or null. */
export function videoEmbed(url: string): { provider: 'youtube' | 'vimeo'; id: string; url: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be')
    return /^[\w-]{6,}$/.test(parsed.pathname.slice(1)) ? { provider: 'youtube', id: parsed.pathname.slice(1), url } : null;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = parsed.searchParams.get('v') ?? /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(parsed.pathname)?.[1];
    return id && /^[\w-]{6,}$/.test(id) ? { provider: 'youtube', id, url } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = /\/(?:video\/)?(\d{5,})/.exec(parsed.pathname)?.[1];
    return id ? { provider: 'vimeo', id, url } : null;
  }
  return null;
}
