// ---------------------------------------------------------------------------
// The Notes editor's own rules, kept out of the components so they are
// testable: the colour palette (stored as CSS variables, so a coloured word
// follows light and dark mode), what a typed link becomes, which Content
// files can go into a note, and the word count under it.
// ---------------------------------------------------------------------------

/** Notion's palette, which people already know. "Default" is the absence of a colour. */
export const NOTE_COLOURS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
export type NoteColour = (typeof NOTE_COLOURS)[number];
export type NoteColourKind = 'text' | 'mark';

/**
 * What is stored on the mark: a variable, not a hex. The values live in
 * globals.css (`--note-text-*`, `--note-mark-*`), defined for both themes.
 */
export const noteColourValue = (kind: NoteColourKind, colour: NoteColour) => `var(--note-${kind}-${colour})`;

/** The palette entry a stored value names — or null for a colour from elsewhere (a pasted page). */
export function noteColourOf(kind: NoteColourKind, value: unknown): NoteColour | null {
  if (typeof value !== 'string') return null;
  const match = /^var\(--note-(text|mark)-([a-z]+)\)$/.exec(value.trim());
  if (!match || match[1] !== kind) return null;
  return (NOTE_COLOURS as readonly string[]).includes(match[2]!) ? (match[2] as NoteColour) : null;
}

const UNSAFE_SCHEME = /^\s*(javascript|data|vbscript|file):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * What a typed link becomes: `costa.co.uk` → `https://costa.co.uk`, an email
 * address → `mailto:`, a phone number → `tel:`. Null for nothing, or for a
 * scheme that could run script.
 */
export function normaliseNoteLink(input: string): string | null {
  const value = input.trim();
  if (!value || value === 'https://') return null;
  if (UNSAFE_SCHEME.test(value)) return null;
  if (HAS_SCHEME.test(value) || value.startsWith('/') || value.startsWith('#')) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^\+?[\d\s()-]{7,}$/.test(value)) return `tel:${value.replace(/[\s()-]/g, '')}`;
  return `https://${value}`;
}

/** What a Content file can be in a note: an image, a video, or nothing. */
export function noteMediaKind(mimeType: string): 'image' | 'video' | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return null;
}

export interface NoteLength {
  words: number;
  characters: number;
  minutes: number;
}

/** Words and minutes to read, for the Notes header. 200 words a minute. */
export function noteLength(text: string): NoteLength {
  const words = text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return { words, characters: text.replace(/\s/g, '').length, minutes: words === 0 ? 0 : Math.max(1, Math.round(words / 200)) };
}
