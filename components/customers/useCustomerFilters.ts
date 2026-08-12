'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { CUSTOMER_SORTS, DIETARY_PREFERENCES, FSA_ALLERGENS } from '@/types/customers';
import type { Allergen, CustomerFilters, CustomerSort, DietaryPreference, SortDirection, Tier } from '@/types/customers';

/**
 * The customer list's filter state, held in the URL.
 *
 * The query string is the single source of truth rather than component state, so
 * a filtered view can be linked to a colleague, survives a refresh, and the back
 * button steps through filter changes the way a user expects. It also means the
 * page and a saved segment describe a selection in exactly the same shape.
 *
 * Keys not owned by the filters (`tab`, `page`, `segment`) are preserved on every
 * write, so changing a filter never silently drops the open tab.
 */

const TIERS = ['vip', 'gold', 'silver', 'bronze'] as const;

const isTier = (value: string | null): value is Tier => !!value && (TIERS as readonly string[]).includes(value);
const isSort = (value: string | null): value is CustomerSort =>
  !!value && (CUSTOMER_SORTS as readonly string[]).includes(value);

/** Positive integer, or undefined. Rejects junk rather than sending NaN. */
const intParam = (raw: string | null, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}): number | undefined => {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) return undefined;
  return value;
};

const numberParam = (raw: string | null, { min = 0 } = {}): number | undefined => {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) return undefined;
  return value;
};

const listParam = <T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined => {
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is T => (allowed as readonly string[]).includes(value));
  return values.length > 0 ? values : undefined;
};

/** Read the filter block out of a query string, discarding anything invalid. */
export function readFilters(params: URLSearchParams): CustomerFilters {
  const tier = params.get('tier');
  const marketing = params.get('marketing');
  const direction = params.get('direction');
  const sort = params.get('sort');

  return {
    ...(params.get('q') ? { search: params.get('q')! } : {}),
    ...(isTier(tier) ? { tier } : {}),
    ...(intParam(params.get('lapsedDays'), { max: 3650 }) !== undefined
      ? { lapsedDays: intParam(params.get('lapsedDays'), { max: 3650 })! }
      : {}),
    ...(intParam(params.get('activeWithinDays'), { max: 3650 }) !== undefined
      ? { activeWithinDays: intParam(params.get('activeWithinDays'), { max: 3650 })! }
      : {}),
    ...(params.get('neverVisited') === 'true' ? { neverVisited: true } : {}),
    ...(intParam(params.get('birthdayMonth'), { min: 1, max: 12 }) !== undefined
      ? { birthdayMonth: intParam(params.get('birthdayMonth'), { min: 1, max: 12 })! }
      : {}),
    ...(marketing === 'opted_in' || marketing === 'opted_out' ? { marketing } : {}),
    ...(numberParam(params.get('minTotalSpent')) !== undefined ? { minTotalSpent: numberParam(params.get('minTotalSpent'))! } : {}),
    ...(numberParam(params.get('maxTotalSpent')) !== undefined ? { maxTotalSpent: numberParam(params.get('maxTotalSpent'))! } : {}),
    ...(intParam(params.get('minTotalVisits'), { min: 0 }) !== undefined
      ? { minTotalVisits: intParam(params.get('minTotalVisits'), { min: 0 })! }
      : {}),
    ...(intParam(params.get('maxTotalVisits'), { min: 0 }) !== undefined
      ? { maxTotalVisits: intParam(params.get('maxTotalVisits'), { min: 0 })! }
      : {}),
    ...(listParam<Allergen>(params.get('allergies'), FSA_ALLERGENS) ? { allergies: listParam<Allergen>(params.get('allergies'), FSA_ALLERGENS)! } : {}),
    ...(listParam<DietaryPreference>(params.get('dietary'), DIETARY_PREFERENCES)
      ? { dietary: listParam<DietaryPreference>(params.get('dietary'), DIETARY_PREFERENCES)! }
      : {}),
    ...(isSort(sort) ? { sort } : {}),
    ...(direction === 'asc' || direction === 'desc' ? { direction: direction as SortDirection } : {}),
  };
}

