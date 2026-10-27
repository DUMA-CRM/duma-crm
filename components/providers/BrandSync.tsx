'use client';

import { useEffect } from 'react';

import { DEFAULT_BRAND } from '@/lib/utils/brand';
import { brandForContext, contextPartition } from '@/lib/utils/workspace-context';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Keeps <html data-brand> on this tab's context's colour: its workspace's
 * cached brand, or DUMA's default in DUMA Admin and before a context exists.
 * First paint is the pre-paint script's job (app/layout.tsx); this follows
 * switches and saves after that.
 *
 * Another tab saving a colour updates the shared cache, so this tab picks up a
 * change to *its* workspace — and ignores colours for workspaces it is not in.
 */
export function BrandSync() {
  const context = useWorkspaceStore((state) => state.context);
  const partition = useWorkspaceStore((state) => contextPartition(state.accountId, state.context));
  const brands = useUiSettingsStore((state) => state.brands);
  const last = useUiSettingsStore((state) => state.brand);
  // No context yet (a public page, a tab still loading): the device's last colour.
  const active = context.kind === 'unresolved' ? last : brandForContext(brands, partition, context, DEFAULT_BRAND);

  useEffect(() => {
    document.documentElement.dataset.brand = active;
  }, [active]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === useUiSettingsStore.persist.getOptions().name) void useUiSettingsStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}
