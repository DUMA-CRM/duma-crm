'use client';

import { useQuery } from '@tanstack/react-query';

import { type VatContext, vatContextFrom } from '@/lib/menu/costing';
import { getTradingSettings } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The tenant's tax posture, for anything that shows a margin.
 *
 * Shares the ['trading', tenantId] cache key with the POS and the trading
 * settings screen, so the whole app reads one copy of these settings rather
 * than each screen fetching its own and briefly disagreeing.
 *
 * While loading, `ctx` is the safe default (not VAT registered), which deducts
 * nothing — a margin may therefore tick down once settings arrive, but it never
 * invents a VAT charge that turns out not to apply.
 */
export function useVatContext(): { ctx: VatContext; isLoading: boolean } {
  const { tenantId } = useWorkspaceStore();

  const { data, isLoading } = useQuery({
    queryKey: moduleQueryKeys.organization.key('trading', tenantId),
    queryFn: () => getTradingSettings(tenantId!),
    enabled: !!tenantId,
    // Tax posture changes about once a year; refetching it per mount is waste.
    staleTime: 5 * 60 * 1000,
  });

  return { ctx: vatContextFrom(data), isLoading };
}
