import { redirect } from 'next/navigation';

import { requireAnyCapability } from '@/lib/auth/require-capability';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

export default async function QrOrderingLayout({ children }: { children: React.ReactNode }) {
  await requireAnyCapability('qr-ordering:read', 'qr-ordering:write');

  // null for a platform administrator: the tab's workspace decides (ContextBoundary).
  const qrOrderingEnabled = await workspaceModuleEnabled('qr-ordering');
  if (qrOrderingEnabled === false) redirect('/settings/modules');

  return children;
}
