'use client';

import { useEffect, useMemo } from 'react';

import { type RotaChange, type RotaShiftFields, diffRota, rotaSnapshot } from '@/lib/utils/my-rota';

const storageKey = (userId: string, week: string) => `duma:my-rota-seen:${userId}:${week}`;

function readSnapshot(key: string): Record<string, string> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

/**
 * Which of this week's shifts are new or changed since you last looked.
 *
 * A per-device convenience, so browser storage is right for it: the snapshot
 * of what you saw is read once per week opened — before this visit overwrites
 * it — and saved again whenever the week's shifts load. Pills therefore stay
 * for the whole visit and are gone on the next. Storage that is blocked or
 * empty simply marks nothing; a first visit marks nothing either.
 */
export function useRotaChanges(userId: string | undefined, week: string, shifts: RotaShiftFields[], ready: boolean) {
  // Read when the week (or person) changes, never after this visit's own write.
  const previous = useMemo(() => (userId && typeof window !== 'undefined' ? readSnapshot(storageKey(userId, week)) : null), [userId, week]);

  useEffect(() => {
    if (!ready || !userId) return;
    try {
      window.localStorage.setItem(storageKey(userId, week), JSON.stringify(rotaSnapshot(shifts)));
    } catch {
      // Private mode or full storage: the pills are a convenience, not a record.
    }
  }, [ready, shifts, userId, week]);

  return useMemo<Map<string, RotaChange>>(() => (ready ? diffRota(previous, shifts) : new Map()), [previous, ready, shifts]);
}
