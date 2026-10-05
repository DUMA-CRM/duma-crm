'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { hasCapability } from '@/lib/auth/capabilities';
import { getPayrollSchedule } from '@/lib/modules/payroll/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { formatMoney } from '@/lib/utils/payroll-totals';
import { useAuthStore } from '@/stores/authStore';

/** The workspace's payroll settings — schedule, country and (read-only) currency. */
export function usePayrollSettings(enabled = true) {
  return useQuery({ queryKey: moduleQueryKeys.payroll.key('payroll-schedule'), queryFn: getPayrollSchedule, enabled });
}

/**
 * Money in the workspace's currency. Falls back to GBP only while the settings
 * are loading, or for a reader without `hr.payroll:read` — the one currency
 * every run before multi-country payroll used.
 */
export function useMoney(enabled = true) {
  const { data } = usePayrollSettings(enabled);
  const currency = data?.currency ?? 'GBP';
  return useCallback((amount: string | number | null | undefined) => formatMoney(amount, currency), [currency]);
}

/**
 * The workspace's payroll country and currency for screens outside payroll —
 * the employee record, its drawers. Reads the settings only with
 * `hr.payroll:read`; without it, the pre-country defaults (UK, GBP).
 */
export function usePayrollLocale() {
  const canRead = hasCapability(useAuthStore((state) => state.capabilities), 'hr.payroll:read');
  const { data } = usePayrollSettings(canRead);
  const country = data?.payrollCountry ?? null;
  return { country, uk: !country || country === 'GB', currency: data?.currency ?? 'GBP' };
}
