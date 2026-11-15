// ---------------------------------------------------------------------------
// The customer list's quick views — All, Can be emailed, Birthdays this month,
// Not seen in 60 days — as Shopify's saved-view tabs: each is a count and a
// one-click filter. Which tab is lit is worked out from the filters, so a view
// reached any other way (the Filters popover, a shared link) lights it too.
// ---------------------------------------------------------------------------
import type { CustomerFilters } from '@/types/customers';

export type QuickViewKey = 'all' | 'emailable' | 'birthdays' | 'lapsed';

export const QUICK_VIEW_KEYS: QuickViewKey[] = ['all', 'emailable', 'birthdays', 'lapsed'];

/** What a view filters on; `month` is this month at the business, 1–12. */
export function quickViewFilters(key: QuickViewKey, month: number): CustomerFilters {
  if (key === 'emailable') return { marketing: 'opted_in' };
  if (key === 'birthdays') return { birthdayMonth: month };
  if (key === 'lapsed') return { lapsedDays: 60 };
  return {};
}

/** Search and sort narrow or order a view; they don't make it a different one. */
const NOT_A_VIEW: (keyof CustomerFilters)[] = ['search', 'sort', 'direction'];

const narrowing = (filters: CustomerFilters) =>
  Object.fromEntries(
    Object.entries(filters).filter(
      ([key, value]) =>
        !NOT_A_VIEW.includes(key as keyof CustomerFilters) &&
        value !== undefined &&
        value !== false &&
        !(Array.isArray(value) && value.length === 0),
    ),
  );

/** The view these filters are exactly, or null when they are something else. */
export function activeQuickView(filters: CustomerFilters, month: number): QuickViewKey | null {
  const current = narrowing(filters);
  return (
    QUICK_VIEW_KEYS.find((key) => {
      const view = quickViewFilters(key, month) as Record<string, unknown>;
      const keys = Object.keys(current);
      return keys.length === Object.keys(view).length && keys.every((name) => current[name] === view[name]);
    }) ?? null
  );
}
