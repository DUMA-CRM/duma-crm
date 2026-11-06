'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * A connector's half-filled setup, kept on this browser so leaving the wizard
 * and coming back picks up where you were. Pass only what is safe to keep:
 * never a token, password or key — those are typed again.
 */
export function useStoredDraft<T extends object>(key: string | null, empty: T) {
  const storageKey = key ? `duma-connect-draft:${key}` : null;
  const [value, setValue] = useState<T>(empty);

  // Restored after mount, so the server and first client render agree.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // Nothing kept, or storage is unavailable: start empty.
    }
  }, [storageKey]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Not kept; the setup still works in this visit.
      }
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    setValue(empty);
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Nothing to clear.
    }
    // `empty` is a fresh literal each render; clearing to the first one is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return { value, set, clear };
}
