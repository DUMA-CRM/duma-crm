'use client';

import { useEffect } from 'react';

import type { StaffRole } from '@/lib/api/staff.service';
import type { User } from '@/lib/api/auth.service';
import { useAuthStore } from '@/stores/authStore';

export function AuthInitializer({
  user,
  role = null,
  capabilities = [],
}: {
  user: User;
  role?: StaffRole | null;
  capabilities?: string[];
}) {
  // Depend on the joined list, not the array: the server sends a fresh array on
  // every render, so using its identity would re-run this effect each time and
  // push a new reference into the store, waking every subscriber for nothing.
  const capabilityKey = capabilities.join(',');

  useEffect(() => {
    useAuthStore.setState({ user, role, capabilities: capabilityKey ? capabilityKey.split(',') : [], isLoaded: true });
  }, [user, role, capabilityKey]);
  return null;
}
