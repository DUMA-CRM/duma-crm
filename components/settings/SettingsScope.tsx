'use client';

import { useWorkspaceStore } from '@/stores/workspaceStore';

export function useSettingsTenantId() {
  return useWorkspaceStore((state) => state.tenantId);
}
