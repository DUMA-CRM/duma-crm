'use client';

// Interface Segregation: components import only this hook — they never
// touch the service or store directly.
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signIn, signOut, signUp } from '@/lib/api/auth.service';
import { useAuthStore } from '@/stores/authStore';
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
      // Honour ?next= from the auth guard — internal paths only (a value like
      // "//evil.com" would be treated as protocol-relative and open-redirect).
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  async function register(name: string, email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      const { user: created } = await signUp(name, email, password);
      setUser(created);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await signOut().catch(() => {}); // best-effort — clear client state regardless
    setUser(null);
    setRole(null);
    // Workspace selection is account-specific. Keeping it on a shared tablet
    // can make the next user query a tenant they cannot access.
    useWorkspaceStore.setState({ tenantId: null, locationId: null });
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

  return { user, login, register, logout, isLoading, error };
}
