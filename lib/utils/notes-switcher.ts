// How the Notes sidebar search ranks titles (⌘O focuses it): part of a word
// matches, titles you can type the start of beat titles that merely contain the
// words, and ties go to the most recently edited. Pure, so
// tests/notes-switcher.test.mts can check it.

export interface SwitcherNote {
  id: string;
  title: string;
  updatedAt: string;
}

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);

/** Higher is better; null means it doesn't match. Every typed word must appear in the title. */
export function switcherScore(title: string, query: string): number | null {
  const typed = words(query);
  if (typed.length === 0) return 0;
  const name = (title.trim() || 'New note').toLowerCase();
  const nameWords = words(name);
  let score = 0;
  for (const word of typed) {
    if (!name.includes(word)) return null;
    if (nameWords.some((part) => part.startsWith(word))) score += 2;
    else score += 1;
  }
  if (name.startsWith(typed.join(' '))) score += 3;
  return score;
}

/** The notes to offer, best first, at most `limit`. With nothing typed: most recently edited. */
export function rankSwitcher<T extends SwitcherNote>(notes: readonly T[], query: string, limit = 12): T[] {
  const scored = notes
    .map((note) => ({ note, score: switcherScore(note.title, query) }))
    .filter((entry): entry is { note: T; score: number } => entry.score !== null);
  scored.sort((a, b) => b.score - a.score || Date.parse(b.note.updatedAt) - Date.parse(a.note.updatedAt));
  return scored.slice(0, limit).map((entry) => entry.note);
}

/** A title cut into runs, the parts that match a typed word marked — for highlighting. */
export function titleParts(title: string, query: string): { text: string; match: boolean }[] {
  const typed = words(query);
  if (!title || typed.length === 0) return title ? [{ text: title, match: false }] : [];
  const lower = title.toLowerCase();
  const marked = new Array<boolean>(title.length).fill(false);
  for (const word of typed) {
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) {
      marked.fill(true, at, at + word.length);
    }
  }
  const parts: { text: string; match: boolean }[] = [];
  for (let index = 0; index < title.length; index++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[index]) last.text += title[index];
    else parts.push({ text: title[index]!, match: marked[index]! });
  }
  return parts;
}
