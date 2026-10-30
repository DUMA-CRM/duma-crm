'use client';

import { createContext, useContext } from 'react';

import { useWorkspaceStore } from '@/stores/workspaceStore';

export const ContentScope = createContext<{ tenantId: string; basePath: string; storagePath: string } | null>(null);

export function useCmsTenantId() {
  const scope = useContext(ContentScope);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  return scope?.tenantId ?? tenantId;
}

export function useContentPaths() {
  return (
    useContext(ContentScope) ?? {
      basePath: '/content',
      storagePath: '/settings/connectors?connector=media-storage',
    }
  );
}
