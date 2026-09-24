/**
 * Cursor pagination — the types and the hook shape, ahead of the API.
 *
 * [[Pagination and Caching]]: every list in the platform is offset-paginated
 * and there are no cursors. `OFFSET n` makes PostgreSQL walk and discard n rows
 * before returning any, so page 500 costs five hundred pages of work, and a row
 * inserted between two requests shifts every later page by one — the classic
 * duplicate-and-skip that makes an infinite scroll lose records.
 *
 * Neither matters at today's list sizes, which is why the roadmap puts this in
 * tier 4 and not tier 1. This file is groundwork, not a migration: NOTHING here
 * is wired up yet, and no list has changed behaviour.
 *
 * ── Why it is worth writing now ────────────────────────────────────────────
 * The hard prerequisite is already satisfied. A cursor needs a total order — a
 * sort that can never tie, or the cursor cannot say "after this row" without
 * ambiguity — and `customer-filters.ts` in duma-api already appends a unique
 * tiebreaker to every sort. So the change, when a list finally needs it, is
 * smaller than it looks, and the shape below is what it will need. Writing the
 * types down now also stops the next list from being built in a way that
 * forecloses it.
 *
 * ── What the API has to add ────────────────────────────────────────────────
 *  1. accept `?cursor=<opaque>&limit=n` alongside `?page`, not instead of it —
 *     the two must coexist while screens migrate one at a time;
 *  2. return `nextCursor` (and `prevCursor` where a list is walked backwards),
 *     `null` when there are no more rows;
 *  3. encode the cursor from the sort key AND the tiebreaker — `(created_at,
 *     id)` for orders — because `created_at` alone ties and skips rows;
 *  4. keep `total` optional. Counting all matching rows is the other expensive
 *     half of offset pagination, and cursor pagination usually drops it. A
 *     screen that needs "page 7 of 200" is asking for offsets and should keep
 *     them; infinite scroll never needs the count.
 *
 * The cursor is opaque BY CONTRACT: base64 of a server-side payload. If the UI
 * ever decodes one, the API can never change its shape, and a client that
 * builds its own cursor from a row it happens to hold will silently break the
 * moment the sort changes. Treat it as a token.
 */

/** What every cursor-paginated endpoint returns. */
export interface CursorPage<T> {
  readonly data: readonly T[];
  /** Opaque. Pass back verbatim as `cursor`. `null` when this is the last page. */
  readonly nextCursor: string | null;
  /** Present only on endpoints that support walking backwards. */
  readonly prevCursor?: string | null;
  /**
   * Total matching rows, when the endpoint still counts them.
   *
   * Optional on purpose: `count(*)` over a filtered set is the other expensive
   * half of offset pagination, and a screen that does not display a total
   * should not pay for one.
   */
  readonly total?: number;
}

/** Query parameters for a cursor-paginated request. */
export interface CursorParams {
  /** Omit for the first page. Always a value the API returned. */
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

/** The shape the current, offset-paginated lists return. Unchanged. */
export interface OffsetPage<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}

/**
 * Serialise cursor params into a query string fragment.
 *
 * Encoded, because a cursor is base64 and base64 contains `+` and `=`, both of
 * which change meaning in a query string. Concatenating one by hand works right
 * up until a cursor happens to contain a `+`, at which point the API receives a
 * space and returns page one — an intermittent "the list keeps jumping back to
 * the top" that is unpleasant to track down.
 */
export function cursorQuery(params: CursorParams): string {
  const qs = new URLSearchParams();
  if (params.cursor !== undefined && params.cursor !== '') qs.set('cursor', params.cursor);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  return qs.toString();
}

/**
 * `getNextPageParam` for TanStack Query's `useInfiniteQuery`.
 *
 * Returns `undefined`, not `null`, when there is no next page — TanStack reads
 * `undefined` as "no more pages" and treats `null` as a real page parameter,
 * so returning the API's `null` straight through would fetch one extra page
 * with `cursor=null` for ever.
 *
 *   useInfiniteQuery({
 *     queryKey: moduleQueryKeys.ordering.key('orders', filters),
 *     queryFn: ({ pageParam }) => getOrdersPage({ ...filters, cursor: pageParam }),
 *     initialPageParam: undefined as string | undefined,
 *     getNextPageParam: nextPageParam,
 *   })
 */
export function nextPageParam<T>(page: CursorPage<T>): string | undefined {
  return page.nextCursor ?? undefined;
}

/** Flatten the pages TanStack accumulates into one list. */
export function flattenPages<T>(pages: readonly CursorPage<T>[]): T[] {
  return pages.flatMap((page) => [...page.data]);
}

/**
 * True when an offset-paginated list has grown far enough that offsets are
 * costing real time.
 *
 * A number to point at rather than an argument to have. `OFFSET` cost is
 * linear in the offset, and 50 pages is roughly where the walk-and-discard
 * starts to show on a list query that is otherwise indexed. Use it in a
 * development warning or a dashboard, not to switch behaviour at runtime.
 */
export function offsetsAreGettingExpensive(page: OffsetPage<unknown>): boolean {
  return page.page > 50;
}
