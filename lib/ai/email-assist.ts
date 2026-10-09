// ---------------------------------------------------------------------------
// Writing help for Communications: the plain-text version of an email, written
// from its HTML. Prompts and output clean-up live here, pure and tested; the
// provider call is app/api/communications/assist/route.ts. The result is a
// suggestion dropped into the editor — nothing is saved until the user saves.
// ---------------------------------------------------------------------------

export interface EmailAssistMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Enough for any real email; a pasted page beyond it is cut, not refused. */
const MAX_HTML = 40_000;

const SYSTEM =
  'You turn HTML emails into their plain-text version for inboxes that do not show HTML. ' +
  'Keep every word of the message, in order and in its own language — do not translate, summarise, rewrite, add or drop anything. ' +
  'Write a link as its words followed by the address in brackets, e.g. "Order now (https://example.com/order)". ' +
  'Keep merge fields such as {{customer.firstName}} exactly as written, braces included. ' +
  'Separate sections with one blank line. No Markdown, no HTML, no preamble — reply with the plain text only.';

/** The HTML without what never reads as words: styles, scripts, comments, the head. */
export function emailHtmlForModel(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > MAX_HTML ? stripped.slice(0, MAX_HTML) : stripped;
}

export function plainTextMessages(html: string): EmailAssistMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Write the plain-text version of this email.\n\n${emailHtmlForModel(html)}` },
  ];
}

/** Every distinct `{{merge.field}}` in the text, in first-seen order. */
export function mergeTokens(text: string): string[] {
  return [...new Set((text.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map((token) => token.replace(/\s+/g, '')))];
}

/** Merge fields the HTML uses that the plain text lost — each would leave a reader without their details. */
export function missingMergeTokens(html: string, text: string): string[] {
  const kept = new Set(mergeTokens(text));
  return mergeTokens(emailHtmlForModel(html)).filter((token) => !kept.has(token));
}

/** The model's reply as the textarea wants it: unfenced, no label, tidy blank lines. */
export function cleanPlainText(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\n?|\n?```$/g, '')
    .replace(/^(plain[- ]text( version)?)\s*:\s*/i, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Preview text ──────────────────────────────────────────────────────────────

/** Most inboxes cut the preview line around here — the same limit the editor counts to. */
export const PREHEADER_MAX = 90;

const PREHEADER_SYSTEM =
  'You write the preview text of marketing and service emails for a café business: the grey line an inbox shows after the subject. ' +
  'Write it in the same language the email is written in — never translate it, and never switch to English for an email that is not in English. ' +
  'Judge the language from the body text, not from merge fields, links or markup. ' +
  'One sentence, at most 90 characters, natural for a native speaker (British spelling when the email is English). ' +
  'Add to the subject — never repeat it — and give a reason to open. ' +
  'Only use facts that are in the email. Merge fields such as {{customer.firstName}} may be used exactly as written. ' +
  'No emoji, no quotes, no preamble — reply with the preview text only.';

export function preheaderMessages(input: { html: string; subject?: string }): EmailAssistMessage[] {
  return [
    { role: 'system', content: PREHEADER_SYSTEM },
    {
      role: 'user',
      content: `Subject: ${input.subject?.trim() || '(none yet)'}\n\nWrite the preview text for this email, in the email's own language.\n\n${emailHtmlForModel(input.html)}`,
    },
  ];
}

/** The reply as one preview line: unquoted, unlabelled, on one line, cut at a word inside the limit. */
export function cleanPreheader(raw: string): string {
  let text = raw
    .trim()
    .replace(/^```[a-z]*\n?|\n?```$/g, '')
    .replace(/^(preview( text)?|preheader)\s*:\s*/i, '')
    .replace(/^["“'‘]([\s\S]*)["”'’]$/, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > PREHEADER_MAX) {
    const cut = text.slice(0, PREHEADER_MAX - 1);
    text = `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,;:–—-]+$/, '')}…`;
  }
  return text;
}
