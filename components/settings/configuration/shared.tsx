'use client';

import { useSyncExternalStore } from 'react';

/**
 * These settings live in this device's localStorage, so the server render
 * can't know them: render only once mounted, or the first paint shows the
 * defaults and then jumps.
 */
export const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
