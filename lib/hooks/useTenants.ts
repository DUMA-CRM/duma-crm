'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { type Tenant, getTenants } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The tenant list, plus the one selection rule that belongs with it: when the
 * estate holds exactly one workspace there is nothing to choose, so choose it.
 *
 * Without this a super admin (the only role not pinned to a tenant by their
 * staff profile) can sit in a no-workspace state where locations, POS and
 * reporting all read as empty — a dead end nobody asked for. It also picks up
 * the first workspace the moment it is created.
 *
 * Pass `enabled: false` where the list isn't wanted (the query is shared, so
 * every caller reads the same cache entry).
 */
export function useTenants({ enabled = true }: { enabled?: boolean } = {}): { tenants: Tenant[]; isLoading: boolean; isSuccess: boolean } {
  const tenantId = useWorkspaceStore((s) => s.tenantId);
  const setTenantId = useWorkspaceStore((s) => s.setTenantId);

  const {
    data: tenants = [],
    isLoading,
    isSuccess,
  } = useQuery({ queryKey: moduleQueryKeys.organization.key('tenants'), queryFn: getTenants, enabled });

  useEffect(() => {
    // Only act on a loaded list, never on the transient empty/loading state.
    if (!isSuccess) return;
    // A persisted selection that no longer exists (deleted, or a different user
    // signed in) has to go, or every downstream page sends an invalid tenantId.
    if (tenantId && !tenants.some((t) => t.id === tenantId)) {
      setTenantId(null);
      return;
    }
    if (!tenantId && tenants.length === 1) setTenantId(tenants[0].id);
  }, [isSuccess, tenantId, tenants, setTenantId]);

  return { tenants, isLoading, isSuccess };
}
