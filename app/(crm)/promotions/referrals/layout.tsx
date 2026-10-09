import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { requireCapability } from '@/lib/auth/require-capability';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';

/**
 * Refer a friend is its own module, on top of promotions (whose layout wraps
 * this one): a workspace without it is sent to the module settings.
 */
export default async function ReferralsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('referrals:read');

  const cookieHeader = (await cookies())
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const modules = await getCurrentTenantModules(undefined, cookieHeader);
  const enabled = modules.modules.some((module) => module.moduleId === 'referrals' && module.status === 'enabled');
  if (!enabled) redirect('/settings/modules');

  return children;
}
