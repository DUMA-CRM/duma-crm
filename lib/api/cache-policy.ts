/**
 * Client cache policy, derived from what the API already says.
 *
 * Every analytics endpoint in duma-api sends `Cache-Control: private,
 * max-age=N[, stale-while-revalidate=M]`, chosen per endpoint. As of the
 * caching work in duma-api the *server* also caches those responses in Redis
 * for the same N (`src/lib/cache.ts`, `TTL.*`). So there were three places
 * expressing an opinion about how stale each figure may be — the header, the
 * server cache, and whatever `staleTime` each `useQuery` happened to inherit
 * from the 60s default in QueryProvider — and they did not agree.
 *
 * They now all come from the same numbers. The practical effect of a mismatch
 * was: React Query treating a 30-minute baseline as stale after 60s and
 * refetching it 30 times more often than the data can change, and conversely
 * a 30s labour figure held for 60s on screen, so the number a manager reads
 * during a rush could be twice as old as the API is prepared to serve.
 *
 * ── Keeping these in step ──────────────────────────────────────────────────
 * The source of truth is duma-api `src/lib/cache.ts` (`TTL`) and the
 * `cacheControl(n, m)` argument on each route. If one changes, change the
 * matching line here. There is no contract test for these numbers — the
 * OpenAPI spec does not describe cache headers — so it is a comment and a
 * grep, honestly labelled as such.
 *
 * See [[Pagination and Caching]] and [[Performance and Caching Roadmap]] 3.3.
 */

/** Seconds, exactly as the API's `cacheControl(maxAge, staleWhileRevalidate)`. */
const SERVER_POLICY = {
  /** GET /v1/analytics/orders — cacheControl(60, 30) */
  orders: { maxAge: 60, staleWhileRevalidate: 30 },
  /** GET /v1/analytics/top-items — cacheControl(120, 30) */
  topItems: { maxAge: 120, staleWhileRevalidate: 30 },
  /** GET /v1/analytics/stock/movements — cacheControl(60, 15) */
  stockMovements: { maxAge: 60, staleWhileRevalidate: 15 },
  /** GET /v1/analytics/stock/summary — cacheControl(300, 60) */
  stockSummary: { maxAge: 300, staleWhileRevalidate: 60 },
  /** GET /v1/analytics/inventory-forecast — cacheControl(300, 60) */
  inventoryForecast: { maxAge: 300, staleWhileRevalidate: 60 },
  /** GET /v1/analytics/revenue-by-location — cacheControl(120, 30) */
  revenueByLocation: { maxAge: 120, staleWhileRevalidate: 30 },
  /** GET /v1/analytics/hourly-volume — cacheControl(300, 60) */
  hourlyVolume: { maxAge: 300, staleWhileRevalidate: 60 },
  /** GET /v1/analytics/staff-hours — cacheControl(120, 30) */
  staffHours: { maxAge: 120, staleWhileRevalidate: 30 },
  /** GET /v1/analytics/customer-retention — cacheControl(300, 60) */
  customerRetention: { maxAge: 300, staleWhileRevalidate: 60 },
  /** GET /v1/analytics/baseline — cacheControl(1800, 300). Eight weeks of history. */
  baseline: { maxAge: 1800, staleWhileRevalidate: 300 },
  /** GET /v1/analytics/labour — cacheControl(30, 15). The most live of these. */
  labour: { maxAge: 30, staleWhileRevalidate: 15 },
  /** GET /v1/staff/:userId/performance — cacheControl(60, 30) */
  staffPerformance: { maxAge: 60, staleWhileRevalidate: 30 },
  /** GET /v1/scheduled-shifts/... — cacheControl(300, 60) */
  scheduledShifts: { maxAge: 300, staleWhileRevalidate: 60 },
} as const satisfies Record<string, { maxAge: number; staleWhileRevalidate: number }>;

export type ServerCachedEndpoint = keyof typeof SERVER_POLICY;

/**
 * `staleTime` and `gcTime` for a query that reads a server-cached endpoint.
 *
 * Spread it into the `useQuery` options:
 *
 *   useQuery({ queryKey, queryFn, ...serverCache('baseline') })
 *
 * `staleTime` is the API's `max-age`: refetching sooner cannot produce a newer
 * answer, because both the browser cache and the server cache would serve the
 * same bytes. `gcTime` keeps the data available for `max-age +
 * stale-while-revalidate` after the last observer unmounts, which mirrors the
 * header's own intent — show what we have, refresh behind it — and is what
 * makes moving between two report tabs feel instant instead of re-fetching.
 *
 * It deliberately does NOT set `refetchInterval`. Polling is about how live a
 * screen needs to feel, which is a per-screen product decision; this is about
 * how stale a response is allowed to be, which the API already decided. The
 * dashboard's 60s poll on top of a 30s labour staleTime is correct and
 * intentional.
 */
export function serverCache(endpoint: ServerCachedEndpoint): { staleTime: number; gcTime: number } {
  const policy = SERVER_POLICY[endpoint];
  return {
    staleTime: policy.maxAge * 1000,
    gcTime: (policy.maxAge + policy.staleWhileRevalidate) * 1000,
  };
}

/** Exposed for tests and for anything that needs the raw seconds. */
export const serverCachePolicy = SERVER_POLICY;
