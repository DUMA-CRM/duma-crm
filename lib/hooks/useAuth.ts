'use client';

// Interface Segregation: components import only this hook — they never
// touch the service or store directly.
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { resetAnalytics, track } from '@/lib/analytics/client';
import { signIn, signOut } from '@/lib/modules/identity/client';
import { useAuthStore } from '@/stores/authStore';
import { useLoginIntroStore } from '@/stores/loginIntroStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function useAuth() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, setUser, setRole } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      const session = await signIn(email, password);
      setUser(session.user);
      track('user_signed_in', undefined, { beforeNavigation: true });
      // Armed before navigating so the intro is already up when the CRM layout
      // paints — it doubles as cover for the dashboard's first data fetches.
      useLoginIntroStore.getState().start();
      // Honour ?next= from the auth guard only when it resolves to this origin.
      const next = new URLSearchParams(window.location.search).get('next');
      let destination = '/dashboard';
      if (next?.startsWith('/')) {
        try {
          const target = new URL(next, window.location.origin);
          if (target.origin === window.location.origin) destination = `${target.pathname}${target.search}${target.hash}`;
        } catch {
          // Keep the dashboard as the safe fallback for malformed destinations.
        }
      }
      // The session cookie is set by the API response. A full document
      // navigation makes the dashboard's server-side session guard read that
      // newly stored cookie, instead of racing an App Router transition.
      window.location.replace(destination);
    } catch (err) {
      track('sign_in_failed');
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await signOut().catch(() => {}); // best-effort — clear client state regardless
    track('user_signed_out');
    resetAnalytics();
    setUser(null);
    setRole(null);
    // Workspace selection is account-specific. Keeping it on a shared tablet
    // can make the next user query a tenant they cannot access.
    useWorkspaceStore.getState().setContext(null, { kind: 'unresolved' });
    // Drop all cached API data so nothing sensitive survives sign-out in memory.
    qc.clear();
    // Remove any navigation responses cached by an older service worker before
    // the privacy-safe worker activates.
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith('duma-user-') || key.startsWith('duma-pages-')).map((key) => caches.delete(key)),
      );
    }
    router.replace('/sign-in');
  }

  return { user, login, logout, isLoading, error };
}
