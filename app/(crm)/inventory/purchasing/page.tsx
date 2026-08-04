import { redirect } from 'next/navigation';

/** Purchasing is a tab on /inventory now — keep old links and bookmarks working. */
export default function PurchasingRedirect() {
  redirect('/inventory?tab=demand');
}
