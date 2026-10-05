'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { getLocations } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type DateRange,
  type ReportFilters,
  apiRange,
  comparisonRange,
  rangeLabel,
  readFilters,
  resolveRange,
  writeFilters,
} from '@/lib/utils/report-filters';

/**
 * The filters, from the URL, resolved into ranges — the one source every report
 * on the page reads, so the overview, the library and an open report always
 * agree on which days and which site they mean. Changing a filter rewrites the
 * URL (replace, not push: a filter change is not a page to go back to).
 */
export function useReportFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Pinned per mount: "today" must not roll over under someone reading a report at midnight.
  const [now] = useState(() => new Date());

  const filters = useMemo(() => readFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const range = useMemo(() => resolveRange(filters, now), [filters, now]);
  const previous = useMemo(() => comparisonRange(range, filters.compare), [range, filters.compare]);

  const locations = useQuery({ queryKey: moduleQueryKeys.organization.key('locations-accessible'), queryFn: getLocations });
  const location = locations.data?.find((entry) => entry.id === filters.locationId);
  const timezone = location?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';

  const setFilters = useCallback(
    (next: Partial<ReportFilters>) => {
      const params = writeFilters({ ...filters, ...next }, new URLSearchParams(searchParams.toString()));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [filters, pathname, router, searchParams],
  );

  /** API parameters for a range, scoped to the chosen location. */
  const params = useCallback(
    (which: DateRange) => ({ ...apiRange(which), ...(filters.locationId ? { locationId: filters.locationId } : {}) }),
    [filters.locationId],
  );

  return {
    filters,
    range,
    previous,
    label: rangeLabel(filters, range),
    setFilters,
    params,
    timezone,
    locations: locations.data ?? [],
    locationName: location?.name ?? null,
    /** The query string to carry into a report link, so the filters travel with it. */
    query: writeFilters(filters).toString(),
  };
}

export type ReportFilterState = ReturnType<typeof useReportFilters>;
