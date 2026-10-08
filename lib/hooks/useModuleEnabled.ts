'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import type { ModuleId } from '@/lib/modules/manifest';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Whether a module is switched on for this workspace — `true` only once that
 * is known. Shares the sidebar's module query, so it costs no extra request.
 *
 * A capability is not enough on its own: the API refuses a disabled module's
 * routes (`requireEnabledModule`, 403 `module_disabled`) even for a role that
 * holds the capability. Gate the query itself on this, not just the UI around
 * it, or the request still goes out and the screen reports a permission error.
 */
export function useModuleEnabled(moduleId: ModuleId): boolean {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const query = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
  return query.data?.modules.some((state) => state.moduleId === moduleId && state.status === 'enabled') ?? false;
}
