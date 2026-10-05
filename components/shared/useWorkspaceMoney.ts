'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { hasCapability } from '@/lib/auth/capabilities';
import { getTradingSettings } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { formatMoney } from '@/lib/utils/payroll-totals';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Money in the workspace's trading currency — the one the POS charges in and
 * stock is costed in.
 * Same query key as the POS, so it's usually cached. `GET /trading-settings`
 * needs `settings:read`; without it the pre-multi-currency default (GBP)
 * stands in rather than a failed request.
 */
/** The workspace's trading currency code (GBP until the settings load or without `settings:read`). */
export function useWorkspaceCurrency() {
  const { tenantId } = useWorkspaceStore();
  const canRead = hasCapability(useAuthStore((state) => state.capabilities), 'settings:read');
  const { data } = useQuery({
    queryKey: moduleQueryKeys.organization.key('trading', tenantId),
    queryFn: () => getTradingSettings(tenantId!),
    enabled: !!tenantId && canRead,
  });
  return data?.currency ?? 'GBP';
}

export function useWorkspaceMoney() {
  const currency = useWorkspaceCurrency();
  return useCallback((amount: string | number | null | undefined) => formatMoney(amount, currency), [currency]);
}
