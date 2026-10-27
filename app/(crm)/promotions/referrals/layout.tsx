import { redirect } from 'next/navigation';

import { requireCapability } from '@/lib/auth/require-capability';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

/**
 * Refer a friend is its own module, on top of promotions (whose layout wraps
 * this one): a workspace without it is sent to the module settings.
 */
export default async function ReferralsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('referrals:read');

  // null for a platform administrator: the tab's workspace decides (ContextBoundary).
  const enabled = await workspaceModuleEnabled('referrals');
  if (enabled === false) redirect('/settings/modules');

  return children;
}
