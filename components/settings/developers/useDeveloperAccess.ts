'use client';

import { useQuery } from '@tanstack/react-query';

import { hasCapability } from '@/lib/auth/capabilities';
import { type WorkspaceModuleId, getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * What this viewer may do in Settings → Developers. The page itself needs
 * `settings:write` or `cms.keys:write`; each part then follows the capability
 * the API checks for it. Hiding a control is a courtesy — the API is the boundary.
 */
export function useDeveloperAccess() {
  const capabilities = useAuthStore((state) => state.capabilities);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // The same query the settings shell runs, so this is a cache hit.
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    staleTime: 30_000,
  });
  const enabled = (moduleId: WorkspaceModuleId) =>
    modules.data?.modules.some((module) => module.moduleId === moduleId && module.status === 'enabled') ?? false;
  const contentOn = enabled('cms');

  return {
    capabilities,
    /** Store scopes, and keys holding them — `settings:write`. */
    canManageStore: hasCapability(capabilities, 'settings:write'),
    /** Content scopes, webhooks and legacy content keys — `cms.keys:write`, with Content switched on. */
    canManageContent: contentOn && hasCapability(capabilities, 'cms.keys:write'),
    /** The reference reads this workspace's models and languages. */
    canReadContent: contentOn && hasCapability(capabilities, 'cms:read'),
    contentOn,
  };
}

export type DeveloperAccess = ReturnType<typeof useDeveloperAccess>;
