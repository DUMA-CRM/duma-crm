'use client';

import { useLayoutEffect } from 'react';

import type { StaffProfile } from '@/lib/api/staff.service';
import { roleAtLeast } from '@/lib/api/staff.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type AssignedWorkspace = Pick<StaffProfile, 'tenantId' | 'role' | 'locationIds'>;

export function WorkspaceInitializer({ profile }: { profile: AssignedWorkspace | null }) {
  useLayoutEffect(() => {
    if (!profile || roleAtLeast(profile.role, 'franchise_owner')) return;

    const current = useWorkspaceStore.getState();
    const assignedLocations = profile.locationIds ?? [];
    const tenantChanged = current.tenantId !== profile.tenantId;
    const currentLocationIsAssigned = !!current.locationId && assignedLocations.includes(current.locationId);

    // Restricted roles cannot visit Workspaces to establish this context. Keep
    // a valid persisted location, otherwise select their first assignment.
    const locationId =
      !tenantChanged && (assignedLocations.length === 0 || currentLocationIsAssigned) ? current.locationId : (assignedLocations[0] ?? null);

    if (tenantChanged || current.locationId !== locationId) {
      useWorkspaceStore.setState({ tenantId: profile.tenantId, locationId });
    }
  }, [profile]);

  return null;
}
