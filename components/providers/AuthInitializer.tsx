'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/lib/api/auth.service';

export function AuthInitializer({ user }: { user: User }) {
  useEffect(() => {
    useAuthStore.setState({ user, isLoaded: true });
  }, [user]);
  return null;
}
