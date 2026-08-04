import { redirect } from 'next/navigation';

/** Stocktakes is a tab on /inventory now — keep old links and bookmarks working. */
export default function StocktakesRedirect() {
  redirect('/inventory?tab=stocktakes');
}
