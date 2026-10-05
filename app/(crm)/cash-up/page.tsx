import { redirect } from 'next/navigation';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

/**
 * Cashing up moved into the till (2026-10-04): it's done standing at the
 * drawer, so it lives beside it. This route stays for links, bookmarks and the
 * agent's shortcut — it opens the till's cash-up, or the End of day history for
 * someone who can read cash-ups but not run them.
 */
export default async function Page() {
  const profile = await getCurrentStaffProfile();
  if (profile && hasCapability(profile, 'cashups:write') && hasCapability(profile, 'orders:create')) redirect('/pos?cashup=open');
  if (profile && hasCapability(profile, 'cashups:read')) redirect('/reports/end-of-day');
  redirect('/dashboard');
}
