'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the window is at least `px` wide, live as it resizes. For layout
 * that CSS alone can't do — dealing cards into a number of columns. The
 * server snapshot is the narrow layout, so hydration never disagrees.
 */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
