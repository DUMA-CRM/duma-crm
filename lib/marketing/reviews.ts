/**
 * Customer reviews for the marketing site.
 *
 * REVIEWS holds real ones only — words a real customer wrote and agreed to
 * have published, with their real name and business. Publishing an invented
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
  name: string;
  /** Their role and business, e.g. "Owner, Bridge Street Café". */
  business: string;
  /** Where the review was left. 'google' shows "on [G]" — only for a review that really is on Google. */
  source?: 'google';
};

export const REVIEWS: readonly Review[] = [];

export const SAMPLE_REVIEWS: readonly Review[] = [
  { quote: 'Our till, rota and stock finally live in one place.', name: 'Sample review', business: 'Replace with a real customer', source: 'google' },
  { quote: 'I stopped paying for four separate apps.', name: 'Sample review', business: 'Replace with a real customer', source: 'google' },
  { quote: 'The till kept selling when our Wi-Fi went down.', name: 'Sample review', business: 'Replace with a real customer', source: 'google' },
];

/** What the review row may show in this build: real reviews, or samples on a dev server only. */
export function reviewsToShow(): readonly Review[] {
  if (REVIEWS.length > 0) return REVIEWS;
  return process.env.NODE_ENV === 'development' ? SAMPLE_REVIEWS : [];
}
