'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getTradingSettings } from '@/lib/api/operations.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { getOrderAnalytics } from '@/lib/modules/analytics/client';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type ReportContext, channelCount } from '@/lib/reports/relevance';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { useRangeQuery } from './useRangeQuery';
import type { ReportFilterState } from './useReportFilters';

/**
 * What decides which reports apply here (see `lib/reports/relevance.ts`).
 * Every query is one the app already makes — the sidebar's modules, Settings'
 * trading settings, the overview's sales — so this adds no requests.
 */
export function useReportContext(filters: ReportFilterState): ReportContext {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const { tools } = useCatalogWords();

  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
  const trading = useQuery({
    queryKey: moduleQueryKeys.organization.key('trading', tenantId),
    queryFn: () => getTradingSettings(tenantId!),
    enabled: Boolean(tenantId) && hasCapability(capabilities, 'settings:read'),
  });
  // The overview's own query (same key), for the channels actually sold through in the period.
  const readsSales = hasCapability(capabilities, 'analytics:read');
  const sales = useRangeQuery('orders', getOrderAnalytics, filters, { enabled: readsSales });

  const enabled = useMemo(
    () =>
      modules.data ? new Set(modules.data.modules.filter((state) => state.status === 'enabled').map((state) => state.moduleId)) : null,
    [modules.data],
  );

  return {
    modules: enabled,
    // Unknown counts as several, so nothing hides while the list loads.
    locationCount: filters.locationsLoaded ? filters.locations.length : Number.POSITIVE_INFINITY,
    kitchen: tools.kitchen,
    vatRegistered: trading.data?.vatRegistered,
    // Unknown until both are in: an online shop's channels show only in what it sold.
    channels:
      enabled && (sales.data || !readsSales)
        ? channelCount(
            enabled,
            (sales.data?.bySource ?? []).map((row) => row.source),
          )
        : Number.POSITIVE_INFINITY,
  };
}
