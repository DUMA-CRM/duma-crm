import { redirect } from 'next/navigation';

import { requireCapability } from '@/lib/auth/require-capability';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

/**
 * Reservations is a switchable module: a workspace that has not enabled it is
 * sent to the module settings rather than shown a page whose every call returns 403.
 */
export default async function ReservationsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('reservations:read');

  // null for a platform administrator: the tab's workspace decides (ContextBoundary).
  const enabled = await workspaceModuleEnabled('reservations');
  if (enabled === false) redirect('/settings/modules');

  return children;
}