/** Keys this hook owns. Everything else in the URL is left alone. */
const FILTER_KEYS = [
  'q',
  'tier',
  'lapsedDays',
  'activeWithinDays',
  'neverVisited',
  'birthdayMonth',
  'marketing',
  'minTotalSpent',
  'maxTotalSpent',
  'minTotalVisits',
  'maxTotalVisits',
  'allergies',
  'dietary',
  'sort',
  'direction',
] as const;

function writeFilters(params: URLSearchParams, filters: CustomerFilters) {
  for (const key of FILTER_KEYS) params.delete(key);

  if (filters.search) params.set('q', filters.search);
  if (filters.tier) params.set('tier', filters.tier);
  if (filters.lapsedDays !== undefined) params.set('lapsedDays', String(filters.lapsedDays));
  if (filters.activeWithinDays !== undefined) params.set('activeWithinDays', String(filters.activeWithinDays));
  if (filters.neverVisited) params.set('neverVisited', 'true');
  if (filters.birthdayMonth !== undefined) params.set('birthdayMonth', String(filters.birthdayMonth));
  if (filters.marketing) params.set('marketing', filters.marketing);
  if (filters.minTotalSpent !== undefined) params.set('minTotalSpent', String(filters.minTotalSpent));
  if (filters.maxTotalSpent !== undefined) params.set('maxTotalSpent', String(filters.maxTotalSpent));
  if (filters.minTotalVisits !== undefined) params.set('minTotalVisits', String(filters.minTotalVisits));
  if (filters.maxTotalVisits !== undefined) params.set('maxTotalVisits', String(filters.maxTotalVisits));
  if (filters.allergies?.length) params.set('allergies', filters.allergies.join(','));
  if (filters.dietary?.length) params.set('dietary', filters.dietary.join(','));
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.direction) params.set('direction', filters.direction);
}

export function useCustomerFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => readFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const page = intParam(searchParams.get('page')) ?? 1;
  const appliedSegmentId = searchParams.get('segment') ?? null;

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      // `replace` rather than `push`: typing in the search box would otherwise
      // stack one history entry per keystroke, making Back useless.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setFilters = useCallback(
    (next: CustomerFilters | ((current: CustomerFilters) => CustomerFilters)) => {
      commit((params) => {
        const resolved = typeof next === 'function' ? next(filters) : next;
        writeFilters(params, resolved);
        // Any filter change invalidates the current page — page 4 of the old
        // result set is rarely page 4 of the new one, and is often past the end.
        params.delete('page');
      });
    },
    [commit, filters],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      commit((params) => {
        if (nextPage <= 1) params.delete('page');
        else params.set('page', String(nextPage));
      });
    },
    [commit],
  );

  /** Apply a saved segment's filters, and remember which segment is showing. */
  const applySegment = useCallback(
    (segmentId: string | null, segmentFilters?: CustomerFilters) => {
      commit((params) => {
        params.delete('page');
        if (!segmentId) {
          params.delete('segment');
          writeFilters(params, {});
          return;
        }
        params.set('segment', segmentId);
        writeFilters(params, segmentFilters ?? {});
      });
    },
    [commit],
  );

  const clearFilters = useCallback(() => {
    commit((params) => {
      writeFilters(params, {});
      params.delete('page');
      params.delete('segment');
    });
  }, [commit]);

  /** Toggle a sort column: same column flips direction, new column starts sensibly. */
  const toggleSort = useCallback(
    (sort: CustomerSort) => {
      setFilters((current) => {
        if (current.sort === sort) {
          return { ...current, sort, direction: current.direction === 'asc' ? 'desc' : 'asc' };
        }
        // Names read A–Z; everything else is most-interesting-first.
        return { ...current, sort, direction: sort === 'name' ? 'asc' : 'desc' };
      });
    },
    [setFilters],
  );

  return { filters, page, appliedSegmentId, setFilters, setPage, clearFilters, applySegment, toggleSort };
}
