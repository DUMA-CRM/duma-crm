'use client';

import { useEffect } from 'react';

import type { User } from '@/lib/api/auth.service';
import { useAuthStore } from '@/stores/authStore';

export function AuthInitializer({ user }: { user: User }) {
  useEffect(() => {
    useAuthStore.setState({ user, isLoaded: true });
  }, [user]);
  return null;
}
