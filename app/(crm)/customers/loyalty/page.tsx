import { redirect } from 'next/navigation';

/** Loyalty moved to a tab of Promotions; an open programme keeps its `?programme=`. */
export default async function CustomersLoyaltyRedirect({ searchParams }: { searchParams: Promise<{ programme?: string | string[] }> }) {
  const { programme } = await searchParams;
  const id = Array.isArray(programme) ? programme[0] : programme;
  redirect(id ? `/promotions/loyalty?programme=${encodeURIComponent(id)}` : '/promotions/loyalty');
}
