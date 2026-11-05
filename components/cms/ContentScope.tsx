'use client';

import { useWorkspaceStore } from '@/stores/workspaceStore';

// DUMA's own content lives in its internal workspace, so Content always
// follows the tab's workspace — there is no second scope to provide.
export function useCmsTenantId() {
  return useWorkspaceStore((state) => state.tenantId);
}

const CONTENT_PATHS = { basePath: '/content', storagePath: '/settings/connectors?connector=media-storage' } as const;

export function useContentPaths() {
  return CONTENT_PATHS;
}
