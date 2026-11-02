/**
 * Shapes shared by the /solutions pages (cafés, shops, any business), so each
 * page is words in its own lib/marketing/<page>.ts and the layout lives once in
 * components/marketing/solution.tsx.
 */

export type ListItem = { title: string; body: string };

/** How one way of working covers a job: fully, partly (with a note), or not at all. */
export type CoverMark = 'yes' | 'part' | 'no';

/**
 * One column of a "three ways to run it" comparison. The other columns are
 * categories, not named products, so every mark is a fair generalisation —
 * and the last column is always DUMA.
 */
export type ComparisonOption = {
  title: string;
  summary: string;
  bestFor: string;
  rows: readonly { job: string; mark: CoverMark; note?: string }[];
};

/**
 * One descriptive anchor per audience page, for the "Related" blocks and the
 * home page, so every page links to a neighbour in the same words. Each says
 * what the page is about — the anchor is the label a search engine reads.
 */
export const AUDIENCE_LINKS = {
  cafes: { path: '/solutions/cafes', label: 'Café and restaurant software, with recipe margin and rotas' },
  bars: { path: '/solutions/bars', label: 'Bar and pub software, with table bookings and cash-up' },
  bakeries: { path: '/solutions/bakeries', label: 'Bakery software, with recipe costing and waste tracking' },
  shops: { path: '/solutions/shops', label: 'Stock by size and colour for clothing shops and online stores' },
  retail: { path: '/solutions/retail', label: 'Retail stock control, with stocktakes in every shop' },
  blogs: { path: '/solutions/blogs', label: 'A headless content system for blogs and creators' },
  anyBusiness: { path: '/solutions/any-business', label: 'Forms, team notes and an API, each on its own' },
} as const satisfies Record<string, { path: `/solutions/${string}`; label: string }>;
