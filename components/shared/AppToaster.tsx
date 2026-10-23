'use client';

import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sileo';

import { toastPositionFor } from '@/lib/utils/toast-position';

/**
 * The one sileo viewport, mounted in QueryProvider. Its default position
 * follows the route (`toastPositionFor`); critical toasts override it per call.
 * Theme follows the next-themes class rather than sileo's own `system` lookup,
 * so a user who picked dark in Profile gets dark toasts regardless of their OS.
 */
export function AppToaster() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  return <Toaster position={toastPositionFor(pathname)} theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />;
}
