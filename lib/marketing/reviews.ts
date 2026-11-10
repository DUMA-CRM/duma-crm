/**
 * Customer reviews for the marketing site.
 *
 * REVIEWS holds real ones only — words a real customer wrote, copied exactly,
 * with their name and business when they gave one. Publishing an invented
 * review is an offence in the UK (Digital Markets, Competition and Consumers
 * Act 2024, Schedule 20), and Google treats fake review markup as spam, so
 * nothing else may go in it. Add an entry here and the hero's review row
 * appears in production; leave it empty and the row renders nothing there.
 *
 * SAMPLE_REVIEWS exist only so the row can be seen and styled on a local dev
 * server. They are labelled as samples, and production never renders them.
 */

export type Review = {
  quote: string;
  /** Left out when the reviewer is anonymous. */
  name?: string;
  /** Their role and business, e.g. "Owner, Bridge Street Café". */
  business?: string;
  /** Where the review was left. 'google' shows "on [G]" — only for a review that really is on Google. */
  source?: 'google';
  /** The stars they actually gave. No rating, no stars. */
  rating?: 1 | 2 | 3 | 4 | 5;
};

// Google reviews, word for word — don't tidy their wording.
export const REVIEWS: readonly Review[] = [
  { quote: 'We saved so much money switching to DUMA since it replaces five separate apps for zero cost', source: 'google', rating: 5 },
  { quote: 'An incredibly robust, truly free all-in-one business software', source: 'google', rating: 5 },
  { quote: 'Amazing customer service', source: 'google', rating: 5 },
  { quote: 'Love how seamlessly it integrates our till and inventory tracking', source: 'google', rating: 5 },
  { quote: 'The offline mode is a lifesaver for our café', source: 'google', rating: 5 },
  {
    quote: 'DUMA has completely simplified our daily operations by bringing our EPOS, stock, and staff rotas into one single dashboard',
    source: 'google',
    rating: 5,
  },
];

export const SAMPLE_REVIEWS: readonly Review[] = [
  { quote: 'Our till, rota and stock finally live in one place.', name: 'Sample review', business: 'Replace with a real customer', source: 'google', rating: 5 },
  { quote: 'I stopped paying for four separate apps.', name: 'Sample review', business: 'Replace with a real customer', source: 'google', rating: 5 },
  { quote: 'The till kept selling when our Wi-Fi went down.', name: 'Sample review', business: 'Replace with a real customer', source: 'google', rating: 5 },
];

/** What the review row may show in this build: real reviews, or samples on a dev server only. */
export function reviewsToShow(): readonly Review[] {
  if (REVIEWS.length > 0) return REVIEWS;
  return process.env.NODE_ENV === 'development' ? SAMPLE_REVIEWS : [];
}
