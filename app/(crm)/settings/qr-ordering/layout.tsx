import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { requireAnyCapability } from '@/lib/auth/require-capability';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';

export default async function QrOrderingLayout({ children }: { children: React.ReactNode }) {
  await requireAnyCapability('qr-ordering:read', 'qr-ordering:write');

  const cookieHeader = (await cookies())
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const modules = await getCurrentTenantModules(undefined, cookieHeader);
  const qrOrderingEnabled = modules.modules.some((module) => module.moduleId === 'qr-ordering' && module.status === 'enabled');
  if (!qrOrderingEnabled) redirect('/settings/modules');

  return children;
}
