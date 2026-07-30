'use client';

import { useLayoutEffect } from 'react';

import type { StaffProfile } from '@/lib/api/staff.service';
import { roleAtLeast } from '@/lib/api/staff.service';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineOrdersStore } from '@/stores/offlineOrdersStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type AssignedWorkspace = Pick<StaffProfile, 'tenantId' | 'role' | 'locationIds'>;

export function WorkspaceInitializer({ profile }: { profile: AssignedWorkspace | null }) {
  const userId = useAuthStore((state) => state.user?.id);

  useLayoutEffect(() => {
    if (!profile) return;

    if (userId) useOfflineOrdersStore.getState().claimUnscoped(userId, profile.tenantId);
    if (profile.role === 'super_admin') return;

    const current = useWorkspaceStore.getState();
    const assignedLocations = profile.locationIds ?? [];
    const tenantChanged = current.tenantId !== profile.tenantId;
    const currentLocationIsAssigned = !!current.locationId && assignedLocations.includes(current.locationId);

    // Every non-super-admin is fixed to their profile tenant. Restricted roles
    // cannot visit Workspaces, so also keep a valid assigned location or choose
    // their first one. Owners may select any location within their tenant.
    const locationId = roleAtLeast(profile.role, 'franchise_owner')
      ? tenantChanged
        ? null
        : current.locationId
      : !tenantChanged && (assignedLocations.length === 0 || currentLocationIsAssigned)
        ? current.locationId
        : (assignedLocations[0] ?? null);

    if (tenantChanged || current.locationId !== locationId) {
      useWorkspaceStore.setState({ tenantId: profile.tenantId, locationId });
    }
  }, [profile, userId]);

  return null;
}
