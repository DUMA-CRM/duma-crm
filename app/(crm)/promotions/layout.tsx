import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { requireCapability } from '@/lib/auth/require-capability';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';

/**
 * Promotions is a switchable module: a workspace that has not enabled it is
 * sent to the module settings rather than shown a page whose every call returns 403.
 */
export default async function PromotionsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('promotions:read');

  const cookieHeader = (await cookies())
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const modules = await getCurrentTenantModules(undefined, cookieHeader);
  const enabled = modules.modules.some((module) => module.moduleId === 'promotions' && module.status === 'enabled');
  if (!enabled) redirect('/settings/modules');

  return children;
}
