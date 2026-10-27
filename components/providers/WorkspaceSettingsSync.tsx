'use client';

import { useEffect } from 'react';

import { registerAnalyticsContext } from '@/lib/analytics/client';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { parseBrand } from '@/lib/utils/brand';
import { type AccountKind, analyticsContext } from '@/lib/utils/workspace-context';
import { setWorkspaceTimeZone } from '@/lib/utils/workspace-time';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

/**
 * Puts this tab's context into effect: the workspace's timezone and brand
 * colour, and the context analytics events carry.
 *
 * Only from an answer that describes the tab's current context
 * (useWorkspaceContext drops late ones), so a slow response for A can never
 * repaint B. DUMA Admin reads time in the browser's zone and wears the default
 * colour. A brand saved in Settings arrives through the same query.
 *
 * The zone is set during render, not in an effect: this sits above every page
 * in the CRM layout, so it is in place before any of them formats a time. It is
 * browser-only (see lib/utils/workspace-time.ts).
 */
export function WorkspaceSettingsSync({ account }: { account: AccountKind }) {
  const { context, partition, workspace, data } = useWorkspaceContext();

  if (typeof window !== 'undefined') setWorkspaceTimeZone(workspace?.timezone ?? null);

  const setBrandFor = useUiSettingsStore((state) => state.setBrandFor);
  const setBrand = useUiSettingsStore((state) => state.setBrand);
  const brand = workspace?.brand ?? null;
  useEffect(() => {
    if (context.kind !== 'workspace' || !brand) return;
    setBrandFor(partition, parseBrand(brand));
    setBrand(parseBrand(brand));
  }, [brand, context.kind, partition, setBrand, setBrandFor]);

  const classification = workspace?.classification ?? null;
  useEffect(() => {
    if (!data) return;
    registerAnalyticsContext(analyticsContext(account, context, classification));
  }, [account, classification, context, data]);

  return null;
}
