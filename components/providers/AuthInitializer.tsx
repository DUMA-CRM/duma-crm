'use client';

import { useEffect } from 'react';

import type { StaffRole } from '@/lib/api/staff.service';
import type { User } from '@/lib/api/auth.service';
import { useAuthStore } from '@/stores/authStore';

export function AuthInitializer({ user, role = null }: { user: User; role?: StaffRole | null }) {
  useEffect(() => {
    useAuthStore.setState({ user, role, isLoaded: true });
  }, [user, role]);
  return null;
}
