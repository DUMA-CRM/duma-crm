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
