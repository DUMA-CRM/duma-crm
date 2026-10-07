/**
 * The arithmetic behind the "it worked" moments — a secret decoding into place,
 * a save bar holding its "Saved" beat. Kept here so it can be tested without a DOM.
 */

const SCRAMBLE_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * One frame of a secret decoding left to right. `progress` 0 is all noise, 1 is
 * the secret itself. Punctuation (`_`, `-`, `.`) is never scrambled, so a
 * prefix like `cms_live_` keeps its shape and the token reads as itself throughout.
 */
export function scrambleFrame(target: string, progress: number, random: () => number = Math.random): string {
  const clamped = Math.min(1, Math.max(0, progress));
  const settled = Math.floor(target.length * clamped);
  let out = '';
  for (let index = 0; index < target.length; index += 1) {
    const char = target[index]!;
    out += index < settled || !/[A-Za-z0-9]/.test(char) ? char : SCRAMBLE_GLYPHS[Math.floor(random() * SCRAMBLE_GLYPHS.length)]!;
  }
  return out;
}

export interface SaveWatch {
  saving: boolean;
  dirty: boolean;
  /** A save ended with the form still dirty — waiting on its refetch to clean it. */
  awaiting: boolean;
}

/** How long after a save ends a form may take to come back clean (a refetch) and still count. */
export const SAVE_SETTLE_MS = 5000;

/**
 * Whether a save just landed, read from the save bar's own props. Most forms
 * only come back clean after the refetch that follows a save, so a save that
 * ends dirty is awaited rather than called a failure — the caller has already
 * toasted a real failure. The caller drops `awaiting` after `SAVE_SETTLE_MS`
 * and on discard, or discarding after a failed save would read as a success.
 */
export function watchSave(previous: SaveWatch, next: { saving: boolean; dirty: boolean }): { watch: SaveWatch; saved: boolean } {
  if (next.saving) return { watch: { ...next, awaiting: false }, saved: false };
  if (previous.saving) return { watch: { ...next, awaiting: next.dirty }, saved: !next.dirty };
  const saved = previous.awaiting && previous.dirty && !next.dirty;
  return { watch: { ...next, awaiting: previous.awaiting && next.dirty }, saved };
}
