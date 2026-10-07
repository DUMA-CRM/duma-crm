// ---------------------------------------------------------------------------
// Draft recovery for the entry editor. Unsaved edits are mirrored to this
// device's storage as you type, so a closed tab, a crash or a dead battery
// does not lose a long post. Nothing leaves the browser; saving clears it.
// ---------------------------------------------------------------------------

export interface StoredDraft {
  data: Record<string, unknown>;
  /** The entry version the edits started from. */
  baseVersion: number;
  savedAt: string;
}

export const draftStorageKey = (entryId: string) => `duma.cms.draft.${entryId}`;

/** Drafts older than this are stale enough to be noise rather than rescue. */
export const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function parseStoredDraft(raw: string | null): StoredDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredDraft>;
    if (!value || typeof value !== 'object' || typeof value.baseVersion !== 'number' || typeof value.savedAt !== 'string') return null;
    if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) return null;
    return value as StoredDraft;
  } catch {
    return null;
  }
}

export type Recovery = { kind: 'none' } | { kind: 'offer'; draft: StoredDraft; outdated: boolean };

/**
 * Offer a stored draft back only when it differs from what the entry now
 * holds and is recent. `outdated`: someone saved the entry after these edits
 * began — restoring would overwrite their save, so the editor says so.
 */
export function recoveryFor(
  draft: StoredDraft | null,
  entry: { version: number; draftData: Record<string, unknown> },
  same: (a: Record<string, unknown>, b: Record<string, unknown>) => boolean,
  now = Date.now(),
): Recovery {
  if (!draft) return { kind: 'none' };
  if (now - Date.parse(draft.savedAt) > DRAFT_MAX_AGE_MS) return { kind: 'none' };
  if (same(draft.data, entry.draftData)) return { kind: 'none' };
  return { kind: 'offer', draft, outdated: draft.baseVersion < entry.version };
}
