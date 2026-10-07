'use client';

import { useEffect } from 'react';

import { useUiSettingsStore } from '@/stores/uiSettingsStore';

/**
 * Keeps <html data-brand> in step with the stored brand after a change in
 * Settings, or in another tab. First paint is the pre-paint script's job
 * (app/layout.tsx); this only follows changes after that.
 */
export function BrandSync() {
  const brand = useUiSettingsStore((state) => state.brand);

  useEffect(() => {
    document.documentElement.dataset.brand = brand;
  }, [brand]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === useUiSettingsStore.persist.getOptions().name) void useUiSettingsStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}
