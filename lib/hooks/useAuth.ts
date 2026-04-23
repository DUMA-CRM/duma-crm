'use client';

// Interface Segregation: components import only this hook — they never
// touch the service or store directly.
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signIn, signOut } from '@/lib/api/auth.service';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      const session = await signIn(email, password);
      setUser(session.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await signOut().catch(() => {}); // best-effort — clear client state regardless
    setUser(null);
    router.push('/sign-in');
  }

  return { user, login, logout, isLoading, error };
}
