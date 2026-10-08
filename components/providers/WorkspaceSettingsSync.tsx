'use client';

import { useEffect } from 'react';

import { parseBrand } from '@/lib/utils/brand';
import { setWorkspaceTimeZone } from '@/lib/utils/workspace-time';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

/**
 * Puts the workspace's timezone and brand colour, read with the staff profile
 * on the server, into effect for this browser.
 *
 * The zone is set during render, not in an effect: this sits above every page
 * in the CRM layout, so it is in place before any of them formats a time. It is
 * browser-only (see lib/utils/workspace-time.ts).
 *
 * The brand is written to uiSettingsStore, which BrandSync paints and which the
 * pre-paint script reads on the next load — the device's copy is now only a
 * cache of the workspace's choice, so the colour does not flash.
 */
export function WorkspaceSettingsSync({ timezone, brand }: { timezone: string | null; brand: string | null }) {
  if (typeof window !== 'undefined') setWorkspaceTimeZone(timezone);

  const setBrand = useUiSettingsStore((state) => state.setBrand);
  useEffect(() => {
    if (brand) setBrand(parseBrand(brand));
  }, [brand, setBrand]);

  return null;
}
