import { redirect } from 'next/navigation';

import { hasAllCapabilities } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

/**
 * The promotions list itself — the guard that used to wrap all of /promotions.
 * Loyalty (/promotions/loyalty) is a tab here but belongs to Customers, so it
 * sits outside this group with its own guard, and Refer a friend repeats this
 * guard in its own layout.
 *
 * Someone who can't open promotions but can run loyalty lands on the Loyalty
 * tab rather than the dashboard, so the Promotions nav entry still goes
 * somewhere useful for them.
 */
export default async function PromotionsListLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentStaffProfile();
  const loyalty = profile ? hasAllCapabilities(profile, 'customers:read', 'customers:points') : false;
  if (!profile || !hasAllCapabilities(profile, 'promotions:read')) redirect(loyalty ? '/promotions/loyalty' : '/dashboard');
  if ((await workspaceModuleEnabled('promotions')) === false) redirect(loyalty ? '/promotions/loyalty' : '/settings/modules');
  return children;
}
