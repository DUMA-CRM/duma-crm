// Links between notes: an ordinary link to `/notes?note=<id>` — what the editor's
// [[ picker writes, and what "Copy link" copies. Pure, so tests/note-links.test.mts
// can check it.

const NOTE_ID = /[?&]note=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[&#]|$)/i;

export const noteHref = (id: string) => `/notes?note=${id}`;

/** The note a link points at — a `/notes?note=` link, relative or absolute on any host — or null. */
export function noteIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const at = href.indexOf('/notes?');
  if (at === -1) return null;
  return NOTE_ID.exec(href.slice(at + '/notes'.length))?.[1]?.toLowerCase() ?? null;
}

/** The text typed after an unclosed `[[` right before the caret, or null if there isn't one. */
export function noteLinkQuery(textBeforeCaret: string): string | null {
  const match = /\[\[([^\[\]\n]{0,60})$/.exec(textBeforeCaret);
  return match ? match[1]! : null;
}

/** What a note with no title is called, wherever its name is shown. */
export const untitledNote = (kind?: 'note' | 'drawing' | null) => (kind === 'drawing' ? 'Untitled drawing' : 'New note');

/**
 * What a link to a note should say now its note may have been renamed, or null
 * to leave it. The [[ picker writes the title as the link's text and remembers
 * it (`savedTitle`); while the text is still that title, it follows renames.
 * Text someone wrote themselves is theirs and is never touched. Links made
 * before titles were remembered follow too, unless their text is a URL — a
 * pasted "Copy link".
 */
export function relinkedText(link: { text: string; savedTitle: string | null }, currentTitle: string): string | null {
  const text = link.text.trim();
  const current = currentTitle.trim();
  if (!current || text === current) return null;
  const following = link.savedTitle !== null ? text === link.savedTitle.trim() : !/^(https?:\/\/|\/)/i.test(text);
  return following ? current : null;
}
