'use client';

import { useQuery } from '@tanstack/react-query';

import type { AnalyticsRangeParams } from '@/lib/modules/analytics/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

import type { ReportFilterState } from './useReportFilters';

/**
 * One report source, read for the chosen range and — when comparison is on —
 * for the comparison range, under keys that name the source, the window and
 * the site. Every report fetches through this, so a figure on the overview and
 * the same figure in its report are one cached request, not two.
 */
export function useRangeQuery<T>(
  source: string,
  fetcher: (params: AnalyticsRangeParams) => Promise<T>,
  filters: ReportFilterState,
  { compare = true, enabled = true }: { compare?: boolean; enabled?: boolean } = {},
) {
  const current = filters.params(filters.range);
  const previousRange = compare ? filters.previous : null;
  const previous = previousRange ? filters.params(previousRange) : null;

  const now = useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', source, current.from, current.to, current.locationId ?? 'all'),
    queryFn: () => fetcher(current),
    staleTime: 60_000,
    enabled,
  });
  const then = useQuery({
    queryKey: moduleQueryKeys.analytics.key('report', source, previous?.from, previous?.to, previous?.locationId ?? 'all'),
    queryFn: () => fetcher(previous!),
    staleTime: 60_000,
    enabled: enabled && previous !== null,
  });

  return {
    data: now.data,
    previous: previous ? then.data : undefined,
    isPending: now.isPending,
    isError: now.isError,
    /** The comparison failed: the report still renders, without change pills. */
    previousFailed: then.isError,
    refetch: () => {
      void now.refetch();
      if (previous) void then.refetch();
    },
  };
}
