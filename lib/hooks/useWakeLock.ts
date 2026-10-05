'use client';

import { useEffect, useState } from 'react';

/**
 * Keep the screen on while `enabled` — a wall-mounted kitchen tablet must not
 * dim mid-service. The browser drops the lock whenever the page is hidden, so
 * it is taken again each time the page becomes visible. Where the Screen Wake
 * Lock API is missing (older iPadOS) this does nothing and says so.
 */
export function useWakeLock(enabled: boolean) {
  const [held, setHeld] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!enabled || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        setHeld(true);
        lock.addEventListener('release', () => setHeld(false));
      } catch {
        setHeld(false); // battery saver or a denied permission — the screen may dim
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [enabled, supported]);

  return { supported, held: enabled && held };
}
