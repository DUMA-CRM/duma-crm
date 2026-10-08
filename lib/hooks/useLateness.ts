'use client';

import { useQuery } from '@tanstack/react-query';

import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type Lateness, latenessFor } from '@/lib/utils/kitchen-age';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * When this workspace calls an order nearly late and late — its own setting
 * (Settings → Configuration → Orders), else the default for what it sells.
 * `null`: lateness is off, so nothing is flagged. Shares the sidebar's module
 * query, so it costs no request.
 */
export function useLateness(): Lateness | null {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const { vocabulary } = useCatalogWords();
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
  const ordering = modules.data?.modules.find((state) => state.moduleId === 'ordering');
  return latenessFor(ordering?.configuration, vocabulary);
}
