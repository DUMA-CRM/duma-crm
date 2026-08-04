import { redirect } from 'next/navigation';

/** Restock demand is a tab on /inventory now — keep old links and bookmarks working. */
export default function RestockRequestsRedirect() {
  redirect('/inventory?tab=demand');
}
