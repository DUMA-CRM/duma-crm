'use client';

import { useQuery } from '@tanstack/react-query';

import { hasCapability } from '@/lib/auth/capabilities';
import { useTenants } from '@/lib/hooks/useTenants';
import { type Tenant, getCurrentTenant, getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The workspace and location the app is working in, for any role.
 *
 * A platform admin reads the tenant list (`tenants:read`); an owner reads
 * `/tenants/current`, scoped to their own profile. Anyone else gets no tenant
 * row at all, rather than a 403 surfacing as an error on a personal page.
 */
export function useCurrentWorkspace() {
  const capabilities = useAuthStore((state) => state.capabilities);
  const { tenantId, locationId } = useWorkspaceStore();
  const platform = hasCapability(capabilities, 'tenants:read');
  const owner = !platform && hasCapability(capabilities, 'settings:read');

  const { tenants, isLoading: tenantsLoading } = useTenants({ enabled: platform });
  const own = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant'),
    queryFn: getCurrentTenant,
    enabled: owner,
  });
  const locations = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: Boolean(tenantId),
  });

  const tenant: Tenant | undefined = platform ? tenants.find((row) => row.id === tenantId) : own.data;
  return {
    tenant,
    location: locations.data?.find((row) => row.id === locationId),
    locations: locations.data,
    isLoading: (platform && tenantsLoading) || (owner && own.isLoading),
    /** True when this person can see more than their own workspace. */
    isPlatform: platform,
  };
}
