'use client';

import { createContext, useContext } from 'react';

import { useWorkspaceStore } from '@/stores/workspaceStore';

export const SettingsScope = createContext<{ tenantId: string; connectorsPath: string } | null>(null);
export function useSettingsScope() {
  return useContext(SettingsScope);
}
export function useSettingsTenantId() {
  const scope = useSettingsScope();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  return scope?.tenantId ?? tenantId;
}
