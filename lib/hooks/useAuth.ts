'use client';

// Interface Segregation: components import only this hook — they never
// touch the service or store directly.
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { resetAnalytics, track } from '@/lib/analytics/client';
import { signIn, signOut, startGoogleSignIn } from '@/lib/modules/identity/client';
import { signInDestination } from '@/lib/utils/sign-in';
import { useAuthStore } from '@/stores/authStore';
import { useLoginIntroStore } from '@/stores/loginIntroStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function useAuth() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, setUser, setRole } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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
      // The session cookie is set by the API response. A full document
      // navigation makes the dashboard's server-side session guard read that
      // newly stored cookie, instead of racing an App Router transition.
      window.location.replace(destinationFromLocation());
    } catch (err) {
      track('sign_in_failed');
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  // Leaves the page for Google. The API's callback sets the session cookie and
  // lands on the destination directly, or back here with `?error=CODE`.
  async function loginWithGoogle() {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const { origin } = window.location;
      const url = await startGoogleSignIn(`${origin}${destinationFromLocation()}`, `${origin}/sign-in`);
      track('google_sign_in_started', undefined, { beforeNavigation: true });
      window.location.assign(url);
    } catch {
      track('sign_in_failed');
      setError('Google sign-in isn’t available right now. Use your email and password.');
      setIsGoogleLoading(false);
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

  return { user, login, loginWithGoogle, logout, isLoading, isGoogleLoading, error };
}

function destinationFromLocation() {
  return signInDestination(new URLSearchParams(window.location.search).get('next'), window.location.origin);
}
