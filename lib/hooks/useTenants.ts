'use client';

import { useQuery } from '@tanstack/react-query';

import { type Tenant, getTenants } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

/**
 * Every workspace, for platform administrators.
 *
 * It used to choose for you — selecting the sole workspace, and clearing a
 * selection that had vanished. Both are gone: DUMA Admin is a real place to be,
 * so "no workspace" is a choice rather than a dead end, and a vanished
 * selection now fails visibly in the context boundary with a way back.
 *
 * Pass `enabled: false` where the list isn't wanted (the query is shared, so
 * every caller reads the same cache entry).
 */
export function useTenants({ enabled = true }: { enabled?: boolean } = {}): {
  tenants: Tenant[];
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => unknown;
} {
  const {
    data: tenants = [],
    isLoading,
    isSuccess,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.organization.key('tenants'),
    queryFn: getTenants,
    enabled,
  });
  return { tenants, isLoading, isSuccess, isError, refetch };
}
