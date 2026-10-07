'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { catalogVocabulary, catalogWords } from '@/lib/utils/catalog-vocabulary';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The catalogue's words for this workspace — Products for a shop, Menu for a
 * café. Shares the sidebar's module query, so it costs no extra request, and
 * says Menu until it knows otherwise.
 */
export function useCatalogWords() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const query = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
  const vocabulary = catalogVocabulary(query.data?.modules ?? []);
  return { vocabulary, ...catalogWords(vocabulary) };
}
