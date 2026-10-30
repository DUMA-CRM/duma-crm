'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { SIGN_UP_PATH } from '@/lib/marketing/site';

/**
 * Pressing S anywhere on the marketing site opens sign-up — the shortcut the
 * "S" chip on every sign-up button advertises. Ignored while typing, with a
 * modifier held, or when another handler already took the key.
 */
export function SignUpShortcut() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 's' && event.key !== 'S') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      router.push(SIGN_UP_PATH);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return null;
}
